"""
Phase 2 — Full endpoint test suite for Diacheck API.
Tests every endpoint and records status codes + issues.
"""

import httpx
import json
import sys
from datetime import datetime, timezone

BASE = "http://localhost:8005"
PATIENT_TOKEN = None
DOCTOR_TOKEN = None
PATIENT_EMAIL = f"testpatient_{int(datetime.now().timestamp())}@test.com"
DOCTOR_EMAIL = f"testdoctor_{int(datetime.now().timestamp())}@test.com"
PASSWORD = "TestPass1"

results = []

def log(endpoint, method, status, ok, note=""):
    tag = "✅" if ok else "❌"
    results.append({"endpoint": f"{method} {endpoint}", "status": status, "ok": ok, "note": note})
    print(f"  {tag} {method:6} {endpoint:50} → {status}  {note}")


def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main():
    global PATIENT_TOKEN, DOCTOR_TOKEN

    client = httpx.Client(base_url=BASE, timeout=30.0)

    print("=" * 70)
    print("PHASE 2 — TESTING ALL ENDPOINTS")
    print("=" * 70)

    # ─── Health Check ────────────────────────────────────────────────────
    print("\n── Health Check ──")
    r = client.get("/")
    log("/", "GET", r.status_code, r.status_code == 200)

    # ─── AUTH ────────────────────────────────────────────────────────────
    print("\n── AUTH ──")

    # Register doctor first (so auto-assign works for patient)
    r = client.post("/auth/register/doctor", json={
        "full_name": "Dr Test Doctor",
        "email": DOCTOR_EMAIL,
        "password": PASSWORD,
    })
    log("/auth/register/doctor", "POST", r.status_code, r.status_code == 201, r.text[:200] if r.status_code != 201 else "")

    # Register patient
    r = client.post("/auth/register/patient", json={
        "full_name": "Test Patient",
        "email": PATIENT_EMAIL,
        "password": PASSWORD,
        "dob": "1990-05-15",
        "gender": "male",
        "height_cm": 175,
        "weight_kg": 80,
    })
    log("/auth/register/patient", "POST", r.status_code, r.status_code == 201, r.text[:200] if r.status_code != 201 else "")

    # Login patient
    r = client.post("/auth/login", json={"email": PATIENT_EMAIL, "password": PASSWORD})
    log("/auth/login (patient)", "POST", r.status_code, r.status_code == 200)
    if r.status_code == 200:
        data = r.json()
        PATIENT_TOKEN = data["access_token"]
        print(f"    Patient token saved (user_id={data['user']['id']}, role={data['user']['role']})")

    # Login doctor
    r = client.post("/auth/login", json={"email": DOCTOR_EMAIL, "password": PASSWORD})
    log("/auth/login (doctor)", "POST", r.status_code, r.status_code == 200)
    if r.status_code == 200:
        data = r.json()
        DOCTOR_TOKEN = data["access_token"]
        print(f"    Doctor token saved (user_id={data['user']['id']}, role={data['user']['role']})")

    # GET /auth/me
    r = client.get("/auth/me", headers=headers(PATIENT_TOKEN))
    log("/auth/me", "GET", r.status_code, r.status_code == 200)

    # ─── PATIENT ─────────────────────────────────────────────────────────
    print("\n── PATIENT ──")
    r = client.get("/patient/dashboard", headers=headers(PATIENT_TOKEN))
    log("/patient/dashboard", "GET", r.status_code, r.status_code == 200, r.text[:200] if r.status_code != 200 else "")

    r = client.get("/patient/profile", headers=headers(PATIENT_TOKEN))
    log("/patient/profile", "GET", r.status_code, r.status_code == 200)

    r = client.patch("/patient/profile", headers=headers(PATIENT_TOKEN), json={"weight_kg": 82})
    log("/patient/profile", "PATCH", r.status_code, r.status_code == 200)

    r = client.get("/patient/stats", headers=headers(PATIENT_TOKEN))
    log("/patient/stats", "GET", r.status_code, r.status_code == 200)

    # ─── GLUCOSE ─────────────────────────────────────────────────────────
    print("\n── GLUCOSE ──")
    r = client.post("/glucose/logs", headers=headers(PATIENT_TOKEN), json={
        "glucose_value": 120.5,
        "reading_type": "fasting",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "notes": "Test reading"
    })
    log("/glucose/logs", "POST", r.status_code, r.status_code == 201, r.text[:200] if r.status_code != 201 else "")

    # Add a high glucose to trigger alert
    r = client.post("/glucose/logs", headers=headers(PATIENT_TOKEN), json={
        "glucose_value": 350.0,
        "reading_type": "random",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "notes": "High test"
    })
    log("/glucose/logs (high)", "POST", r.status_code, r.status_code == 201)

    r = client.get("/glucose/logs", headers=headers(PATIENT_TOKEN))
    log("/glucose/logs", "GET", r.status_code, r.status_code == 200)

    r = client.get("/glucose/stats?days=7", headers=headers(PATIENT_TOKEN))
    log("/glucose/stats", "GET", r.status_code, r.status_code == 200)

    # ─── MEALS ───────────────────────────────────────────────────────────
    print("\n── MEALS ──")
    # Test upload with a dummy image (will likely fail AI but tests the endpoint)
    import io
    from PIL import Image
    img = Image.new("RGB", (100, 100), color="red")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    r = client.post("/meal/upload", 
        headers={"Authorization": f"Bearer {PATIENT_TOKEN}"},
        files={"file": ("test.png", buf, "image/png")})
    log("/meal/upload", "POST", r.status_code, r.status_code in (200, 503), 
        r.text[:200] if r.status_code not in (200, 503) else f"status={r.status_code}")

    # Confirm meal
    r = client.post("/meal/confirm", headers=headers(PATIENT_TOKEN), json={
        "meal_name": "Test Lunch",
        "meal_time": datetime.now(timezone.utc).isoformat(),
        "total_carbs_g": 45.0,
        "total_calories": 500,
        "detected_items": [
            {
                "food_name": "Rice",
                "confidence_pct": 95.0,
                "quantity_desc": "1 cup",
                "carbs_g": 45.0,
                "calories": 200,
                "protein_g": 4.0,
                "fat_g": 0.5
            }
        ]
    })
    log("/meal/confirm", "POST", r.status_code, r.status_code == 201, r.text[:200] if r.status_code != 201 else "")

    # List meals
    r = client.get("/meal/", headers=headers(PATIENT_TOKEN))
    log("/meal/", "GET", r.status_code, r.status_code == 200)
    
    meal_id = None
    if r.status_code == 200 and r.json():
        meal_id = r.json()[0]["id"]

    # Get meal detail
    if meal_id:
        r = client.get(f"/meal/{meal_id}", headers=headers(PATIENT_TOKEN))
        log(f"/meal/{meal_id}", "GET", r.status_code, r.status_code == 200)

    # ─── SCREENING ───────────────────────────────────────────────────────
    print("\n── SCREENING ──")
    r = client.get("/screening/questions/simple")
    log("/screening/questions/simple", "GET", r.status_code, r.status_code == 200, r.text[:200] if r.status_code != 200 else "")
    
    simple_questions = []
    if r.status_code == 200:
        simple_questions = r.json().get("questions", [])
        print(f"    Simple questions: {len(simple_questions)} found")

    r = client.get("/screening/questions/advanced")
    log("/screening/questions/advanced", "GET", r.status_code, r.status_code == 200, r.text[:200] if r.status_code != 200 else "")

    advanced_questions = []
    if r.status_code == 200:
        advanced_questions = r.json().get("questions", [])
        print(f"    Advanced questions: {len(advanced_questions)} found")

    # Predict simple
    if simple_questions:
        simple_answers = []
        for q in simple_questions:
            if "age" in q["question_text"].lower():
                simple_answers.append({"question_id": q["id"], "answer_value": "45", "answer_numeric": 45})
            elif "bmi" in q["question_text"].lower() or "height" in q["question_text"].lower():
                simple_answers.append({"question_id": q["id"], "answer_value": "175,80", "answer_numeric": None})
            elif "glucose" in q["question_text"].lower():
                simple_answers.append({"question_id": q["id"], "answer_value": "130", "answer_numeric": 130})
            elif "activity" in q["question_text"].lower() or "physical" in q["question_text"].lower():
                simple_answers.append({"question_id": q["id"], "answer_value": "moderate", "answer_numeric": None})
            elif "family" in q["question_text"].lower():
                simple_answers.append({"question_id": q["id"], "answer_value": "1", "answer_numeric": 1})
            elif "smok" in q["question_text"].lower():
                simple_answers.append({"question_id": q["id"], "answer_value": "0", "answer_numeric": 0})
            else:
                simple_answers.append({"question_id": q["id"], "answer_value": "0", "answer_numeric": 0})

        r = client.post("/screening/predict", headers=headers(PATIENT_TOKEN), json={
            "screening_type": "simple",
            "answers": simple_answers
        })
        log("/screening/predict (simple)", "POST", r.status_code, r.status_code == 201, r.text[:200] if r.status_code != 201 else "")

    # Predict advanced
    if advanced_questions:
        advanced_answers = []
        for q in advanced_questions:
            qt = q["question_text"].lower()
            if "gender" in qt:
                advanced_answers.append({"question_id": q["id"], "answer_value": "male", "answer_numeric": None})
            elif "age" in qt:
                advanced_answers.append({"question_id": q["id"], "answer_value": "50", "answer_numeric": 50})
            elif "hypertension" in qt:
                advanced_answers.append({"question_id": q["id"], "answer_value": "1", "answer_numeric": 1})
            elif "heart" in qt:
                advanced_answers.append({"question_id": q["id"], "answer_value": "0", "answer_numeric": 0})
            elif "smok" in qt:
                advanced_answers.append({"question_id": q["id"], "answer_value": "current", "answer_numeric": None})
            elif "bmi" in qt or "height" in qt:
                advanced_answers.append({"question_id": q["id"], "answer_value": "175,90", "answer_numeric": None})
            elif "hba1c" in qt:
                advanced_answers.append({"question_id": q["id"], "answer_value": "6.5", "answer_numeric": 6.5})
            elif "glucose" in qt:
                advanced_answers.append({"question_id": q["id"], "answer_value": "200", "answer_numeric": 200})
            else:
                advanced_answers.append({"question_id": q["id"], "answer_value": "0", "answer_numeric": 0})

        r = client.post("/screening/predict", headers=headers(PATIENT_TOKEN), json={
            "screening_type": "advanced",
            "answers": advanced_answers
        })
        log("/screening/predict (advanced)", "POST", r.status_code, r.status_code == 201, r.text[:200] if r.status_code != 201 else "")

    # Screening history
    r = client.get("/screening/history", headers=headers(PATIENT_TOKEN))
    log("/screening/history", "GET", r.status_code, r.status_code == 200)

    # ─── AI CHAT ─────────────────────────────────────────────────────────
    print("\n── AI CHAT ──")
    r = client.post("/ai/conversations", headers=headers(PATIENT_TOKEN), json={"title": "Test Conversation"})
    log("/ai/conversations", "POST", r.status_code, r.status_code == 201)
    
    convo_id = None
    if r.status_code == 201:
        convo_id = r.json()["id"]

    if convo_id:
        r = client.post(f"/ai/conversations/{convo_id}/messages", headers=headers(PATIENT_TOKEN), 
                        json={"message": "Hello, I need help with my glucose levels"})
        log(f"/ai/conversations/{convo_id}/messages", "POST", r.status_code, r.status_code == 200)

    r = client.get("/ai/conversations", headers=headers(PATIENT_TOKEN))
    log("/ai/conversations", "GET", r.status_code, r.status_code == 200)

    if convo_id:
        r = client.get(f"/ai/conversations/{convo_id}", headers=headers(PATIENT_TOKEN))
        log(f"/ai/conversations/{convo_id}", "GET", r.status_code, r.status_code == 200)

    # ─── DOCTOR ──────────────────────────────────────────────────────────
    print("\n── DOCTOR ──")
    r = client.get("/doctor/dashboard", headers=headers(DOCTOR_TOKEN))
    log("/doctor/dashboard", "GET", r.status_code, r.status_code == 200, r.text[:300] if r.status_code != 200 else "")

    r = client.get("/doctor/patients", headers=headers(DOCTOR_TOKEN))
    log("/doctor/patients", "GET", r.status_code, r.status_code == 200, r.text[:300] if r.status_code != 200 else "")

    patient_id = None
    if r.status_code == 200:
        patients = r.json().get("patients", [])
        if patients:
            patient_id = patients[0]["patient_id"]
            print(f"    Found {len(patients)} patients, using patient_id={patient_id}")

    if patient_id:
        r = client.get(f"/doctor/patients/{patient_id}/profile", headers=headers(DOCTOR_TOKEN))
        log(f"/doctor/patients/{patient_id}/profile", "GET", r.status_code, r.status_code == 200, r.text[:300] if r.status_code != 200 else "")

        r = client.get(f"/doctor/patients/{patient_id}/glucose?days=30", headers=headers(DOCTOR_TOKEN))
        log(f"/doctor/patients/{patient_id}/glucose", "GET", r.status_code, r.status_code == 200)

    r = client.get("/doctor/alerts", headers=headers(DOCTOR_TOKEN))
    log("/doctor/alerts", "GET", r.status_code, r.status_code == 200)
    
    alert_id = None
    if r.status_code == 200 and r.json():
        alert_id = r.json()[0]["alert_id"]
    
    if alert_id:
        r = client.put(f"/doctor/alerts/{alert_id}/read", headers=headers(DOCTOR_TOKEN))
        log(f"/doctor/alerts/{alert_id}/read", "PUT", r.status_code, r.status_code == 200)

    # ─── ALERTS (Patient) ───────────────────────────────────────────────
    print("\n── ALERTS ──")
    r = client.get("/alerts/", headers=headers(PATIENT_TOKEN))
    log("/alerts/", "GET", r.status_code, r.status_code == 200)
    
    patient_alert_ids = []
    if r.status_code == 200 and r.json():
        patient_alert_ids = [a["id"] for a in r.json()[:2]]

    if patient_alert_ids:
        r = client.patch("/alerts/read", headers=headers(PATIENT_TOKEN), json={"alert_ids": patient_alert_ids})
        log("/alerts/read", "PATCH", r.status_code, r.status_code == 200, r.text[:200] if r.status_code != 200 else "")

    # ─── CLINICAL NOTES ─────────────────────────────────────────────────
    print("\n── CLINICAL NOTES ──")
    if patient_id:
        r = client.post("/clinical/notes", headers=headers(DOCTOR_TOKEN), json={
            "patient_id": patient_id,
            "note_text": "Patient glucose levels are elevated. Recommend diet adjustment.",
            "priority": "routine",
            "status": "published"
        })
        log("/clinical/notes", "POST", r.status_code, r.status_code == 201, r.text[:200] if r.status_code != 201 else "")

    r = client.get("/clinical/notes", headers=headers(PATIENT_TOKEN))
    log("/clinical/notes (patient)", "GET", r.status_code, r.status_code == 200)

    # ─── SETTINGS ────────────────────────────────────────────────────────
    print("\n── SETTINGS ──")
    r = client.get("/settings/profile", headers=headers(PATIENT_TOKEN))
    log("/settings/profile", "GET", r.status_code, r.status_code == 200)

    r = client.put("/settings/profile", headers=headers(PATIENT_TOKEN), json={
        "full_name": "Test Patient Updated",
        "weight_kg": 83.0,
        "height_cm": 175.0,
    })
    log("/settings/profile", "PUT", r.status_code, r.status_code == 200, r.text[:200] if r.status_code != 200 else "")

    r = client.get("/settings/preferences", headers=headers(PATIENT_TOKEN))
    log("/settings/preferences", "GET", r.status_code, r.status_code == 200)

    r = client.put("/settings/preferences", headers=headers(PATIENT_TOKEN), json={
        "min_glucose": 70.0,
        "max_glucose": 140.0,
        "carb_limit_g": 60.0,
        "diet_type": "balanced"
    })
    log("/settings/preferences", "PUT", r.status_code, r.status_code == 200)

    r = client.put("/settings/password", headers=headers(PATIENT_TOKEN), json={
        "current_password": PASSWORD,
        "new_password": "NewTestPass1",
        "confirm_password": "NewTestPass1"
    })
    log("/settings/password", "PUT", r.status_code, r.status_code == 200)

    # ─── SUMMARY ─────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])
    print(f"Total: {len(results)}  Passed: {passed}  Failed: {failed}\n")
    
    if failed > 0:
        print("FAILURES:")
        for r in results:
            if not r["ok"]:
                print(f"  ❌ {r['endpoint']} → {r['status']}  {r['note']}")
    
    client.close()


if __name__ == "__main__":
    main()
