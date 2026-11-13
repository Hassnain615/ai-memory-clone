"""Conversation persistence + streaming RAG answers."""
from __future__ import annotations

import json
import logging
from typing import Iterator

from database import get_conn, row_to_dict, utcnow
from services.llm import LLMNotConfigured
from services.rag_service import RAGService

log = logging.getLogger(__name__)


def sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


class ChatService:
    def __init__(self, rag: RAGService):
        self.rag = rag

    # -------------------------------------------------------------- conversations
    def list_conversations(self, user_id: int) -> list[dict]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT c.id, c.title, c.created_at, c.updated_at,
                          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
                   FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC, c.id DESC""",
                (user_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_conversation(self, user_id: int, conv_id: int) -> dict | None:
        with get_conn() as conn:
            conv = conn.execute(
                "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?",
                (conv_id, user_id),
            ).fetchone()
            if not conv:
                return None
            msgs = conn.execute(
                "SELECT id, role, content, sources, created_at FROM messages WHERE conversation_id = ? ORDER BY id",
                (conv_id,),
            ).fetchall()
        data = dict(conv)
        data["messages"] = [row_to_dict(m, ("sources",)) for m in msgs]
        return data

    def create_conversation(self, user_id: int, title: str) -> int:
        now = utcnow()
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (user_id, title, now, now),
            )
            return cur.lastrowid

    def rename_conversation(self, user_id: int, conv_id: int, title: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                "UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?", (title, conv_id, user_id)
            )
            return cur.rowcount > 0

    def delete_conversation(self, user_id: int, conv_id: int) -> bool:
        with get_conn() as conn:
            cur = conn.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", (conv_id, user_id))
            return cur.rowcount > 0

    def _history(self, conv_id: int) -> list[dict]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 10",
                (conv_id,),
            ).fetchall()
        return [dict(r) for r in reversed(rows)]

    def _add_message(self, conv_id: int, role: str, content: str, sources: list | None = None) -> int:
        now = utcnow()
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO messages (conversation_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?)",
                (conv_id, role, content, json.dumps(sources) if sources is not None else None, now),
            )
            conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id))
            return cur.lastrowid

    # -------------------------------------------------------------- streaming answer
    def stream_answer(
        self,
        user_id: int,
        message: str,
        conversation_id: int | None,
        doc_ids: list[int] | None,
    ) -> Iterator[str]:
        """Yields Server-Sent-Event strings: meta → token* → done | error."""
        if conversation_id is None:
            title = message.strip().replace("\n", " ")
            conversation_id = self.create_conversation(user_id, title[:60] + ("…" if len(title) > 60 else ""))
        history = self._history(conversation_id)
        user_msg_id = self._add_message(conversation_id, "user", message)

        try:
            hits, tokens, mode = self.rag.answer_stream(user_id, message, history, doc_ids)
        except Exception as exc:  # noqa: BLE001
            log.exception("Retrieval failed")
            err = f"Retrieval failed: {exc}"
            self._add_message(conversation_id, "assistant", f"⚠️ {err}", [])
            yield sse({"type": "error", "conversation_id": conversation_id, "message": err})
            return

        sources = [
            {
                "n": i,
                "doc_id": h["doc_id"],
                "title": h["title"],
                "kind": h["kind"],
                "page": h["page"],
                "score": h["score"],
                "snippet": h["text"][:420],
            }
            for i, h in enumerate(hits, start=1)
        ]
        yield sse(
            {
                "type": "meta",
                "conversation_id": conversation_id,
                "user_message_id": user_msg_id,
                "sources": sources,
                "mode": mode,
            }
        )

        parts: list[str] = []
        try:
            for tok in tokens:
                parts.append(tok)
                yield sse({"type": "token", "content": tok})
        except LLMNotConfigured as exc:
            parts = [str(exc)]
            yield sse({"type": "token", "content": str(exc)})
        except Exception as exc:  # noqa: BLE001
            log.exception("Generation failed")
            msg = f"\n\n⚠️ The language model failed: {exc.__class__.__name__}. Please try again."
            parts.append(msg)
            yield sse({"type": "token", "content": msg})

        reply = "".join(parts).strip() or "I couldn't generate a response. Please try again."
        msg_id = self._add_message(conversation_id, "assistant", reply, sources)
        yield sse({"type": "done", "conversation_id": conversation_id, "message_id": msg_id})
