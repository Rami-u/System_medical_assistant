from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router

from app.models import *

app = FastAPI(
    title="Diabetes AI System API",
    description="Production backend for AI-assisted diabetes management",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "Diabetes AI API is running",
        "docs": "/docs",
        "version": "1.0.0",
    }