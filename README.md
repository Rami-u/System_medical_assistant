<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/DiaCheck-🩺-06b6d4?style=for-the-badge">
    <img src="https://img.shields.io/badge/DiaCheck-🩺-0284c7?style=for-the-badge">
  </picture>
</p>

<p align="center">
  <strong>AI-Powered Diabetes Management System</strong><br>
  Screening · Monitoring · Nutrition Analysis · Clinical Dashboard
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/PyTorch-2.0-EE4C2C?logo=pytorch&logoColor=white" alt="PyTorch">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## Overview

DiaCheck is a full-stack healthcare platform that combines **machine learning**, **computer vision**, and **cloud AI** to help patients manage diabetes and nutrition. Doctors get a real-time dashboard to monitor patients, write clinical notes, and respond to auto-generated health alerts.

### Features

| Module | Description |
|--------|-------------|
| **Diabetes Screening** | XGBoost classifier — answers 5–8 questions to predict diabetic risk |
| **Glucose Tracking** | Log blood glucose readings with fasting/post-meal context; auto-generated threshold alerts |
| **AI Meal Analysis** | Hybrid CNN (MobileNetV2) + OpenRouter Vision API — photograph food → get carbs, protein, fat, calories |
| **Retinopathy Detection** | Deep learning model for diabetic retinopathy screening from fundus images |
| **AI Health Assistant** | Context-aware chatbot with access to patient glucose, meals, and screening history |
| **Doctor Dashboard** | Population analytics, patient drill-down, clinical notes, alert management |
| **Patient Settings** | Target glucose ranges, carb limits, notification preferences |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)                    │
│      TypeScript · Tailwind CSS · Shadcn UI · Recharts           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (JSON)
┌──────────────────────────▼──────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│                                                                  │
│   api/ ───→ services/ ───→ models/ (SQLAlchemy)                 │
│                                                                  │
│   ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│   │  XGBoost       │  │  MobileNetV2   │  │  OpenRouter AI   │  │
│   │  Screening     │  │  CNN           │  │  Gemini / GPT    │  │
│   │  Classifier    │  │  Nutrition     │  │  Vision & Chat   │  │
│   └────────────────┘  └────────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                   ┌───────▼───────┐
                   │  SQLite / MySQL │
                   │   21 tables     │
                   └─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2 |
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS, Shadcn UI |
| **ML Screening** | XGBoost, Scikit-learn (binary diabetes classification) |
| **Computer Vision** | PyTorch, MobileNetV2 (nutrition), ResNet (retinopathy) |
| **Cloud AI** | OpenRouter API — Gemini / GPT-OSS models |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Database** | SQLite (dev), MySQL (production) |

---

## Project Structure

```
├── main.py                      # FastAPI entry point
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment template
├── alembic.ini                  # Migration config
│
├── app/                         # Backend
│   ├── api/                     #   Route handlers
│   │   ├── auth.py              #     Registration, login, JWT
│   │   ├── glucose.py           #     Glucose logging
│   │   ├── meal.py              #     Meal upload & analysis
│   │   ├── screening.py         #     Diabetes screening
│   │   ├── doctor.py            #     Doctor dashboard
│   │   ├── patient.py           #     Patient dashboard
│   │   ├── ai_chat.py           #     AI assistant
│   │   ├── settings.py          #     User preferences
│   │   ├── clinical.py          #     Clinical notes
│   │   └── alerts.py            #     Health alerts
│   │
│   ├── services/                #   Business logic
│   │   ├── ai_service.py        #     CNN + Vision API + chatbot
│   │   ├── screening_service.py #     ML prediction
│   │   └── ...
│   │
│   ├── models/                  #   SQLAlchemy ORM (21 tables)
│   ├── schemas/                 #   Pydantic models
│   └── core/                    #   Config, security, dependencies
│
├── frontend/                    # React SPA
│   └── src/
│       ├── api/                 #   Axios API modules
│       └── app/
│           ├── pages/           #   Route pages
│           ├── components/      #   Shared UI components
│           └── context/         #   Auth context (JWT)
│
├── ml/                          # Trained ML models
│   ├── screening/               #   XGBoost classifiers
│   ├── nutrition/               #   MobileNetV2 CNN
│   └── retinopathy/             #   Retinopathy detection
│
├── migrations/                  # Alembic migrations
└── tests/                       # Integration tests
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- [OpenRouter API Key](https://openrouter.ai/) (free tier available)

### Backend Setup

```bash
# Create virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY and SECRET_KEY

# Run database migrations
alembic upgrade head

# Start the server
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

---

## Configuration

```env
# Database
DATABASE_URL=sqlite:///./diacheck.db

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenRouter AI
OPENROUTER_API_KEY=your-api-key
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_VISION_MODEL=google/gemma-4-31b-it:free

# Doctor registration
DOCTOR_ACCESS_KEY=your-doctor-access-key

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## API Reference

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

### Doctor — `/doctor`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/doctor/dashboard` | Doctor | Population analytics |
| GET | `/doctor/patients` | Doctor | Patient list |
| GET | `/doctor/patients/{id}/profile` | Doctor | Full patient profile |
| GET | `/doctor/alerts` | Doctor | Patient health alerts |
| PUT | `/doctor/alerts/{id}/read` | Doctor | Mark alert as read |
| POST | `/doctor/notes` | Doctor | Create clinical note |

### AI Chat — `/ai`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/chat` | Patient | Send message to AI assistant |
| GET | `/ai/conversations` | Patient | List conversations |
| GET | `/ai/conversations/{id}` | Patient | Conversation messages |

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
| **Model** | `ml/screening/advanced_model.pkl` |
| **Type** | XGBoost Binary Classifier |
| **Features** | Gender, age, hypertension, heart disease, smoking history, BMI, HbA1c level, blood glucose |
| **Output** | `Diabetic` / `Not Diabetic` |
| **Simple Mode** | 5 user-facing questions mapped to 8 features |

### Nutrition Analysis — MobileNetV2 CNN + Vision API

Two-stage hybrid pipeline:

```
Upload Image
     │
     ├──→ MobileNetV2 CNN (local)  ──→ calories, macros
     │
     └──→ Gemma 4 (via OpenRouter) ──→ food names, portions
               │
               └──→ Merged response
```

| Scenario | Fallback |
|----------|----------|
| Both succeed | API food names + CNN nutrition totals |
| API unavailable | CNN results only (offline capable) |
| CNN fails | API results only |

### Retinopathy Detection — Deep Learning

| Aspect | Detail |
|--------|--------|
| **Model** | `ml/retinopathy/best_dr_model.pth` |
| **Type** | CNN classifier |
| **Input** | Fundus (retinal) images |
| **Output** | Diabetic retinopathy severity grade |

---

## Database Schema

```
User ─── Role
  │
  ├── Patient ─── GlucoseLog ─── MealLog ─── MealDetectedItem
  │            ─── Screening ─── ScreeningAnswer
  │            ─── Alert
  │            ─── HealthPreferences
  │            ─── AiConversation ─── AiMessage
  │
  └── Doctor ─── ClinicalNote
       │
       └── Patient (many-to-many through patient_doctor)
```

21 tables in total.

---

## Security

| Feature | Implementation |
|---------|---------------|
| **Passwords** | bcrypt hashing |
| **Authentication** | JWT (15 min access + 7 day refresh tokens) |
| **Authorization** | Role-based guards per endpoint (patient / doctor) |
| **Doctor Signup** | Protected by `DOCTOR_ACCESS_KEY` |
| **Frontend** | Axios interceptor attaches Bearer token; auto-logout on 401 |

---

## Deployment

```bash
# Backend — production
uvicorn main:app --host 0.0.0.0 --port 8005 --workers 4

# Frontend — production build
cd frontend && npm run build
# Serve frontend/dist/ with nginx or similar

# MySQL — update .env
DATABASE_URL=mysql+pymysql://user:password@host:3306/diacheck
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.
