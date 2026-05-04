"""Clinical notes router — doctor creates notes, patients view them."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_doctor, get_current_patient_or_doctor
from app.models.database import get_db
from app.models.user import User
from app.schemas.clinical_schemas import ClinicalNoteCreate, ClinicalNoteResponse
from app.services.clinical_service import create_clinical_note, get_notes_for_patient_user, get_patient_notes

router = APIRouter(prefix="/clinical", tags=["Clinical Notes"])


@router.post("/notes", response_model=ClinicalNoteResponse, status_code=201, summary="Create a clinical note")
def create_note(data: ClinicalNoteCreate, current_user: User = Depends(get_current_doctor), db: Session = Depends(get_db)) -> ClinicalNoteResponse:
    return create_clinical_note(data, current_user.id, db)


@router.get("/notes", response_model=list[ClinicalNoteResponse], summary="List clinical notes")
def list_notes(
    patient_id: int | None = Query(None, description="Required for doctors, ignored for patients"),
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_patient_or_doctor), db: Session = Depends(get_db),
) -> list[ClinicalNoteResponse]:
    # Check if user has the doctor role
    is_doctor = any(r.role_name == "doctor" for r in current_user.roles)
    
    if is_doctor:
        if patient_id is None:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="patient_id is required for doctors")
        return get_patient_notes(patient_id, db, skip, limit)
    else:
        return get_notes_for_patient_user(current_user.id, db, skip, limit)
