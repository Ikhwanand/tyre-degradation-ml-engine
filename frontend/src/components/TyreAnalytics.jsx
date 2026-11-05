import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Clock, ShieldCheck, Flame } from "lucide-react";

export default function TyreAnalytics({
  selectedDriverNumber,
  driversMeta = {},
  livePrediction = null,
  currentLapDrivers = [],
  currentLap = 1,
  totalLaps = 52,
}) {
  const [selectedCompound, setSelectedCompound] = useState("MEDIUM");
  const [stintCurve, setStintCurve] = useState([]);

  const meta = driversMeta[selectedDriverNumber] || {
    name: "Select a Driver",
    code: "---",
    team: "Pitwall Strategy",
    color: "#EF4444",
  };

  // Cari driver info di lap saat ini
  const currentDriverLap = currentLapDrivers.find(
    (d) => String(d.driver_number) === String(selectedDriverNumber)
  );

  // Default compound mengikuti apa yang sedang dipakai di track
  useEffect(() => {
    if (currentDriverLap?.compound) {
      setSelectedCompound(currentDriverLap.compound.toUpperCase());
    }
  }, [selectedDriverNumber, currentDriverLap?.compound]);

  // Fetch stint prediction curve from FastAPI Backend
  useEffect(() => {
    if (!selectedDriverNumber) return;

    let isMounted = true;

    fetch("http://localhost:8000/api/f1/predict-stint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driver: String(selectedDriverNumber),
        compound: selectedCompound,
        track_temp: 35.0,
        max_laps: 35,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch prediction");
        return res.json();
      })
      .then((data) => {
        if (isMounted && data.curve) {
          setStintCurve(data.curve);
        }
      })
      .catch((err) => {
        console.warn("Backend prediction fallback:", err);
        // Fallback simulation jika backend belum start
        const fallback = [];
        const base = 90.0;
        const degRate = selectedCompound === "SOFT" ? 0.085 : selectedCompound === "MEDIUM" ? 0.055 : 0.035;
        for (let l = 1; l <= 35; l++) {
          const delta = (l - 1) * degRate + (l > 22 ? Math.pow(l - 22, 1.6) * 0.08 : 0);
          fallback.push({
            tyre_life: l,
            predicted_time: Number((base + delta).toFixed(3)),
            pace_delta: Number(delta.toFixed(3)),
            status: delta < 0.6 ? "GOOD" : delta < 1.2 ? "DEGRADING" : "CLIFF",
          });
        }
        if (isMounted) setStintCurve(fallback);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDriverNumber, selectedCompound]);

  // Hitung status degradation saat ini
  const currentTyreLife = currentDriverLap?.tyre_life || 1;
  const currentStint = currentDriverLap?.stint || 1;
  const currentPredictedTime = livePrediction?.predicted_lap_time;
  const currentActualTime = currentDriverLap?.lap_time;

  // Umur ban maksimum sebelum menyentuh cliff (berdasarkan kurva model XGBoost)
  const cliffTyreLife =
    stintCurve.find((p) => p.status === "CLIFF")?.tyre_life || 25;

  // Sisa lap produktif pada set ban ini
  const remainingLifeOnSet = Math.max(0, cliffTyreLife - currentTyreLife);

  // Proyeksi LAP BALAPAN SEBENARNYA (sinkron dengan angka di Navbar)
  const projectedCliffRaceLap = currentLap + remainingLifeOnSet;
  const pitWindowStartLap = Math.max(currentLap, projectedCliffRaceLap - 4);
  const pitWindowEndLap = Math.max(pitWindowStartLap, projectedCliffRaceLap - 1);

  // Status balapan & pit window
  const isOverdue = currentTyreLife >= cliffTyreLife;
  const isPitWindowOpen =
    currentLap >= pitWindowStartLap && currentLap <= pitWindowEndLap;
  const isFinalStintSafe =
    projectedCliffRaceLap >= totalLaps && currentLap > totalLaps * 0.35;

  return (
    <div className="bg-[#0D111A] border border-slate-800/90 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
      {/* Header: Driver Info Banner */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div
            className="w-1.5 h-10 rounded-full"
            style={{ backgroundColor: meta.color || "#EF4444" }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white font-mono tracking-tight">
                {meta.name}
              </h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                #{selectedDriverNumber || "--"} {meta.code}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">{meta.team}</p>
          </div>
        </div>

        {/* Compound Toggle Selector */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {["SOFT", "MEDIUM", "HARD"].map((c) => {
            const isSelected = selectedCompound === c;
            const colors = {
              SOFT: "hover:text-red-400",
              MEDIUM: "hover:text-amber-400",
              HARD: "hover:text-slate-200",
            };
            return (
              <button
                key={c}
                onClick={() => setSelectedCompound(c)}
                className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all ${
                  isSelected
                    ? c === "SOFT"
                      ? "bg-red-500/20 text-red-400 border border-red-500/60"
                      : c === "MEDIUM"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/60"
                      : "bg-slate-100/20 text-slate-100 border border-slate-300/60"
                    : `text-slate-400 ${colors[c]}`
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Metrics Row: 3 Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Tyre Wear Health */}
        <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider">
              TYRE WEAR (STINT {currentStint})
            </span>
            {isOverdue ? (
              <Flame size={14} className="text-red-500 animate-pulse" />
            ) : (
              <ShieldCheck size={14} className="text-emerald-400" />
            )}
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">
              {currentTyreLife}{" "}
              <span className="text-xs font-normal text-slate-400">LAPS</span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${
                isOverdue
                  ? "bg-red-500/20 text-red-400 border border-red-500 animate-pulse"
                  : isPitWindowOpen
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500"
                  : isFinalStintSafe
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500"
              }`}
            >
              {isOverdue
                ? "CLIFF REACHED"
                : isPitWindowOpen
                ? "PIT WINDOW OPEN"
                : isFinalStintSafe
                ? "SAFE TO FINISH"
                : "OPTIMAL WINDOW"}
            </span>
          </div>
        </div>

        {/* Card 2: ML Predicted Pace */}
        <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider">ML PREDICTED</span>
            <TrendingUp size={14} className="text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-blue-400">
              {currentPredictedTime ? `${currentPredictedTime.toFixed(3)}s` : "--"}
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Actual: {currentActualTime ? `${currentActualTime.toFixed(3)}s` : "--"}
            </p>
          </div>
        </div>

        {/* Card 3: Pit Stop Recommendation (100% Sinkron dengan Lap Navbar) */}
        <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider">
              PIT RECOMMENDATION
            </span>
            <Clock
              size={14}
              className={
                isOverdue
                  ? "text-red-400 animate-pulse"
                  : isPitWindowOpen
                  ? "text-amber-400 animate-pulse"
                  : "text-amber-400"
              }
            />
          </div>
          <div>
            <div
              className={`text-2xl font-black font-mono ${
                isOverdue
                  ? "text-red-400"
                  : isFinalStintSafe
                  ? "text-emerald-400"
                  : isPitWindowOpen
                  ? "text-amber-400"
                  : "text-amber-400"
              }`}
            >
              {isOverdue
                ? `BOX LAP ${currentLap}`
                : isFinalStintSafe
                ? "RUN TO END"
                : isPitWindowOpen
                ? `BOX LAP ${currentLap}`
                : `L${pitWindowStartLap} - L${pitWindowEndLap}`}
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              {isOverdue
                ? "Tyres dead! Box immediately"
                : isFinalStintSafe
                ? `Tyres will last to finish (L${totalLaps})`
                : isPitWindowOpen
                ? "Pit window OPEN right now!"
                : `In ~${Math.max(1, remainingLifeOnSet - 4)} laps (Cliff: L${projectedCliffRaceLap})`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Chart: Recharts Stint Degradation Curve */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            STINT DEGRADATION PROFILE ({selectedCompound})
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            XGBoost v1.0 • Pace Delta Loss (Seconds)
          </span>
        </div>

        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={stintCurve}
              margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="tyre_life"
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                label={{ value: "Tyre Life (Laps)", position: "insideBottom", offset: -5, fontSize: 10, fill: "#64748B" }}
              />
              <YAxis
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0B0F17",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
                formatter={(val) => [`${val}s`, "Predicted Time"]}
                labelFormatter={(lap) => `Tyre Life: Lap ${lap}`}
              />
              <ReferenceLine
                x={cliffTyreLife}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{
                  value: "THE CLIFF",
                  position: "top",
                  fill: "#EF4444",
                  fontSize: 10,
                  fontFamily: "monospace",
                }}
              />
              <Line
                type="monotone"
                dataKey="predicted_time"
                stroke={
                  selectedCompound === "SOFT"
                    ? "#EF4444"
                    : selectedCompound === "MEDIUM"
                    ? "#F59E0B"
                    : "#F3F4F6"
                }
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

