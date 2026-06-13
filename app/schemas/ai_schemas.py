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
    feedback: Optional[str] = None
    created_at: datetime


class AiFeedbackRequest(BaseModel):
    """Body for submitting feedback on an AI message."""

    feedback: str = Field(..., pattern=r"^(positive|negative)$")


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


# ── SEARCH ──────────────────────────────────────────────────
class AiSearchRequest(BaseModel):
    """Body for searching messages within conversations."""

    query: str = Field(..., min_length=1, max_length=200)


class AiSearchResult(BaseModel):
    """A single search result from message search."""

    conversation_id: int
    conversation_title: Optional[str] = None
    message_id: int
    sender: str
    snippet: str
    created_at: datetime


# ── EXPORT ──────────────────────────────────────────────────
class AiExportRequest(BaseModel):
    """Body for exporting a conversation."""

    format: str = Field(default="markdown", pattern=r"^(markdown|text)$")


# ── FUNCTION CALLING ────────────────────────────────────────
class AiFunctionCall(BaseModel):
    """A structured action the AI can request (e.g., create reminder, book appointment)."""

    function: str = Field(..., pattern=r"^(create_reminder|log_medication|book_appointment)$")
    parameters: dict = Field(default_factory=dict)
