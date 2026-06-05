"""Doctor service — business logic for doctor dashboard and patient management."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import case, func, select, and_, cast, Integer
from sqlalchemy.orm import Session, selectinload

import app.schemas.doctor_schemas as schemas
from app.models.alert import Alert
from app.models.clinical_note import ClinicalNote
from app.models.glucose_log import GlucoseLog
from app.models.health_preferences import HealthPreferences
from app.models.lookup import LkDiabetesType
from app.models.meal_log import MealLog
from app.models.patient_doctor import Doctor, Patient, doctor_patient_table
from app.models.screening import Screening


def _verify_doctor_patient(doctor_id: int, patient_id: int, db: Session) -> None:
    """Verify that the patient is assigned to this doctor."""
    stmt = select(doctor_patient_table).where(
        doctor_patient_table.c.doctor_id == doctor_id,
        doctor_patient_table.c.patient_id == patient_id,
    )
    if db.execute(stmt).first() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient not assigned to this doctor",
        )


def _resolve_doctor_id(user_id: int, db: Session) -> int:
    """Resolve Doctor.id (doctors table PK) from users.id."""
    doctor_id = db.execute(
        select(Doctor.id).where(Doctor.user_id == user_id)
    ).scalar_one_or_none()
    if doctor_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found",
        )
    return doctor_id


def get_dashboard(user_id: int, db: Session) -> schemas.DoctorDashboardResponse:
    doctor_id = _resolve_doctor_id(user_id, db)
    doctor = db.execute(select(Doctor).where(Doctor.id == doctor_id)).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    today = datetime.now(timezone.utc)
    three_days_ago = today - timedelta(days=3)

    # 1. Latest Glucose Subquery
    latest_glucose_sq = (
        select(
            GlucoseLog.patient_id,
            GlucoseLog.glucose_value,
            GlucoseLog.recorded_at,
            func.row_number().over(
                partition_by=GlucoseLog.patient_id,
                order_by=GlucoseLog.recorded_at.desc(),
            ).label("rn"),
        ).subquery()
    )
    latest_glucose = select(latest_glucose_sq).where(latest_glucose_sq.c.rn == 1).subquery()

    # 2. Latest Screening Subquery
    latest_screening_sq = (
        select(
            Screening.patient_id,
            Screening.risk_level,
            func.row_number().over(
                partition_by=Screening.patient_id,
                order_by=Screening.created_at.desc(),
            ).label("rn"),
        ).subquery()
    )
    latest_screening = select(latest_screening_sq).where(latest_screening_sq.c.rn == 1).subquery()

    # 3. Patient Stats Aggregation
    stmt = (
        select(
            Patient.id.label("patient_id"),
            Patient.full_name,
            LkDiabetesType.type_name.label("diabetes_type"),
            HealthPreferences.min_glucose,
            HealthPreferences.max_glucose,
            func.count(GlucoseLog.id).label("total_readings"),
            func.sum(
                case(
                    (
                        and_(
                            GlucoseLog.glucose_value >= func.coalesce(HealthPreferences.min_glucose, 70),
                            GlucoseLog.glucose_value <= func.coalesce(HealthPreferences.max_glucose, 140),
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("in_range_readings"),
            func.avg(GlucoseLog.glucose_value).label("avg_glucose"),
            latest_glucose.c.glucose_value.label("latest_glucose_value"),
            latest_glucose.c.recorded_at.label("latest_log_time"),
            func.coalesce(latest_screening.c.risk_level, "low").label("risk_level"),
        )
        .select_from(Patient)
        .join(doctor_patient_table, doctor_patient_table.c.patient_id == Patient.id)
        .outerjoin(HealthPreferences, HealthPreferences.patient_id == Patient.id)
        .outerjoin(LkDiabetesType, LkDiabetesType.id == Patient.diabetes_type_id)
        .outerjoin(GlucoseLog, GlucoseLog.patient_id == Patient.id)
        .outerjoin(latest_glucose, latest_glucose.c.patient_id == Patient.id)
        .outerjoin(latest_screening, latest_screening.c.patient_id == Patient.id)
        .where(doctor_patient_table.c.doctor_id == doctor_id)
        .group_by(
            Patient.id,
            Patient.full_name,
            LkDiabetesType.type_name,
            HealthPreferences.min_glucose,
            HealthPreferences.max_glucose,
            latest_glucose.c.glucose_value,
            latest_glucose.c.recorded_at,
            latest_screening.c.risk_level,
        )
    )

    results = db.execute(stmt).all()

    total_patients = len(results)
    in_range_count = 0
    need_attention_count = 0
    risk_dist = {"high": 0, "moderate": 0, "low": 0}
    patients_needing_attention = []

    for row in results:
        # Time in Range
        tir_pct = 0
        if row.total_readings and row.total_readings > 0:
            tir_pct = int((row.in_range_readings / row.total_readings) * 100)

        # In Range Overall (arbitrary definition: >70% TIR means patient is "in range")
        if tir_pct >= 70:
            in_range_count += 1

        # Risk Distribution
        risk = (row.risk_level or "low").lower()
        if risk in risk_dist:
            risk_dist[risk] += 1
        else:
            risk_dist["low"] += 1

        # Need Attention Logic
        # 1. Latest glucose out of range OR
        # 2. No glucose log in last 3 days
        needs_attn = False
        min_g = row.min_glucose or 70
        max_g = row.max_glucose or 140

        # Parse latest_log_time — SQLite subqueries return strings
        latest_log_time = row.latest_log_time
        if isinstance(latest_log_time, str):
            try:
                latest_log_time = datetime.fromisoformat(latest_log_time)
            except (ValueError, TypeError):
                latest_log_time = None

        # Ensure both sides are naive for comparison (SQLite stores naive)
        three_days_ago_naive = three_days_ago.replace(tzinfo=None)
        if latest_log_time is not None and latest_log_time.tzinfo is not None:
            latest_log_time = latest_log_time.replace(tzinfo=None)

        if latest_log_time is None or latest_log_time < three_days_ago_naive:
            needs_attn = True
        elif row.latest_glucose_value is not None:
            if not (min_g <= row.latest_glucose_value <= max_g):
                needs_attn = True

        if needs_attn:
            need_attention_count += 1
            patients_needing_attention.append(
                schemas.PatientAttention(
                    patient_id=row.patient_id,
                    full_name=row.full_name,
                    patient_code=f"P-{str(row.patient_id).zfill(4)}",
                    diabetes_type=row.diabetes_type,
                    avg_glucose=int(row.avg_glucose or 0),
                    time_in_range_pct=tir_pct,
                    risk_level=risk,
                )
            )

    in_range_pct_overall = int((in_range_count / total_patients) * 100) if total_patients > 0 else 0

    # 4. Population Trend (last 14 days)
    fourteen_days_ago = today - timedelta(days=14)
    trend_stmt = (
        select(
            func.date(GlucoseLog.recorded_at).label("log_date"),
            func.avg(GlucoseLog.glucose_value).label("avg_g"),
            func.max(GlucoseLog.glucose_value).label("max_g"),
            func.min(GlucoseLog.glucose_value).label("min_g"),
        )
        .join(Patient, Patient.id == GlucoseLog.patient_id)
        .join(doctor_patient_table, doctor_patient_table.c.patient_id == Patient.id)
        .where(
            doctor_patient_table.c.doctor_id == doctor_id,
            GlucoseLog.recorded_at >= fourteen_days_ago,
        )
        .group_by(func.date(GlucoseLog.recorded_at))
        .order_by(func.date(GlucoseLog.recorded_at))
    )
    
    trend_results = db.execute(trend_stmt).all()
    population_trend = []
    for r in trend_results:
        dt_obj = datetime.strptime(r.log_date, "%Y-%m-%d") if isinstance(r.log_date, str) else r.log_date
        date_str = dt_obj.strftime("%b %d")
        population_trend.append(
            schemas.PopulationTrendPoint(
                date=date_str,
                avg=int(r.avg_g or 0),
                max=int(r.max_g or 0),
                min=int(r.min_g or 0),
            )
        )

    return schemas.DoctorDashboardResponse(
        doctor_name=doctor.full_name,
        today_date=today.strftime("%Y-%m-%d"),
        stats=schemas.DashboardStats(
            total_patients=total_patients,
            in_range_count=in_range_count,
            in_range_pct=in_range_pct_overall,
            need_attention=need_attention_count,
        ),
        population_trend=population_trend,
        risk_distribution=risk_dist,
        patients_needing_attention=patients_needing_attention,
    )


def list_patients(user_id: int, risk: Optional[str], search: Optional[str], db: Session) -> schemas.DoctorPatientListResponse:
    doctor_id = _resolve_doctor_id(user_id, db)
    # 1. Latest Screening Subquery (for risk level)
    latest_screening_sq = (
        select(
            Screening.patient_id,
            Screening.risk_level,
            func.row_number().over(
                partition_by=Screening.patient_id,
                order_by=Screening.created_at.desc(),
            ).label("rn"),
        ).subquery()
    )
    latest_screening = select(latest_screening_sq).where(latest_screening_sq.c.rn == 1).subquery()

    # 2. Latest Visit Subquery (using latest clinical note)
    latest_visit_sq = (
        select(
            ClinicalNote.patient_id,
            ClinicalNote.created_at.label("last_visit_date"),
            func.row_number().over(
                partition_by=ClinicalNote.patient_id,
                order_by=ClinicalNote.created_at.desc(),
            ).label("rn"),
        ).subquery()
    )
    latest_visit = select(latest_visit_sq).where(latest_visit_sq.c.rn == 1).subquery()

    # Base statement
    stmt = (
        select(
            Patient.id.label("patient_id"),
            Patient.full_name,
            LkDiabetesType.type_name.label("diabetes_type"),
            func.coalesce(latest_screening.c.risk_level, "low").label("risk_level"),
            latest_visit.c.last_visit_date,
            func.avg(GlucoseLog.glucose_value).label("avg_glucose"),
        )
        .select_from(Patient)
        .join(doctor_patient_table, doctor_patient_table.c.patient_id == Patient.id)
        .outerjoin(LkDiabetesType, LkDiabetesType.id == Patient.diabetes_type_id)
        .outerjoin(latest_screening, latest_screening.c.patient_id == Patient.id)
        .outerjoin(latest_visit, latest_visit.c.patient_id == Patient.id)
        .outerjoin(GlucoseLog, GlucoseLog.patient_id == Patient.id)
        .where(doctor_patient_table.c.doctor_id == doctor_id)
        .group_by(
            Patient.id,
            Patient.full_name,
            LkDiabetesType.type_name,
            latest_screening.c.risk_level,
            latest_visit.c.last_visit_date,
        )
    )

    if search:
        stmt = stmt.where(Patient.full_name.ilike(f"%{search}%"))

    if risk:
        stmt = stmt.where(func.lower(func.coalesce(latest_screening.c.risk_level, "low")) == risk.lower())

    results = db.execute(stmt).all()

    patients_list = []
    for r in results:
        last_visit_str = None
        if r.last_visit_date:
            # SQLite may return dates as strings
            if isinstance(r.last_visit_date, str):
                try:
                    parsed = datetime.fromisoformat(r.last_visit_date)
                    last_visit_str = parsed.strftime("%b %d, %Y")
                except (ValueError, TypeError):
                    last_visit_str = r.last_visit_date
            else:
                last_visit_str = r.last_visit_date.strftime("%b %d, %Y")
            
        patients_list.append(
            schemas.PatientListItem(
                patient_id=r.patient_id,
                full_name=r.full_name,
                patient_code=f"P-{str(r.patient_id).zfill(4)}",
                diabetes_type=r.diabetes_type,
                risk_level=r.risk_level,
                last_visit=last_visit_str,
                avg_glucose=int(r.avg_glucose) if r.avg_glucose is not None else None,
            )
        )

    return schemas.DoctorPatientListResponse(patients=patients_list)


def get_patient_profile(user_id: int, patient_id: int, db: Session) -> schemas.DoctorPatientProfileResponse:
    doctor_id = _resolve_doctor_id(user_id, db)
    _verify_doctor_patient(doctor_id, patient_id, db)

    patient = db.execute(
        select(Patient)
        .options(
            selectinload(Patient.health_preferences),
            selectinload(Patient.diabetes_type),
            selectinload(Patient.user),
            # Load these directly rather than N+1
            selectinload(Patient.glucose_logs),
            selectinload(Patient.meal_logs),
            selectinload(Patient.clinical_notes),
        )
        .where(Patient.id == patient_id)
    ).scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    today = datetime.now(timezone.utc)
    
    # Calculate age
    age = None
    if patient.dob:
        age = today.year - patient.dob.year - ((today.month, today.day) < (patient.dob.month, patient.dob.day))

    # BMI
    bmi = None
    if patient.height_cm and patient.weight_kg:
        h_m = float(patient.height_cm) / 100.0
        bmi = round(float(patient.weight_kg) / (h_m * h_m), 1)

    # Sort logs locally since we used selectinload
    glucose_logs = sorted(patient.glucose_logs, key=lambda x: x.recorded_at, reverse=True)
    meal_logs = sorted(patient.meal_logs, key=lambda x: x.meal_time, reverse=True)
    notes = sorted(patient.clinical_notes, key=lambda x: x.created_at, reverse=True)

    min_g = float(patient.health_preferences.min_glucose) if patient.health_preferences else 70.0
    max_g = float(patient.health_preferences.max_glucose) if patient.health_preferences else 140.0

    avg_glucose = int(sum(float(g.glucose_value) for g in glucose_logs) / len(glucose_logs)) if glucose_logs else 0
    latest_glucose = int(glucose_logs[0].glucose_value) if glucose_logs else 0

    # Latest screening risk level
    latest_screening = db.execute(
        select(Screening.risk_level)
        .where(Screening.patient_id == patient_id)
        .order_by(Screening.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    risk_level = (latest_screening or "low").lower()

    # Glucose trend (last 14 days)
    fourteen_days_ago = today - timedelta(days=14)
    fourteen_days_ago_naive = fourteen_days_ago.replace(tzinfo=None)
    trend_logs = []
    for g in glucose_logs:
        rec_at = g.recorded_at
        if isinstance(rec_at, str):
            try:
                rec_at = datetime.fromisoformat(rec_at)
            except (ValueError, TypeError):
                continue
        rec_at_naive = rec_at.replace(tzinfo=None) if rec_at.tzinfo else rec_at
        if rec_at_naive >= fourteen_days_ago_naive:
            trend_logs.append(g)
    # Group by date locally
    daily_glucose = {}
    for g in trend_logs:
        d_str = g.recorded_at.strftime("%b %d")
        if d_str not in daily_glucose:
            daily_glucose[d_str] = []
        daily_glucose[d_str].append(float(g.glucose_value))
    
    glucose_trend = []
    for d_str, values in daily_glucose.items():
        avg_v = sum(values) / len(values)
        glucose_trend.append(
            schemas.GlucoseTrendPoint(
                date=d_str,
                value=round(avg_v, 1),
                in_range=(min_g <= avg_v <= max_g)
            )
        )
    # Re-sort trend chronologically (simplified by date parsing)
    glucose_trend.sort(key=lambda x: datetime.strptime(x.date, "%b %d").replace(year=today.year))

    # Weekly avg (last 4 weeks)
    weekly_avg_glucose = []
    for i in range(4):
        start_date = (today - timedelta(days=(i+1)*7)).replace(tzinfo=None)
        end_date = (today - timedelta(days=i*7)).replace(tzinfo=None)
        week_logs = []
        for g in glucose_logs:
            rec_at = g.recorded_at
            if isinstance(rec_at, str):
                try:
                    rec_at = datetime.fromisoformat(rec_at)
                except (ValueError, TypeError):
                    continue
            rec_naive = rec_at.replace(tzinfo=None) if rec_at.tzinfo else rec_at
            if start_date <= rec_naive < end_date:
                week_logs.append(g)
        if week_logs:
            w_avg = int(sum(float(g.glucose_value) for g in week_logs) / len(week_logs))
            weekly_avg_glucose.append(schemas.WeeklyAvgPoint(week=f"Wk {i+1}", avg=w_avg))
    weekly_avg_glucose.reverse()

    # Daily carbs (last 7 days)
    seven_days_ago = today - timedelta(days=7)
    seven_days_ago_naive = seven_days_ago.replace(tzinfo=None)
    recent_meals = []
    for m in meal_logs:
        mt = m.meal_time
        if isinstance(mt, str):
            try:
                mt = datetime.fromisoformat(mt)
            except (ValueError, TypeError):
                continue
        mt_naive = mt.replace(tzinfo=None) if mt.tzinfo else mt
        if mt_naive >= seven_days_ago_naive:
            recent_meals.append(m)
    daily_carbs = {}
    for m in recent_meals:
        d_str = m.meal_time.strftime("%a")
        if d_str not in daily_carbs:
            daily_carbs[d_str] = 0.0
        daily_carbs[d_str] += float(m.total_carbs_g or 0)
    
    daily_carb_intake = [schemas.DailyCarbPoint(date=d, carbs_g=c) for d, c in daily_carbs.items()]

    return schemas.DoctorPatientProfileResponse(
        patient_id=patient.id,
        full_name=patient.full_name,
        patient_code=f"P-{str(patient.id).zfill(4)}",
        age=age,
        gender=patient.gender,
        dob=patient.dob,
        email=patient.user.email if patient.user else None,
        stats=schemas.PatientStatsBlock(
            avg_glucose=avg_glucose,
            latest_glucose=latest_glucose,
            bmi=bmi,
            risk_level=risk_level,
        ),
        physical=schemas.PhysicalBlock(
            height_cm=float(patient.height_cm) if patient.height_cm else None,
            weight_kg=float(patient.weight_kg) if patient.weight_kg else None,
            bmi=bmi,
            diagnosis=patient.diabetes_type.type_name if patient.diabetes_type else None,
        ),
        preferences=schemas.PatientPreferencesBlock(
            min_glucose=float(patient.health_preferences.min_glucose) if patient.health_preferences else 70.0,
            max_glucose=float(patient.health_preferences.max_glucose) if patient.health_preferences else 140.0,
            carb_limit_g=float(patient.health_preferences.carb_limit_g) if patient.health_preferences else 60.0,
            diet_type=patient.health_preferences.diet_type if patient.health_preferences else None,
        ),
        glucose_trend=glucose_trend,
        weekly_avg_glucose=weekly_avg_glucose,
        daily_carb_intake=daily_carb_intake,
        glucose_logs=[
            schemas.GlucoseLogItem(
                id=g.id,
                glucose_value=float(g.glucose_value),
                reading_type=g.reading_type,
                recorded_at=g.recorded_at,
                notes=g.notes,
            )
            for g in glucose_logs[:10]  # Limit to latest 10
        ],
        meal_logs=[
            schemas.MealLogItem(
                id=m.id,
                meal_name=m.meal_name,
                total_carbs_g=float(m.total_carbs_g) if m.total_carbs_g is not None else None,
                meal_time=m.meal_time,
            )
            for m in meal_logs[:10]  # Limit to latest 10
        ],
        clinical_notes=[
            schemas.ClinicalNoteItem(
                id=n.id,
                note_text=n.note_text,
                priority=n.priority,
                status=n.status,
                created_at=n.created_at,
            )
            for n in notes[:10]  # Limit to latest 10
        ],
    )


def get_patient_glucose(user_id: int, patient_id: int, db: Session, days: int) -> list[dict]:
    doctor_id = _resolve_doctor_id(user_id, db)
    _verify_doctor_patient(doctor_id, patient_id, db)
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(GlucoseLog)
        .where(
            GlucoseLog.patient_id == patient_id,
            GlucoseLog.recorded_at >= cutoff,
        )
        .order_by(GlucoseLog.recorded_at.desc())
    )
    logs = db.execute(stmt).scalars().all()
    
    # Returning dicts to match the router's expected response model automatically
    return [
        {
            "id": g.id,
            "patient_id": g.patient_id,
            "glucose_value": float(g.glucose_value),
            "reading_type": g.reading_type,
            "recorded_at": g.recorded_at,
            "notes": g.notes,
            "created_at": g.created_at,
        }
        for g in logs
    ]


def create_doctor_note(user_id: int, data: schemas.DoctorNoteCreate, db: Session) -> schemas.DoctorNoteResponse:
    doctor_id = _resolve_doctor_id(user_id, db)
    _verify_doctor_patient(doctor_id, data.patient_id, db)
    
    note = ClinicalNote(
        doctor_id=doctor_id,
        patient_id=data.patient_id,
        note_text=data.note_text,
        priority=data.priority,
        status="published",
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    
    return schemas.DoctorNoteResponse(
        id=note.id,
        patient_id=note.patient_id,
        note_text=note.note_text,
        priority=note.priority,
        status=note.status,
        created_at=note.created_at,
    )


def list_doctor_notes(user_id: int, patient_id: int, db: Session) -> list[schemas.DoctorNoteResponse]:
    doctor_id = _resolve_doctor_id(user_id, db)
    _verify_doctor_patient(doctor_id, patient_id, db)
    
    stmt = (
        select(ClinicalNote)
        .where(
            ClinicalNote.doctor_id == doctor_id,
            ClinicalNote.patient_id == patient_id,
        )
        .order_by(ClinicalNote.created_at.desc())
    )
    notes = db.execute(stmt).scalars().all()
    return [
        schemas.DoctorNoteResponse(
            id=n.id,
            patient_id=n.patient_id,
            note_text=n.note_text,
            priority=n.priority,
            status=n.status,
            created_at=n.created_at,
        )
        for n in notes
    ]


def get_doctor_alerts(user_id: int, db: Session) -> list[schemas.DoctorAlertResponse]:
    doctor_id = _resolve_doctor_id(user_id, db)
    stmt = (
        select(Alert, Patient)
        .join(Patient, Patient.id == Alert.patient_id)
        .join(doctor_patient_table, doctor_patient_table.c.patient_id == Patient.id)
        .where(doctor_patient_table.c.doctor_id == doctor_id)
    )
    
    results = db.execute(stmt).all()
    
    # Sort: critical first, then moderate, low, then created_at DESC
    severity_order = {"critical": 0, "moderate": 1, "low": 2}
    sorted_results = sorted(
        results, 
        key=lambda x: (severity_order.get(x.Alert.severity, 3), -x.Alert.created_at.timestamp())
    )
    
    return [
        schemas.DoctorAlertResponse(
            alert_id=r.Alert.id,
            patient_name=r.Patient.full_name,
            patient_id=r.Patient.id,
            alert_type=r.Alert.alert_type,
            severity=r.Alert.severity,
            message=r.Alert.message,
            created_at=r.Alert.created_at,
            is_read=r.Alert.is_read,
        )
        for r in sorted_results
    ]


def mark_alert_read(user_id: int, alert_id: int, db: Session) -> dict:
    doctor_id = _resolve_doctor_id(user_id, db)
    stmt = (
        select(Alert)
        .join(doctor_patient_table, doctor_patient_table.c.patient_id == Alert.patient_id)
        .where(
            Alert.id == alert_id,
            doctor_patient_table.c.doctor_id == doctor_id,
        )
    )
    alert = db.execute(stmt).scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found or does not belong to a patient of this doctor",
        )
        
    alert.is_read = True
    db.commit()
    
    return {"message": "Alert marked as read"}
