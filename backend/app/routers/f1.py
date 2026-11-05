from fastapi import APIRouter, HTTPException
from app.services.f1_service import f1_service
from app.services.ml_service import ml_service
from pydantic import BaseModel


router = APIRouter(prefix="/api/f1", tags=["F1 Data"])

class PredictionRequest(BaseModel):
    driver: str 
    compound: str 
    track_temp: float = 35.0
    max_laps: int = 35 
    
@router.get("/circuits")
def get_circuits():
    """Mengembalikan daftar semua sirkuit Season 2026."""
    return f1_service.get_circuits_2026()


@router.get("/circuit/{circuit_name}")
def get_circuit_details(circuit_name: str):
    """Mengembalikan koordinat trek GPS dan profil pembalap untuk sirkuit yang dipilih."""
    try:
        data = f1_service.load_race_session(circuit_name)
        return {
            "circuit": data["circuit"],
            "year": data["year"],
            "total_laps": data["total_laps"],
            "track_coordinates": data["track_coordinates"],
            "drivers": data["drivers"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat sirkuit: {str(e)}")
    

@router.post("/predict-stint")
def predict_stint(req: PredictionRequest):
    """Menghitung kurva prediksi degradasi ban untuk driver dan kompon yang dipilih."""
    curve = ml_service.predict_stint_curve(
        driver=req.driver,
        compound=req.compound,
        track_temp=req.track_temp,
        max_laps=req.max_laps,
    )
    
    return {"driver": req.driver, "compound": req.compound, "curve": curve}