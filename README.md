# DiaCheck — AI-Powered Diabetes Management System

A full-stack healthcare platform combining a **FastAPI** backend with a **React/TypeScript** frontend for intelligent diabetes monitoring, screening, and doctor-patient collaboration.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Backend Architecture](#backend-architecture)
7. [API Reference](#api-reference)
8. [Frontend Architecture](#frontend-architecture)
9. [Database Schema](#database-schema)
10. [ML Models](#ml-models)
11. [Authentication & Security](#authentication--security)
12. [Deployment](#deployment)

---

## Overview

DiaCheck empowers patients and doctors with:

| Feature | Description |
|---------|-------------|
| **Glucose Logging** | Track blood glucose with context (fasting, post-meal, etc.) and auto-alerts |
| **Meal Detection** | AI-powered food recognition via camera with carb estimation |
| **Diabetes Screening** | Simple (6-question) and Advanced (8-question) risk assessments using pre-trained ML models |
| **AI Chat Assistant** | Gemini-powered conversational health advisor |
| **Doctor Dashboard** | Population-level analytics, patient drill-down, clinical notes |
| **Patient Dashboard** | Personal health overview with glucose trends and doctor notes |
| **Settings & Preferences** | Target glucose ranges, notification preferences, data export |

---

## Tech Stack

### Backend
- **Framework:** FastAPI 0.110+
- **ORM:** SQLAlchemy 2.0 (async-compatible)
- **Database:** SQLite (dev) / MySQL (prod)
- **Auth:** JWT (access + refresh tokens) via python-jose
- **AI/ML:** Scikit-learn, XGBoost, PyTorch (EfficientNet-B3), Google Gemini API
- **Migrations:** Alembic

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6
- **Routing:** React Router v7
- **Charts:** Recharts
- **Icons:** Lucide React
- **HTTP Client:** Axios (with interceptors)
- **Styling:** Vanilla CSS + Tailwind utilities

---

## Project Structure

```
System_medical_assistant/
├── main.py                    # FastAPI entry point + lifespan
├── requirements.txt           # Python dependencies
├── .env                       # Environment variables
├── alembic.ini                # Migration config
├── models/                    # Pre-trained ML model files
│   ├── simple_model.pkl       # RandomForest (6-feat, needs scaler — unused)
│   ├── advanced_model.pkl     # XGBoost classifier (8-feat, active)
│   ├── full_pipeline.pkl      # Scaler + XGBoost dict (reference)
│   └── best_model.pth        # EfficientNet-B3 food detection CNN
│
├── app/
│   ├── __init__.py
│   ├── core/
│   │   ├── config.py          # Settings (DB URL, JWT secrets)
│   │   ├── security.py        # JWT create/decode, password hashing
│   │   └── dependencies.py    # FastAPI Depends helpers (get_current_*)
│   ├── models/
│   │   ├── database.py        # Engine, SessionLocal, Base
│   │   ├── user.py            # User, Role, user_roles_table
│   │   ├── patient_doctor.py  # Patient, Doctor, doctor_patient_table
│   │   ├── glucose_log.py     # GlucoseLog
│   │   ├── meal_log.py        # MealLog, MealDetectedItem
│   │   ├── screening.py       # ScreeningType, Question, Screening, ScreeningAnswer
│   │   ├── alert.py           # Alert
│   │   ├── clinical_note.py   # ClinicalNote
│   │   ├── ai_conversation.py # AiConversation, AiMessage
│   │   ├── health_preferences.py
│   │   ├── lookup.py          # LkDiabetesType, LkSpecialization
│   │   └── audit_log.py       # AuditLog
│   ├── schemas/               # Pydantic request/response models
│   │   ├── auth_schemas.py
│   │   ├── glucose_schemas.py
│   │   ├── meal_schemas.py
│   │   ├── screening_schemas.py
│   │   ├── doctor_schemas.py
│   │   ├── patient_schemas.py
│   │   ├── settings_schemas.py
│   │   ├── clinical_schemas.py
│   │   ├── alert_schemas.py
│   │   └── ai_schemas.py
│   ├── services/              # Business logic layer
│   │   ├── auth_service.py
│   │   ├── glucose_service.py
│   │   ├── meal_service.py
│   │   ├── screening_service.py
│   │   ├── doctor_service.py
│   │   ├── patient_service.py
│   │   ├── settings_service.py
│   │   ├── clinical_service.py
│   │   ├── alert_service.py
│   │   └── ai_service.py      # Gemini + ML model management
│   └── api/                   # Route controllers (thin)
│       ├── auth.py
│       ├── glucose.py
│       ├── meal.py
│       ├── screening.py
│       ├── doctor.py
│       ├── patient.py
│       ├── settings.py
│       ├── clinical.py
│       ├── alerts.py
│       └── ai_chat.py
│
└── Frontend_New/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx               # React DOM entry
        ├── vite-env.d.ts          # Type declarations
        ├── styles/index.css       # Global styles
        ├── api/                   # Axios API modules
        │   ├── axiosClient.ts     # Base client + interceptors
        │   ├── authApi.ts
        │   ├── glucoseApi.ts
        │   ├── mealApi.ts
        │   ├── screeningApi.ts
        │   ├── doctorApi.ts
        │   ├── patientApi.ts
        │   ├── settingsApi.ts
        │   ├── chatApi.ts
        │   ├── clinicalApi.ts
        │   └── alertsApi.ts
        └── app/
            ├── App.tsx
            ├── routes.tsx         # React Router config
            ├── context/
            │   └── AuthContext.tsx # Auth state + JWT management
            ├── components/
            │   └── ProtectedRoute.tsx
            └── pages/
                ├── LandingPage.tsx
                ├── AuthPage.tsx
                ├── DiabetesTestPage.tsx
                ├── PatientDashboard.tsx
                ├── GlucoseLogsPage.tsx
                ├── MealLogsPage.tsx
                ├── AIAssistantPage.tsx
                ├── PatientSettingsPage.tsx
                ├── DoctorDashboard.tsx
                └── PatientDetailsPage.tsx
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or pnpm

### Backend Setup

```bash
# Clone and enter project
cd System_medical_assistant

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt
pip install torch torchvision Pillow joblib scikit-learn numpy xgboost

# Start server (port 8005)
uvicorn main:app --reload --port 8005
```

### Frontend Setup

```bash
cd Frontend_New

# Install dependencies
npm install

# Start dev server (port 5173)
npm run dev

# Production build
npm run build
```

### Access Points
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8005 |
| Swagger Docs | http://localhost:8005/docs |
| ReDoc | http://localhost:8005/redoc |

---

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=sqlite:///./diacheck.db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
GEMINI_API_KEY=your-gemini-api-key    # Optional, for AI chat
```

---

## Backend Architecture

The backend follows a **3-layer architecture**:

```
API Layer (app/api/)        → Route definitions, request validation
Service Layer (app/services/) → Business logic, DB queries
Data Layer (app/models/)     → SQLAlchemy ORM models
```

### Startup Lifecycle
1. Create all database tables via `Base.metadata.create_all()`
2. Seed lookup data (roles, diabetes types, screening types)
3. Load pre-trained ML models (sklearn + PyTorch)

### Key Design Decisions
- **SQLAlchemy 2.0 style** — uses `select()` statements, not legacy `query()`
- **Aggregation in SQL** — dashboard stats use `func.avg/max/min`, no N+1 loops
- **Optional auth** — screening endpoint works anonymously, saves if logged in
- **Background alerts** — glucose logging auto-generates alerts when out of range

---

## API Reference

### Authentication (`/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register/patient` | Public | Register a patient |
| POST | `/auth/register/doctor` | Public | Register a doctor |
| POST | `/auth/login` | Public | Login, returns JWT tokens |
| POST | `/auth/refresh` | Public | Refresh access token |
| GET | `/auth/me` | Bearer | Get current user profile |

### Glucose (`/glucose`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/glucose/log` | Patient | Log a glucose reading |
| GET | `/glucose/logs` | Patient | Get glucose history (query: `days`) |
| GET | `/glucose/stats` | Patient | Get glucose statistics |

### Meals (`/meal`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/meal/upload` | Patient | Upload meal image for AI detection |
| POST | `/meal/confirm` | Patient | Confirm and save meal log |
| GET | `/meal/logs` | Patient | Get meal history (query: `days`) |

### Screening (`/screening`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/screening/predict` | Optional | Run diabetes risk prediction |
| GET | `/screening/questions/{type}` | Public | Get questions for `simple`/`advanced` |
| GET | `/screening/history` | Patient | Get past screening results |

### Doctor (`/doctor`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/doctor/dashboard` | Doctor | Aggregated dashboard stats |
| GET | `/doctor/patients` | Doctor | List assigned patients |
| GET | `/doctor/patients/{id}/profile` | Doctor | Full patient profile |
| GET | `/doctor/alerts` | Doctor | Patient alerts |
| PUT | `/doctor/alerts/{id}/read` | Doctor | Mark alert as read |
| POST | `/doctor/notes` | Doctor | Create clinical note |

### Patient (`/patient`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/patient/dashboard` | Patient | Dashboard data with trends |

### Settings (`/settings`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/settings/profile` | Patient | Get profile & preferences |
| PUT | `/settings/profile` | Patient | Update profile |
| PUT | `/settings/preferences` | Patient | Update health preferences |
| PUT | `/settings/password` | Patient | Change password |

### AI Chat (`/ai`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/chat` | Patient | Send message to AI assistant |
| GET | `/ai/conversations` | Patient | List conversations |
| GET | `/ai/conversations/{id}` | Patient | Get conversation messages |

### Alerts (`/alerts`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/alerts/` | Patient | Get patient alerts |
| PUT | `/alerts/{id}/read` | Patient | Mark alert as read |

---

## Frontend Architecture

### Routing

```
/                          → LandingPage (public)
/auth                      → AuthPage (login/register)
/diabetes-test             → DiabetesTestPage (screening)
/dashboard/patient         → PatientDashboard (protected: patient)
/dashboard/patient/glucose → GlucoseLogsPage
/dashboard/patient/meals   → MealLogsPage
/dashboard/patient/ai-chat → AIAssistantPage
/dashboard/patient/settings→ PatientSettingsPage
/dashboard/doctor          → DoctorDashboard (protected: doctor)
/dashboard/doctor/patients → PatientDetailsPage
```

### Auth Flow
1. User logs in → receives `access_token` + `refresh_token`
2. Tokens stored in `localStorage`
3. `axiosClient` interceptor attaches `Bearer` token to all requests
4. On 401 response → auto-clear session, redirect to `/login`
5. `ProtectedRoute` checks role before rendering child routes

### API Client Architecture
All API calls go through `axiosClient.ts` which provides:
- Base URL configuration (`http://localhost:8005`)
- Automatic JWT token injection
- 401 error handling with session cleanup

Each domain has its own typed API module (e.g., `glucoseApi.ts`, `doctorApi.ts`).

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Role : has
    User ||--o| Patient : "is a"
    User ||--o| Doctor : "is a"
    Doctor }o--o{ Patient : manages
    Patient ||--o{ GlucoseLog : logs
    Patient ||--o{ MealLog : logs
    Patient ||--o{ Screening : takes
    Patient ||--o{ Alert : receives
    Patient ||--o{ HealthPreferences : configures
    Patient ||--o{ AiConversation : chats
    Doctor ||--o{ ClinicalNote : writes
    MealLog ||--o{ MealDetectedItem : contains
    ScreeningType ||--o{ Question : has
    ScreeningType ||--o{ Screening : categorizes
    Screening ||--o{ ScreeningAnswer : contains
    AiConversation ||--o{ AiMessage : contains
```

### Key Tables

| Table | Description |
|-------|-------------|
| `users` | Email, hashed password, timestamps |
| `roles` | `patient`, `doctor` |
| `patients` | Profile (DOB, gender, diabetes type, weight, height) |
| `doctors` | Profile (specialization, license) |
| `doctor_patient` | M2M assignment table |
| `glucose_logs` | Value, context_type, recorded_at, notes |
| `meal_logs` | Meal description, total carbs, image URL |
| `meal_detected_items` | AI-detected food items per meal |
| `screenings` | Risk score, risk level, linked to screening type |
| `screening_types` | `simple`, `advanced` |
| `questions` | Screening questions per type |
| `alerts` | Auto-generated health alerts |
| `clinical_notes` | Doctor-written notes for patients |
| `health_preferences` | Target glucose min/max, dietary restrictions |
| `ai_conversations` | Chat sessions with Gemini |

---

## ML Models

### Advanced Screening Model (`advanced_model.pkl`)
- **Type:** XGBoost Classifier
- **Features (8):** gender, age, hypertension, heart_disease, smoking_history, bmi, HbA1c_level, blood_glucose_level
- **Output:** `predict_proba()` → risk_score (0–100%)
- **Risk Levels:** <33% = low, 33–66% = moderate, >66% = high
- **Status:** ✅ Working correctly on raw feature values

### Simple Screening (mapped to Advanced)
- Collects 6 questions (age, BMI, glucose, activity, family history, smoking)
- Maps to 8-feature advanced model format with inferred defaults:
  - HbA1c estimated from glucose via eAG formula: `HbA1c = (glucose + 46.7) / 28.7`
  - Hypertension inferred from age ≥ 45 + BMI ≥ 28

### Food Detection Model (`best_model.pth`)
- **Type:** EfficientNet-B3 (PyTorch)
- **Input:** 224×224 RGB image, ImageNet normalization
- **Output:** Food class + confidence percentage
- **Fallback:** If confidence < 70%, falls through to Gemini API

---

## Authentication & Security

### JWT Token Structure
```json
{
  "sub": "user_id",
  "type": "access",
  "exp": "timestamp"
}
```

### Password Security
- Hashed with **bcrypt** (salt rounds auto-managed)
- Never stored or transmitted in plaintext

### Role-Based Access
- **Patient endpoints:** Require JWT with patient role
- **Doctor endpoints:** Require JWT with doctor role
- **Public endpoints:** `/auth/*`, `/screening/predict`, `/screening/questions/*`

---

## Deployment

### Production Build

```bash
# Backend
uvicorn main:app --host 0.0.0.0 --port 8005 --workers 4

# Frontend
cd Frontend_New
npm run build
# Serve dist/ with nginx or any static file server
```

### Database Migration (MySQL)

Update `.env`:
```env
DATABASE_URL=mysql+pymysql://user:password@host:3306/diacheck
```

### Docker (optional)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8005"]
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.
