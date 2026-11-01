"""
Vaani Moderation Console - FastAPI Backend.
Serves REST endpoints for messages, sources, stats, repeat targets, settings, and live classification.
"""

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from datetime import datetime, timezone
import os
import time
import asyncio

try:
    from dotenv import load_dotenv  # type: ignore
    dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path=dotenv_path)
    else:
        load_dotenv()
except (ImportError, PermissionError):
    pass

import database as db
from models import (
    NormalizedMessage,
    MessageStatusUpdate,
    ConnectedSource,
    SourceCreateRequest,
    ClassifyRequest,
    ClassifyResponse,
    DashboardStats,
    RepeatTargetItem,
    SystemSettings,
)
from services.classifier import classify_text
from services.alerts import send_high_severity_alert, get_pending_digest
from services.ingest_worker import sync_all_sources, start_background_worker, stop_background_worker, _sync_lock
from services.actions import execute_moderator_action
from services.source_verifier import create_and_verify_source
from services.security import mask_token, encrypt_token, decrypt_token
from connectors.discord_service import start_discord_gateway, stop_discord_gateway
from services.config_resolver import get_telegram_runtime_config
from routers.brain import router as brain_router
from routers.ops import ops_router

# Initialize FastAPI application
app = FastAPI(
    title="Vaani Moderation API",
    description="Multi-platform toxic speech & cyber-bullying moderation backend for Telegram, Discord, and YouTube.",
    version="1.0.4",
)

# CORS configuration supporting local dev and Vercel cloud deployments
frontend_origin = os.getenv("FRONTEND_ORIGIN", "")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if frontend_origin:
    for o in frontend_origin.split(","):
        clean = o.strip()
        if clean and clean not in allowed_origins:
            allowed_origins.append(clean)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include brain router and operations router
app.include_router(brain_router)
app.include_router(ops_router)


@app.on_event("startup")
def startup_event():
    """Initializes SQLite database and background tasks for continuous ingestion and Discord gateway."""
    db.init_db()
    if os.getenv("ENABLE_BACKGROUND_WORKER", "False").lower() == "true" or os.getenv("TELEGRAM_LIVE", "False").lower() == "true":
        start_background_worker()
    start_discord_gateway()
    cfg = get_telegram_runtime_config(log_startup=True)
    print("[Vaani Backend] SQLite database, background worker, and Discord gateway initialized.")


@app.on_event("shutdown")
def shutdown_event():
    stop_background_worker()
    stop_discord_gateway()


@app.get("/")
def read_root():
    return {
        "service": "Vaani Moderation Console API",
        "status": "online",
        "mock_mode": os.getenv("MOCK_MODE", "True").lower() == "true",
        "version": "1.0.4",
        "docs_url": "/docs",
    }


# ============================================================================
# Messages Endpoints
# ============================================================================

@app.get("/messages", response_model=List[NormalizedMessage])
def list_messages(
    platform: Optional[str] = Query(None, description="telegram, discord, or youtube"),
    channel: Optional[str] = Query(None, description="Exact channel name"),
    severity: Optional[str] = Query(None, description="high, medium, or low"),
    language: Optional[str] = Query(None, description="Hindi (Romanized), Hinglish, etc."),
    category: Optional[str] = Query(None, description="Insult/Bullying, Threat, etc."),
    status: Optional[str] = Query(None, description="new, reviewed, dismissed, escalated"),
    search: Optional[str] = Query(None, description="Text, sender, target search query"),
    sort_by: str = Query("time", description="time or severity"),
    sort_order: str = Query("desc", description="desc or asc"),
):
    """
    Returns flagged messages matching multi-criteria filter and sort parameters.
    """
    t0 = time.perf_counter()
    messages = db.get_messages(
        platform=platform,
        channel=channel,
        severity=severity,
        language=language,
        category=category,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    duration_ms = (time.perf_counter() - t0) * 1000
    print(f"[Timing] GET /messages took {duration_ms:.2f}ms (returned {len(messages)} messages)")
    return messages


@app.get("/messages/{message_id}", response_model=NormalizedMessage)
def get_message(message_id: str):
    msg = db.get_message_by_id(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


@app.patch("/messages/{message_id}/status", response_model=NormalizedMessage)
def update_message_status(message_id: str, payload: MessageStatusUpdate):
    """
    Updates status workflow and executes human-in-the-loop moderation actions
    (warn, dismiss, escalate, delete_and_ban). Never crashes with 500.
    """
    reviewer = payload.reviewed_by or "moderator@vaani.org"
    updated = execute_moderator_action(
        message_id=message_id,
        status=payload.status,
        action=payload.action,
        reviewed_by=reviewer,
        notes=payload.notes,
    )
    if not updated or updated.get("error") == "Message not found":
        raise HTTPException(status_code=404, detail="Message not found")
    return updated


# ============================================================================
# Connected Sources Endpoints
# ============================================================================

@app.get("/sources", response_model=List[ConnectedSource])
def list_sources():
    """
    Returns all connected community channels across Telegram, Discord, and YouTube.
    """
    return db.get_sources()


@app.post("/sources", response_model=ConnectedSource)
def create_source(payload: SourceCreateRequest):
    """
    Adds a new community channel: parses t.me, discord.gg, and YouTube URLs,
    verifies permissions via platform API or mock validation,
    and sets status ('connected', 'pending', 'permission_missing') with permission_hint.
    """
    return create_and_verify_source(
        url=payload.url,
        platform=payload.platform,
        channel_name=payload.channel_name,
        privacy_mode=payload.privacy_mode or "full"
    )


@app.delete("/sources/{source_id}")
def delete_source(source_id: str):
    """
    Disconnects a channel and stops monitoring.
    """
    success = db.delete_source(source_id)
    return {"success": success, "message": f"Source {source_id} disconnected."}


@app.post("/sources/sync")
async def trigger_source_sync():
    """
    Polls all connected channels across Telegram, Discord, and YouTube in real-time.
    Dispatches ingestion in background task so HTTP response returns in < 5ms and frontend never times out.
    """
    if _sync_lock.locked():
        return {
            "synced_sources_count": 0,
            "new_flagged_incidents": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "messages": []
        }
    asyncio.create_task(sync_all_sources())
    sources = db.get_sources()
    return {
        "synced_sources_count": len(sources),
        "new_flagged_incidents": 0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "messages": []
    }


# ============================================================================
# Analytics & Repeat Targets Endpoints
# ============================================================================

@app.get("/stats", response_model=DashboardStats)
def get_stats():
    """
    Returns high-level statistics and chart series for the Overview dashboard.
    """
    t0 = time.perf_counter()
    stats = db.get_stats()
    duration_ms = (time.perf_counter() - t0) * 1000
    print(f"[Timing] GET /stats took {duration_ms:.2f}ms")
    return stats


@app.get("/repeat-targets", response_model=List[RepeatTargetItem])
def get_repeat_targets():
    """
    Aggregates flagged messages by target user to identify recurring harassment and pile-ons.
    """
    return db.get_repeat_targets()


# ============================================================================
# Live Classification Sandbox
# ============================================================================

@app.post("/classify", response_model=ClassifyResponse)
def classify_endpoint(payload: ClassifyRequest):
    """
    Accepts arbitrary text in Hindi, Hinglish, Punjabi, or English.
    Returns normalized transliteration, category, severity, and rationale.
    """
    result = classify_text(payload.text, payload.target_user, payload.context)
    return result


# ============================================================================
# System Settings & Alerts
# ============================================================================

@app.get("/settings", response_model=SystemSettings)
def get_settings():
    settings = db.get_settings()
    masked = dict(settings)
    raw_token = masked.get("telegram_bot_token", "")
    if raw_token:
        decrypted = decrypt_token(raw_token)
        masked["telegram_bot_token"] = mask_token(decrypted)
    return masked


@app.post("/settings", response_model=SystemSettings)
def save_settings(payload: SystemSettings):
    existing = db.get_settings()
    data = payload.dict()
    raw_token = data.get("telegram_bot_token", "")
    if "********" in raw_token:
        # Retain previous token if unchanged by user
        data["telegram_bot_token"] = existing.get("telegram_bot_token", "")
    elif raw_token:
        data["telegram_bot_token"] = encrypt_token(raw_token)

    saved = db.save_settings(data)
    res = dict(saved)
    res["telegram_bot_token"] = mask_token(raw_token) if raw_token else ""
    return res


@app.post("/alerts/test")
def test_alert(message_id: Optional[str] = None):
    """
    Triggers a test Telegram alert notification for demonstration and verification.
    """
    target_msg = None
    if message_id:
        target_msg = db.get_message_by_id(message_id)

    if not target_msg:
        # Pick the highest priority open message
        high_msgs = db.get_messages(severity="high")
        target_msg = high_msgs[0] if high_msgs else {
            "id": "msg_001",
            "channel_name": "Delhi University Student Forum",
            "platform": "telegram",
            "category": "Threat",
            "sender_name": "Karan Malhotra",
            "target_user": "@priya_sharma_du",
            "text": "@priya_sharma_du college aake dikha kal, tera vo haal karunga ki hospital me admit hona padega.",
        }

    alert_result = send_high_severity_alert(target_msg)
    return {
        "success": True,
        "message": "Alert dispatched to Telegram moderator DM webhook.",
        "details": alert_result,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)


