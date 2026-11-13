"""Shared service singletons (created once at startup)."""
from __future__ import annotations

from functools import lru_cache

from services.chat_service import ChatService
from services.document_service import DocumentService
from services.embeddings import EmbeddingService
from services.graph_service import GraphService
from services.insights_service import InsightsService
from services.llm import LLMService
from services.rag_service import RAGService


class Container:
    def __init__(self) -> None:
        self.embeddings = EmbeddingService()
        self.llm = LLMService()
        self.rag = RAGService(self.embeddings, self.llm)
        self.documents = DocumentService(self.rag)
        self.chat = ChatService(self.rag)
        self.insights = InsightsService(self.rag)
        self.graph = GraphService(self.rag)


@lru_cache(maxsize=1)
def get_container() -> Container:
    return Container()
