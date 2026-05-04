"""
ScreeningService — handles AI-based risk predictions.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.patient_doctor import Patient
from app.models.screening import Screening, ScreeningAnswer
from app.schemas.screening_schemas import ScreeningPredictRequest, ScreeningResponse
from app.services.ai_service import predict_screening_risk


def _resolve_patient_id(user_id: int, db: Session) -> int:
    """Resolve patient.id from user.id, raise 404 if no profile."""
    stmt = select(Patient.id).where(Patient.user_id == user_id)
    patient_id = db.execute(stmt).scalar_one_or_none()
    if patient_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    return patient_id


def predict_and_save_screening(
    data: ScreeningPredictRequest, user_id: int, db: Session
) -> ScreeningResponse:
    """
    Sends answers to Gemini AI, evaluates risk level,
    and saves both the screening result and the provided answers.
    """
    patient_id = _resolve_patient_id(user_id, db)

    # 1. Format answers for the AI prompt
    answers_text = []
    for a in data.answers:
        val = a.answer_value if a.answer_value else str(a.answer_numeric)
        answers_text.append(f"Question ID {a.question_id}: {val}")

    # 2. Call AI service
    ai_result = predict_screening_risk("\n".join(answers_text))

    # 3. Save Screening
    screening = Screening(
        patient_id=patient_id,
        screening_type_id=data.screening_type_id,
        risk_level=ai_result.get("risk_level", "Unknown"),
        ai_confidence_pct=ai_result.get("confidence_pct"),
        ai_notes=ai_result.get("notes"),
    )
    db.add(screening)
    db.flush()

    # 4. Save Answers in same transaction
    for a in data.answers:
        ans = ScreeningAnswer(
            screening_id=screening.id,
            question_id=a.question_id,
            answer_value=a.answer_value,
            answer_numeric=a.answer_numeric,
        )
        db.add(ans)

    db.commit()
    db.refresh(screening)
    return ScreeningResponse.model_validate(screening)
