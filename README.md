<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/DiaCheck-🩺-06b6d4?style=for-the-badge">
    <img src="https://img.shields.io/badge/DiaCheck-🩺-0284c7?style=for-the-badge">
  </picture>
</p>

<h3 align="center">AI-Powered Diabetes Management Platform</h3>

<p align="center">
  Screening · Glucose Monitoring · Nutrition Analysis · Retinopathy Detection · Clinical Dashboard
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PyTorch-2.0-EE4C2C?logo=pytorch&logoColor=white" alt="PyTorch">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## Overview

**DiaCheck** is a full-stack healthcare platform that combines **machine learning**, **computer vision**, and **cloud AI** to help patients manage diabetes and nutrition. Doctors get a real-time dashboard to monitor patients, write clinical notes, and respond to auto-generated health alerts.

The system ships with **realistic demo data** (2 doctors, 5 patients, 30 days of glucose logs, meals, alerts, screenings, and AI conversations) that is automatically seeded on first startup.

### Key Features

| Module | Description |
|--------|-------------|
| **Diabetes Screening** | XGBoost classifier — simple (5-question) or advanced (8-question) mode for diabetic risk prediction |
| **Glucose Tracking** | Log blood glucose readings with fasting/post-meal context; auto-generated threshold alerts |
| **AI Meal Analysis** | Hybrid MobileNetV2 CNN + OpenRouter Vision API — photograph food → get carbs, protein, fat, calories |
| **Retinopathy Detection** | EfficientNet-B4 regression model — fundus image → 5-level severity grade with confidence score |
| **AI Health Assistant** | Context-aware chatbot with streaming responses, image analysis, conversation search & export |
| **Doctor Dashboard** | Population analytics, patient drill-down, clinical notes, alert management |
| **Patient Settings** | Target glucose ranges, carb limits, notification preferences |
| **Rate Limiting** | SlowAPI-based per-endpoint rate limiting for abuse prevention |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   Frontend (React 18 + Vite 6)                   │
│    TypeScript · Tailwind CSS 4 · Shadcn/ui · MUI · Recharts     │
│         Framer Motion · React Router 7 · Lucide Icons            │
└──────────────────────────┬───────────────────────────────────────┘
                           │ REST API + SSE Streaming (JSON)
┌──────────────────────────▼───────────────────────────────────────┐
│                     Backend (FastAPI 0.110+)                      │
│                                                                   │
│   api/ ───→ services/ ───→ models/ (SQLAlchemy 2.0)              │
│                                                                   │
│   ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│   │  XGBoost       │  │  MobileNetV2   │  │  OpenRouter AI    │  │
│   │  Screening     │  │  Nutrition CNN │  │  Gemini / GPT-OSS │  │
│   │  Classifier    │  │  (fallback)    │  │  Vision & Chat    │  │
│   └────────────────┘  └────────────────┘  └───────────────────┘  │
│                                                                   │
│   ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│   │  EfficientNet-B4 │  │  SlowAPI Rate Limiter                │ │
│   │  Retinopathy     │  │  JWT Auth (access + refresh)         │ │
│   │  Regression      │  │  Alembic Migrations                  │ │
│   └──────────────────┘  └──────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                   ┌───────▼────────┐
                   │  SQLite / MySQL  │
                   │   21 tables      │
                   └──────────────────┘
```

---

## Tech Stack

### Backend

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI ≥ 0.110, Uvicorn |
| ORM | SQLAlchemy 2.0, Alembic |
| Validation | Pydantic v2 |
| Auth | JWT (python-jose), bcrypt |
| ML — Screening | XGBoost, Scikit-learn (joblib) |
| ML — Nutrition | PyTorch, MobileNetV2 |
| ML — Retinopathy | PyTorch, EfficientNet-B4 |
| Cloud AI | OpenRouter API (Gemini, GPT-OSS) |
| Rate Limiting | SlowAPI |
| Database | SQLite (dev) / MySQL (prod) |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | React 18.3, TypeScript 6 |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 4, Emotion |
| UI Libraries | Shadcn/ui (Radix primitives), MUI 7 |
| Routing | React Router 7 |
| Charts | Recharts |
| Animations | Framer Motion |
| Forms | React Hook Form |
| HTTP Client | Axios |
| Icons | Lucide React, MUI Icons |
| Toasts | Sonner |
| Dates | date-fns |

---

## Project Structure

```
├── main.py                          # FastAPI entry point, lifespan, mock data seeder
├── requirements.txt                 # Python dependencies
├── .env.example                     # Environment variable template
├── alembic.ini                      # Alembic migration config
├── LICENSE                          # MIT License
│
├── app/                             # ── Backend Application ──
│   ├── api/                         #   Route handlers (11 routers)
│   │   ├── auth.py                  #     Registration, login, JWT refresh
│   │   ├── glucose.py               #     Glucose logging & stats
│   │   ├── meal.py                  #     Meal upload, analysis & history
│   │   ├── screening.py             #     Diabetes screening prediction
│   │   ├── retinopathy.py           #     Fundus image DR screening
│   │   ├── ai_chat.py               #     AI assistant (CRUD, stream, search, export)
│   │   ├── doctor.py                #     Doctor dashboard & patient management
│   │   ├── patient.py               #     Patient dashboard
│   │   ├── alerts.py                #     Health alert management
│   │   ├── clinical.py              #     Clinical notes
│   │   └── settings.py              #     User preferences
│   │
│   ├── services/                    #   Business logic layer
│   │   ├── ai_service.py            #     CNN inference + Vision API + chatbot orchestration
│   │   ├── screening_service.py     #     XGBoost prediction pipeline
│   │   ├── auth_service.py          #     Authentication & token management
│   │   ├── glucose_service.py       #     Glucose CRUD & stats
│   │   ├── meal_service.py          #     Meal processing & history
│   │   ├── doctor_service.py        #     Doctor dashboard analytics
│   │   ├── patient_service.py       #     Patient dashboard data
│   │   ├── clinical_service.py      #     Clinical note operations
│   │   ├── alert_service.py         #     Alert generation & management
│   │   └── settings_service.py      #     User preference management
│   │
│   ├── models/                      #   SQLAlchemy ORM (21 tables)
│   │   ├── database.py              #     Engine, session, Base
│   │   ├── user.py                  #     User, Role, user_roles
│   │   ├── patient_doctor.py        #     Patient, Doctor, doctor_patient
│   │   ├── glucose_log.py           #     GlucoseLog
│   │   ├── meal_log.py              #     MealLog, MealDetectedItem
│   │   ├── screening.py             #     Screening, ScreeningAnswer, Question, ScreeningType
│   │   ├── ai_conversation.py       #     AiConversation, AiMessage
│   │   ├── alert.py                 #     Alert
│   │   ├── clinical_note.py         #     ClinicalNote
│   │   ├── health_preferences.py    #     HealthPreferences
│   │   ├── audit_log.py             #     AuditLog
│   │   └── lookup.py                #     LkDiabetesType, LkSpecialization
│   │
│   ├── schemas/                     #   Pydantic request/response models
│   └── core/                        #   Config, security, dependency injection
│       ├── config.py                #     Environment settings
│       ├── security.py              #     JWT encode/decode, password hashing
│       └── dependencies.py          #     FastAPI dependency providers
│
├── frontend/                        # ── React SPA ──
│   └── src/
│       ├── main.tsx                 #   App entry point
│       ├── api/                     #   Axios API modules (12 modules)
│       │   ├── axiosClient.ts       #     Base client, interceptors, auto-refresh
│       │   ├── authApi.ts           #     Auth endpoints
│       │   ├── glucoseApi.ts        #     Glucose endpoints
│       │   ├── mealApi.ts           #     Meal endpoints
│       │   ├── screeningApi.ts      #     Screening endpoints
│       │   ├── retinopathyApi.ts    #     Retinopathy endpoints
│       │   ├── chatApi.ts           #     AI chat + streaming
│       │   ├── doctorApi.ts         #     Doctor dashboard
│       │   ├── patientApi.ts        #     Patient dashboard
│       │   ├── alertsApi.ts         #     Alerts
│       │   ├── clinicalApi.ts       #     Clinical notes
│       │   └── settingsApi.ts       #     User settings
│       │
│       └── app/
│           ├── routes.tsx           #   React Router config
│           ├── pages/               #   13 page components
│           │   ├── LandingPage.tsx
│           │   ├── AuthPage.tsx
│           │   ├── DiabetesTestPage.tsx
│           │   ├── PatientDashboard.tsx
│           │   ├── GlucoseLogsPage.tsx
│           │   ├── MealLogsPage.tsx
│           │   ├── RetinopathyPage.tsx
│           │   ├── AIAssistantPage.tsx
│           │   ├── AISummaryPage.tsx
│           │   ├── DoctorDashboard.tsx
│           │   ├── DoctorAIAssistantPage.tsx
│           │   ├── PatientDetailsPage.tsx
│           │   └── PatientSettingsPage.tsx
│           │
│           ├── components/          #   Shared UI components
│           │   ├── Navbar.tsx
│           │   ├── Footer.tsx
│           │   ├── HeroSection.tsx
│           │   ├── FeaturesSection.tsx
│           │   ├── DiabetesTestModal.tsx
│           │   ├── ResultPopup.tsx
│           │   ├── ProtectedRoute.tsx
│           │   ├── ui/              #   48 Shadcn/ui primitives
│           │   └── figma/           #   Figma-exported components
│           │
│           └── context/
│               └── AuthContext.tsx   #   JWT auth state provider
│
├── ml/                              # ── Trained ML Models ──
│   ├── screening/                   #   XGBoost classifiers
│   │   ├── advanced_model.pkl
│   │   ├── simple_model.pkl
│   │   └── full_pipeline.pkl
│   ├── nutrition/                   #   MobileNetV2 CNN
│   │   └── nutrition_cnn.pkl
│   └── retinopathy/                 #   EfficientNet-B4 DR model
│       ├── best_dr_model.pth
│       ├── dr_inference.py          #   Inference service
│       └── dr_model_config.json     #   Thresholds & metrics
│
├── docs/                            # ── Project Documentation ──
│   ├── General/
│   │   ├── TEAM_DOCUMENTATION.md
│   │   └── CHATBOT_FEATURES.md
│   ├── Nutrition/
│   │   ├── cv_project_documentation.md
│   │   └── Nutrition_CNN_Discussion_Guide_Updated.md
│   └── Retinopathy/
│       ├── PLAN.md
│       └── last_edits.md
│
└── migrations/                      # Alembic migration versions
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| OpenRouter API Key | [Free tier available](https://openrouter.ai/) |

### Backend Setup

```bash
# 1. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux / macOS

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment variables
cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY and SECRET_KEY at minimum

# 4. Run database migrations
alembic upgrade head

# 5. Start the server (auto-seeds demo data on first run)
uvicorn main:app --reload --port 8005
```

### Frontend Setup

```bash
cd frontend
npm install
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

On first startup, the system seeds demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Doctor | `dr.sarah@diacheck.com` | `Doctor123` |
| Doctor | `dr.ahmed@diacheck.com` | `Doctor123` |
| Patient | `lina@diacheck.com` | `Patient123` |
| Patient | `omar@diacheck.com` | `Patient123` |
| Patient | `nadia@diacheck.com` | `Patient123` |
| Patient | `tariq@diacheck.com` | `Patient123` |
| Patient | `yasmine@diacheck.com` | `Patient123` |

---

## Configuration

Create a `.env` file from the template (see `.env.example`):

```env
# Database
DATABASE_URL=sqlite:///./diacheck.db

# JWT Authentication
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenRouter AI
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_VISION_MODEL=google/gemma-4-31b-it:free

# NVIDIA (optional — fallback AI provider)
NVIDIA_API_KEY=your-nvidia-api-key

# Doctor Registration Key
DOCTOR_ACCESS_KEY=your-doctor-access-key

# CORS — comma-separated allowed origins
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## API Reference

Full interactive documentation is available at `/docs` (Swagger UI) and `/redoc` when the server is running.

### Authentication — `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register/patient` | — | Register patient account |
| POST | `/auth/register/doctor` | — | Register doctor (requires access key) |
| POST | `/auth/login` | — | Login → JWT tokens |
| POST | `/auth/refresh` | — | Refresh access token |
| GET | `/auth/me` | Bearer | Current user profile |

### Glucose — `/glucose`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/glucose/log` | Patient | Log a glucose reading (auto-alerts on threshold breach) |
| GET | `/glucose/logs` | Patient | Glucose reading history |
| GET | `/glucose/stats` | Patient | Statistics and trends |

### Meals — `/meal`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/meal/upload` | Patient | Upload food image → hybrid AI analysis |
| POST | `/meal/confirm` | Patient | Save analyzed meal to history |
| GET | `/meal/` | Patient | Meal history |
| GET | `/meal/{id}` | Patient | Meal details |

### Screening — `/screening`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/screening/predict` | — | Submit answers → binary risk result |
| GET | `/screening/questions/{type}` | — | Get questions (`simple` / `advanced`) |
| GET | `/screening/history` | Patient | Past screening results |

### Retinopathy — `/retinopathy`

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/retinopathy/predict` | Patient | 10/min | Upload fundus image → DR severity grade (0–4) with confidence |

### AI Chat — `/ai`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/conversations` | Patient | Create a new conversation |
| GET | `/ai/conversations` | Patient | List conversations (paginated) |
| GET | `/ai/conversations/{id}` | Patient | Conversation detail with messages |
| DELETE | `/ai/conversations/{id}` | Patient | Delete a conversation |
| POST | `/ai/conversations/{id}/messages` | Patient | Send a text message |
| POST | `/ai/conversations/{id}/messages-with-image` | Patient | Send a message with image attachment |
| POST | `/ai/conversations/{id}/messages/stream` | Patient | Send message with SSE streaming response |
| POST | `/ai/messages/{id}/feedback` | Patient | Submit thumbs-up/down feedback |
| POST | `/ai/search` | Patient | Full-text search across conversations |
| POST | `/ai/conversations/{id}/export` | Patient | Export conversation (Markdown / plain text) |
| GET | `/ai/doctor/patients/{id}/conversations` | Doctor | View a patient's AI conversations |

### Doctor — `/doctor`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/doctor/dashboard` | Doctor | Population analytics |
| GET | `/doctor/patients` | Doctor | Patient list |
| GET | `/doctor/patients/{id}/profile` | Doctor | Full patient profile |
| GET | `/doctor/alerts` | Doctor | Patient health alerts |
| PUT | `/doctor/alerts/{id}/read` | Doctor | Mark alert as read |
| POST | `/doctor/notes` | Doctor | Create clinical note |

### Patient & Settings — `/patient`, `/settings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/patient/dashboard` | Patient | Dashboard with trends |
| GET | `/settings/profile` | Patient | User profile |
| PUT | `/settings/preferences` | Patient | Update glucose targets, carb limits |
| PUT | `/settings/password` | Patient | Change password |

---

## ML Models

### Diabetes Screening — XGBoost

| Aspect | Detail |
|--------|--------|
| **Models** | `ml/screening/advanced_model.pkl`, `simple_model.pkl`, `full_pipeline.pkl` |
| **Type** | XGBoost binary classifier |
| **Features** | Gender, age, hypertension, heart disease, smoking history, BMI, HbA1c, blood glucose |
| **Output** | `Diabetic` / `Not Diabetic` |
| **Simple Mode** | 6 user-facing questions mapped to 8 model features |
| **Advanced Mode** | 8 clinical questions with direct feature mapping |

### Nutrition Analysis — Hybrid Pipeline

Two-stage CNN + Vision API pipeline with automatic fallback:

```
Upload Image
     │
     ├──→ MobileNetV2 CNN (local)  ──→ calories, carbs, protein, fat
     │
     └──→ nemotron (via Nvidia) ──→ food names, portions, macros
               │
               └──→ Merged response
```

| Scenario | Behavior |
|----------|----------|
| Both succeed | API food names + CNN nutrition totals |
| API unavailable | CNN results only (fully offline capable) |
| CNN fails | API results only |

| Aspect | Detail |
|--------|--------|
| **Model** | `ml/nutrition/nutrition_cnn.pkl` |
| **Architecture** | MobileNetV2 (transfer learning) |
| **Output** | Calories, carbohydrates, protein, fat |

### Retinopathy Detection — EfficientNet-B4

| Aspect | Detail |
|--------|--------|
| **Model** | `ml/retinopathy/best_dr_model.pth` (67 MB) |
| **Architecture** | EfficientNet-B4 with regression head |
| **Input** | 380×380 circle-cropped fundus images |
| **Preprocessing** | Circle crop → ImageNet normalization |
| **Output** | 5 severity grades: No DR, Mild, Moderate, Severe, Proliferative DR |
| **Inference** | Regression score → optimized thresholds → grade |

**Model Metrics (Test Set)**

| Metric | Score |
|--------|-------|
| Quadratic Weighted Kappa | **0.928** |
| Accuracy | 82.0% |
| Precision | 84.6% |
| Recall | 82.0% |
| F1 Score | 82.7% |
| Mean AUC | 0.914 |

---

## Database Schema

```
User ─── Role (many-to-many via user_roles)
  │
  ├── Patient ─── GlucoseLog
  │            ─── MealLog ─── MealDetectedItem
  │            ─── Screening ─── ScreeningAnswer
  │            ─── Alert
  │            ─── HealthPreferences
  │            ─── AiConversation ─── AiMessage
  │
  └── Doctor ─── ClinicalNote
       │
       └── Patient (many-to-many via doctor_patient)

Lookups: LkDiabetesType, LkSpecialization, ScreeningType, Question
Audit:   AuditLog
```

**21 tables** including association tables and lookup tables.

---

## Security

| Feature | Implementation |
|---------|---------------|
| **Passwords** | bcrypt hashing |
| **Authentication** | JWT — 15 min access tokens + 7 day refresh tokens |
| **Authorization** | Role-based guards per endpoint (patient / doctor / either) |
| **Doctor Signup** | Protected by `DOCTOR_ACCESS_KEY` environment variable |
| **Rate Limiting** | SlowAPI — per-endpoint limits (e.g., 30/min chat, 10/min retinopathy) |
| **CORS** | Configurable allowed origins via environment variable |
| **Frontend** | Axios interceptor attaches Bearer token; auto-refresh on 401 |

---

## Frontend Routes

| Path | Page | Access |
|------|------|--------|
| `/` | Landing Page | Public |
| `/auth` | Login / Register | Public |
| `/diabetes-test` | Diabetes Screening Quiz | Public |
| `/dashboard/patient` | Patient Dashboard | Patient |
| `/dashboard/patient/glucose` | Glucose Logs | Patient |
| `/dashboard/patient/meals` | Meal Logs & Analysis | Patient |
| `/dashboard/patient/retinopathy` | Eye Screening | Patient |
| `/dashboard/patient/ai-chat` | AI Health Assistant | Patient |
| `/dashboard/patient/settings` | Patient Settings | Patient |
| `/dashboard/doctor` | Doctor Dashboard | Doctor |
| `/dashboard/doctor/patients` | Patient Details | Doctor |
| `/dashboard/doctor/ai-chat` | Doctor AI Assistant | Doctor |

---

## Documentation

Additional project documentation is available in the `docs/` directory:

| Document | Path |
|----------|------|
| Team Documentation | `docs/General/TEAM_DOCUMENTATION.md` |
| Chatbot Features | `docs/General/CHATBOT_FEATURES.md` |
| CV Project Documentation | `docs/Nutrition/cv_project_documentation.md` |
| Nutrition CNN Guide | `docs/Nutrition/Nutrition_CNN_Discussion_Guide_Updated.md` |
| Retinopathy Plan | `docs/Retinopathy/PLAN.md` |

---

## Deployment

```bash
# Backend — production
uvicorn main:app --host 0.0.0.0 --port 8005 --workers 4

# Frontend — production build
cd frontend && npm run build
# Serve frontend/dist/ with nginx or similar

# MySQL — update DATABASE_URL in .env
DATABASE_URL=mysql+pymysql://user:password@host:3306/diacheck
```

---

## License

MIT License © 2026 0xOmarTaha — see [LICENSE](LICENSE) for details.
