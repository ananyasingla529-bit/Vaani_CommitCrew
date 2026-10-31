"""
Operations router for Vaani moderation console.
Houses endpoints for audit logs, student discipline histories, authentication,
and retention cleanup.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
import os
import db_ops
from services.security import (
    verify_password,
    create_access_token,
    get_current_user,
    DEFAULT_MODERATOR_EMAIL,
    DEFAULT_PW_HASH
)

ops_router = APIRouter(tags=["Operations & Security"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    role: str = "moderator"


@ops_router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    """
    Moderator authentication endpoint.
    Validates credentials against MODERATOR_EMAIL and MODERATOR_PASSWORD_HASH using bcrypt.
    Returns a signed JWT.
    """
    configured_email = os.getenv("MODERATOR_EMAIL", DEFAULT_MODERATOR_EMAIL)
    configured_hash = os.getenv("MODERATOR_PASSWORD_HASH", DEFAULT_PW_HASH)

    if payload.email.strip().lower() != configured_email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(payload.password, configured_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    token = create_access_token(subject=payload.email, role="moderator")
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        email=payload.email,
        role="moderator"
    )


@ops_router.get("/audit-log", response_model=List[Dict[str, Any]])
def get_audit_log(
    limit: int = Query(50, ge=1, le=500),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns recent human-in-the-loop moderation and administrative audit events.
    """
    return db_ops.get_audit_logs(limit=limit)


@ops_router.get("/students/{sender_id}/history", response_model=Dict[str, Any])
def get_student_history_endpoint(
    sender_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns incident timeline, warning count, ban status, and previous moderation actions
    for a specific student sender across all monitored platforms.
    """
    history = db_ops.get_student_history(sender_id)
    return history


@ops_router.post("/ops/retention-cleanup")
def run_retention_cleanup(
    days: Optional[int] = Query(None, description="Optional override for retention days (default 30)"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Hard Rule 7 Privacy retention cleanup job.
    Deletes flagged incidents older than RETENTION_DAYS.
    """
    deleted_count = db_ops.cleanup_old_messages(retention_days=days)
    return {
        "success": True,
        "deleted_count": deleted_count,
        "retention_days": days or int(os.getenv("RETENTION_DAYS", "30"))
    }

