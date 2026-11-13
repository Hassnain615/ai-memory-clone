"""RAGService — per-user vector memory (ChromaDB) + retrieval-augmented generation.

Refactored from the original single-collection version:
  * every user gets an isolated Chroma collection
  * chunks carry doc_id / page / chunk_index metadata for precise citations
  * answers stream token-by-token and fall back to extractive answers without an LLM
"""
from __future__ import annotations

import logging
import threading
from typing import Iterator

import chromadb
import numpy as np
from chromadb.config import Settings as ChromaSettings

from config import settings
from services.document_processor import Chunk, extractive_summary
from services.embeddings import EmbeddingService
from services.llm import LLMService

log = logging.getLogger(__name__)

NO_MEMORY_REPLY = (
    "I don't have any memories about that yet. Upload notes or PDFs related to this topic "
    "and I'll be able to answer from them."
)

SYSTEM_PROMPT = """You are the user's AI Memory Clone — a personal second brain.
You answer using ONLY the user's stored memories provided in <memories>.

Rules:
- Ground every claim in the memories. Cite sources inline as [1], [2] matching the memory numbers.
- If the memories don't contain the answer, say so clearly and suggest what to upload — never invent facts.
- Be concise, warm and insightful. Use Markdown: short paragraphs, bullet lists, **bold** for key ideas.
- When useful, connect ideas across different sources and point out patterns or next steps."""


class RAGService:
    def __init__(self, embeddings: EmbeddingService | None = None, llm: LLMService | None = None):
        settings.CHROMA_PATH.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=str(settings.CHROMA_PATH),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.embeddings = embeddings or EmbeddingService()
        self.llm = llm or LLMService()
        self._collections: dict[int, object] = {}
        self._lock = threading.Lock()

    # -------------------------------------------------------------- collections
    def _collection_name(self, user_id: int) -> str:
        return f"mem_u{user_id}_{self.embeddings.signature}"

    def collection(self, user_id: int):
        col = self._collections.get(user_id)
        if col is None:
            with self._lock:
                col = self._collections.get(user_id)
                if col is None:
                    col = self.client.get_or_create_collection(
                        name=self._collection_name(user_id),
                        metadata={"hnsw:space": "cosine", "embedding_model": self.embeddings.model_name},
                    )
                    self._collections[user_id] = col
        return col

    def count(self, user_id: int) -> int:
        return self.collection(user_id).count()

    # -------------------------------------------------------------- indexing
    def index_document(self, user_id: int, doc_id: int, title: str, kind: str, chunks: list[Chunk]) -> int:
        if not chunks:
            return 0
        col = self.collection(user_id)
        self.delete_document(user_id, doc_id)  # idempotent re-index
        batch = 64
        for start in range(0, len(chunks), batch):
            part = chunks[start : start + batch]
            vectors = self.embeddings.embed_documents([c.text for c in part])
            col.add(
                ids=[f"d{doc_id}_c{c.index}" for c in part],
                documents=[c.text for c in part],
                embeddings=vectors,
                metadatas=[
                    {
                        "doc_id": doc_id,
                        "title": title,
                        "kind": kind,
                        "chunk_index": c.index,
                        "page": c.page or 0,
                    }
                    for c in part
                ],
            )
        return len(chunks)

    def delete_document(self, user_id: int, doc_id: int) -> None:
        try:
            self.collection(user_id).delete(where={"doc_id": doc_id})
        except Exception as exc:  # noqa: BLE001
            log.warning("Vector delete failed for doc %s: %s", doc_id, exc)

    def clear_user(self, user_id: int) -> None:
        with self._lock:
            self._collections.pop(user_id, None)
            try:
                self.client.delete_collection(self._collection_name(user_id))
            except Exception:  # noqa: BLE001 - collection may not exist
                pass

    def get_document_chunks(self, user_id: int, doc_id: int) -> list[dict]:
        res = self.collection(user_id).get(where={"doc_id": doc_id}, include=["documents", "metadatas"])
        items = [
            {"text": d, "chunk_index": m.get("chunk_index", 0), "page": m.get("page") or None}
            for d, m in zip(res.get("documents") or [], res.get("metadatas") or [])
        ]
        return sorted(items, key=lambda x: x["chunk_index"])

    # -------------------------------------------------------------- retrieval
    def retrieve(
        self,
        user_id: int,
        query: str,
        k: int | None = None,
        doc_ids: list[int] | None = None,
        min_score: float | None = None,
    ) -> list[dict]:
        col = self.collection(user_id)
        total = col.count()
        if total == 0 or not query.strip():
            return []
        k = k or settings.RETRIEVAL_TOP_K
        min_score = settings.RETRIEVAL_MIN_SCORE if min_score is None else min_score
        where = None
        if doc_ids:
            where = {"doc_id": doc_ids[0]} if len(doc_ids) == 1 else {"doc_id": {"$in": doc_ids}}
        res = col.query(
            query_embeddings=[self.embeddings.embed_query(query)],
            n_results=min(k, total),
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        hits = []
        for text, meta, dist in zip(docs, metas, dists):
            score = round(1.0 - float(dist), 4)
            if score < min_score:
                continue
            hits.append(
                {
                    "doc_id": meta.get("doc_id"),
                    "title": meta.get("title", "Untitled"),
                    "kind": meta.get("kind", "text"),
                    "page": meta.get("page") or None,
                    "chunk_index": meta.get("chunk_index", 0),
                    "text": text,
                    "score": score,
                }
            )
        return hits

    # -------------------------------------------------------------- generation
    @staticmethod
    def build_prompt(question: str, hits: list[dict], history: list[dict]) -> str:
        blocks = []
        for i, h in enumerate(hits, start=1):
            page = f" (page {h['page']})" if h.get("page") else ""
            blocks.append(f"[{i}] Source: {h['title']}{page}\n{h['text']}")
        memories = "\n\n".join(blocks)
        convo = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content'][:1500]}" for m in history[-8:]
        )
        return (
            f"<memories>\n{memories or 'No relevant memories found.'}\n</memories>\n\n"
            f"<conversation>\n{convo or '(new conversation)'}\n</conversation>\n\n"
            f"User question: {question}\n\nAnswer:"
        )

    def answer_stream(
        self,
        user_id: int,
        question: str,
        history: list[dict],
        doc_ids: list[int] | None = None,
    ) -> tuple[list[dict], Iterator[str], str]:
        """Returns (sources, token_iterator, mode). mode is 'llm', 'extractive' or 'empty'."""
        # Use the previous user turn to enrich short follow-up questions ("and what about that?")
        query = question
        if len(question.split()) < 6:
            prev_user = [m["content"] for m in history if m["role"] == "user"][-1:]
            if prev_user:
                query = f"{prev_user[0]} {question}"
        hits = self.retrieve(user_id, query, doc_ids=doc_ids)

        if not hits:
            return [], iter([NO_MEMORY_REPLY]), "empty"

        if not self.llm.available:
            return hits, iter([self._extractive_answer(hits)]), "extractive"

        prompt = self.build_prompt(question, hits, history)
        return hits, self.llm.stream(SYSTEM_PROMPT, prompt), "llm"

    @staticmethod
    def _extractive_answer(hits: list[dict]) -> str:
        lines = [
            "_No language model is configured, so here are the most relevant passages from your memory:_",
            "",
        ]
        for i, h in enumerate(hits[:4], start=1):
            snippet = extractive_summary(h["text"], max_sentences=2)
            where = f", p.{h['page']}" if h.get("page") else ""
            lines.append(f"- **{h['title']}{where}** [{i}] — {snippet}")
        return "\n".join(lines)

    # -------------------------------------------------------------- vectors for graph
    def document_centroids(self, user_id: int) -> dict[int, list[float]]:
        col = self.collection(user_id)
        if col.count() == 0:
            return {}
        res = col.get(include=["embeddings", "metadatas"])
        embeddings = res.get("embeddings")
        if embeddings is None or len(embeddings) == 0:
            return {}
        matrix = np.asarray(embeddings, dtype=np.float32)
        groups: dict[int, list[int]] = {}
        for i, meta in enumerate(res.get("metadatas") or []):
            did = meta.get("doc_id")
            if did is not None:
                groups.setdefault(did, []).append(i)
        return {did: matrix[idx].mean(axis=0).tolist() for did, idx in groups.items()}
