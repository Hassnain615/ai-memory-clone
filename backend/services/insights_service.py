"""InsightsService — AI analysis of a user's whole knowledge base.

Evolved from the original "Analyze My Brain" feature: now per-user, samples evenly
across documents, persists results, and works through the LLM abstraction.
"""
from __future__ import annotations

import json
from collections import defaultdict

from database import get_conn, row_to_dict, utcnow
from services.document_processor import tfidf_keywords
from services.llm import LLMNotConfigured
from services.rag_service import RAGService

INSIGHTS_SYSTEM = (
    "You are an insightful learning coach analysing a person's personal knowledge base. "
    "Be specific to their actual content. Reply with valid JSON only."
)


class InsightsService:
    def __init__(self, rag: RAGService):
        self.rag = rag

    def latest(self, user_id: int) -> dict | None:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT id, data, created_at FROM insights WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                (user_id,),
            ).fetchone()
        if not row:
            return None
        data = json.loads(row["data"])
        data["id"] = row["id"]
        data["created_at"] = row["created_at"]
        return data

    def _sample(self, user_id: int, budget_chars: int = 14000) -> tuple[list[dict], str]:
        """Round-robin sample of chunks across documents so one large PDF can't dominate."""
        col = self.rag.collection(user_id)
        res = col.get(include=["documents", "metadatas"])
        by_doc: dict[int, list[tuple[int, str, str]]] = defaultdict(list)
        for text, meta in zip(res.get("documents") or [], res.get("metadatas") or []):
            by_doc[meta.get("doc_id")].append((meta.get("chunk_index", 0), meta.get("title", ""), text))
        for v in by_doc.values():
            v.sort()
        parts, used, rnd = [], 0, 0
        while used < budget_chars and any(len(v) > rnd for v in by_doc.values()):
            for v in by_doc.values():
                if len(v) > rnd:
                    _, title, text = v[rnd]
                    piece = f"[{title}] {text[:900]}"
                    parts.append(piece)
                    used += len(piece)
                    if used >= budget_chars:
                        break
            rnd += 1
        with get_conn() as conn:
            docs = [
                row_to_dict(r, ("topics",))
                for r in conn.execute(
                    "SELECT id, title, kind, summary, topics, word_count FROM documents "
                    "WHERE user_id = ? AND status = 'ready'",
                    (user_id,),
                ).fetchall()
            ]
        return docs, "\n\n".join(parts)

    def generate(self, user_id: int) -> dict:
        if not self.rag.llm.available:
            raise LLMNotConfigured("Insights need an LLM. Add GEMINI_API_KEY (or HF_TOKEN) to backend/.env")
        docs, sample = self._sample(user_id)
        if not docs or not sample:
            raise ValueError("No memories yet. Upload some notes or PDFs first.")

        doc_lines = "\n".join(
            f"- {d['title']} ({d['kind']}, {d['word_count']} words): {(d.get('summary') or '')[:300]}"
            for d in docs[:40]
        )
        prompt = f"""DOCUMENTS ({len(docs)} total):
{doc_lines}

KNOWLEDGE BASE EXCERPTS:
{sample}

Respond ONLY with JSON in exactly this shape:
{{
  "summary": "2-3 sentence overview of what this person's mind is focused on",
  "focus_areas": [{{"topic": "Topic", "description": "Why it matters to them", "strength": 85}}],
  "patterns": ["Recurring theme or cognitive pattern"],
  "connections": [{{"from": "Document or idea A", "to": "Document or idea B", "insight": "How they relate"}}],
  "knowledge_gaps": ["Something missing or underexplored that would strengthen their understanding"],
  "suggestions": [{{"title": "Actionable suggestion", "detail": "Specific advice"}}],
  "personality_insight": "One sentence about what kind of thinker/learner this person seems to be"
}}
Provide 4-6 focus_areas (strength 0-100), 3-5 patterns, 2-4 connections, 2-4 knowledge_gaps and 3-5 suggestions."""
        data = self.rag.llm.complete_json(INSIGHTS_SYSTEM, prompt, max_tokens=1800)

        # Normalise shape so the UI never breaks on a sloppy model response
        clean = {
            "summary": str(data.get("summary", "")),
            "focus_areas": [
                {
                    "topic": str(f.get("topic", "")),
                    "description": str(f.get("description", "")),
                    "strength": max(0, min(100, int(float(f.get("strength", 50) or 50)))),
                }
                for f in data.get("focus_areas", [])
                if isinstance(f, dict)
            ],
            "patterns": [str(p) for p in data.get("patterns", []) if p],
            "connections": [
                {"from": str(c.get("from", "")), "to": str(c.get("to", "")), "insight": str(c.get("insight", ""))}
                for c in data.get("connections", [])
                if isinstance(c, dict)
            ],
            "knowledge_gaps": [str(g) for g in data.get("knowledge_gaps", []) if g],
            "suggestions": [
                {"title": str(s.get("title", "")), "detail": str(s.get("detail", ""))}
                for s in data.get("suggestions", [])
                if isinstance(s, dict)
            ],
            "personality_insight": str(data.get("personality_insight", "")),
            "documents_analyzed": len(docs),
            "model": self.rag.llm.model_name,
        }
        created = utcnow()
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO insights (user_id, data, created_at) VALUES (?, ?, ?)",
                (user_id, json.dumps(clean), created),
            )
            # keep the 20 most recent
            conn.execute(
                "DELETE FROM insights WHERE user_id = ? AND id NOT IN "
                "(SELECT id FROM insights WHERE user_id = ? ORDER BY id DESC LIMIT 20)",
                (user_id, user_id),
            )
        clean["id"] = cur.lastrowid
        clean["created_at"] = created
        return clean

    # -------------------------------------------------------------- keyword topics (no LLM)
    def topic_cloud(self, user_id: int, top_n: int = 24) -> list[dict]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT id, content FROM documents WHERE user_id = ? AND status = 'ready'", (user_id,)
            ).fetchall()
        if not rows:
            return []
        per_doc = tfidf_keywords({r["id"]: r["content"] for r in rows}, top_n=10)
        agg: dict[str, dict] = {}
        for doc_id, kws in per_doc.items():
            for word, score in kws:
                a = agg.setdefault(word, {"term": word, "score": 0.0, "documents": 0})
                a["score"] += score
                a["documents"] += 1
        ranked = sorted(agg.values(), key=lambda x: (x["documents"], x["score"]), reverse=True)[:top_n]
        for r in ranked:
            r["score"] = round(r["score"], 4)
        return ranked
