import os
import re
import json
import asyncio
from typing import Optional
import chromadb
from chromadb.config import Settings
import google.generativeai as genai

import fitz  # PyMuPDF
from collections import Counter

# NEW - hardcoded for hackathon
GEMINI_API_KEY = "AIzaSyBgSK2KrCEwtRBEvDhuE_pxGJeuYlpl3Ik"
genai.configure(api_key=GEMINI_API_KEY, transport="rest")


class RAGService:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path="./chroma_db",
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name="memories",
            metadata={"hnsw:space": "cosine"}
        )
        self.model = genai.GenerativeModel("gemini-2.5-flash-lite")
        self.embed_model = "models/gemini-embedding-001"
        self.chat_histories = {}
        self.doc_counter = self._load_counter()

    def _load_counter(self):
        try:
            count = self.collection.count()
            return count
        except:
            return 0

    def _chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
        text = re.sub(r'\s+', ' ', text.strip())
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk = ' '.join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)
            i += chunk_size - overlap
        return chunks

    def _embed(self, texts: list[str]) -> list[list[float]]:
        embeddings = []
        for text in texts:
            result = genai.embed_content(
                model=self.embed_model,
                content=text
            )
            embeddings.append(result['embedding'])
        return embeddings

    def _embed_query(self, text: str) -> list[float]:
        result = genai.embed_content(
            model=self.embed_model,
            content=text
        )
        return result['embedding']

    async def add_text(self, content: str, metadata: dict) -> dict:
        chunks = self._chunk_text(content)
        if not chunks:
            return {"chunks": 0}
        embeddings = self._embed(chunks)
        ids = []
        docs = []
        metas = []
        embs = []
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            doc_id = f"doc_{self.doc_counter}_{i}"
            ids.append(doc_id)
            docs.append(chunk)
            metas.append({**metadata, "chunk_index": i})
            embs.append(emb)
            self.doc_counter += 1
        self.collection.add(ids=ids, documents=docs, metadatas=metas, embeddings=embs)
        return {"chunks": len(chunks)}

    async def add_pdf(self, content: bytes, filename: str) -> dict:
        doc = fitz.open(stream=content, filetype="pdf")
        full_text = ""
        for page in doc:
            full_text += page.get_text()
        doc.close()
        return await self.add_text(full_text, {"title": filename, "type": "pdf"})

    def _retrieve(self, query: str, n_results: int = 5) -> list[dict]:
        if self.collection.count() == 0:
            return []
        query_emb = self._embed_query(query)
        results = self.collection.query(
            query_embeddings=[query_emb],
            n_results=min(n_results, self.collection.count())
        )
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        return [
            {"text": d, "metadata": m, "score": 1 - s}
            for d, m, s in zip(docs, metas, distances)
        ]

    async def chat(self, message: str, session_id: str) -> dict:
        chunks = self._retrieve(message, n_results=5)
        has_memory = len(chunks) > 0
        if not has_memory:
            context = "No memories uploaded yet."
        else:
            context = "\n\n---\n\n".join([
                f"[Source: {c['metadata'].get('title', 'Unknown')}]\n{c['text']}"
                for c in chunks
            ])
        if session_id not in self.chat_histories:
            self.chat_histories[session_id] = []
        history = self.chat_histories[session_id]
        history_text = ""
        for h in history[-6:]:
            history_text += f"Human: {h['user']}\nAssistant: {h['assistant']}\n\n"
        prompt = f"""You are an AI Memory Clone — a personalized second brain assistant. You answer based ONLY on the user's stored memories below.

STORED MEMORIES:
{context}

CONVERSATION HISTORY:
{history_text}

INSTRUCTIONS:
- Answer based on the stored memories above
- If memories are relevant, synthesize insights and patterns
- If no relevant memory found, say exactly: "I don't have memory of that yet. Upload some notes or PDFs to teach me!"
- Be conversational, insightful, and personal
- Reference specific sources when helpful
- Spot patterns and give actionable suggestions

USER: {message}
ASSISTANT:"""

        response = self.model.generate_content(prompt)
        reply = response.text.strip()
        history.append({"user": message, "assistant": reply})
        if len(history) > 20:
            self.chat_histories[session_id] = history[-20:]
        sources = list(set([c['metadata'].get('title', 'Unknown') for c in chunks]))
        return {
            "reply": reply,
            "sources": sources if has_memory else [],
            "chunks_used": len(chunks)
        }

    def get_all_memories(self) -> dict:
        count = self.collection.count()
        if count == 0:
            return {"total_chunks": 0, "sources": []}
        results = self.collection.get(include=["metadatas"])
        metas = results.get("metadatas", [])
        sources = {}
        for m in metas:
            title = m.get("title", "Unknown")
            t = m.get("type", "text")
            if title not in sources:
                sources[title] = {"title": title, "type": t, "chunks": 0}
            sources[title]["chunks"] += 1
        return {
            "total_chunks": count,
            "sources": list(sources.values())
        }

    def get_knowledge_graph(self) -> dict:
        count = self.collection.count()
        if count == 0:
            return {"nodes": [], "edges": []}
        results = self.collection.get(include=["documents", "metadatas"])
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])
        # Extract keywords using simple frequency analysis
        stop_words = set([
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
            "have", "has", "had", "do", "does", "did", "will", "would", "could",
            "should", "may", "might", "can", "this", "that", "these", "those",
            "it", "its", "i", "you", "we", "they", "he", "she", "my", "your",
            "our", "their", "not", "no", "so", "if", "as", "up", "out", "about",
            "into", "than", "then", "when", "where", "which", "who", "what",
            "how", "all", "also", "more", "just", "like", "some", "there"
        ])
        word_freq = Counter()
        word_doc_map = {}  # word -> set of sources
        for doc, meta in zip(docs, metas):
            words = re.findall(r'\b[a-zA-Z]{4,}\b', doc.lower())
            source = meta.get("title", "Unknown")
            for w in words:
                if w not in stop_words:
                    word_freq[w] += 1
                    if w not in word_doc_map:
                        word_doc_map[w] = set()
                    word_doc_map[w].add(source)
        # Top 20 keywords
        top_words = [w for w, _ in word_freq.most_common(20)]
        # Source nodes
        sources = list(set([m.get("title", "Unknown") for m in metas]))
        nodes = []
        for i, src in enumerate(sources):
            nodes.append({"id": f"src_{i}", "label": src, "type": "source", "size": 20})
        for i, word in enumerate(top_words):
            freq = word_freq[word]
            nodes.append({"id": f"kw_{i}", "label": word, "type": "keyword", "size": min(5 + freq, 18)})
        # Edges: keywords to their sources
        edges = []
        for i, word in enumerate(top_words):
            for src in word_doc_map.get(word, []):
                src_idx = sources.index(src) if src in sources else None
                if src_idx is not None:
                    edges.append({
                        "source": f"src_{src_idx}",
                        "target": f"kw_{i}",
                        "weight": word_freq[word]
                    })
        # Keyword co-occurrence edges
        for i in range(len(top_words)):
            for j in range(i + 1, len(top_words)):
                shared = word_doc_map.get(top_words[i], set()) & word_doc_map.get(top_words[j], set())
                if shared:
                    edges.append({"source": f"kw_{i}", "target": f"kw_{j}", "weight": len(shared)})
        return {"nodes": nodes, "edges": edges}

    def clear_all(self):
        self.client.delete_collection("memories")
        self.collection = self.client.get_or_create_collection(
            name="memories",
            metadata={"hnsw:space": "cosine"}
        )
        self.doc_counter = 0
        self.chat_histories = {}
