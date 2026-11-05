import os 
import joblib
import pandas as pd 
import numpy as np 


class TyreMLService:
    def __init__(self, model_path: str = None):
        if model_path is None:
            # Mengarah ke model joblib yang sudah berhasil kita latih sebelumnya
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            model_path = os.path.join(base_dir, "notebooks", "model", "tyre_deg_model.joblib")
            
            # Fallback jika model ada di direktori root backend/model/
            if not os.path.exists(model_path):
                model_path = os.path.join(base_dir, "model", "tyre_deg_model.joblib")
        
        self.model_path = model_path 
        self.pipeline = None 
        self._load_model()
    
    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.pipeline = joblib.load(self.model_path)
                print(f"[ML SERVICE] Model berhasil dimuat dari: {self.model_path}")
            except Exception as e:
                print(f"[ML SERVICE ERROR] Gagal memuat model: {e}")
        else:
            print(f"[ML SERVICE WARN] File model tidak ditemukan di: {self.model_path}")
    
    def predict_lap_time(self, driver: str, compound: str, tyre_life: int, track_temp: float = 35.0, stint: int = 1) -> float:
        """Memprediksi waktu lap (dalam detik) berdasarkan kondisi ban saat ini."""
        if self.pipeline is None:
            return 90.0 # Fallback baseline
        
        input_df = pd.DataFrame([{
            "Driver": str(driver),
            "Compound": str(compound).upper(),
            "TyreLife": int(tyre_life),
            "TrackTemp": float(track_temp),
            "Stint": int(stint)
        }])
        
        pred = self.pipeline.predict(input_df)[0]
        return round(float(pred), 3)
    
    def predict_stint_curve(self, driver: str, compound: str, track_temp: float = 35.0, max_laps: int = 35) -> list:
        """Men-generate kurva prediksi degradasi ban dari Lap 1 hingga max_laps."""
        curve = []
        base_lap_time = None 
        
        for life in range(1, max_laps + 1):
            pred_time = self.predict_lap_time(driver, compound, life, track_temp)
            if life == 1:
                base_lap_time = pred_time 
            
            delta = round(pred_time - base_lap_time, 3)
            # Indikator "The Cliff": jika delta melambat > 1.2 detik 
            status = "GOOD" if delta < 0.6 else ("DEGRADING" if delta < 1.2 else "CLIFF")

            curve.append({
                "tyre_life": life,
                "predicted_time": pred_time,
                "pace_delta": delta,
                "status": status,
            })
            
        return curve 
    

ml_service = TyreMLService()