"""
Diacheck — FastAPI application entry point.

Registers all routers and creates SQLite tables on startup via lifespan.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

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


def _seed_lookup_data() -> None:
    """Insert required lookup rows if they don't exist yet."""
    from sqlalchemy import select
    from app.models.database import SessionLocal
    from app.models.user import Role
    from app.models.lookup import LkDiabetesType, LkSpecialization

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

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create all tables and seed lookup data on startup."""
    Base.metadata.create_all(bind=engine)
    _seed_lookup_data()
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


@app.get("/", tags=["Health"])
def root() -> dict:
    return {
        "status": "Diacheck API is running",
        "docs": "/docs",
        "version": "2.0.0",
    }