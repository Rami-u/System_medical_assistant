"""Doctor dashboard & management schemas."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Dashboard ───────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_patients: int
    in_range_count: int
    in_range_pct: int
    need_attention: int


class PopulationTrendPoint(BaseModel):
    date: str
    avg: int
    max: int
    min: int


class PatientAttention(BaseModel):
    patient_id: int
    full_name: str
    patient_code: str
    diabetes_type: Optional[str] = None
    avg_glucose: int
    time_in_range_pct: int
    risk_level: str


class DoctorDashboardResponse(BaseModel):
    doctor_name: str
    today_date: str
    stats: DashboardStats
    population_trend: list[PopulationTrendPoint]
    risk_distribution: dict[str, int]
    patients_needing_attention: list[PatientAttention]


# ── Patient List (doctor view) ─────────────────────────────

class PatientListItem(BaseModel):
    patient_id: int
    full_name: str
    patient_code: str
    diabetes_type: Optional[str] = None
    risk_level: str
    last_visit: Optional[str] = None
    avg_glucose: Optional[int] = None


class DoctorPatientListResponse(BaseModel):
    patients: list[PatientListItem]


# ── Patient Profile (doctor view) ──────────────────────────

class PatientStatsBlock(BaseModel):
    avg_glucose: int
    latest_glucose: int
    bmi: Optional[float] = None


class PhysicalBlock(BaseModel):
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    bmi: Optional[float] = None
    diagnosis: Optional[str] = None


class GlucoseTrendPoint(BaseModel):
    date: str
    value: float
    in_range: bool


class WeeklyAvgPoint(BaseModel):
    week: str
    avg: int


class DailyCarbPoint(BaseModel):
    date: str
    carbs_g: float


class GlucoseLogItem(BaseModel):
    id: int
    glucose_value: float
    reading_type: str
    recorded_at: datetime
    notes: Optional[str] = None


class MealLogItem(BaseModel):
    id: int
    meal_name: Optional[str] = None
    total_carbs_g: Optional[float] = None
    meal_time: datetime


class ClinicalNoteItem(BaseModel):
    id: int
    note_text: str
    priority: str
    status: str
    created_at: datetime


class DoctorPatientProfileResponse(BaseModel):
    patient_id: int
    full_name: str
    patient_code: str
    age: Optional[int] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    email: Optional[str] = None
    stats: PatientStatsBlock
    physical: PhysicalBlock
    glucose_trend: list[GlucoseTrendPoint]
    weekly_avg_glucose: list[WeeklyAvgPoint]
    daily_carb_intake: list[DailyCarbPoint]
    glucose_logs: list[GlucoseLogItem]
    meal_logs: list[MealLogItem]
    clinical_notes: list[ClinicalNoteItem]


# ── Notes (doctor) ──────────────────────────────────────────

class DoctorNoteCreate(BaseModel):
    patient_id: int
    note_text: str = Field(..., min_length=1)
    priority: str = Field("routine", pattern="^(routine|urgent|critical)$")


class DoctorNoteResponse(BaseModel):
    id: int
    patient_id: int
    note_text: str
    priority: str
    status: str
    created_at: datetime


# ── Alerts (doctor view) ───────────────────────────────────

class DoctorAlertResponse(BaseModel):
    alert_id: int
    patient_name: str
    patient_id: int
    alert_type: str
    severity: str
    message: str
    created_at: datetime
    is_read: bool
