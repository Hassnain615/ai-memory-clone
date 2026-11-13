"""Central configuration loaded from environment variables (backend/.env)."""
from __future__ import annotations

import os
import secrets
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
except ImportError:  # python-dotenv is optional at runtime
    pass

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _load_secret_key() -> str:
    """Use SECRET_KEY from env; otherwise create and persist a random one for local dev."""
    key = os.getenv("SECRET_KEY", "").strip()
    if key:
        return key
    key_file = DATA_DIR / ".secret_key"
    if key_file.exists():
        return key_file.read_text().strip()
    key = secrets.token_urlsafe(64)
    key_file.write_text(key)
    try:
        key_file.chmod(0o600)
    except OSError:
        pass
    return key


class Settings:
    APP_NAME = "AI Memory Clone"
    ENV = os.getenv("ENV", "development")

    # Storage
    SQLITE_PATH = Path(os.getenv("SQLITE_PATH", DATA_DIR / "memory_clone.db"))
    CHROMA_PATH = Path(os.getenv("CHROMA_PATH", DATA_DIR / "chroma_db"))

    # Auth
    SECRET_KEY = _load_secret_key()
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24 * 7))
    PASSWORD_MIN_LENGTH = 8

    # CORS
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if o.strip()
    ]

    # Uploads
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", 20))
    MAX_NOTE_CHARS = int(os.getenv("MAX_NOTE_CHARS", 200_000))
    ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".markdown"}

    # Chunking / retrieval
    CHUNK_SIZE_WORDS = int(os.getenv("CHUNK_SIZE_WORDS", 220))
    CHUNK_OVERLAP_WORDS = int(os.getenv("CHUNK_OVERLAP_WORDS", 40))
    RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", 6))
    RETRIEVAL_MIN_SCORE = float(os.getenv("RETRIEVAL_MIN_SCORE", 0.15))

    # Embeddings: "sentence-transformers" (local, default) or "gemini"
    EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "sentence-transformers").lower()
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")

    # LLM: "gemini" (default), "huggingface", or "none" (extractive fallback only)
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    HF_TOKEN = os.getenv("HF_TOKEN", "").strip()
    HF_MODEL = os.getenv("HF_MODEL", "meta-llama/Llama-3.1-8B-Instruct")
    LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", 0.3))
    LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", 1024))

    # Rate limits (requests per minute)
    RATE_LIMIT_AUTH = int(os.getenv("RATE_LIMIT_AUTH", 10))
    RATE_LIMIT_CHAT = int(os.getenv("RATE_LIMIT_CHAT", 30))
    RATE_LIMIT_UPLOAD = int(os.getenv("RATE_LIMIT_UPLOAD", 20))

    AUTO_SUMMARIZE = _bool("AUTO_SUMMARIZE", True)


settings = Settings()
