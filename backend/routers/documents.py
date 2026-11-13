from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from config import settings
from deps import enforce_rate_limit, get_current_user
from services.container import get_container

router = APIRouter(tags=["documents"])


class NoteIn(BaseModel):
    title: str = Field(default="Untitled note", max_length=200)
    content: str = Field(min_length=1)


class DocumentPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = None


def _clean_title(title: str | None, fallback: str) -> str:
    title = re.sub(r"[\x00-\x1f\x7f]", "", (title or "")).strip()
    return title[:200] or fallback


async def _read_limited(file: UploadFile) -> bytes:
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    buf = bytearray()
    while chunk := await file.read(1024 * 1024):
        buf.extend(chunk)
        if len(buf) > limit:
            raise HTTPException(413, f"File too large. Maximum size is {settings.MAX_UPLOAD_MB} MB")
    return bytes(buf)


@router.get("/documents")
def list_documents(user: dict = Depends(get_current_user)):
    return get_container().documents.list(user["id"])


@router.post("/documents/upload", status_code=202)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: dict = Depends(get_current_user),
):
    enforce_rate_limit(f"upload:{user['id']}", settings.RATE_LIMIT_UPLOAD)
    filename = Path(file.filename or "upload").name[:200]
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(415, "Unsupported file type. Upload a PDF, TXT or Markdown file.")
    data = await _read_limited(file)
    if not data:
        raise HTTPException(400, "File is empty")
    if ext == ".pdf" and not data.startswith(b"%PDF"):
        raise HTTPException(415, "This file is not a valid PDF")
    kind = "pdf" if ext == ".pdf" else ("markdown" if ext in {".md", ".markdown"} else "text")

    docs = get_container().documents
    doc = docs.create(user["id"], _clean_title(title, Path(filename).stem), kind, data, filename)
    background.add_task(docs.process, user["id"], doc["id"], data)
    return doc


@router.post("/documents/note", status_code=202)
def create_note(data: NoteIn, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    enforce_rate_limit(f"upload:{user['id']}", settings.RATE_LIMIT_UPLOAD)
    content = data.content.strip()
    if not content:
        raise HTTPException(422, "Note is empty")
    if len(content) > settings.MAX_NOTE_CHARS:
        raise HTTPException(413, f"Note is too long (max {settings.MAX_NOTE_CHARS:,} characters)")
    docs = get_container().documents
    doc = docs.create(user["id"], _clean_title(data.title, "Untitled note"), "note", content)
    background.add_task(docs.process, user["id"], doc["id"], content)
    return doc


@router.get("/documents/{doc_id}")
def get_document(doc_id: int, user: dict = Depends(get_current_user)):
    c = get_container()
    doc = c.documents.get(user["id"], doc_id, with_content=True)
    if not doc:
        raise HTTPException(404, "Document not found")
    content = doc.pop("content", "") or ""
    doc["content"] = content if doc["kind"] == "note" else content[:20000]
    doc["content_truncated"] = doc["kind"] != "note" and len(content) > 20000
    doc["chunks"] = c.rag.get_document_chunks(user["id"], doc_id)[:200] if doc["status"] == "ready" else []
    return doc


@router.patch("/documents/{doc_id}")
def update_document(
    doc_id: int, data: DocumentPatch, background: BackgroundTasks, user: dict = Depends(get_current_user)
):
    c = get_container()
    doc = c.documents.get(user["id"], doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc["status"] == "processing":
        raise HTTPException(409, "Document is still processing")
    title = _clean_title(data.title, doc["title"]) if data.title is not None else doc["title"]
    if data.content is not None:
        if doc["kind"] != "note":
            raise HTTPException(400, "Only notes can be edited")
        content = data.content.strip()
        if not content:
            raise HTTPException(422, "Note is empty")
        if len(content) > settings.MAX_NOTE_CHARS:
            raise HTTPException(413, "Note is too long")
        updated = c.documents.update_note(user["id"], doc_id, title, content)
        background.add_task(c.documents.process, user["id"], doc_id, content)
        return updated
    return c.documents.rename(user["id"], doc_id, title)


@router.post("/documents/{doc_id}/summarize")
def summarize_document(doc_id: int, user: dict = Depends(get_current_user)):
    c = get_container()
    doc = c.documents.get(user["id"], doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc["status"] != "ready":
        raise HTTPException(409, "Document is not ready yet")
    return c.documents.summarize(user["id"], doc_id)


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: int, user: dict = Depends(get_current_user)):
    c = get_container()
    if not c.documents.delete(user["id"], doc_id):
        raise HTTPException(404, "Document not found")
    c.graph.invalidate(user["id"])
    return {"success": True}


@router.delete("/documents")
def delete_all_documents(user: dict = Depends(get_current_user)):
    c = get_container()
    n = c.documents.delete_all(user["id"])
    c.graph.invalidate(user["id"])
    return {"success": True, "deleted": n}


@router.post("/documents/reindex")
def reindex(background: BackgroundTasks, user: dict = Depends(get_current_user)):
    c = get_container()
    background.add_task(c.documents.reindex_all, user["id"])
    return {"success": True, "message": "Re-indexing started"}


@router.get("/search")
def semantic_search(
    q: str = Query(min_length=1, max_length=500),
    k: int = Query(default=8, ge=1, le=25),
    user: dict = Depends(get_current_user),
):
    hits = get_container().rag.retrieve(user["id"], q, k=k, min_score=0.0)
    return {"query": q, "results": hits}
