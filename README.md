<p align="center">
  <h1 align="center">🩺 DiaCheck — Smart Medical System</h1>
  <p align="center">
    AI-Powered Diabetes Management Platform with Computer Vision Nutrition Analysis
    <br />
    <strong>FastAPI · React · PyTorch · OpenRouter AI</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## Overview

DiaCheck is a full-stack healthcare platform that combines **machine learning**, **computer vision**, and **cloud AI** to help patients manage diabetes and nutrition. Doctors get a real-time dashboard to monitor patients, write clinical notes, and respond to auto-generated health alerts.

### Key Features

| Module | Description |
|--------|-------------|
| 🩸 **Glucose Tracking** | Log blood glucose readings with context (fasting, post-meal) + auto-generated alerts |
| 📸 **AI Meal Analysis** | Hybrid CNN + Vision API: photograph food → get carbs, protein, fat, calories per item |
| 🧪 **Diabetes Screening** | XGBoost binary classifier: answers 5–8 questions → **Diabetic** / **Not Diabetic** |
| 🤖 **AI Health Assistant** | Context-aware chatbot with access to patient's glucose, meals, and screening history |
| 👨‍⚕️ **Doctor Dashboard** | Population analytics, patient drill-down, clinical notes, alert management |
| ⚙️ **Settings & Preferences** | Target glucose ranges, carb limits, notification preferences |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (React 19)                     │
│    Vite · TypeScript · Tailwind CSS · Shadcn UI · Recharts   │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API (JSON)
┌──────────────────────▼───────────────────────────────────────┐
│                    Backend (FastAPI)                          │
│                                                              │
│   API Layer ──→ Service Layer ──→ Data Layer                 │
│   (app/api/)    (app/services/)   (app/models/)              │
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│   │ XGBoost     │  │ MobileNetV2 │  │ OpenRouter API    │   │
│   │ Screening   │  │ CNN (local) │  │ Gemma 4 Vision    │   │
│   │ Model       │  │ Primary     │  │ Enrichment        │   │
│   └─────────────┘  └─────────────┘  └───────────────────┘   │
└──────────────────────┬───────────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  SQLite / MySQL │
              │   21 Tables     │
              └─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2 |
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS, Shadcn UI |
| **ML Screening** | XGBoost, Scikit-learn (binary diabetes classification) |
| **Computer Vision** | PyTorch, MobileNetV2 (nutrition regression CNN) |
| **Cloud AI** | OpenRouter API — Gemma 4 31B (vision) + GPT-OSS 120B (chat) |
| **Auth** | JWT (access + refresh tokens), bcrypt password hashing |
| **Database** | SQLite (development), MySQL (production) |
| **Charts** | Recharts |

---

## Project Structure

```
System_medical_assistant/
├── main.py                          # FastAPI entry point + lifespan
├── requirements.txt                 # Python dependencies
├── .env.example                     # Environment template
├── alembic.ini                      # Database migration config
│
├── app/                             # Backend application
│   ├── api/                         #   Route controllers
│   │   ├── auth.py                  #     Registration, login, JWT
│   │   ├── glucose.py               #     Glucose logging + stats
│   │   ├── meal.py                  #     AI meal upload + confirm
│   │   ├── screening.py             #     Diabetes screening
│   │   ├── doctor.py                #     Doctor dashboard + patients
│   │   ├── patient.py               #     Patient dashboard
│   │   ├── ai_chat.py               #     AI assistant conversations
│   │   ├── settings.py              #     Profile & preferences
│   │   ├── clinical.py              #     Doctor clinical notes
│   │   └── alerts.py                #     Health alert management
│   │
│   ├── services/                    #   Business logic layer
│   │   ├── ai_service.py            #     Hybrid CNN + Vision API + chatbot
│   │   ├── screening_service.py     #     XGBoost ML prediction
│   │   ├── glucose_service.py       #     Glucose logging + auto-alerts
│   │   ├── meal_service.py          #     Meal log CRUD
│   │   ├── doctor_service.py        #     Doctor analytics
│   │   └── ...
│   │
│   ├── models/                      #   SQLAlchemy ORM models (21 tables)
│   │   ├── user.py                  #     User, Role
│   │   ├── patient_doctor.py        #     Patient, Doctor, assignments
│   │   ├── glucose_log.py           #     GlucoseLog
│   │   ├── meal_log.py              #     MealLog, MealDetectedItem
│   │   ├── screening.py             #     Screening, ScreeningAnswer
│   │   ├── alert.py                 #     Alert (auto-generated)
│   │   └── ...
│   │
│   ├── schemas/                     #   Pydantic request/response models
│   └── core/                        #   Config, security, dependencies
│
├── models/                          # Pre-trained ML model weights (.gitignored)
│   ├── advanced_model.pkl           #   XGBoost diabetes classifier
│   ├── simple_model.pkl             #   RandomForest (simple mode)
│   └── nutrition_cnn.pkl            #   MobileNetV2 nutrition CNN
│
├── Ai/                              # ML development workspace
│   ├── src/                         #   Training scripts (train.py, predict.py)
│   └── notebooks/                   #   Experiment notebooks
│
├── nutrtition/                      # CNN training pipeline
│   ├── model.py                     #   NutritionCNN architecture
│   ├── colab_download_and_train.py  #   All-in-one Colab training script
│   ├── download_images.py           #   Download images from GCS
│   ├── Nutrition5k_CNN_Training.ipynb  # Colab notebook
│   └── README.md                    #   Training instructions
│
├── Frontend_New/                    # React frontend
│   ├── src/
│   │   ├── api/                     #   Axios API modules
│   │   └── app/
│   │       ├── pages/               #     11 page components
│   │       ├── components/          #     Shared components + Shadcn UI
│   │       └── context/             #     Auth context (JWT management)
│   ├── package.json
│   └── vite.config.ts
│
├── migrations/                      # Alembic database migrations
└── test_all_endpoints.py            # API integration tests
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- [OpenRouter API Key](https://openrouter.ai/) (free tier available)

### 1. Backend Setup

```bash
cd System_medical_assistant

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt
pip install torch torchvision Pillow joblib scikit-learn numpy xgboost requests

# Copy and configure environment
cp .env.example .env
# Edit .env with your OPENROUTER_API_KEY and SECRET_KEY

# Start server
uvicorn main:app --reload --port 8005
```

### 2. Frontend Setup

```bash
cd Frontend_New

npm install
npm run dev
```

### 3. Access Points

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

```env
# Database
DATABASE_URL=sqlite:///./diacheck.db

# JWT Authentication
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenRouter AI (get free key at openrouter.ai)
OPENROUTER_API_KEY=your-api-key
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_VISION_MODEL=google/gemma-4-31b-it:free

# Doctor Registration
DOCTOR_ACCESS_KEY=your-doctor-access-key
```

---

## ML & AI Models

### 1. Diabetes Screening — XGBoost Binary Classifier

| Aspect | Detail |
|--------|--------|
| **Model** | `models/advanced_model.pkl` |
| **Type** | XGBoost Classifier |
| **Features** | gender, age, hypertension, heart_disease, smoking_history, bmi, HbA1c_level, blood_glucose_level |
| **Output** | Binary: `Diabetic` / `Not Diabetic` |
| **Simple Mode** | 5 questions mapped to 8 features (HbA1c estimated via eAG formula) |

### 2. Nutrition Analysis — Hybrid CNN + Vision API

The meal analysis pipeline uses a **two-stage hybrid approach**:

```
Upload Image
     │
     ├──────────────────┐
     ▼                  ▼
┌──────────┐    ┌──────────────┐
│ CNN Model│    │ Vision API   │
│ (Primary)│    │ (Enrichment) │
│          │    │              │
│ MobileNet│    │ Gemma 4 31B  │
│ V2       │    │ via OpenRouter│
│          │    │              │
│ Returns: │    │ Returns:     │
│ calories │    │ food names   │
│ carbs_g  │    │ per-item     │
│ fat_g    │    │ portions     │
│ protein_g│    │ nutrition    │
└────┬─────┘    └──────┬───────┘
     │                 │
     └────────┬────────┘
              ▼
       Merged Response
```

| Scenario | Result |
|----------|--------|
| Both succeed | API food names + CNN nutrition totals |
| API rate-limited | CNN results returned (offline capable) |
| CNN fails | API results only |

**CNN Training:**

| Aspect | Detail |
|--------|--------|
| **Architecture** | MobileNetV2 + custom regression head (4 outputs) |
| **Dataset** | [Nutrition5k](https://github.com/google-research-datasets/Nutrition5k) — 3,485 images |
| **Best Val Loss** | 0.2699 (31 epochs, early stopping) |
| **Training** | RTX 4060 local / Google Colab T4 |

To retrain the CNN, see [`nutrtition/README.md`](nutrtition/README.md).

### 3. AI Health Assistant — OpenRouter

| Aspect | Detail |
|--------|--------|
| **Chat Model** | GPT-OSS 120B (free tier) |
| **Vision Model** | Gemma 4 31B IT (free tier) |
| **Fallback Models** | Gemma 4 26B, Nemotron Nano 12B |
| **Context** | Patient glucose readings, meals, screenings, profile |
| **Features** | Retry with exponential backoff, model fallback chain |

---

## API Reference

### Authentication — `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register/patient` | — | Register patient |
| POST | `/auth/register/doctor` | — | Register doctor (requires access key) |
| POST | `/auth/login` | — | Login → JWT tokens |
| POST | `/auth/refresh` | — | Refresh access token |
| GET | `/auth/me` | Bearer | Current user profile |

### Glucose — `/glucose`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/glucose/log` | Patient | Log glucose reading (auto-alerts) |
| GET | `/glucose/logs` | Patient | Glucose history |
| GET | `/glucose/stats` | Patient | Statistics & trends |

### Meals — `/meal`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/meal/upload` | Patient | Upload image → hybrid AI analysis |
| POST | `/meal/confirm` | Patient | Save analyzed meal log |
| GET | `/meal/` | Patient | Meal history |
| GET | `/meal/{id}` | Patient | Meal detail |

### Screening — `/screening`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/screening/predict` | Optional | Diabetes screening → binary result |
| GET | `/screening/questions/{type}` | — | Get questions (`simple` / `advanced`) |
| GET | `/screening/history` | Patient | Past screening results |

### Doctor — `/doctor`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/doctor/dashboard` | Doctor | Dashboard stats |
| GET | `/doctor/patients` | Doctor | Patient list |
| GET | `/doctor/patients/{id}/profile` | Doctor | Full patient profile |
| GET | `/doctor/alerts` | Doctor | Patient alerts |
| PUT | `/doctor/alerts/{id}/read` | Doctor | Mark alert read |
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
| GET | `/settings/profile` | Patient | Profile & preferences |
| PUT | `/settings/preferences` | Patient | Update glucose targets, carb limits |
| PUT | `/settings/password` | Patient | Change password |

---

## Database Schema

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
    Screening ||--o{ ScreeningAnswer : contains
    AiConversation ||--o{ AiMessage : contains
```

**21 tables** including User, Patient, Doctor, GlucoseLog, MealLog, MealDetectedItem, Screening, ScreeningAnswer, Alert, ClinicalNote, AiConversation, AiMessage, HealthPreferences, and lookup tables.

---

## Security

| Feature | Implementation |
|---------|---------------|
| **Password Hashing** | bcrypt with auto-managed salt rounds |
| **JWT Tokens** | Access (15 min) + Refresh (7 days) |
| **Role-Based Access** | Patient / Doctor roles enforced per endpoint |
| **Doctor Registration** | Requires `DOCTOR_ACCESS_KEY` |
| **Frontend Auth** | Axios interceptor attaches Bearer token, auto-clears on 401 |

---

## Deployment

### Production

```bash
# Backend
uvicorn main:app --host 0.0.0.0 --port 8005 --workers 4

# Frontend
cd Frontend_New && npm run build
# Serve dist/ with nginx
```

### MySQL

Update `.env`:
```env
DATABASE_URL=mysql+pymysql://user:password@host:3306/diacheck
```

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8005"]
```

---

## Team

Smart Medical System for Blood Diseases — Built as a collaborative project with 11 team members across ML, Backend, Security, and Frontend domains.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
