"""Test screening via the API after fix."""
import sys, os
sys.path.insert(0, os.getcwd())
import requests

BASE = "http://localhost:8005"

tests = [
    ("Simple LOW", "simple", [
        {"question_id": 1, "answer_numeric": 22},
        {"question_id": 2, "answer_value": "170,65"},
        {"question_id": 3, "answer_numeric": 85},
        {"question_id": 4, "answer_value": "active"},
        {"question_id": 5, "answer_value": "no"},
        {"question_id": 6, "answer_value": "no"},
    ], "low"),
    ("Simple HIGH", "simple", [
        {"question_id": 1, "answer_numeric": 55},
        {"question_id": 2, "answer_value": "165,100"},
        {"question_id": 3, "answer_numeric": 180},
        {"question_id": 4, "answer_value": "sedentary"},
        {"question_id": 5, "answer_value": "yes"},
        {"question_id": 6, "answer_value": "yes"},
    ], "high"),
    ("Simple MODERATE", "simple", [
        {"question_id": 1, "answer_numeric": 40},
        {"question_id": 2, "answer_value": "175,85"},
        {"question_id": 3, "answer_numeric": 130},
        {"question_id": 4, "answer_value": "moderate"},
        {"question_id": 5, "answer_value": "yes"},
        {"question_id": 6, "answer_value": "no"},
    ], "moderate"),
    ("Advanced LOW", "advanced", [
        {"question_id": 1, "answer_value": "female"},
        {"question_id": 2, "answer_numeric": 22},
        {"question_id": 3, "answer_value": "no"},
        {"question_id": 4, "answer_value": "no"},
        {"question_id": 5, "answer_value": "never"},
        {"question_id": 6, "answer_value": "170,65"},
        {"question_id": 7, "answer_numeric": 4.5},
        {"question_id": 8, "answer_numeric": 85},
    ], "low"),
    ("Advanced MODERATE", "advanced", [
        {"question_id": 1, "answer_value": "male"},
        {"question_id": 2, "answer_numeric": 45},
        {"question_id": 3, "answer_value": "yes"},
        {"question_id": 4, "answer_value": "no"},
        {"question_id": 5, "answer_value": "former"},
        {"question_id": 6, "answer_value": "175,88"},
        {"question_id": 7, "answer_numeric": 6.0},
        {"question_id": 8, "answer_numeric": 140},
    ], "moderate"),
    ("Advanced HIGH", "advanced", [
        {"question_id": 1, "answer_value": "male"},
        {"question_id": 2, "answer_numeric": 60},
        {"question_id": 3, "answer_value": "yes"},
        {"question_id": 4, "answer_value": "yes"},
        {"question_id": 5, "answer_value": "current"},
        {"question_id": 6, "answer_value": "170,100"},
        {"question_id": 7, "answer_numeric": 8.5},
        {"question_id": 8, "answer_numeric": 250},
    ], "high"),
]

print("SCREENING API TEST RESULTS")
print("=" * 70)
for name, stype, answers, expected in tests:
    payload = {"screening_type": stype, "answers": answers}
    try:
        r = requests.post(f"{BASE}/screening/predict", json=payload)
        if r.status_code == 201:
            d = r.json()
            level = d.get("risk_level", "?")
            score = d.get("risk_score", "?")
            match = "PASS" if level == expected else "FAIL"
            print(f"  {match}  {name:25s}  score={score:7}  level={level:10s}  expected={expected}")
        else:
            print(f"  ERR  {name:25s}  HTTP {r.status_code}: {r.text[:100]}")
    except Exception as e:
        print(f"  ERR  {name:25s}  {e}")
