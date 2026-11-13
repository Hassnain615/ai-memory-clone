"""Real usage analytics computed from the user's own data."""
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from database import get_conn


def overview(user_id: int, days: int = 14) -> dict:
    with get_conn() as conn:
        docs = conn.execute(
            "SELECT id, title, kind, status, word_count, chunk_count, page_count, size_bytes, created_at "
            "FROM documents WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        conv_count = conn.execute(
            "SELECT COUNT(*) FROM conversations WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
        msgs = conn.execute(
            """SELECT m.role, m.sources, m.created_at FROM messages m
               JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = ?""",
            (user_id,),
        ).fetchall()
        insight_count = conn.execute(
            "SELECT COUNT(*) FROM insights WHERE user_id = ?", (user_id,)
        ).fetchone()[0]

    ready = [d for d in docs if d["status"] == "ready"]
    by_kind = Counter(d["kind"] for d in ready)

    today = datetime.now(timezone.utc).date()
    day_keys = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
    activity = {k: {"date": k, "uploads": 0, "questions": 0} for k in day_keys}
    for d in docs:
        k = d["created_at"][:10]
        if k in activity:
            activity[k]["uploads"] += 1

    cited: Counter = Counter()
    scores: list[float] = []
    questions = 0
    for m in msgs:
        if m["role"] == "user":
            questions += 1
            k = m["created_at"][:10]
            if k in activity:
                activity[k]["questions"] += 1
        elif m["sources"]:
            try:
                for s in json.loads(m["sources"]):
                    cited[s.get("title", "Untitled")] += 1
                    if isinstance(s.get("score"), (int, float)):
                        scores.append(float(s["score"]))
            except (ValueError, AttributeError):
                pass

    return {
        "totals": {
            "documents": len(ready),
            "processing": sum(1 for d in docs if d["status"] == "processing"),
            "failed": sum(1 for d in docs if d["status"] == "failed"),
            "chunks": sum(d["chunk_count"] for d in ready),
            "words": sum(d["word_count"] for d in ready),
            "pages": sum(d["page_count"] for d in ready),
            "storage_bytes": sum(d["size_bytes"] for d in docs),
            "conversations": conv_count,
            "questions": questions,
            "insights": insight_count,
        },
        "by_kind": [{"kind": k, "count": v} for k, v in by_kind.most_common()],
        "activity": list(activity.values()),
        "top_sources": [{"title": t, "citations": c} for t, c in cited.most_common(6)],
        "avg_relevance": round(sum(scores) / len(scores), 3) if scores else None,
        "recent_documents": [
            {"id": d["id"], "title": d["title"], "kind": d["kind"], "status": d["status"], "created_at": d["created_at"]}
            for d in docs[:6]
        ],
    }
