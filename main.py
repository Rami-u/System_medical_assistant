import logging

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.database import Base, engine

# Import all models so Base.metadata knows about every table
from app.models import (  # noqa: F401
    AiConversation, AiMessage, Alert, AuditLog, ClinicalNote,
    Doctor, GlucoseLog, HealthPreferences, LkDiabetesType, LkSpecialization,
    MealDetectedItem, MealLog, Patient, Question, Role, Screening,
    ScreeningAnswer, ScreeningType, User, doctor_patient_table, user_roles_table,
)

# Routers
from app.api.auth import router as auth_router
from app.api.glucose import router as glucose_router
from app.api.meal import router as meal_router
from app.api.patient import router as patient_router
from app.api.alerts import router as alerts_router
from app.api.clinical import router as clinical_router
from app.api.ai_chat import router as ai_chat_router
from app.api.screening import router as screening_router
from app.api.doctor import router as doctor_router
from app.api.settings import router as settings_router

logger = logging.getLogger(__name__)


def _seed_lookup_data() -> None:
    """Insert required lookup rows if they don't exist yet."""
    from sqlalchemy import select
    from app.models.database import SessionLocal

    db = SessionLocal()
    try:
        # Roles
        for name in ("patient", "doctor"):
            exists = db.execute(select(Role).where(Role.role_name == name)).scalar_one_or_none()
            if not exists:
                db.add(Role(role_name=name))

        # Diabetes types
        for dtype in ("Type 1", "Type 2", "Gestational", "Pre-diabetes"):
            exists = db.execute(select(LkDiabetesType).where(LkDiabetesType.type_name == dtype)).scalar_one_or_none()
            if not exists:
                db.add(LkDiabetesType(type_name=dtype))

        # Specializations
        for spec in ("Endocrinology", "Internal Medicine", "General Practice", "Diabetology"):
            exists = db.execute(select(LkSpecialization).where(LkSpecialization.spec_name == spec)).scalar_one_or_none()
            if not exists:
                db.add(LkSpecialization(spec_name=spec))

        # Screening types (lowercase — must match request schema)
        for stype in ("simple", "advanced"):
            exists = db.execute(select(ScreeningType).where(ScreeningType.name == stype)).scalar_one_or_none()
            if not exists:
                db.add(ScreeningType(name=stype))

        db.commit()

        # ── Seed screening questions (only if not already present) ────────────
        simple_type = db.execute(select(ScreeningType).where(ScreeningType.name == "simple")).scalar_one_or_none()
        advanced_type = db.execute(select(ScreeningType).where(ScreeningType.name == "advanced")).scalar_one_or_none()

        simple_questions = [
            ("What is your age?", "integer", 1),
            ("Enter your height (cm) and weight (kg) separated by a comma (e.g. 175,70):", "text", 2),
            ("What is your fasting blood glucose level (mg/dL)?", "float", 3),
            ("How would you describe your physical activity level?", "choice", 4),
            ("Do you have a family history of diabetes?", "boolean", 5),
            ("Are you a smoker?", "boolean", 6),
        ]
        advanced_questions = [
            ("What is your gender?", "choice", 1),
            ("What is your age?", "integer", 2),
            ("Do you have hypertension?", "boolean", 3),
            ("Do you have heart disease?", "boolean", 4),
            ("What is your smoking history?", "choice", 5),
            ("Enter your height (cm) and weight (kg) separated by a comma (e.g. 175,70):", "text", 6),
            ("What is your HbA1c level?", "float", 7),
            ("What is your blood glucose level (mg/dL)?", "float", 8),
        ]

        if simple_type:
            existing = db.execute(select(Question).where(Question.screening_type_id == simple_type.id)).scalars().all()
            if not existing:
                for text, dtype, order in simple_questions:
                    db.add(Question(screening_type_id=simple_type.id, question_text=text, data_type=dtype, display_order=order))

        if advanced_type:
            existing = db.execute(select(Question).where(Question.screening_type_id == advanced_type.id)).scalars().all()
            if not existing:
                for text, dtype, order in advanced_questions:
                    db.add(Question(screening_type_id=advanced_type.id, question_text=text, data_type=dtype, display_order=order))

        db.commit()
    finally:
        db.close()


def _seed_mock_data() -> None:
    """Insert realistic mock data for demo purposes (only if users table is empty)."""
    import random
    from datetime import date
    from sqlalchemy import select
    from app.models.database import SessionLocal
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        # Skip if already seeded
        existing_users = db.execute(select(User)).scalars().all()
        if existing_users:
            logger.info("Database already has users — skipping mock data seed.")
            return

        logger.info("Seeding mock data for realistic demo …")

        # ── 1. Create Doctor user ────────────────────────────────────
        doctor_role = db.execute(select(Role).where(Role.role_name == "doctor")).scalar_one()
        patient_role = db.execute(select(Role).where(Role.role_name == "patient")).scalar_one()

        doctor_user = User(email="dr.sarah@diacheck.com", password_hash=hash_password("Doctor123"))
        db.add(doctor_user)
        db.flush()
        doctor_user.roles.append(doctor_role)

        doctor_profile = Doctor(
            user_id=doctor_user.id,
            full_name="Dr. Sarah Al-Hassan",
            specialization_id=1,  # Endocrinology
        )
        db.add(doctor_profile)
        db.flush()

        doctor2_user = User(email="dr.ahmed@diacheck.com", password_hash=hash_password("Doctor123"))
        db.add(doctor2_user)
        db.flush()
        doctor2_user.roles.append(doctor_role)

        doctor2_profile = Doctor(
            user_id=doctor2_user.id,
            full_name="Dr. Ahmed Mansour",
            specialization_id=4,  # Diabetology
        )
        db.add(doctor2_profile)
        db.flush()

        # ── 2. Create Patient users ──────────────────────────────────
        patients_data = [
            {"full_name": "Lina Khalil", "email": "lina@diacheck.com",
             "dob": date(1992, 5, 15), "gender": "female",
             "height_cm": 165.0, "weight_kg": 72.0, "diabetes_type_id": 2},
            {"full_name": "Omar Farouk", "email": "omar@diacheck.com",
             "dob": date(1985, 11, 3), "gender": "male",
             "height_cm": 178.0, "weight_kg": 88.0, "diabetes_type_id": 2},
            {"full_name": "Nadia Youssef", "email": "nadia@diacheck.com",
             "dob": date(1998, 2, 20), "gender": "female",
             "height_cm": 158.0, "weight_kg": 65.0, "diabetes_type_id": 1},
            {"full_name": "Tariq Hassan", "email": "tariq@diacheck.com",
             "dob": date(1975, 8, 10), "gender": "male",
             "height_cm": 182.0, "weight_kg": 95.0, "diabetes_type_id": 2},
            {"full_name": "Yasmine Nabil", "email": "yasmine@diacheck.com",
             "dob": date(2000, 12, 1), "gender": "female",
             "height_cm": 170.0, "weight_kg": 60.0, "diabetes_type_id": 4},
        ]

        patient_profiles = []
        for pd in patients_data:
            user = User(email=pd["email"], password_hash=hash_password("Patient123"))
            db.add(user)
            db.flush()
            user.roles.append(patient_role)

            profile = Patient(
                user_id=user.id,
                full_name=pd["full_name"],
                dob=pd["dob"],
                gender=pd["gender"],
                height_cm=pd["height_cm"],
                weight_kg=pd["weight_kg"],
                diabetes_type_id=pd["diabetes_type_id"],
            )
            db.add(profile)
            db.flush()

            # Default health preferences
            prefs = HealthPreferences(
                patient_id=profile.id,
                min_glucose=70.0,
                max_glucose=140.0,
                carb_limit_g=60.0,
            )
            db.add(prefs)
            patient_profiles.append(profile)

        db.flush()

        # ── 3. Assign patients to doctors ────────────────────────────
        for p in patient_profiles:
            db.execute(doctor_patient_table.insert().values(doctor_id=doctor_profile.id, patient_id=p.id))
            db.execute(doctor_patient_table.insert().values(doctor_id=doctor2_profile.id, patient_id=p.id))

        # ── 4. Generate glucose logs (last 30 days) ──────────────────
        now = datetime.now(timezone.utc)
        reading_types = ["fasting", "after_meal", "before_sleep", "random"]
        for p in patient_profiles:
            for day_offset in range(30):
                day = now - timedelta(days=day_offset)
                # 2-4 readings per day
                num_readings = random.randint(2, 4)
                for _ in range(num_readings):
                    hour = random.choice([7, 9, 13, 15, 19, 22])
                    recorded_at = day.replace(hour=hour, minute=random.randint(0, 59))
                    # Base glucose depends on patient
                    base = random.gauss(120, 25) if p.diabetes_type_id == 2 else random.gauss(110, 30)
                    glucose_val = max(50.0, min(350.0, round(base, 1)))
                    log = GlucoseLog(
                        patient_id=p.id,
                        glucose_value=glucose_val,
                        reading_type=random.choice(reading_types),
                        recorded_at=recorded_at,
                        notes=random.choice([None, "Felt fine", "Slightly dizzy", "After exercise", "Before medication"]),
                    )
                    db.add(log)

        # ── 5. Generate meal logs (last 14 days) ─────────────────────
        meal_names = [
            "Grilled Chicken Salad", "Rice & Lentils", "Oatmeal Breakfast",
            "Vegetable Soup", "Fish & Vegetables", "Whole Wheat Pasta",
            "Mixed Fruit Bowl", "Egg Omelette", "Hummus & Pita",
            "Grilled Steak & Potatoes", "Yogurt Parfait", "Falafel Wrap",
        ]
        for p in patient_profiles:
            for day_offset in range(14):
                day = now - timedelta(days=day_offset)
                num_meals = random.randint(2, 3)
                for meal_idx in range(num_meals):
                    hour = [8, 13, 19][meal_idx] if meal_idx < 3 else 15
                    meal_time = day.replace(hour=hour, minute=random.randint(0, 30))
                    carbs = round(random.uniform(20, 80), 1)
                    cals = int(random.uniform(250, 700))
                    meal = MealLog(
                        patient_id=p.id,
                        meal_name=random.choice(meal_names),
                        total_carbs_g=carbs,
                        total_calories=cals,
                        meal_time=meal_time,
                    )
                    db.add(meal)
                    db.flush()

                    # Add 1-3 detected items per meal
                    food_items = [
                        ("Chicken Breast", 0, 165, 31, 3.6),
                        ("White Rice", 45, 206, 4.3, 0.4),
                        ("Lentil Soup", 20, 116, 9, 0.4),
                        ("Mixed Vegetables", 12, 65, 2.6, 0.3),
                        ("Whole Wheat Bread", 22, 128, 5.0, 1.5),
                        ("Olive Oil", 0, 119, 0, 13.5),
                        ("Greek Yogurt", 6, 100, 17, 0.7),
                        ("Fresh Fruits", 15, 60, 0.7, 0.2),
                    ]
                    for _ in range(random.randint(1, 3)):
                        fi = random.choice(food_items)
                        item = MealDetectedItem(
                            meal_log_id=meal.id,
                            food_name=fi[0],
                            confidence_pct=round(random.uniform(75, 98), 1),
                            quantity_desc="1 serving",
                            carbs_g=fi[1],
                            calories=fi[2],
                            protein_g=fi[3],
                            fat_g=fi[4],
                        )
                        db.add(item)

        # ── 6. Generate alerts ───────────────────────────────────────
        alert_templates = [
            ("glucose_high", "warning", "High glucose: {val} mg/dL. Above your target of 140 mg/dL."),
            ("glucose_low", "warning", "Low glucose: {val} mg/dL. Below your target of 70 mg/dL."),
            ("glucose_critical_high", "critical", "Critical high glucose: {val} mg/dL. Contact your doctor immediately."),
        ]
        for p in patient_profiles[:3]:  # Alerts for first 3 patients
            for i in range(random.randint(2, 5)):
                tmpl = random.choice(alert_templates)
                val = random.randint(55, 320)
                alert = Alert(
                    patient_id=p.id,
                    alert_type=tmpl[0],
                    severity=tmpl[1],
                    message=tmpl[2].format(val=val),
                    is_read=random.choice([True, False]),
                )
                db.add(alert)

        # ── 7. Generate clinical notes ───────────────────────────────
        note_texts = [
            "Patient glucose levels have been well-controlled this week. Continue current medication.",
            "Recommended increasing physical activity to 30 minutes daily walking.",
            "HbA1c results show improvement from 7.8% to 7.2%. Great progress.",
            "Discussed dietary changes — reducing refined carbohydrate intake.",
            "Patient reports occasional hypoglycemia in the morning. Adjusted insulin dose.",
            "Routine check-up. All vitals within normal range. Next visit in 3 months.",
        ]
        for p in patient_profiles:
            for i in range(random.randint(1, 3)):
                note = ClinicalNote(
                    doctor_id=doctor_profile.id,
                    patient_id=p.id,
                    note_text=random.choice(note_texts),
                    priority=random.choice(["routine", "urgent"]),
                    status="published",
                )
                db.add(note)

        # ── 8. Generate screenings ───────────────────────────────────
        simple_type = db.execute(select(ScreeningType).where(ScreeningType.name == "simple")).scalar_one_or_none()
        advanced_type = db.execute(select(ScreeningType).where(ScreeningType.name == "advanced")).scalar_one_or_none()

        risk_levels = ["low", "moderate", "high"]
        for p in patient_profiles:
            for i in range(random.randint(1, 2)):
                stype = random.choice([simple_type, advanced_type])
                risk_score = round(random.uniform(10, 85), 2)
                risk_level = "low" if risk_score < 33 else ("moderate" if risk_score <= 66 else "high")
                screening = Screening(
                    patient_id=p.id,
                    screening_type_id=stype.id,
                    risk_score=risk_score,
                    risk_level=risk_level,
                )
                db.add(screening)

        # ── 9. Generate AI conversations ─────────────────────────────
        for p in patient_profiles[:2]:
            convo = AiConversation(patient_id=p.id, title="Glucose Management Tips")
            db.add(convo)
            db.flush()

            user_msg = AiMessage(
                conversation_id=convo.id, sender="user",
                message_text="What should I eat when my blood sugar is high?"
            )
            db.add(user_msg)

            ai_msg = AiMessage(
                conversation_id=convo.id, sender="ai",
                message_text=(
                    "When your blood sugar is high, focus on non-starchy vegetables "
                    "(leafy greens, broccoli, cucumber), lean proteins (chicken, fish), "
                    "and foods with a low glycemic index. Avoid sugary drinks, white bread, "
                    "and processed snacks. Drinking water can also help. Always monitor your "
                    "glucose levels and consult your doctor if levels remain elevated."
                )
            )
            db.add(ai_msg)

        db.commit()
        logger.info("✓ Mock data seeded successfully: 2 doctors, 5 patients, glucose/meal/alert/screening data.")

    except Exception as e:
        db.rollback()
        logger.error("Failed to seed mock data: %s", e)
        raise
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create all tables, seed lookup data, load ML models, and populate mock data on startup."""
    logging.basicConfig(level=logging.INFO)

    Base.metadata.create_all(bind=engine)
    _seed_lookup_data()
    _seed_mock_data()

    # Load pre-trained ML models (sklearn + PyTorch)
    try:
        from app.services.ai_service import AIModelService
        AIModelService.load_models()
        logger.info("✓ All ML models loaded successfully.")
    except Exception as exc:
        logger.warning("Failed to load ML models — Gemini fallback will be used: %s", exc)

    yield


app = FastAPI(
    title="Diacheck API",
    description="Production backend for AI-assisted diabetes management",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(glucose_router)
app.include_router(meal_router)
app.include_router(patient_router)
app.include_router(alerts_router)
app.include_router(clinical_router)
app.include_router(ai_chat_router)
app.include_router(screening_router)
app.include_router(doctor_router)
app.include_router(settings_router)


@app.get("/", tags=["Health"])
def root() -> dict:
    return {
        "status": "Diacheck API is running",
        "docs": "/docs",
        "version": "2.0.0",
    }