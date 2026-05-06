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
    "low": "Your screening result is negative. No diabetes indicators detected. Maintain your healthy lifestyle.",
    "moderate": "Moderate risk detected. Consider consulting your doctor.",
    "high": "Your screening result is positive. Diabetes indicators detected. Please consult your doctor immediately for a clinical diagnosis.",
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
    Build the feature vector for the simple screening.

    NOTE: simple_model.pkl was trained on StandardScaler-normalized data
    but the scaler was NOT saved alongside the model. As a result, it
    always predicts "high" when given raw feature values.

    WORKAROUND: we map the 6 simple questions onto the 8-feature vector
    used by advanced_model.pkl (XGBoost, which works correctly on raw
    values).  Missing advanced fields (hypertension, heart_disease,
    smoking, HbA1c) are filled with conservative defaults.

    Simple questions:
      1: age (int)
      2: bmi — answer_value format "height_cm,weight_kg"
      3: glucose_level (float)  → maps to blood_glucose_level
      4: physical_activity_level (0/1/2)  — informational only, not in advanced model
      5: family_history (0/1)  — informational only
      6: smoker (0/1)  → maps to smoking_history (0 or 2)

    Advanced feature order:
      [gender, age, hypertension, heart_disease,
       smoking_history, bmi, HbA1c_level, blood_glucose_level]
    """
    answer_map: dict[int, object] = {}
    for a in answers:
        val = a.answer_numeric if a.answer_numeric is not None else a.answer_value
        answer_map[a.question_id] = val
        logger.info("  Q%d → answer_numeric=%s, answer_value=%s, chosen=%s", a.question_id, a.answer_numeric, a.answer_value, val)

    age = float(answer_map.get(1, 0))
    bmi = _parse_bmi(answer_map.get(2, "0,0"))
    glucose_level = float(answer_map.get(3, 0))

    # smoker -> smoking_history: no=0, yes=2(current)
    smoker_raw = answer_map.get(6, 0)
    smoking = 2 if str(smoker_raw).lower() in ("yes", "1", "true") else 0

    # family_history
    fh_raw = answer_map.get(5, 0)
    family_history = 1 if str(fh_raw).lower() in ("yes", "1", "true") else 0

    # activity
    activity_raw = answer_map.get(4, 0)
    activity_map = {"sedentary": 0, "moderate": 1, "active": 2}
    activity_str = str(activity_raw).lower().strip()
    if activity_str in activity_map:
        physical_activity = activity_map[activity_str]
    else:
        try:
            physical_activity = int(float(activity_raw))
        except (ValueError, TypeError):
            physical_activity = 1

    # ── Infer missing advanced features from simple data ──
    gender = 0  # conservative default

    # Estimate hypertension from age + BMI risk factors
    hypertension = 1 if (age >= 45 and bmi >= 28) else 0
    heart_disease = 0

    # Estimate HbA1c from blood glucose using the eAG formula:
    #   eAG (mg/dL) = 28.7 × HbA1c − 46.7
    #   HbA1c = (eAG + 46.7) / 28.7
    hba1c = (glucose_level + 46.7) / 28.7

    # Adjust based on risk factors
    if family_history:
        hba1c += 0.3
    if physical_activity == 0:  # sedentary
        hba1c += 0.2
    if bmi >= 30:
        hba1c += 0.2

    features = [gender, age, hypertension, heart_disease, smoking, bmi, hba1c, glucose_level]
    logger.info("SIMPLE->ADVANCED features: gender=%d, age=%.1f, hypertension=%d, heart_disease=%d, smoking=%d, bmi=%.2f, hba1c=%.1f, blood_glucose=%.1f",
                gender, age, hypertension, heart_disease, smoking, bmi, hba1c, glucose_level)
    logger.info("SIMPLE->ADVANCED feature vector: %s", features)
    return features


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
        logger.info("  Q%d → answer_numeric=%s, answer_value=%s, chosen=%s", a.question_id, a.answer_numeric, a.answer_value, val)

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

    features = [gender, age, hypertension, heart_disease, smoking, bmi, hba1c, blood_glucose]
    logger.info("ADVANCED features: gender=%d, age=%.1f, hypertension=%d, heart_disease=%d, smoking=%d, bmi=%.2f, hba1c=%.1f, blood_glucose=%.1f", gender, age, hypertension, heart_disease, smoking, bmi, hba1c, blood_glucose)
    logger.info("ADVANCED feature vector: %s", features)
    return features


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
    if not AIModelService.screening_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are not loaded yet. Try again shortly.",
        )

    # Resolve screening_type_id from DB
    screening_type_id = _resolve_screening_type_id(data.screening_type, db)

    # 1. Build feature vector
    #    NOTE: Both simple and advanced now use the advanced model (XGBoost)
    #    because simple_model.pkl was trained on scaled data without its
    #    scaler saved alongside it, causing it to always predict "high".
    if data.screening_type == "simple":
        features = _extract_simple_features(data.answers)
    else:
        features = _extract_advanced_features(data.answers)
    model = AIModelService._advanced_model

    # 2. Predict — binary classification (0 = Not Diabetic, 1 = Diabetic)
    try:
        logger.info("=== PREDICTION [%s] ===", data.screening_type)
        logger.info("Final feature vector: %s", features)
        prediction = int(model.predict([features])[0])
        logger.info("Model binary prediction: %d", prediction)
        logger.info("Model classes: %s", model.classes_)

        # Map binary output to diagnosis
        is_diabetic = prediction == 1
        diagnosis = "Diabetic" if is_diabetic else "Not Diabetic"
        risk_level = "high" if is_diabetic else "low"
        risk_score = 100.0 if is_diabetic else 0.0
        logger.info("diagnosis=%s, risk_level=%s", diagnosis, risk_level)
    except Exception as exc:
        logger.error("Model prediction failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model prediction error: {exc}",
        )

    recommendation = _RECOMMENDATIONS[risk_level]

    # ── Anonymous caller: return prediction only, no DB write ──
    if user_id is None:
        return ScreeningResponse(
            id=0,
            patient_id=0,
            screening_type_id=screening_type_id,
            risk_level=risk_level,
            risk_score=risk_score,
            diagnosis=diagnosis,
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
    resp.diagnosis = diagnosis
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
        
        # Determine diagnosis from risk_level
        risk_level = screening.risk_level or "low"
        is_diabetic = risk_level.lower() == "high"
        diagnosis = "Diabetic" if is_diabetic else "Not Diabetic"
        risk_label = "Diabetic" if is_diabetic else "Not Diabetic"
        
        history.append(
            ScreeningHistoryItem(
                screening_id=screening.id,
                screening_type=stype.name,
                risk_level=risk_level,
                risk_score=float(screening.risk_score or 0.0),
                risk_label=risk_label,
                diagnosis=diagnosis,
                recommendation=_RECOMMENDATIONS.get(risk_level, ""),
                created_at=screening.created_at,
            )
        )
        
    return history