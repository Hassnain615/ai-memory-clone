"""Embedding providers.

Default: Sentence Transformers (runs locally, free, no API key).
Optional: Gemini embeddings (EMBEDDING_PROVIDER=gemini) — the original project's approach.
"""
from __future__ import annotations

import hashlib
import logging
import threading

from config import settings

log = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self) -> None:
        self.provider = settings.EMBEDDING_PROVIDER
        self.model_name = (
            settings.GEMINI_EMBEDDING_MODEL if self.provider == "gemini" else settings.EMBEDDING_MODEL
        )
        self._model = None
        self._lock = threading.Lock()

    @property
    def signature(self) -> str:
        """Short stable id for the active model; vectors from different models never mix."""
        return hashlib.sha1(f"{self.provider}:{self.model_name}".encode()).hexdigest()[:10]

    # -------------------------------------------------------------- loading
    def _load_st(self):
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from sentence_transformers import SentenceTransformer

                    log.info("Loading sentence-transformers model %s", self.model_name)
                    self._model = SentenceTransformer(self.model_name)
        return self._model

    def _gemini(self):
        import google.generativeai as genai

        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini")
        genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")
        return genai

    def warmup(self) -> None:
        if self.provider != "gemini":
            self._load_st()

    # -------------------------------------------------------------- API
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self.provider == "gemini":
            genai = self._gemini()
            out = []
            for t in texts:
                r = genai.embed_content(
                    model=self.model_name, content=t, task_type="retrieval_document"
                )
                out.append(r["embedding"])
            return out
        model = self._load_st()
        vecs = model.encode(
            texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False
        )
        return [v.tolist() for v in vecs]

    def embed_query(self, text: str) -> list[float]:
        if self.provider == "gemini":
            genai = self._gemini()
            r = genai.embed_content(model=self.model_name, content=text, task_type="retrieval_query")
            return r["embedding"]
        model = self._load_st()
        return model.encode([text], normalize_embeddings=True, show_progress_bar=False)[0].tolist()
