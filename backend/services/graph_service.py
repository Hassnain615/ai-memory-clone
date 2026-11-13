"""Knowledge graph: documents + concepts, linked by TF-IDF keywords and semantic similarity."""
from __future__ import annotations

import math

from database import get_conn
from services.document_processor import tfidf_keywords
from services.rag_service import RAGService


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


class GraphService:
    def __init__(self, rag: RAGService):
        self.rag = rag
        self._cache: dict[int, tuple[str, dict]] = {}

    def build(self, user_id: int, max_concepts: int = 40) -> dict:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT id, title, kind, content, summary, chunk_count, word_count, updated_at "
                "FROM documents WHERE user_id = ? AND status = 'ready'",
                (user_id,),
            ).fetchall()
        if not rows:
            return {"nodes": [], "edges": [], "stats": {"documents": 0, "concepts": 0, "links": 0}}

        version = f"{len(rows)}:{max(r['updated_at'] for r in rows)}"
        cached = self._cache.get(user_id)
        if cached and cached[0] == version:
            return cached[1]

        docs = {r["id"]: r for r in rows}
        keywords = tfidf_keywords({i: r["content"] for i, r in docs.items()}, top_n=8)

        # Concepts shared by more docs (or strongest) rank first
        concept_docs: dict[str, dict[int, float]] = {}
        for did, kws in keywords.items():
            for word, score in kws:
                concept_docs.setdefault(word, {})[did] = score
        ranked = sorted(
            concept_docs.items(), key=lambda kv: (len(kv[1]), sum(kv[1].values())), reverse=True
        )[:max_concepts]

        nodes, edges = [], []
        for did, r in docs.items():
            nodes.append(
                {
                    "id": f"doc_{did}",
                    "doc_id": did,
                    "label": r["title"],
                    "type": "document",
                    "kind": r["kind"],
                    "size": min(14 + math.sqrt(r["chunk_count"] or 1) * 3, 34),
                    "summary": (r["summary"] or "")[:280],
                    "words": r["word_count"],
                }
            )
        for word, linked in ranked:
            nodes.append(
                {
                    "id": f"concept_{word}",
                    "label": word,
                    "type": "concept",
                    "size": min(5 + len(linked) * 2.5, 16),
                    "documents": len(linked),
                }
            )
            for did, score in linked.items():
                edges.append(
                    {"source": f"doc_{did}", "target": f"concept_{word}", "kind": "mentions", "weight": round(score * 100, 2)}
                )

        # Semantic links between documents (mean chunk embedding similarity)
        try:
            centroids = self.rag.document_centroids(user_id)
        except Exception:  # noqa: BLE001
            centroids = {}
        ids = [d for d in docs if d in centroids]
        seen: set[tuple[int, int]] = set()
        for a in ids:
            sims = sorted(
                ((_cosine(centroids[a], centroids[b]), b) for b in ids if b != a), reverse=True
            )[:3]  # each document links to at most its 3 nearest neighbours
            for sim, b in sims:
                key = (min(a, b), max(a, b))
                if sim < 0.35 or key in seen:
                    continue
                seen.add(key)
                edges.append(
                    {
                        "source": f"doc_{key[0]}",
                        "target": f"doc_{key[1]}",
                        "kind": "similar",
                        "weight": round(sim, 3),
                    }
                )

        graph = {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "documents": len(docs),
                "concepts": len(ranked),
                "links": len(edges),
                "semantic_links": sum(1 for e in edges if e["kind"] == "similar"),
            },
        }
        self._cache[user_id] = (version, graph)
        return graph

    def invalidate(self, user_id: int) -> None:
        self._cache.pop(user_id, None)
