import React, { useState, useEffect, useRef } from "react";
import Navbar from "./components/Navbar";
import CircuitCanvas from "./components/CircuitCanvas";
import Leaderboard from "./components/Leaderboard";
import TyreAnalytics from "./components/TyreAnalytics";

const FALLBACK_CIRCUITS = [
  { round: 1, name: "Bahrain", event_name: "Bahrain Grand Prix", location: "Sakhir" },
  { round: 2, name: "Jeddah", event_name: "Saudi Arabian Grand Prix", location: "Jeddah" },
  { round: 3, name: "Melbourne", event_name: "Australian Grand Prix", location: "Melbourne" },
  { round: 12, name: "Silverstone", event_name: "British Grand Prix", location: "Silverstone" },
  { round: 14, name: "Spa", event_name: "Belgian Grand Prix", location: "Spa-Francorchamps" },
  { round: 16, name: "Monza", event_name: "Italian Grand Prix", location: "Monza" },
];

export default function App() {
  const [circuits, setCircuits] = useState(FALLBACK_CIRCUITS);
  const [selectedCircuit, setSelectedCircuit] = useState("Silverstone");
  const [trackCoordinates, setTrackCoordinates] = useState([]);
  const [driversMeta, setDriversMeta] = useState({});
  const [currentLapDrivers, setCurrentLapDrivers] = useState([]);
  const [currentLap, setCurrentLap] = useState(1);
  const [totalLaps, setTotalLaps] = useState(52);
  const [lapDuration, setLapDuration] = useState(5.0);
  const [isRaceFinished, setIsRaceFinished] = useState(false);
  const [selectedDriverNumber, setSelectedDriverNumber] = useState("16");
  const [livePrediction, setLivePrediction] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);

  // 1. Fetch Daftar Sirkuit Season 2026 dari FastAPI Backend
  useEffect(() => {
    fetch("http://localhost:8000/api/f1/circuits")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCircuits(data);
        }
      })
      .catch((err) => {
        console.warn("Backend circuits offline, using fallback list:", err);
      });
  }, []);

  // 2. Hubungkan ke WebSocket Streaming Endpoint per Sirkuit (Dengan Auto-Reconnect)
  useEffect(() => {
    let reconnectTimer = null;
    let isDisposed = false;

    function connectWebSocket() {
      if (isDisposed) return;
      const wsUrl = `ws://localhost:8000/ws/race/${selectedCircuit}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WS] Connected to race: ${selectedCircuit}`);
        setWsConnected(true);
        // Sinkronisasi status awal
        ws.send(JSON.stringify({ action: "SET_SPEED", speed: speed }));
        if (selectedDriverNumber) {
          ws.send(JSON.stringify({ action: "SELECT_DRIVER", driver: selectedDriverNumber }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const msgType = msg.type || msg.tyre; // Kompatibilitas format pesan

          if (msgType === "INIT") {
            setTrackCoordinates(msg.track_coordinates || []);
            setDriversMeta(msg.drivers || {});
            setTotalLaps(msg.total_laps || 52);
            // Set driver pertama jika belum ada yang dipilih
            const firstDriver = Object.keys(msg.drivers || {})[0];
            if (firstDriver && !selectedDriverNumber) {
              setSelectedDriverNumber(firstDriver);
            }
          } else if (msgType === "LAP_TICK") {
            setCurrentLap(msg.lap);
            setTotalLaps(msg.total_laps);
            if (msg.lap_duration) {
              setLapDuration(msg.lap_duration);
            }
            if (Array.isArray(msg.drivers)) {
              setCurrentLapDrivers(msg.drivers);
            }
            if (msg.driver_prediction) {
              setLivePrediction(msg.driver_prediction);
            }
            if (msg.is_finished || msg.lap >= msg.total_laps) {
              setIsRaceFinished(true);
            }
          } else if (msgType === "RACE_FINISHED") {
            setIsPlaying(false);
            setIsRaceFinished(true);
            setCurrentLap(msg.total_laps || totalLaps);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onerror = (err) => {
        console.warn("[WS] Connection warning:", err);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected, mencoba menyambung ulang dalam 3 detik...");
        setWsConnected(false);
        if (!isDisposed) {
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
      };
    }

    connectWebSocket();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedCircuit]);

  // 3. User Controls Handlers
  const handleTogglePlay = () => {
    // Jika balapan sudah selesai dan user klik play, reset ke awal dulu
    if (isRaceFinished || currentLap >= totalLaps) {
      setIsRaceFinished(false);
      setCurrentLap(1);
      setIsPlaying(true);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "SEEK", lap: 1 }));
        wsRef.current.send(JSON.stringify({ action: "PLAY" }));
      }
      return;
    }

    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: nextState ? "PLAY" : "PAUSE" }));
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setIsRaceFinished(false);
    setCurrentLap(1);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "SEEK", lap: 1 }));
      wsRef.current.send(JSON.stringify({ action: "PAUSE" }));
    }
  };

  const handleChangeSpeed = (newSpeed) => {
    setSpeed(newSpeed);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "SET_SPEED", speed: newSpeed }));
    }
  };

  const handleSelectDriver = (driverNumber) => {
    setSelectedDriverNumber(driverNumber);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "SELECT_DRIVER", driver: driverNumber }));
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* Top Telemetry Header */}
      <Navbar
        circuits={circuits}
        selectedCircuit={selectedCircuit}
        onSelectCircuit={(circuit) => {
          setSelectedCircuit(circuit);
          setIsPlaying(false);
          setIsRaceFinished(false);
        }}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onReset={handleReset}
        speed={speed}
        onChangeSpeed={handleChangeSpeed}
        currentLap={currentLap}
        totalLaps={totalLaps}
        isRaceFinished={isRaceFinished}
        wsConnected={wsConnected}
      />

      {/* Main Pit Wall Dashboard Grid */}
      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1700px] w-full mx-auto items-start">
        {/* Kolom 1: Canvas Sirkuit (5 Cols) */}
        <div className="lg:col-span-5 w-full">
          <CircuitCanvas
            circuitName={selectedCircuit}
            trackCoordinates={trackCoordinates}
            drivers={currentLapDrivers}
            driversMeta={driversMeta}
            selectedDriverNumber={selectedDriverNumber}
            isPlaying={isPlaying}
            speedMultiplier={speed}
            currentLap={currentLap}
            totalLaps={totalLaps}
            lapDuration={lapDuration}
            isRaceFinished={isRaceFinished}
          />
        </div>

        {/* Kolom 2: Analisis Degradasi Ban Machine Learning (4 Cols) */}
        <div className="lg:col-span-4 w-full">
          <TyreAnalytics
            selectedDriverNumber={selectedDriverNumber}
            driversMeta={driversMeta}
            livePrediction={livePrediction}
            currentLapDrivers={currentLapDrivers}
            currentLap={currentLap}
            totalLaps={totalLaps}
          />
        </div>

        {/* Kolom 3: Leaderboard Pembalap Real-Time (3 Cols) */}
        <div className="lg:col-span-3 w-full">
          <Leaderboard
            drivers={currentLapDrivers}
            driversMeta={driversMeta}
            selectedDriverNumber={selectedDriverNumber}
            onSelectDriver={handleSelectDriver}
          />
        </div>
      </main>
    </div>
  );
}
