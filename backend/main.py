"""
Vaani Moderation Console - FastAPI Backend.
Serves REST endpoints for messages, sources, stats, repeat targets, settings, and live classification.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()

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
from services.ingest_worker import sync_all_sources

# Initialize FastAPI application
app = FastAPI(
    title="Vaani Moderation API",
    description="Multi-platform toxic speech & cyber-bullying moderation backend for Telegram, Discord, and YouTube.",
    version="1.0.4",
)

# Enable CORS for local Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    """Initializes SQLite database and seeds initial mock dataset if empty."""
    db.init_db()
    print("[Vaani Backend] SQLite database initialized and ready.")
    mock_flag = os.getenv("MOCK_MODE", "True")
    print(f"[Vaani Backend] MOCK_MODE={mock_flag}")


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
    Updates status workflow (New, Reviewed, Dismissed, Escalated).
    Records moderator identity and review timestamp.
    """
    reviewed_at = datetime.now(timezone.utc).isoformat()
    reviewer = payload.reviewed_by or "moderator@vaani.org"
    
    updated = db.update_message_status(
        msg_id=message_id,
        status=payload.status,
        reviewed_by=reviewer,
        reviewed_at=reviewed_at,
    )
    if not updated:
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
    Adds a new community channel with parsed platform recognition.
    """
    url = payload.url.strip()
    platform = payload.platform
    if not platform:
        if "t.me" in url or "telegram.me" in url:
            platform = "telegram"
        elif "discord" in url:
            platform = "discord"
        elif "youtube.com" in url or "youtu.be" in url:
            platform = "youtube"
        else:
            platform = "telegram"

    source_id = f"src_{platform}_{int(datetime.now(timezone.utc).timestamp())}"
    channel_name = payload.channel_name or f"Connected {platform.capitalize()} Channel"

    new_source = {
        "id": source_id,
        "platform": platform,
        "channel_id": f"chan_{int(datetime.now(timezone.utc).timestamp()) % 1000000}",
        "channel_name": channel_name,
        "url": url,
        "status": "connected",
        "flags_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "permission_hint": None,
    }

    return db.insert_source(new_source)


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
    Polls all connected channels across Telegram, Discord, and YouTube in real-time,
    evaluates messages through the classifier, and inserts flagged incidents.
    """
    sync_summary = await sync_all_sources()
    return sync_summary


# ============================================================================
# Analytics & Repeat Targets Endpoints
# ============================================================================

@app.get("/stats", response_model=DashboardStats)
def get_stats():
    """
    Returns high-level statistics and chart series for the Overview dashboard.
    """
    return db.get_stats()


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
    result = classify_text(payload.text, payload.target_user)
    return result


# ============================================================================
# System Settings & Alerts
# ============================================================================

@app.get("/settings", response_model=SystemSettings)
def get_settings():
    return db.get_settings()


@app.post("/settings", response_model=SystemSettings)
def save_settings(payload: SystemSettings):
    return db.save_settings(payload.dict())


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
