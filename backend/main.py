"""AI Memory Clone — FastAPI application entry point."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database import init_db
from routers import auth, chat, documents, insights
from services.container import get_container

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("memory-clone")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    container = get_container()
    # Load the embedding model in the background so the API is responsive immediately
    threading.Thread(target=container.embeddings.warmup, daemon=True).start()
    if not container.llm.available:
        log.warning(
            "No LLM configured (LLM_PROVIDER=%s). Chat will return extractive answers; insights are disabled.",
            settings.LLM_PROVIDER,
        )
    yield


app = FastAPI(title="AI Memory Clone API", version="2.0.0", lifespan=lifespan)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,  # bearer tokens, no cookies
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return response


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health():
    c = get_container()
    return {
        "status": "ok",
        "version": app.version,
        "llm": {"provider": c.llm.provider, "model": c.llm.model_name, "available": c.llm.available},
        "embeddings": {"provider": c.embeddings.provider, "model": c.embeddings.model_name},
        "max_upload_mb": settings.MAX_UPLOAD_MB,
    }


for r in (auth.router, documents.router, chat.router, insights.router):
    app.include_router(r, prefix="/api")


# Serve the built React app (frontend/dist) when present — single-server deployment
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        target = (DIST / full_path).resolve()
        if full_path and target.is_file() and DIST in target.parents:
            return FileResponse(target)
        return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.ENV == "development")
