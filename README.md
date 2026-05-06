# DiaCheck — AI-Powered Smart Medical System for Diabetes Management

A full-stack healthcare platform combining **FastAPI**, **React/TypeScript**, **Machine Learning**, and **Computer Vision** for intelligent diabetes screening, nutritional analysis, and doctor-patient collaboration.

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
10. [ML & AI Models](#ml--ai-models)
11. [Authentication & Security](#authentication--security)
12. [Deployment](#deployment)

---

## Overview

DiaCheck empowers patients and doctors with an integrated AI-driven diabetes management ecosystem:

| Feature | Description |
|---------|-------------|
| **Glucose Logging** | Track blood glucose with context (fasting, post-meal, etc.) and auto-generated alerts |
| **AI Meal Analysis** | Computer Vision–powered food recognition via camera with structured nutritional output (carbs, protein, fat, mass, calories) |
| **Diabetes Screening** | Simple (5-question) and Advanced (8-question) binary classification using pre-trained XGBoost ML model — outputs **Diabetic** or **Not Diabetic** |
| **AI Chat Assistant** | OpenRouter-powered conversational health advisor with access to patient health data |
| **Doctor Dashboard** | Population-level analytics, patient drill-down, clinical notes, and alert management |
| **Patient Dashboard** | Personal health overview with glucose trends, meal history, and doctor notes |
| **Settings & Preferences** | Target glucose ranges, carb limits, notification preferences, data export |

---

## Tech Stack

### Backend
| Component | Technology |
|-----------|------------|
| **Framework** | FastAPI 0.110+ |
| **ORM** | SQLAlchemy 2.0 (select() syntax) |
| **Database** | SQLite (dev) / MySQL (prod) |
| **Auth** | JWT (access + refresh tokens) via python-jose |
| **ML Screening** | Scikit-learn, XGBoost (binary classification) |
| **Computer Vision** | PyTorch (EfficientNet-B3 nutrition regression) |
| **AI Chat** | OpenRouter API (LLaMA 3.1 / Gemini Vision) |
| **Migrations** | Alembic |

### Frontend
| Component | Technology |
|-----------|------------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 6 |
| **Routing** | React Router v7 |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **HTTP Client** | Axios (with JWT interceptors) |
| **Styling** | Tailwind CSS + Vanilla CSS |

---

## Project Structure

```
System_medical_assistant/
├── main.py                        # FastAPI entry point + lifespan (startup seeds + model loading)
├── requirements.txt               # Python dependencies
├── .env                           # Environment variables (secrets, API keys)
├── alembic.ini                    # Database migration config
├── diacheck.db                    # SQLite database (auto-created)
│
├── models/                        # Pre-trained ML model artifacts
│   ├── advanced_model.pkl         # XGBoost binary classifier (8-feature, active)
│   ├── simple_model.pkl           # RandomForest (6-feature, mapped to advanced)
│   ├── full_pipeline.pkl          # Scaler + XGBoost reference pipeline
│   └── best_model.pth            # EfficientNet-B3 nutrition regression CNN (4 outputs)
│
├── app/                           # Backend application package
│   ├── __init__.py
│   ├── core/                      # Configuration & security
│   │   ├── config.py              #   App settings (DB URL, JWT secrets)
│   │   ├── security.py            #   JWT create/decode, bcrypt password hashing
│   │   └── dependencies.py        #   FastAPI Depends helpers (get_current_patient/doctor)
│   │
│   ├── models/                    # SQLAlchemy ORM models
│   │   ├── database.py            #   Engine, SessionLocal, Base
│   │   ├── user.py                #   User, Role, user_roles_table
│   │   ├── patient_doctor.py      #   Patient, Doctor, doctor_patient_table
│   │   ├── glucose_log.py         #   GlucoseLog
│   │   ├── meal_log.py            #   MealLog, MealDetectedItem
│   │   ├── screening.py           #   ScreeningType, Question, Screening, ScreeningAnswer
│   │   ├── alert.py               #   Alert (auto-generated health alerts)
│   │   ├── clinical_note.py       #   ClinicalNote (doctor-written)
│   │   ├── ai_conversation.py     #   AiConversation, AiMessage
│   │   ├── health_preferences.py  #   HealthPreferences (glucose targets, carb limits)
│   │   ├── lookup.py              #   LkDiabetesType, LkSpecialization
│   │   └── audit_log.py           #   AuditLog
│   │
│   ├── schemas/                   # Pydantic request/response models
│   │   ├── auth_schemas.py
│   │   ├── glucose_schemas.py
│   │   ├── meal_schemas.py
│   │   ├── screening_schemas.py   #   Includes binary `diagnosis` field
│   │   ├── doctor_schemas.py
│   │   ├── patient_schemas.py
│   │   ├── settings_schemas.py
│   │   ├── clinical_schemas.py
│   │   ├── alert_schemas.py
│   │   └── ai_schemas.py
│   │
│   ├── services/                  # Business logic layer
│   │   ├── auth_service.py        #   Registration, login, JWT refresh
│   │   ├── glucose_service.py     #   Glucose logging + auto-alerts
│   │   ├── meal_service.py        #   Meal log CRUD
│   │   ├── screening_service.py   #   ML binary prediction (Diabetic / Not Diabetic)
│   │   ├── doctor_service.py      #   Doctor dashboard + patient management
│   │   ├── patient_service.py     #   Patient dashboard data
│   │   ├── settings_service.py    #   Profile & preferences management
│   │   ├── clinical_service.py    #   Clinical notes CRUD
│   │   ├── alert_service.py       #   Alert retrieval + read marking
│   │   └── ai_service.py          #   OpenRouter chat + CV model + ML model management
│   │
│   └── api/                       # Route controllers (thin — delegate to services)
│       ├── auth.py
│       ├── glucose.py
│       ├── meal.py                #   /meal/upload → AI analysis → structured nutrition
│       ├── screening.py           #   /screening/predict → binary diagnosis
│       ├── doctor.py
│       ├── patient.py
│       ├── settings.py
│       ├── clinical.py
│       ├── alerts.py
│       └── ai_chat.py
│
├── Ai/                            # AI/ML development workspace
│   ├── src/                       #   Training scripts & model code
│   ├── notebooks/                 #   Jupyter experiments
│   └── artifacts/                 #   Training artifacts & checkpoints
│
├── Frontend_New/                  # React frontend application
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx               #   React DOM entry
│       ├── styles/index.css       #   Global styles
│       ├── api/                   #   Axios API modules
│       │   ├── axiosClient.ts     #     Base client + JWT interceptors
│       │   ├── authApi.ts
│       │   ├── glucoseApi.ts
│       │   ├── mealApi.ts
│       │   ├── screeningApi.ts
│       │   ├── doctorApi.ts
│       │   ├── patientApi.ts
│       │   ├── settingsApi.ts
│       │   ├── chatApi.ts
│       │   ├── clinicalApi.ts
│       │   └── alertsApi.ts
│       └── app/
│           ├── App.tsx
│           ├── routes.tsx         #   React Router config
│           ├── context/
│           │   └── AuthContext.tsx #     Auth state + JWT management
│           ├── components/
│           │   └── ProtectedRoute.tsx
│           └── pages/
│               ├── LandingPage.tsx          # Public landing
│               ├── AuthPage.tsx             # Login / Register
│               ├── DiabetesTestPage.tsx     # Screening (binary diagnosis)
│               ├── PatientDashboard.tsx     # Patient overview
│               ├── GlucoseLogsPage.tsx      # Glucose tracking
│               ├── MealLogsPage.tsx         # AI meal analysis + logging
│               ├── AIAssistantPage.tsx      # AI chat assistant
│               ├── AISummaryPage.tsx        # AI health summary
│               ├── PatientSettingsPage.tsx  # Settings & preferences
│               ├── DoctorDashboard.tsx      # Doctor overview
│               └── PatientDetailsPage.tsx   # Doctor → patient drill-down
│
└── cv_project_documentation.md    # Computer Vision model documentation
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or pnpm

### Backend Setup

```bash
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

# or across Node Modules
node .\node_modules\vite\bin\vite.js\

# Start dev server (port 5173)
npm run dev
```

### Access Points
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8005 |
| Swagger Docs | http://localhost:8005/docs |
| ReDoc | http://localhost:8005/redoc |

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Doctor | dr.sarah@diacheck.com | Doctor123 |
| Doctor | dr.ahmed@diacheck.com | Doctor123 |
| Patient | lina@diacheck.com | Patient123 |
| Patient | omar@diacheck.com | Patient123 |

---

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=sqlite:///./diacheck.db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
OPENROUTER_API_KEY=your-openrouter-key     # For AI chat + Gemini Vision
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

---

## Backend Architecture

The backend follows a **3-layer architecture**:

```
API Layer (app/api/)          → Route definitions, request validation
Service Layer (app/services/) → Business logic, ML inference, DB queries
Data Layer (app/models/)      → SQLAlchemy ORM models
```

### Startup Lifecycle
1. Create all database tables via `Base.metadata.create_all()`
2. Seed lookup data (roles, diabetes types, screening types, questions)
3. Seed realistic mock data (doctors, patients, glucose/meal/alert history)
4. Load pre-trained ML models (XGBoost screening + EfficientNet-B3 vision)

### Key Design Decisions
- **SQLAlchemy 2.0 style** — uses `select()` statements, not legacy `query()`
- **Binary screening** — ML model outputs 0/1 (Not Diabetic/Diabetic), no misleading scores
- **Dual AI strategy** — OpenRouter Gemini Vision (primary) + local CNN (fallback) for meal analysis
- **Carb-focused logging** — only carbohydrates are tracked for glucose correlation
- **Optional auth** — screening endpoint works anonymously, saves if logged in
- **Auto-alerts** — glucose logging auto-generates alerts when readings are out of range

---

## API Reference

### Authentication (`/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register/patient` | Public | Register a patient |
| POST | `/auth/register/doctor` | Public | Register a doctor (requires access key) |
| POST | `/auth/login` | Public | Login → JWT tokens |
| POST | `/auth/refresh` | Public | Refresh access token |
| GET | `/auth/me` | Bearer | Get current user profile |

### Glucose (`/glucose`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/glucose/log` | Patient | Log a glucose reading (auto-generates alerts) |
| GET | `/glucose/logs` | Patient | Get glucose history (query: `days`) |
| GET | `/glucose/stats` | Patient | Get glucose statistics |

### Meals (`/meal`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/meal/upload` | Patient | Upload meal image → AI returns structured nutrition (carbs, protein, fat, mass, calories) |
| POST | `/meal/confirm` | Patient | Confirm and save meal log (only carbs logged for glucose tracking) |
| GET | `/meal/` | Patient | Get meal history |
| GET | `/meal/{id}` | Patient | Get meal detail |

### Screening (`/screening`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/screening/predict` | Optional | Run diabetes screening → binary result: `Diabetic` or `Not Diabetic` |
| GET | `/screening/questions/{type}` | Public | Get questions for `simple`/`advanced` |
| GET | `/screening/history` | Patient | Get past screening results |

### Doctor (`/doctor`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/doctor/dashboard` | Doctor | Aggregated dashboard stats |
| GET | `/doctor/patients` | Doctor | List assigned patients |
| GET | `/doctor/patients/{id}/profile` | Doctor | Full patient profile with health data |
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
| PUT | `/settings/preferences` | Patient | Update health preferences (glucose targets, carb limits) |
| PUT | `/settings/password` | Patient | Change password |

### AI Chat (`/ai`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/chat` | Patient | Send message to AI assistant (context-aware with patient health data) |
| GET | `/ai/conversations` | Patient | List conversations |
| GET | `/ai/conversations/{id}` | Patient | Get conversation messages |

---

## Frontend Architecture

### Routing

```
/                            → LandingPage (public)
/auth                        → AuthPage (login/register)
/diabetes-test               → DiabetesTestPage (binary screening)
/dashboard/patient           → PatientDashboard (protected: patient)
/dashboard/patient/glucose   → GlucoseLogsPage
/dashboard/patient/meals     → MealLogsPage (AI-powered nutritional analysis)
/dashboard/patient/ai-chat   → AIAssistantPage
/dashboard/patient/settings  → PatientSettingsPage
/dashboard/doctor            → DoctorDashboard (protected: doctor)
/dashboard/doctor/patients   → PatientDetailsPage
```

### Auth Flow
1. User logs in → receives `access_token` + `refresh_token`
2. Tokens stored in `localStorage`
3. `axiosClient` interceptor attaches `Bearer` token to all requests
4. On 401 response → auto-clear session, redirect to `/auth`
5. `ProtectedRoute` checks role before rendering child routes

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

---

## ML & AI Models

### 1. Diabetes Screening — XGBoost Binary Classifier

| Aspect | Detail |
|--------|--------|
| **Model File** | `models/advanced_model.pkl` |
| **Type** | XGBoost Classifier |
| **Features (8)** | gender, age, hypertension, heart_disease, smoking_history, bmi, HbA1c_level, blood_glucose_level |
| **Output** | Binary: `0` (Not Diabetic) / `1` (Diabetic) |
| **Method** | `model.predict()` — direct binary classification |
| **Simple Mode** | Maps 5 simple questions onto the 8-feature format with inferred defaults |

**Simple → Advanced Feature Mapping:**
- HbA1c estimated from glucose via eAG formula: `HbA1c = (glucose + 46.7) / 28.7`
- Hypertension inferred from age ≥ 45 + BMI ≥ 28
- Gender defaults to 0, heart disease defaults to 0

### 2. Nutrition Estimation — EfficientNet-B3 Regression CNN

| Aspect | Detail |
|--------|--------|
| **Model File** | `models/best_model.pth` |
| **Type** | EfficientNet-B3 + custom regression head |
| **Input** | 224×224 RGB image (ImageNet normalization) |
| **Output** | 4 continuous values: `[calories, carbs_g, fat_g, protein_g]` |
| **Mass** | Estimated from macronutrient totals |
| **Dataset** | Nutrition5k (Google) — 4,770 dish images |
| **Integration** | Fallback behind OpenRouter Gemini Vision API |

**Frontend Display:**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  Carbs   │ Protein  │   Fat    │   Mass   │ Calories │
│  28g *   │   22g    │   19g    │  197g    │   343    │
└──────────┴──────────┴──────────┴──────────┴──────────┘
* Only carbs are editable and logged (affects blood glucose)
```

### 3. AI Chat — OpenRouter Integration

| Aspect | Detail |
|--------|--------|
| **Provider** | OpenRouter API |
| **Model** | LLaMA 3.1 8B Instruct (free tier) |
| **Context** | Patient's recent glucose readings, meals, screenings, profile |
| **Features** | Personalized health advice, data-aware responses |

---

## Authentication & Security

### JWT Token Structure
```json
{
  "sub": "user_id",
  "type": "access | refresh",
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
- **Doctor registration:** Requires `DOCTOR_ACCESS_KEY` environment variable

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
