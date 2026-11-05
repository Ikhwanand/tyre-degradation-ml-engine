import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.f1_service import f1_service
from app.services.ml_service import ml_service 

router = APIRouter(tags=["Race Streaming"])

@router.websocket("/ws/race/{circuit_name}")
async def websocket_race_stream(websocket: WebSocket, circuit_name: str):
    await websocket.accept()
    print(f"[WS CONNECTED] Client tersambung ke balapan: {circuit_name}")
    
    try:
        # Load race session di thread terpisah agar tidak memblokir async event loop
        race_data = await asyncio.to_thread(f1_service.load_race_session, circuit_name)
        timeline = race_data["timeline"]
        drivers_meta = race_data["drivers"]
        
        # Kirim handshake awal (info trek dan drivers)
        await websocket.send_json({
            "type": "INIT",
            "circuit": circuit_name,
            "total_laps": race_data["total_laps"],
            "track_coordinates": race_data["track_coordinates"],
            "drivers": drivers_meta,
        })
        
        is_playing = False 
        current_lap_idx = 0
        selected_driver = None 
        base_lap_duration = 5.0 # Durasi 1 lap pada 1x (5 detik per lap agar realistis & nyaman dilihat)
        speed_delay = base_lap_duration # detik per lap 
        
        async def listen_client_commands():
            nonlocal is_playing, selected_driver, speed_delay, current_lap_idx 
            try:
                while True:
                    msg = await websocket.receive_json()
                    action = msg.get("action")
                    if action == "PLAY":
                        is_playing = True 
                    elif action == "PAUSE":
                        is_playing = False 
                    elif action == "SET_SPEED":
                        mult = max(0.25, float(msg.get("speed", 1)))
                        speed_delay = max(0.4, base_lap_duration / mult)
                    elif action == "SELECT_DRIVER":
                        selected_driver = str(msg.get("driver"))
                    elif action == "SEEK":
                        current_lap_idx = min(len(timeline) - 1, max(0, int(msg.get("lap", 1)) - 1))
            except WebSocketDisconnect:
                pass 
            except Exception as e:
                print(f"[WS COMMAND ERROR]: {e}")
            
        listener_task = asyncio.create_task(listen_client_commands())
        
        # Main Streaming Loop
        while True:
            if is_playing and current_lap_idx < len(timeline):
                lap_info = timeline[current_lap_idx]
                
                # Prediksi ban khusus pembalap yang sedang diklik user 
                driver_pred = None 
                if selected_driver:
                    drv_lap = next((d for d in lap_info["drivers"] if d["driver_number"] == selected_driver), None)
                    if drv_lap:
                        predicted_time = ml_service.predict_lap_time(
                            driver=selected_driver,
                            compound=drv_lap["compound"],
                            tyre_life=drv_lap["tyre_life"],
                            stint=drv_lap["stint"]
                        )
                        driver_pred = {
                            "driver_number": selected_driver,
                            "compound": drv_lap["compound"],
                            "tyre_life": drv_lap["tyre_life"],
                            "predicted_lap_time": predicted_time,
                            "actual_lap_time": drv_lap["lap_time"]
                        }
                
                is_last_lap = (current_lap_idx == len(timeline) - 1)
                
                # Kirim data tick lap
                await websocket.send_json({
                    "type": "LAP_TICK",
                    "tyre": "LAP_TICK",
                    "lap": lap_info["lap"],
                    "total_laps": len(timeline),
                    "lap_duration": speed_delay,
                    "is_finished": is_last_lap,
                    "drivers": lap_info["drivers"],
                    "driver_prediction": driver_pred
                })
                
                current_lap_idx += 1
                if current_lap_idx >= len(timeline):
                    is_playing = False # Balapan selesai
                    await websocket.send_json({
                        "type": "RACE_FINISHED",
                        "lap": len(timeline),
                        "total_laps": len(timeline),
                        "message": "Chequered Flag - Race Finished!"
                    })
                
            await asyncio.sleep(speed_delay)
    
    except WebSocketDisconnect:
        print(f"[WS DISCONNECTED] Client keluar dari balapan: {circuit_name}")
    except Exception as e:
        print(f"[WS ERROR] Error pada stream {circuit_name}: {e}")