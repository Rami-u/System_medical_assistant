"""Alert schemas — response & bulk-update models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AlertResponse(BaseModel):
    """Single alert returned to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    alert_type: str
    severity: str
    message: str
    is_read: bool
    created_at: datetime


class AlertMarkReadRequest(BaseModel):
    """Request body to mark one or more alerts as read."""

    alert_ids: list[int] = Field(..., min_length=1)
