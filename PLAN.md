# DiaCheck — Implementation Plan

## Status Legend
- [ ] Not started
- [🔄] In progress
- [✅] Done

## Task List

### PHASE 0 — Plan
- [✅] 0.1 Create this PLAN.md file

### PHASE 1 — Project Cleanup & Structure
- [✅] 1.1 Audit all existing files and folders
- [✅] 1.2 Fix model path in ai_service.py (models/ → ml/nutrition/)
- [✅] 1.3 Update .gitignore (envs, cache, large models, secrets, node_modules)
- [✅] 1.4 Update .env.example with CORS_ORIGINS
- [✅] 1.5 Update requirements.txt with slowapi + explicit deps

### PHASE 2 — Retinopathy Integration
- [✅] 2.1 Create ml/retinopathy/dr_inference.py (DRInferenceService)
- [✅] 2.2 Create RetinopathyResponse Pydantic schema
- [✅] 2.3 Create app/api/retinopathy.py with POST /retinopathy/predict
- [✅] 2.4 Register retinopathy router in main.py
- [✅] 2.5 Load DR model in lifespan startup
- [✅] 2.6 Add file validation (type + size) and rate limiting (10/min)

### PHASE 3 — Frontend Connection
- [✅] 3.1 Create retinopathyApi.ts
- [✅] 3.2 Create RetinopathyPage.tsx with upload + grade result display
- [✅] 3.3 Add route in routes.tsx
- [✅] 3.4 Add "Eye Screening" sidebar link to ALL patient pages:
  - PatientDashboard, GlucoseLogsPage, MealLogsPage, AIAssistantPage, PatientSettingsPage
- [✅] 3.5 Add high-risk DR banner in PatientDashboard (risk_level === "high")

### PHASE 4 — Security
- [✅] 4.1 CORS: env-based origins (CORS_ORIGINS) instead of allow_origins=["*"]
- [✅] 4.2 Rate limiting: slowapi on login (5/min), meal upload (10/min), retinopathy (10/min)
- [✅] 4.3 File upload validation: type whitelist + 10MB size limit on all upload endpoints

### PHASE 5 — Dashboard Audit
- [✅] 5.1 Audit patient_service.py → 4 scalar queries, no N+1 ✓
- [✅] 5.2 Audit doctor_service.py → single aggregated query w/ subqueries, no N+1 ✓
- [✅] 5.3 Audit meal_service.py → uses selectinload, no N+1 ✓
- [✅] 5.4 Audit glucose_service.py → uses selectinload, no N+1 ✓

### PHASE 6 — Nutrition Display Fix
- [✅] 6.1 Backend: round all nutrition floats to 2dp before DB save (meal_service.py)
- [✅] 6.2 Frontend: all nutrition values already use Math.round() in MealLogsPage.tsx
- [✅] 6.3 Backend meal upload: round values in response (app/api/meal.py)

### PHASE 7 — Nutrition Vision API Performance Fix
- [✅] 7.1 Two-phase response architecture in app/api/meal.py:
  - Phase 1: CNN returns instantly (<1s)
  - Phase 2: Vision API runs in BackgroundTasks
- [✅] 7.2 New endpoint: GET /meal/enrich/{task_id} for polling
- [✅] 7.3 In-memory enrichment cache with 5-minute TTL
- [✅] 7.4 Strict 3-second timeout on Vision API calls (won't block background task)
- [✅] 7.5 Frontend: mealApi.ts updated with getEnrichment() polling method
- [✅] 7.6 Frontend: MealLogsPage.tsx polls enrichment after scan, shows "Enriching…" badge
- [✅] 7.7 Graceful degradation: if enrichment fails, CNN result is kept

## Files Modified/Created

| File | Action |
|------|--------|
| `PLAN.md` | Created |
| `.gitignore` | Rewritten |
| `.env.example` | Updated with CORS_ORIGINS |
| `requirements.txt` | Added slowapi + explicit deps |
| `app/services/ai_service.py` | Fixed model path, added timeout param |
| `ml/retinopathy/dr_inference.py` | Created — DR model inference |
| `app/schemas/retinopathy_schemas.py` | Created — RetinopathyResponse |
| `app/api/retinopathy.py` | Created — prediction endpoint |
| `app/api/auth.py` | Added rate limiting |
| `app/api/meal.py` | Two-phase architecture rewrite |
| `app/services/meal_service.py` | Added rounding to nutrition values |
| `main.py` | DR loader, retinopathy router, CORS, slowapi |
| `frontend/src/api/retinopathyApi.ts` | Created |
| `frontend/src/api/mealApi.ts` | Added enrichment types + polling |
| `frontend/src/app/pages/RetinopathyPage.tsx` | Created |
| `frontend/src/app/routes.tsx` | Added retinopathy route |
| `frontend/src/app/pages/PatientDashboard.tsx` | Eye Screening sidebar + DR banner |
| `frontend/src/app/pages/GlucoseLogsPage.tsx` | Eye Screening sidebar |
| `frontend/src/app/pages/MealLogsPage.tsx` | Eye Screening sidebar + enrichment polling |
| `frontend/src/app/pages/AIAssistantPage.tsx` | Eye Screening sidebar |
| `frontend/src/app/pages/PatientSettingsPage.tsx` | Eye Screening sidebar |
