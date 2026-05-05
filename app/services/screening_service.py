"""
ScreeningService — handles sklearn-based risk predictions.

Uses pre-trained simple_model.pkl and advanced_model.pkl for
diabetes risk scoring, replacing the previous Gemini-based approach.
"""

import logging
from datetime import datetime, timezone

import numpy as np
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.patient_doctor import Patient
from app.models.screening import Screening, ScreeningAnswer, ScreeningType, Question
from app.schemas.screening_schemas import (
    ScreeningPredictRequest, 
    ScreeningResponse,
    ScreeningTestInfoResponse,
    QuestionResponse,
    ScreeningHistoryItem
)
from app.services.ai_service import AIModelService

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Recommendations
# ──────────────────────────────────────────────
_RECOMMENDATIONS = {
    "low": "Your risk is low. Maintain your healthy lifestyle.",
    "moderate": "Moderate risk detected. Consider consulting your doctor.",
    "high": "High risk detected. Please consult your doctor immediately.",
}


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


def _resolve_screening_type_id(screening_type: str, db: Session) -> int:
    """Look up screening_type_id from the ScreeningType table by name."""
    stmt = select(ScreeningType.id).where(
        func.lower(ScreeningType.name) == screening_type.lower()
    )
    type_id = db.execute(stmt).scalar_one_or_none()
    if type_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening type '{screening_type}' not found",
        )
    return type_id


def _classify_risk(score: float) -> str:
    """Map a 0-100 risk score to a categorical level."""
    if score < 33:
        return "low"
    elif score <= 66:
        return "moderate"
    return "high"


def _parse_bmi(raw_value) -> float:
    """Parse BMI from 'height_cm,weight_kg' string format.

    Example: '175,90' → height=1.75m, weight=90kg → BMI=29.39
    """
    try:
        parts = str(raw_value).split(",")
        height_cm = float(parts[0].strip())
        weight_kg = float(parts[1].strip())
        height_m = height_cm / 100.0
        if height_m > 0:
            return weight_kg / (height_m ** 2)
    except (IndexError, ValueError):
        pass
    return 0.0


def _extract_simple_features(answers: list) -> list[float]:
    """
    Build the feature vector for simple_model.pkl.

    Expected order (6 features):
    [age, bmi, glucose_level, physical_activity_level, family_history, smoker]

    Questions:
      1: age (int)
      2: bmi — answer_value format "height_cm,weight_kg"
      3: glucose_level (float)
      4: physical_activity_level (0/1/2)
      5: family_history (0/1)
      6: smoker (0/1)
    """
    answer_map: dict[int, object] = {}
    for a in answers:
        val = a.answer_numeric if a.answer_numeric is not None else a.answer_value
        answer_map[a.question_id] = val

    age = float(answer_map.get(1, 0))
    bmi = _parse_bmi(answer_map.get(2, "0,0"))
    glucose_level = float(answer_map.get(3, 0))

    # physical_activity_level: sedentary=0, moderate=1, active=2
    activity_raw = answer_map.get(4, 0)
    activity_map = {"sedentary": 0, "moderate": 1, "active": 2}
    physical_activity = (
        activity_map.get(str(activity_raw).lower(), int(float(activity_raw)))
        if not str(activity_raw).replace(".", "").isdigit()
        else int(float(activity_raw))
    )

    # family_history: 0 or 1
    fh_raw = answer_map.get(5, 0)
    family_history = 1 if str(fh_raw).lower() in ("yes", "1", "true") else 0

    # smoker: 0 or 1
    smoker_raw = answer_map.get(6, 0)
    smoker = 1 if str(smoker_raw).lower() in ("yes", "1", "true") else 0

    return [age, bmi, glucose_level, physical_activity, family_history, smoker]


def _extract_advanced_features(answers: list) -> list[float]:
    """
    Build the feature vector for advanced_model.pkl.

    Expected order (8 features):
    [gender, age, hypertension, heart_disease,
     smoking_history, bmi, HbA1c_level, blood_glucose_level]

    Questions:
      1: gender (male=1, female=0)
      2: age (int)
      3: hypertension (0/1)
      4: heart_disease (0/1)
      5: smoking_history (never=0, former=1, current=2)
      6: bmi — answer_value format "height_cm,weight_kg"
      7: HbA1c_level (float)
      8: blood_glucose_level (float)
    """
    answer_map: dict[int, object] = {}
    for a in answers:
        val = a.answer_numeric if a.answer_numeric is not None else a.answer_value
        answer_map[a.question_id] = val

    # gender: male=1, female=0
    gender_raw = answer_map.get(1, "male")
    gender = 1 if str(gender_raw).lower() in ("male", "1") else 0

    age = float(answer_map.get(2, 0))

    hypertension_raw = answer_map.get(3, 0)
    hypertension = 1 if str(hypertension_raw).lower() in ("yes", "1", "true") else 0

    heart_disease_raw = answer_map.get(4, 0)
    heart_disease = 1 if str(heart_disease_raw).lower() in ("yes", "1", "true") else 0

    smoking_raw = answer_map.get(5, "never")
    smoking_map = {"never": 0, "former": 1, "current": 2}
    smoking = smoking_map.get(str(smoking_raw).lower(), 0)

    bmi = _parse_bmi(answer_map.get(6, "0,0"))
    hba1c = float(answer_map.get(7, 0))
    blood_glucose = float(answer_map.get(8, 0))

    return [gender, age, hypertension, heart_disease, smoking, bmi, hba1c, blood_glucose]


# ──────────────────────────────────────────────
# Main prediction entry point
# ──────────────────────────────────────────────
def predict_and_save_screening(
    data: ScreeningPredictRequest, user_id: int | None, db: Session
) -> ScreeningResponse:
    """
    Runs the appropriate sklearn model (simple or advanced),
    computes risk score & level.

    If *user_id* is provided (authenticated caller), the result and
    answers are persisted to the database.  Otherwise the prediction
    is returned without saving (anonymous / public usage).
    """
    if not AIModelService.models_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are not loaded yet. Try again shortly.",
        )

    # Resolve screening_type_id from DB
    screening_type_id = _resolve_screening_type_id(data.screening_type, db)

    # 1. Build feature vector
    if data.screening_type == "simple":
        features = _extract_simple_features(data.answers)
        model = AIModelService._simple_model
    else:
        features = _extract_advanced_features(data.answers)
        model = AIModelService._advanced_model

    # 2. Predict
    try:
        proba = model.predict_proba([features])[0]
        risk_score = round(float(proba[1]) * 100, 2)
    except Exception as exc:
        logger.error("Model prediction failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model prediction error: {exc}",
        )

    risk_level = _classify_risk(risk_score)
    recommendation = _RECOMMENDATIONS[risk_level]

    # ── Anonymous caller: return prediction only, no DB write ──
    if user_id is None:
        return ScreeningResponse(
            id=0,
            patient_id=0,
            screening_type_id=screening_type_id,
            risk_level=risk_level,
            risk_score=risk_score,
            recommendation=recommendation,
            created_at=datetime.now(timezone.utc),
        )

    # ── Authenticated caller: persist to database ──────────────
    patient_id = _resolve_patient_id(user_id, db)

    screening = Screening(
        patient_id=patient_id,
        screening_type_id=screening_type_id,
        risk_score=risk_score,
        risk_level=risk_level,
    )
    db.add(screening)
    db.flush()

    for a in data.answers:
        ans = ScreeningAnswer(
            screening_id=screening.id,
            question_id=a.question_id,
            answer_value=a.answer_value or str(a.answer_numeric),
        )
        db.add(ans)

    db.commit()
    db.refresh(screening)

    resp = ScreeningResponse.model_validate(screening)
    resp.risk_score = risk_score
    resp.recommendation = recommendation
    return resp


def get_screening_questions(test_type: str, db: Session) -> ScreeningTestInfoResponse:
    """Get the questions for a specific screening type."""
    stmt = (
        select(ScreeningType)
        .options(selectinload(ScreeningType.questions))
        .where(func.lower(ScreeningType.name) == test_type.lower())
    )
    screening_type = db.execute(stmt).scalar_one_or_none()
    
    if not screening_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening type '{test_type}' not found",
        )
        
    questions = sorted(screening_type.questions, key=lambda q: q.display_order)
    
    # Simple hardcoded metadata for now based on name
    is_simple = (test_type.lower() == "simple")
    title = "Simple Screening" if is_simple else "Advanced Screening"
    desc = "A quick assessment using everyday health information." if is_simple else "A comprehensive assessment using clinical metrics."
    est_mins = 2 if is_simple else 5
    
    return ScreeningTestInfoResponse(
        test_type=screening_type.name,
        title=title,
        description=desc,
        estimated_minutes=est_mins,
        questions=[
            QuestionResponse(
                id=q.id,
                question_text=q.question_text,
                data_type=q.data_type,
                display_order=q.display_order,
            )
            for q in questions
        ]
    )


def get_screening_history(user_id: int, db: Session) -> list[ScreeningHistoryItem]:
    """Get the patient's screening history."""
    patient_id = _resolve_patient_id(user_id, db)
    
    stmt = (
        select(Screening, ScreeningType)
        .join(ScreeningType, ScreeningType.id == Screening.screening_type_id)
        .where(Screening.patient_id == patient_id)
        .order_by(Screening.created_at.desc())
    )
    
    results = db.execute(stmt).all()
    
    history = []
    for r in results:
        screening = r.Screening
        stype = r.ScreeningType
        
        # Determine risk label and recommendation
        risk_level = screening.risk_level or "low"
        risk_label = {
            "low": "Low Risk",
            "moderate": "Mid Risk",
            "high": "High Risk"
        }.get(risk_level.lower(), "Unknown Risk")
        
        history.append(
            ScreeningHistoryItem(
                screening_id=screening.id,
                screening_type=stype.name,
                risk_level=risk_level,
                risk_score=float(screening.risk_score or 0.0),
                risk_label=risk_label,
                recommendation=_RECOMMENDATIONS.get(risk_level, ""),
                created_at=screening.created_at,
            )
        )
        
    return history

