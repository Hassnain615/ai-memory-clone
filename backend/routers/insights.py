from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from config import settings
from deps import enforce_rate_limit, get_current_user
from services import analytics_service
from services.container import get_container
from services.llm import LLMNotConfigured

router = APIRouter(tags=["insights"])


@router.get("/insights/latest")
def latest_insight(user: dict = Depends(get_current_user)):
    return {"insight": get_container().insights.latest(user["id"])}


@router.post("/insights/generate")
def generate_insight(user: dict = Depends(get_current_user)):
    enforce_rate_limit(f"insights:{user['id']}", max(3, settings.RATE_LIMIT_CHAT // 5))
    try:
        return {"insight": get_container().insights.generate(user["id"])}
    except LLMNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@router.get("/insights/topics")
def topics(user: dict = Depends(get_current_user)):
    return {"topics": get_container().insights.topic_cloud(user["id"])}


@router.get("/analytics")
def analytics(user: dict = Depends(get_current_user)):
    return analytics_service.overview(user["id"])


@router.get("/graph")
def graph(user: dict = Depends(get_current_user)):
    return get_container().graph.build(user["id"])
