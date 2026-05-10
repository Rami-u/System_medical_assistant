# DiaCheck — Smart Medical System
# Team Documentation

---

# Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Part 1: Front-End Team](#part-1-front-end-team)
4. [Part 2: Back-End Team](#part-2-back-end-team)
5. [Part 3: Chatbot & Security Team](#part-3-chatbot--security-team)
6. [Part 4: AI & Machine Learning Team](#part-4-ai--machine-learning-team)
7. [How to Run the Project](#how-to-run-the-project)
8. [Demo Credentials](#demo-credentials)

---

# 1. Project Overview

DiaCheck is a full-stack medical system that helps diabetic patients track their health and helps doctors monitor their patients. The system has six main features:

| Feature | What It Does |
|---------|-------------|
| Glucose Tracking | Patients log blood sugar readings; system auto-generates alerts if readings are dangerous |
| AI Meal Analysis | Patient photographs food; AI identifies items and estimates calories, carbs, protein, fat |
| Diabetes Screening | Patient answers 5-8 health questions; ML model predicts Diabetic or Not Diabetic |
| AI Health Chatbot | Patient chats with an AI assistant that knows their health history |
| Doctor Dashboard | Doctors see all their patients, alerts, trends, and can write clinical notes |
| Settings | Patients set glucose targets, carb limits, and notification preferences |

## Tech Stack Summary

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS, Shadcn UI, Recharts |
| Backend | Python, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic |
| AI/ML | PyTorch (MobileNetV2 CNN), Scikit-learn (XGBoost), OpenRouter API |
| Security | JWT tokens (access + refresh), bcrypt password hashing |
| Database | SQLite (development), MySQL (production) |

---

# 2. System Architecture

The system follows a 3-layer architecture:

```
┌──────────────────────────────────────────────┐
│            FRONTEND (React 19)               │
│  Pages → API Modules → Axios HTTP Client     │
└──────────────────┬───────────────────────────┘
                   │  REST API (JSON over HTTP)
┌──────────────────▼───────────────────────────┐
│            BACKEND (FastAPI)                 │
│                                              │
│  api/ (Routes) → services/ (Logic) → models/│
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ XGBoost  │ │ CNN      │ │ OpenRouter   │ │
│  │ Screening│ │ Nutrition│ │ Vision + Chat│ │
│  └──────────┘ └──────────┘ └──────────────┘ │
└──────────────────┬───────────────────────────┘
                   │
          ┌────────▼────────┐
          │  SQLite Database │
          │   (21 tables)    │
          └─────────────────┘
```

## How Data Flows (Example: Meal Upload)

```
1. Patient takes photo of food
2. Frontend sends image to POST /meal/upload
3. Backend runs CNN model (primary) → gets calories, carbs, fat, protein
4. Backend calls Vision API (enrichment) → gets food item names
5. Backend merges results and returns JSON to frontend
6. Patient reviews and confirms → POST /meal/confirm
7. Meal log saved to database with detected items
```

---

# Part 1: Front-End Team

## 1.1 Overview

The frontend is a React 19 single-page application built with TypeScript. It uses Vite as the build tool and Tailwind CSS for styling.

**Key Files:**
- `Frontend_New/src/main.tsx` — App entry point
- `Frontend_New/src/app/App.tsx` — Root component with router
- `Frontend_New/src/app/routes.tsx` — All page routes
- `Frontend_New/src/app/context/AuthContext.tsx` — Login/logout state management

## 1.2 Pages

| Page File | Route | Who Can Access | What It Does |
|-----------|-------|----------------|-------------|
| `LandingPage.tsx` | `/` | Everyone | Public homepage with features overview |
| `AuthPage.tsx` | `/auth` | Everyone | Login and registration forms |
| `DiabetesTestPage.tsx` | `/diabetes-test` | Everyone | Diabetes screening questionnaire |
| `PatientDashboard.tsx` | `/dashboard/patient` | Patient only | Health overview with glucose chart |
| `GlucoseLogsPage.tsx` | `/dashboard/patient/glucose` | Patient only | Log and view blood sugar readings |
| `MealLogsPage.tsx` | `/dashboard/patient/meals` | Patient only | Upload food photos, view meal history |
| `AIAssistantPage.tsx` | `/dashboard/patient/ai-chat` | Patient only | Chat with AI health assistant |
| `PatientSettingsPage.tsx` | `/dashboard/patient/settings` | Patient only | Profile and preferences |
| `DoctorDashboard.tsx` | `/dashboard/doctor` | Doctor only | Patient list, alerts, statistics |
| `PatientDetailsPage.tsx` | `/dashboard/doctor/patients` | Doctor only | Individual patient health data |

## 1.3 API Communication

All HTTP requests go through `axiosClient.ts`, which automatically:
- Attaches the JWT token to every request header
- Redirects to `/auth` if a 401 (unauthorized) response is received
- Points to `http://localhost:8005` (the backend)

Each backend module has its own API file:

| API File | Endpoints Called |
|----------|----------------|
| `authApi.ts` | `/auth/login`, `/auth/register/patient`, `/auth/register/doctor`, `/auth/me` |
| `glucoseApi.ts` | `/glucose/log`, `/glucose/logs`, `/glucose/stats` |
| `mealApi.ts` | `/meal/upload`, `/meal/confirm`, `/meal/` |
| `screeningApi.ts` | `/screening/predict`, `/screening/questions/{type}`, `/screening/history` |
| `chatApi.ts` | `/ai/chat`, `/ai/conversations` |
| `doctorApi.ts` | `/doctor/dashboard`, `/doctor/patients`, `/doctor/alerts` |
| `patientApi.ts` | `/patient/dashboard` |
| `settingsApi.ts` | `/settings/profile`, `/settings/preferences` |

## 1.4 Authentication Flow

```
1. User enters email + password on AuthPage
2. Frontend calls POST /auth/login
3. Backend returns { access_token, refresh_token, user: { id, role } }
4. Frontend stores tokens in localStorage
5. AuthContext sets the user state
6. ProtectedRoute checks user role before showing pages
7. If token expires (401 error), user is redirected to /auth
```

**Code location:** `Frontend_New/src/app/context/AuthContext.tsx`

The `AuthContext` provides these functions to all components:
- `signIn(email, password)` — Login
- `register(data)` — Register new patient or doctor
- `signOut()` — Clear tokens and redirect to login
- `user` — Current logged-in user object (or null)

## 1.5 How to Set Up

```bash
cd Frontend_New
npm install
npm run dev
# Opens at http://localhost:5173
```

---

# Part 2: Back-End Team

## 2.1 Overview

The backend is a Python FastAPI application. It follows a clean 3-layer pattern:

```
app/api/        → Route definitions (thin controllers)
app/services/   → Business logic (all the real work)
app/models/     → Database table definitions (SQLAlchemy ORM)
app/schemas/    → Request/response validation (Pydantic)
app/core/       → Config, security, shared dependencies
```

**Entry point:** `main.py`

## 2.2 What Happens on Startup

When you run `uvicorn main:app`, the server does these things in order:

1. Creates all 21 database tables (if they don't exist)
2. Seeds lookup data: roles (patient, doctor), screening types, questions
3. Seeds demo data: 2 doctors, 3 patients, glucose logs, meal logs, alerts
4. Loads ML models: XGBoost (screening) + MobileNetV2 CNN (nutrition)

## 2.3 Database Tables (21 Total)

| Table | Purpose |
|-------|---------|
| `users` | All user accounts (email, password hash) |
| `roles` | Role definitions (patient, doctor) |
| `user_roles` | Which user has which role |
| `patients` | Patient profile (linked to user) |
| `doctors` | Doctor profile (linked to user) |
| `doctor_patient` | Which doctor manages which patient |
| `glucose_logs` | Blood sugar readings with timestamp and context |
| `meal_logs` | Meal records (name, total carbs, total calories) |
| `meal_detected_items` | Individual food items detected per meal |
| `screening_types` | Simple vs Advanced screening |
| `questions` | Screening questions |
| `screenings` | Completed screening results |
| `screening_answers` | Patient's answers to screening questions |
| `alerts` | Auto-generated health alerts |
| `clinical_notes` | Doctor-written notes about patients |
| `ai_conversations` | Chat conversation headers |
| `ai_messages` | Individual chat messages |
| `health_preferences` | Patient glucose targets and carb limits |
| `lk_diabetes_types` | Diabetes type lookup |
| `lk_specializations` | Doctor specialization lookup |
| `audit_logs` | System audit trail |

**Entity Relationships:**

```
User ──→ Patient ──→ GlucoseLog
                 ──→ MealLog ──→ MealDetectedItem
                 ──→ Screening ──→ ScreeningAnswer
                 ──→ Alert
                 ──→ AiConversation ──→ AiMessage
                 ──→ HealthPreferences

User ──→ Doctor ──→ ClinicalNote
                ──→ Patient (many-to-many via doctor_patient)
```

## 2.4 API Endpoints

### Authentication (`/auth`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/auth/register/patient` | No | Register a new patient |
| POST | `/auth/register/doctor` | No | Register a new doctor (needs access key) |
| POST | `/auth/login` | No | Login, returns JWT tokens |
| POST | `/auth/refresh` | No | Get new access token using refresh token |
| GET | `/auth/me` | Yes | Get current user's profile |

### Glucose (`/glucose`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/glucose/log` | Patient | Log a glucose reading (auto-creates alerts) |
| GET | `/glucose/logs` | Patient | Get glucose history |
| GET | `/glucose/stats` | Patient | Get glucose statistics |

### Meals (`/meal`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/meal/upload` | Patient | Upload food image for AI analysis |
| POST | `/meal/confirm` | Patient | Save the analyzed meal to database |
| GET | `/meal/` | Patient | List meal history |
| GET | `/meal/{id}` | Patient | Get one meal's details |

### Screening (`/screening`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/screening/predict` | Optional | Run diabetes screening |
| GET | `/screening/questions/{type}` | No | Get questions for simple or advanced test |
| GET | `/screening/history` | Patient | Get past screening results |

### Doctor (`/doctor`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/doctor/dashboard` | Doctor | Dashboard statistics |
| GET | `/doctor/patients` | Doctor | List of assigned patients |
| GET | `/doctor/patients/{id}/profile` | Doctor | Full patient health profile |
| GET | `/doctor/alerts` | Doctor | List patient alerts |
| PUT | `/doctor/alerts/{id}/read` | Doctor | Mark an alert as read |
| POST | `/doctor/notes` | Doctor | Write a clinical note |

### AI Chat (`/ai`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/ai/chat` | Patient | Send message to AI chatbot |
| GET | `/ai/conversations` | Patient | List all conversations |
| GET | `/ai/conversations/{id}` | Patient | Get messages in a conversation |

## 2.5 How to Set Up

```bash
cd System_medical_assistant

python -m venv .venv
.venv\Scripts\activate          # Windows

pip install -r requirements.txt
pip install torch torchvision Pillow joblib scikit-learn numpy xgboost requests

cp .env.example .env
# Edit .env with your API keys

uvicorn main:app --reload --port 8005
# API docs at http://localhost:8005/docs
```

---

# Part 3: Chatbot & Security Team

## 3.1 Security: JWT Authentication

### What is JWT?

JWT (JSON Web Token) is a secure way to verify who a user is. When a user logs in, the server creates a signed token containing the user's ID and role. The frontend sends this token with every request so the server knows who is making the request.

### Token Types

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access Token | 15 minutes | Used for every API request |
| Refresh Token | 7 days | Used to get a new access token when the old one expires |

### Token Structure (Payload)

```json
{
  "sub": "5",           // User ID
  "role_id": 2,         // Role (1=patient, 2=doctor)
  "type": "access",     // Token type
  "exp": 1715100000     // Expiration timestamp
}
```

### How It Works

```
LOGIN:
  1. User sends email + password to POST /auth/login
  2. Server checks password against bcrypt hash in database
  3. Server creates access_token (15 min) + refresh_token (7 days)
  4. Server returns both tokens to frontend

EVERY REQUEST AFTER LOGIN:
  1. Frontend adds header: Authorization: Bearer <access_token>
  2. Server decodes and validates the token
  3. Server checks if user has the right role (patient vs doctor)
  4. If valid → process request. If invalid → return 401 error

TOKEN REFRESH:
  1. Access token expires after 15 minutes
  2. Frontend sends refresh_token to POST /auth/refresh
  3. Server issues a new access_token
```

### Key Files

| File | What It Does |
|------|-------------|
| `app/core/security.py` | Password hashing (bcrypt), JWT creation and decoding |
| `app/core/dependencies.py` | `get_current_patient` and `get_current_doctor` — FastAPI dependency injection |
| `app/services/auth_service.py` | Registration logic, login logic, token refresh |
| `app/api/auth.py` | Auth route definitions |

### Password Security

Passwords are hashed using **bcrypt** with 12 salt rounds. The plain-text password is never stored. When a user logs in, the entered password is hashed and compared to the stored hash.

```python
# Hashing (during registration)
hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))

# Verification (during login)
is_valid = bcrypt.checkpw(entered_password.encode("utf-8"), stored_hash.encode("utf-8"))
```

### Role-Based Access Control

| Role | Can Access |
|------|-----------|
| Patient | `/glucose/*`, `/meal/*`, `/patient/*`, `/ai/*`, `/settings/*`, `/screening/*` |
| Doctor | `/doctor/*` |
| Public (no login) | `/auth/*`, `/screening/predict`, `/screening/questions/*` |

The `get_current_patient` dependency checks that the user has the "patient" role. The `get_current_doctor` dependency checks for the "doctor" role. If the wrong role tries to access an endpoint, they get a 403 Forbidden error.

## 3.2 AI Chatbot

### Overview

The chatbot uses **OpenRouter API** to connect to large language models (LLMs). It is context-aware — it reads the patient's actual health data and uses it to give personalized advice.

### How the Chatbot Works

```
1. Patient types a message (e.g., "Is my blood sugar too high?")
2. Backend loads the patient's recent data:
   - Last 15 glucose readings (past 7 days)
   - Last 5 meals with nutrition info
   - Last 3 screening results
   - Patient profile (age, diabetes type)
3. Backend builds a system prompt with this data
4. Backend sends [system_prompt + user_message] to OpenRouter API
5. AI model generates a personalized response
6. Response is saved to database and returned to frontend
```

### System Prompt Structure

```
"You are Diacheck AI, a helpful medical assistant specializing in
diabetes management..."

── PATIENT HEALTH DATA ──
RECENT GLUCOSE (last 7 days):
  2026-05-06 08:30 — 145.0 mg/dL (post_meal)
  2026-05-06 07:00 — 98.0 mg/dL (fasting)

RECENT MEALS:
  2026-05-06 — Grilled Chicken Salad (cal=350, carbs=15g)

SCREENING HISTORY:
  2026-05-05 — Advanced: Not Diabetic
──────────────────────
```

### API Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| `OPENROUTER_MODEL` | `openai/gpt-oss-120b:free` | Text chatbot model |
| `OPENROUTER_VISION_MODEL` | `google/gemma-4-31b-it:free` | Vision model for food images |
| `VISION_FALLBACK_MODELS` | gemma-4-26b, nemotron-nano-12b | Backup models if primary is busy |

### Rate Limit Handling

The API sometimes returns **HTTP 429 (Too Many Requests)**. The system handles this with:

1. **Exponential Backoff**: Wait 1s, then 2s, then 4s before retrying (up to 3 attempts)
2. **Model Fallback**: If the primary vision model fails, try 2 backup models
3. **Graceful Error**: If all models fail, return a friendly error message

### Key Files

| File | What It Does |
|------|-------------|
| `app/services/ai_service.py` | All AI logic: chatbot, vision API, CNN model, OpenRouter calls |
| `app/api/ai_chat.py` | Chat route definitions |
| `app/models/ai_conversation.py` | Database models for conversations and messages |

---

# Part 4: AI & Machine Learning Team

## 4.1 Overview

The system uses three AI/ML components:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Diabetes Screening | XGBoost (scikit-learn) | Predict diabetic / not diabetic |
| Nutrition CNN | MobileNetV2 (PyTorch) | Estimate calories, carbs, fat, protein from food image |
| Vision API | OpenRouter (Gemma 4) | Identify food item names from food image |

## 4.2 Diabetes Screening Model

### What It Does

Patient answers health questions → model predicts **Diabetic** or **Not Diabetic**.

### Model Details

| Aspect | Value |
|--------|-------|
| Algorithm | XGBoost Classifier |
| Model File | `models/advanced_model.pkl` |
| Output | Binary: 0 (Not Diabetic) or 1 (Diabetic) |
| Input Features | 8 numeric values |

### The 8 Input Features

| # | Feature | Type | Example |
|---|---------|------|---------|
| 1 | gender | 0=female, 1=male | 1 |
| 2 | age | years | 45 |
| 3 | hypertension | 0=no, 1=yes | 0 |
| 4 | heart_disease | 0=no, 1=yes | 0 |
| 5 | smoking_history | 0=never, 1=former, 2=current | 0 |
| 6 | bmi | kg/m² | 28.5 |
| 7 | HbA1c_level | percentage | 6.2 |
| 8 | blood_glucose_level | mg/dL | 140 |

### Simple Mode (5 Questions)

The simple screening only asks 5 questions (age, BMI, glucose, activity, family history, smoking). The system maps these to the 8 features needed by the model:

- **HbA1c** is estimated from glucose: `HbA1c = (glucose + 46.7) / 28.7`
- **Hypertension** is estimated: `1 if age >= 45 AND bmi >= 28`
- **Gender** defaults to 0, **heart_disease** defaults to 0

### Prediction Code Flow

```python
# 1. Extract features from patient answers
features = [gender, age, hypertension, heart_disease, smoking, bmi, hba1c, glucose]

# 2. Run XGBoost prediction
prediction = model.predict([features])[0]  # Returns 0 or 1

# 3. Map to diagnosis
diagnosis = "Diabetic" if prediction == 1 else "Not Diabetic"
```

### Key Files

| File | What It Does |
|------|-------------|
| `Ai/src/train.py` | Training script for XGBoost model |
| `Ai/src/predict.py` | Standalone prediction script |
| `Ai/src/preprocess.py` | Data cleaning and preprocessing |
| `app/services/screening_service.py` | Backend integration (feature extraction + prediction) |

## 4.3 Nutrition CNN (Computer Vision)

### What It Does

Takes a photo of food and estimates 4 nutritional values:
- **Total Calories** (kcal)
- **Total Fat** (grams)
- **Total Carbohydrates** (grams)
- **Total Protein** (grams)

### Model Architecture

```
Input Image (224×224 RGB)
        │
        ▼
┌─────────────────────┐
│   MobileNetV2       │  ← Pre-trained on ImageNet (1.4M images)
│   (Feature Extractor)│     First 80 layers frozen during training
│   Output: 1280-dim  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Custom Regression  │
│   Head               │
│                      │
│   Dropout(0.4)       │
│   Linear(1280→512)   │
│   ReLU + BatchNorm   │
│   Dropout(0.3)       │
│   Linear(512→256)    │
│   ReLU + BatchNorm   │
│   Dropout(0.2)       │
│   Linear(256→128)    │
│   ReLU               │
│   Linear(128→4)      │  ← 4 nutrition outputs
└─────────┬───────────┘
          │
          ▼
Output: [calories, fat, carbs, protein] (Z-scores)
        → Denormalize using training means/stds
        → Final values in real units
```

### Training Details

| Aspect | Value |
|--------|-------|
| Dataset | Nutrition5k (Google Research, 2021) |
| Images Used | 3,485 overhead food photos |
| Train/Val Split | 85% / 15% |
| Best Validation Loss | 0.2699 |
| Epochs | 31 (early stopped at 43, patience=12) |
| Optimizer | AdamW (lr=1e-3 → 1e-5 after epoch 10) |
| GPU | NVIDIA RTX 4060 |

### Training Phases

| Phase | Epochs | What Happens |
|-------|--------|-------------|
| Frozen (FR) | 1-9 | Only the regression head trains; MobileNetV2 backbone is frozen |
| Fine-tuning (FT) | 10-31 | All layers unfrozen, learning rate reduced to 1e-5 |

### Z-Score Normalization

The model outputs **Z-scores** (standardized values), not real calories/grams. To get real values:

```python
real_value = z_score × std + mean

# Example for calories:
#   Z-score output: 0.5
#   Training mean: 320.4 kcal
#   Training std: 245.1 kcal
#   Real value: 0.5 × 245.1 + 320.4 = 442.95 kcal
```

The means and stds are saved inside `nutrition_cnn.pkl` alongside the model weights.

### How to Retrain

**Option 1: Google Colab (recommended, free GPU)**
1. Upload `nutrtition/Nutrition5k_CNN_Training.ipynb` to Google Colab
2. Set runtime to T4 GPU
3. Run all cells (downloads images from Google Cloud automatically)

**Option 2: Local (requires GPU)**
```bash
cd nutrtition
python download_images.py     # Downloads 3,485 images (~2-3 GB)
python colab_download_and_train.py --epochs 60 --batch-size 32 --use-amp
cp nutrition_cnn.pkl ../models/
```

### Key Files

| File | What It Does |
|------|-------------|
| `nutrtition/model.py` | NutritionCNN class definition |
| `nutrtition/dataset.py` | PyTorch Dataset for loading images |
| `nutrtition/train.py` | Training loop |
| `nutrtition/inference.py` | Standalone prediction script |
| `nutrtition/colab_download_and_train.py` | All-in-one download + train script |
| `nutrtition/download_images.py` | Download images from Google Cloud |
| `app/services/ai_service.py` | Backend integration (model loading + inference) |

## 4.4 Hybrid Meal Analysis Pipeline

The meal upload endpoint uses BOTH the CNN and the Vision API together:

```
Upload Food Image
       │
       ├────────────────────────┐
       ▼                        ▼
┌──────────────┐        ┌──────────────────┐
│  CNN Model   │        │  Vision API      │
│  (PRIMARY)   │        │  (ENRICHMENT)    │
│              │        │                  │
│  Fast, runs  │        │  Calls OpenRouter│
│  locally     │        │  Gemma 4 model   │
│              │        │                  │
│  Returns:    │        │  Returns:        │
│  cal=350     │        │  "Grilled Chicken│
│  carbs=25g   │        │   Salad" with    │
│  fat=15g     │        │   per-item       │
│  protein=30g │        │   breakdown      │
└──────┬───────┘        └────────┬─────────┘
       │                         │
       └────────────┬────────────┘
                    ▼
            MERGED RESPONSE
    Food names from API + nutrition from CNN
```

| Scenario | What Happens |
|----------|-------------|
| Both work | Best result: API food names + CNN nutrition totals |
| API rate-limited | CNN results still returned (system works offline) |
| CNN fails | API results only |
| Both fail | Error message returned |

---

# How to Run the Project

## Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- An OpenRouter API key (free at https://openrouter.ai)

## Step 1: Clone the Repository

```bash
git clone https://github.com/0xOmarTaha/FinalProject.git
cd FinalProject/System_medical_assistant
```

## Step 2: Backend

```bash
# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux

# Install Python dependencies
pip install -r requirements.txt
pip install torch torchvision Pillow joblib scikit-learn numpy xgboost requests

# Set up environment variables
cp .env.example .env
# Open .env and add your OPENROUTER_API_KEY

# Start the backend server
uvicorn main:app --reload --port 8005
```

The API docs are available at: http://localhost:8005/docs

## Step 3: Frontend

```bash
cd Frontend_New
npm install
npm run dev
```

The app opens at: http://localhost:5173

## Step 4: ML Models

The ML model files are NOT included in the repository (too large). You need to:

1. Get `advanced_model.pkl` and `simple_model.pkl` from the AI team
2. Train or download `nutrition_cnn.pkl` (see nutrtition/README.md)
3. Place all `.pkl` files in the `models/` directory

---

# Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Doctor | dr.sarah@diacheck.com | Doctor123 |
| Doctor | dr.ahmed@diacheck.com | Doctor123 |
| Patient | lina@diacheck.com | Patient123 |
| Patient | omar@diacheck.com | Patient123 |

These demo accounts are auto-created when the server starts for the first time.

---

# Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection string |
| `SECRET_KEY` | Yes | JWT signing secret (any random string) |
| `ALGORITHM` | Yes | JWT algorithm (use `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Yes | Access token lifetime (default: 15) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Yes | Refresh token lifetime (default: 7) |
| `OPENROUTER_API_KEY` | Yes | API key for AI chatbot and vision |
| `OPENROUTER_MODEL` | No | Chat model (default: gpt-oss-120b) |
| `OPENROUTER_VISION_MODEL` | No | Vision model (default: gemma-4-31b-it) |
| `DOCTOR_ACCESS_KEY` | Yes | Secret key required to register as doctor |
