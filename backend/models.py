"""
Pydantic data models for the Vaani moderation console.
Adheres to the normalized message schema across Telegram, Discord, and YouTube.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


PlatformType = Literal["telegram", "discord", "youtube"]
SeverityType = Literal["low", "medium", "high"]
CategoryType = Literal[
    "Insult/Bullying",
    "Harassment",
    "Hate speech",
    "Threat",
    "Sexual content",
    "Other"
]
StatusType = Literal["new", "reviewed", "dismissed", "escalated"]
SourceStatusType = Literal["pending", "connected", "permission_missing"]


class NormalizedMessage(BaseModel):
    id: str
    platform: PlatformType
    source_id: str
    channel_name: str
    sender_id: str
    sender_name: str
    text: str
    normalized_text: str
    language: str
    timestamp: str
    context: List[str] = Field(default_factory=list, description="Previous 3 messages for conversational context")
    category: CategoryType
    severity: SeverityType
    explanation: str
    target_user: Optional[str] = None
    status: StatusType = "new"
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None


class MessageStatusUpdate(BaseModel):
    status: StatusType
    action: Optional[str] = None
    reviewed_by: Optional[str] = "moderator@vaani.org"
    notes: Optional[str] = None


class ConnectedSource(BaseModel):
    id: str
    platform: PlatformType
    channel_id: str
    channel_name: str
    url: str
    status: SourceStatusType = "connected"
    flags_count: int = 0
    created_at: str
    permission_hint: Optional[str] = None


class SourceCreateRequest(BaseModel):
    url: str
    platform: Optional[PlatformType] = None
    channel_name: Optional[str] = None


class ClassifyRequest(BaseModel):
    text: str
    target_user: Optional[str] = None


class ClassifyResponse(BaseModel):
    category: CategoryType
    severity: SeverityType
    language: str
    normalized_text: str
    explanation: str
    target_user: Optional[str] = None
    confidence: float
    flagged: bool


class DashboardStats(BaseModel):
    messages_scanned: int
    messages_flagged: int
    high_severity_open: int
    avg_review_time_mins: float
    flags_over_time: List[dict]
    flags_by_category: List[dict]
    flags_by_language: List[dict]
    flags_by_platform: List[dict]


class RepeatTargetItem(BaseModel):
    target_user: str
    incident_count: int
    severity_breakdown: dict
    platforms: List[str]
    channels: List[str]
    first_seen: str
    last_seen: str
    sample_messages: List[NormalizedMessage]
    pile_on_detected: bool


class SystemSettings(BaseModel):
    instant_high_severity: bool = True
    daily_digest_low: bool = True
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    monitored_languages: List[str] = ["Hindi (Romanized)", "Hinglish", "Punjabi (Romanized)", "English"]
    mock_mode: bool = True
