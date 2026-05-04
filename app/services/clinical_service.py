"""
ClinicalService — doctor clinical notes for patients.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.clinical_note import ClinicalNote
from app.models.patient_doctor import Doctor, Patient
from app.schemas.clinical_schemas import ClinicalNoteCreate, ClinicalNoteResponse


def _get_doctor_or_404(user_id: int, db: Session) -> Doctor:
    stmt = select(Doctor).where(Doctor.user_id == user_id)
    doctor = db.execute(stmt).scalar_one_or_none()
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    return doctor


def _resolve_patient_id(user_id: int, db: Session) -> int:
    stmt = select(Patient.id).where(Patient.user_id == user_id)
    pid = db.execute(stmt).scalar_one_or_none()
    if pid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return pid


def _note_to_response(note: ClinicalNote, db: Session) -> ClinicalNoteResponse:
    doc_name_stmt = select(Doctor.full_name).where(Doctor.id == note.doctor_id)
    doc_name = db.execute(doc_name_stmt).scalar_one_or_none()
    pat_name_stmt = select(Patient.full_name).where(Patient.id == note.patient_id)
    pat_name = db.execute(pat_name_stmt).scalar_one_or_none()
    return ClinicalNoteResponse(
        id=note.id, doctor_id=note.doctor_id, patient_id=note.patient_id,
        note_text=note.note_text, priority=note.priority, status=note.status,
        created_at=note.created_at, doctor_name=doc_name, patient_name=pat_name,
    )


def create_clinical_note(data: ClinicalNoteCreate, user_id: int, db: Session) -> ClinicalNoteResponse:
    doctor = _get_doctor_or_404(user_id, db)
    # Verify patient exists
    pat_stmt = select(Patient.id).where(Patient.id == data.patient_id)
    if db.execute(pat_stmt).scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    note = ClinicalNote(
        doctor_id=doctor.id, patient_id=data.patient_id,
        note_text=data.note_text, priority=data.priority, status=data.status,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_to_response(note, db)


def get_patient_notes(patient_id: int, db: Session, skip: int = 0, limit: int = 50) -> list[ClinicalNoteResponse]:
    stmt = select(ClinicalNote).where(ClinicalNote.patient_id == patient_id).order_by(ClinicalNote.created_at.desc()).offset(skip).limit(limit)
    rows = db.execute(stmt).scalars().all()
    return [_note_to_response(r, db) for r in rows]


def get_notes_for_patient_user(user_id: int, db: Session, skip: int = 0, limit: int = 50) -> list[ClinicalNoteResponse]:
    pid = _resolve_patient_id(user_id, db)
    return get_patient_notes(pid, db, skip, limit)
