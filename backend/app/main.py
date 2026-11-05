from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import f1, stream 


app = FastAPI(
    title="F1 Tyre Degradation Engine - Season 2026",
    description="Real-Time Race Simulatino & ML Tyre Wear Prediction API",
    version="1.0.0",
)

# Izinkan akses dari Frontend Vite (React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hubungkan Routers
app.include_router(f1.router)
app.include_router(stream.router)


@app.get("/")
def root():
    return {
        "status": "online",
        "season": 2026,
        "service": "F1 Tyre Degradation ML Engine"
    }