"""AI conversation & message schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── MESSAGES ────────────────────────────────────────────────
class AiChatRequest(BaseModel):
    """Body for sending a message in an AI conversation."""

    message: str = Field(..., min_length=1, max_length=2000)


class AiMessageResponse(BaseModel):
    """Single message in an AI conversation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    sender: str
    message_text: str
    created_at: datetime


# ── CONVERSATIONS ───────────────────────────────────────────
class AiConversationCreate(BaseModel):
    """Body for starting a new AI conversation."""

    title: Optional[str] = Field(None, max_length=200)


class AiConversationResponse(BaseModel):
    """Conversation with its messages."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    title: Optional[str] = None
    created_at: datetime
    messages: list[AiMessageResponse] = Field(default_factory=list)


class AiConversationListItem(BaseModel):
    """Lightweight conversation for list views (no messages)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None
    created_at: datetime
    message_count: int = 0
