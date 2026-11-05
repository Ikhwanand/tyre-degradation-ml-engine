import fastf1
import os 
import pandas as pd 
import numpy as np 
from dotenv import load_dotenv

load_dotenv() 

class F1DataService:
    def __init__(self, cache_dir: str = None):
        if cache_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            cache_dir = os.path.join(base_dir, "notebooks", "f1_cache")
            if not os.path.exists(cache_dir):
                cache_dir = os.path.join(base_dir, "f1_cache")
                os.makedirs(cache_dir, exist_ok=True)
        
        fastf1.Cache.configure(cache_dir=cache_dir)
        self.year = 2026
        self._memory_cache = {}
        
    def get_circuits_2026(self) -> list:
        """Mengambil kalender resmi sirkuit F1 Season 2026"""
        try:
            schedule = fastf1.get_event_schedule(self.year)
            # Filter hanya seri balapan resmi (RoundNumber > 0)
            race_events = schedule[schedule["RoundNumber"] > 0]
            
            circuits = []
            for _, ev in race_events.iterrows():
                circuits.append({
                    "round": int(ev["RoundNumber"]),
                    "event_name": str(ev["EventName"]),
                    "country": str(ev["Country"]),
                    "location": str(ev["Location"]),
                    "circuit_name": str(ev["Location"]) # Identifier untuk query FastF1
                })
            return circuits
        except Exception as e:
            print(f"[F1 SERVICE ERROR] Gagal memuat jadwal 2026: {e}")
            # Fallback jika offline/API limit 
            return [
                {"round": 1, "event_name": "Bahrain Grand Prix", "country": "Bahrain", "location": "Sakhir", "circuit_name": "Bahrain"},
                {"round": 2, "event_name": "Saudi Arabian Grand Prix", "country": "Saudi Arabia", "location": "Jeddah", "circuit_name": "Jeddah"},
                {"round": 3, "event_name": "Australian Grand Prix", "country": "Australia", "location": "Melbourne", "circuit_name": "Melbourne"},
                {"round": 12, "event_name": "British Grand Prix", "country": "Great Britain", "location": "Silverstone", "circuit_name": "Silverstone"},
                {"round": 14, "event_name": "Belgian Grand Prix", "country": "Belgium", "location": "Spa-Francorchamps", "circuit_name": "Spa"},
                {"round": 16, "event_name": "Italian Grand Prix", "country": "Italy", "location": "Monza", "circuit_name": "Monza"},
            ]
    
    def load_race_session(self, circuit_name: str) -> dict:
        """Membuat session balapan, koordinat GPS trek, pembalap, dan timeline laps."""
        circuit_key = circuit_name.lower()
        if circuit_key in self._memory_cache:
            return self._memory_cache[circuit_key]
        
        try:
            print(f"[F1 SERVICE] Memuat data balapan {self.year} - {circuit_name}...")
            session = fastf1.get_session(self.year, circuit_name, "R")
            session.load(telemetry=True, weather=True)
        except Exception as e:
            print(f"[F1 SERVICE WARN] Gagal memuat balapan {circuit_name}: {e}. Memuat Silverstone sebagai fallback...")
            if circuit_key != "silverstone":
                fallback_data = self.load_race_session("Silverstone")
                # Salin dengan nama sirkuit yang diminta
                copied = dict(fallback_data)
                copied["circuit"] = circuit_name
                self._memory_cache[circuit_key] = copied
                return copied
            raise e
        
        # 1. Ekstraksi Koordinat GPS Sirkuit (Presisi dari Fastest Lap)
        fastest_lap = session.laps.pick_fastest()
        telemetry = fastest_lap.get_telemetry()
        x_raw, y_raw = telemetry["X"].values, telemetry["Y"].values 
        
        x_min, x_max = x_raw.min(), x_raw.max()
        y_min, y_max = y_raw.min(), y_raw.max()
        max_dim = max(x_max - x_min, y_max - y_min)
        
        CANVAS_SIZE = 800
        PADDING = 60
        DRAWABLE = CANVAS_SIZE - (2 * PADDING)
        
        circuit_coords = []
        for i in range(0, len(x_raw), 4): # Downsampling agar ringan
            nx = ((x_raw[i] - x_min) / max_dim) * DRAWABLE + PADDING
            ny = ((max_dim - (y_raw[i] - y_min)) / max_dim) * DRAWABLE + PADDING
            circuit_coords.append({"x": round(float(nx), 2), "y": round(float(ny), 2)})
            
        # 2. Ekstraksi Metadata Pembalap & Warna Tim
        drivers_dict = {}
        for drv_no in session.drivers:
            try:
                drv = session.get_driver(drv_no)
                team_color = drv.get("TeamColor")
                hex_color = f"#{team_color}" if team_color and not str(team_color).startswith("#") else (team_color or "#3B82F6")
                drivers_dict[str(drv_no)] = {
                    "number": str(drv_no),
                    "code": str(drv.get("Abbreviation", drv_no)),
                    "name": str(drv.get("FullName", drv_no)),
                    "team": str(drv.get("TeamName", "F1 Team")),
                    "color": str(hex_color)
                }
            except Exception:
                pass 
            
        # 3. Ekstraksi Timeline Laps
        laps = session.laps
        max_lap = int(laps["LapNumber"].max()) if not laps.empty else 52 
        timeline = []
        
        for lap_no in range(1, max_lap + 1):
            lap_rows = laps[laps["LapNumber"] == lap_no]
            drivers_in_lap = []
            
            for _, row in lap_rows.iterrows():
                drv_no = str(row["DriverNumber"])
                lap_time = round(row["LapTime"].total_seconds(), 3) if pd.notnull(row["LapTime"]) else None 
                compound = str(row["Compound"]).upper() if pd.notnull(row["Compound"]) else "MEDIUM"
                tyre_life = int(row["TyreLife"]) if pd.notnull(row["TyreLife"]) else 1 
                pos = int(row["Position"]) if pd.notnull(row["Position"]) else None 
                
                drivers_in_lap.append({
                    "driver_number": drv_no,
                    "position": pos,
                    "lap_time": lap_time,
                    "compound": compound,
                    "tyre_life": tyre_life,
                    "stint": int(row.get("Stint", 1))
                })
        
            drivers_in_lap.sort(key=lambda d: (d["position"] is None, d["position"]))
            timeline.append({"lap": lap_no, "drivers": drivers_in_lap})
        
        result = {
            "circuit": circuit_name,
            "year": self.year,
            "total_laps": max_lap,
            "track_coordinates": circuit_coords,
            "drivers": drivers_dict,
            "timeline": timeline 
        }
        
        self._memory_cache[circuit_key] = result 
        return result 
    

f1_service = F1DataService()