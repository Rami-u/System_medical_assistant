"""Clinical note schemas — request & response models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ClinicalNoteCreate(BaseModel):
    """Body for a doctor creating a clinical note for a patient."""

    patient_id: int
    note_text: str = Field(..., min_length=1)
    priority: str = Field("routine", pattern="^(routine|urgent|critical)$")
    status: str = Field("published", pattern="^(draft|published)$")


class ClinicalNoteResponse(BaseModel):
    """Clinical note returned to the frontend."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    patient_id: int
    note_text: str
    priority: str
    status: str
    created_at: datetime
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
