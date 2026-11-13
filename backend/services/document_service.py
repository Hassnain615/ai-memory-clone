"""Document lifecycle: create → (background) extract, chunk, embed, summarise → ready."""
from __future__ import annotations

import json
import logging

from config import settings
from database import get_conn, row_to_dict, utcnow
from services.document_processor import (
    ExtractionError,
    chunk_pages,
    decode_text_file,
    extract_pdf,
    extractive_summary,
    tfidf_keywords,
    word_count,
)
from services.rag_service import RAGService

log = logging.getLogger(__name__)

DOC_FIELDS = (
    "id, user_id, title, kind, filename, status, error, summary, topics, word_count, "
    "chunk_count, page_count, size_bytes, created_at, updated_at"
)

SUMMARY_SYSTEM = "You summarise personal documents for a knowledge base. Reply with JSON only."


class DocumentService:
    def __init__(self, rag: RAGService):
        self.rag = rag

    # -------------------------------------------------------------- queries
    def list(self, user_id: int) -> list[dict]:
        with get_conn() as conn:
            rows = conn.execute(
                f"SELECT {DOC_FIELDS} FROM documents WHERE user_id = ? ORDER BY created_at DESC, id DESC",
                (user_id,),
            ).fetchall()
        return [row_to_dict(r, ("topics",)) for r in rows]

    def get(self, user_id: int, doc_id: int, with_content: bool = False) -> dict | None:
        fields = DOC_FIELDS + (", content" if with_content else "")
        with get_conn() as conn:
            row = conn.execute(
                f"SELECT {fields} FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id)
            ).fetchone()
        return row_to_dict(row, ("topics",))

    # -------------------------------------------------------------- create
    def create(
        self, user_id: int, title: str, kind: str, raw: bytes | str, filename: str | None = None
    ) -> dict:
        size = len(raw.encode("utf-8")) if isinstance(raw, str) else len(raw)
        now = utcnow()
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO documents (user_id, title, kind, filename, status, size_bytes, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'processing', ?, ?, ?)""",
                (user_id, title, kind, filename, size, now, now),
            )
            doc_id = cur.lastrowid
        return self.get(user_id, doc_id)

    def process(self, user_id: int, doc_id: int, raw: bytes | str) -> None:
        """Runs in a background task. Never raises — failures are recorded on the document."""
        doc = self.get(user_id, doc_id)
        if not doc:
            return
        try:
            if doc["kind"] == "pdf":
                pages = extract_pdf(raw if isinstance(raw, bytes) else raw.encode())
                paged = True
            else:
                text = raw if isinstance(raw, str) else decode_text_file(raw)
                pages = [text]
                paged = False
            content = "\n\n".join(p for p in pages if p)
            if not content.strip():
                raise ExtractionError("No text content found")
            chunks = chunk_pages(pages, paged=paged)
            n = self.rag.index_document(user_id, doc_id, doc["title"], doc["kind"], chunks)

            with get_conn() as conn:
                conn.execute(
                    """UPDATE documents SET content = ?, pages = ?, word_count = ?, chunk_count = ?,
                       page_count = ?, status = 'ready', error = NULL, updated_at = ? WHERE id = ?""",
                    (
                        content,
                        json.dumps(pages) if paged else None,
                        word_count(content),
                        n,
                        len(pages) if paged else 0,
                        utcnow(),
                        doc_id,
                    ),
                )
            # Summary is best-effort and happens after the doc is already searchable
            if settings.AUTO_SUMMARIZE:
                self.summarize(user_id, doc_id)
        except ExtractionError as exc:
            self._fail(doc_id, str(exc))
        except Exception as exc:  # noqa: BLE001
            log.exception("Processing failed for document %s", doc_id)
            self._fail(doc_id, f"Processing failed: {exc.__class__.__name__}: {exc}"[:500])

    def _fail(self, doc_id: int, message: str) -> None:
        with get_conn() as conn:
            conn.execute(
                "UPDATE documents SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
                (message, utcnow(), doc_id),
            )

    # -------------------------------------------------------------- summaries
    def summarize(self, user_id: int, doc_id: int) -> dict | None:
        doc = self.get(user_id, doc_id, with_content=True)
        if not doc or not doc.get("content"):
            return doc
        content = doc["content"]
        summary, topics = None, []
        if self.rag.llm.available:
            try:
                data = self.rag.llm.complete_json(
                    SUMMARY_SYSTEM,
                    f"""Title: {doc['title']}

Content (may be truncated):
{content[:12000]}

Return JSON exactly like:
{{"summary": "3-4 sentence summary of the key ideas", "topics": ["topic", "topic", "topic"]}}
Use 3-6 short topics (1-3 words each).""",
                    max_tokens=600,
                )
                summary = str(data.get("summary", "")).strip() or None
                topics = [str(t).strip() for t in data.get("topics", []) if str(t).strip()][:6]
            except Exception as exc:  # noqa: BLE001
                log.warning("LLM summary failed for doc %s: %s", doc_id, exc)
        if not summary:
            summary = extractive_summary(content, max_sentences=3)
        if not topics:
            topics = [w for w, _ in tfidf_keywords({doc_id: content}, top_n=5).get(doc_id, [])]
        with get_conn() as conn:
            conn.execute(
                "UPDATE documents SET summary = ?, topics = ?, updated_at = ? WHERE id = ?",
                (summary, json.dumps(topics), utcnow(), doc_id),
            )
        return self.get(user_id, doc_id)

    # -------------------------------------------------------------- update / delete
    def update_note(self, user_id: int, doc_id: int, title: str, content: str) -> dict | None:
        doc = self.get(user_id, doc_id)
        if not doc:
            return None
        with get_conn() as conn:
            conn.execute(
                """UPDATE documents SET title = ?, status = 'processing', error = NULL,
                   size_bytes = ?, updated_at = ? WHERE id = ?""",
                (title, len(content.encode("utf-8")), utcnow(), doc_id),
            )
        return self.get(user_id, doc_id)

    def rename(self, user_id: int, doc_id: int, title: str) -> dict | None:
        doc = self.get(user_id, doc_id, with_content=True)
        if not doc:
            return None
        with get_conn() as conn:
            conn.execute(
                "UPDATE documents SET title = ?, updated_at = ? WHERE id = ?", (title, utcnow(), doc_id)
            )
        # keep citation titles in the vector store in sync
        if doc["status"] == "ready":
            self.reindex_one(user_id, doc_id)
        return self.get(user_id, doc_id)

    def reindex_one(self, user_id: int, doc_id: int) -> None:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT title, kind, content, pages FROM documents WHERE id = ? AND user_id = ?",
                (doc_id, user_id),
            ).fetchone()
        if not row or not row["content"]:
            return
        pages = json.loads(row["pages"]) if row["pages"] else [row["content"]]
        chunks = chunk_pages(pages, paged=bool(row["pages"]))
        n = self.rag.index_document(user_id, doc_id, row["title"], row["kind"], chunks)
        with get_conn() as conn:
            conn.execute("UPDATE documents SET chunk_count = ? WHERE id = ?", (n, doc_id))

    def reindex_all(self, user_id: int) -> int:
        with get_conn() as conn:
            ids = [
                r["id"]
                for r in conn.execute(
                    "SELECT id FROM documents WHERE user_id = ? AND status = 'ready'", (user_id,)
                ).fetchall()
            ]
        for did in ids:
            self.reindex_one(user_id, did)
        return len(ids)

    def delete(self, user_id: int, doc_id: int) -> bool:
        with get_conn() as conn:
            cur = conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))
        if cur.rowcount:
            self.rag.delete_document(user_id, doc_id)
            return True
        return False

    def delete_all(self, user_id: int) -> int:
        with get_conn() as conn:
            cur = conn.execute("DELETE FROM documents WHERE user_id = ?", (user_id,))
        self.rag.clear_user(user_id)
        return cur.rowcount
