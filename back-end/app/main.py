from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine
from app.models import models
from app.routers import auth_router
from app.core.auth import get_current_user, require_doctor

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/auth", tags=["auth"])

@app.get("/")
def read_root():
    return {"message": "Diabetes Security API is running!"}

@app.get("/patient/dashboard")
def patient_dashboard(current_user: dict = Depends(get_current_user)):
    return {"message": f"Welcome {current_user['sub']}", "role": current_user["role"]}

@app.get("/doctor/patients")
def doctor_patients(current_user: dict = Depends(require_doctor)):
    return {"message": f"Doctor {current_user['sub']} - Patient List"}
