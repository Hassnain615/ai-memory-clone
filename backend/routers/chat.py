from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import settings
from deps import enforce_rate_limit, get_current_user
from services.container import get_container

router = APIRouter(tags=["chat"])


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: int | None = None
    document_ids: list[int] | None = Field(default=None, max_length=50)


class RenameIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)


@router.post("/chat/stream")
def chat_stream(data: ChatIn, user: dict = Depends(get_current_user)):
    enforce_rate_limit(f"chat:{user['id']}", settings.RATE_LIMIT_CHAT)
    c = get_container()
    if data.conversation_id is not None and not c.chat.get_conversation(user["id"], data.conversation_id):
        raise HTTPException(404, "Conversation not found")
    gen = c.chat.stream_answer(user["id"], data.message.strip(), data.conversation_id, data.document_ids or None)
    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat")
def chat(data: ChatIn, user: dict = Depends(get_current_user)):
    """Non-streaming variant (kept for API clients and backwards compatibility)."""
    import json

    enforce_rate_limit(f"chat:{user['id']}", settings.RATE_LIMIT_CHAT)
    c = get_container()
    if data.conversation_id is not None and not c.chat.get_conversation(user["id"], data.conversation_id):
        raise HTTPException(404, "Conversation not found")
    reply, meta, done = [], {}, {}
    for raw in c.chat.stream_answer(user["id"], data.message.strip(), data.conversation_id, data.document_ids or None):
        event = json.loads(raw[len("data: "):])
        if event["type"] == "meta":
            meta = event
        elif event["type"] == "token":
            reply.append(event["content"])
        elif event["type"] in {"done", "error"}:
            done = event
    if done.get("type") == "error":
        raise HTTPException(500, done.get("message", "Chat failed"))
    return {
        "reply": "".join(reply).strip(),
        "sources": meta.get("sources", []),
        "conversation_id": done.get("conversation_id"),
        "message_id": done.get("message_id"),
        "mode": meta.get("mode"),
    }


@router.get("/conversations")
def list_conversations(user: dict = Depends(get_current_user)):
    return get_container().chat.list_conversations(user["id"])


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: int, user: dict = Depends(get_current_user)):
    conv = get_container().chat.get_conversation(user["id"], conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


@router.patch("/conversations/{conv_id}")
def rename_conversation(conv_id: int, data: RenameIn, user: dict = Depends(get_current_user)):
    if not get_container().chat.rename_conversation(user["id"], conv_id, data.title.strip()):
        raise HTTPException(404, "Conversation not found")
    return {"success": True}


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: int, user: dict = Depends(get_current_user)):
    if not get_container().chat.delete_conversation(user["id"], conv_id):
        raise HTTPException(404, "Conversation not found")
    return {"success": True}
