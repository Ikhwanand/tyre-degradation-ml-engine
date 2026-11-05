import { useRef, useEffect, useState } from "react";
import { Flag, Thermometer, Zap } from "lucide-react";

// Fallback koordinat jika data trek FastF1 belum selesai diunduh
const DEFAULT_SILVERSTONE = [
  { x: 620, y: 780 },
  { x: 740, y: 720 },
  { x: 780, y: 640 },
  { x: 710, y: 550 },
  { x: 610, y: 530 },
  { x: 570, y: 610 },
  { x: 420, y: 510 },
  { x: 260, y: 430 },
  { x: 210, y: 500 },
  { x: 290, y: 580 },
  { x: 400, y: 650 },
  { x: 540, y: 720 },
  { x: 660, y: 660 },
  { x: 740, y: 560 },
  { x: 790, y: 440 },
  { x: 680, y: 300 },
  { x: 520, y: 190 },
  { x: 340, y: 130 },
  { x: 240, y: 220 },
  { x: 260, y: 350 },
  { x: 380, y: 460 },
  { x: 520, y: 650 },
  { x: 620, y: 780 },
];

export default function CircuitCanvas({
  circuitName = "Silverstone",
  trackCoordinates = [],
  drivers = [],
  driversMeta = {},
  selectedDriverNumber = null,
  isPlaying = false,
  currentLap = 1,
  totalLaps = 52,
  lapDuration = 5.0, // Durasi 1 lap dari backend (dalam detik)
  isRaceFinished = false,
}) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Waktu awal lap untuk sinkronisasi 100% presisi
  const lapStartTimeRef = useRef(0);
  const prevLapRef = useRef(currentLap);
  const frozenProgressRef = useRef(0);

  // Live Telemetry states untuk bottom HUD
  const [liveSector, setLiveSector] = useState(1);
  const [liveSpeed, setLiveSpeed] = useState(285);
  const [lapPercent, setLapPercent] = useState(0);

  useEffect(() => {
    lapStartTimeRef.current = performance.now();
  }, []);

  // Gunakan koordinat GPS asli dari backend, atau fallback jika loading
  const coordinates =
    trackCoordinates && trackCoordinates.length > 10
      ? trackCoordinates
      : DEFAULT_SILVERSTONE;

  const finished = isRaceFinished || (totalLaps > 0 && currentLap >= totalLaps);

  // Sinkronisasi: Saat currentLap dari backend berubah, reset waktu awal lap
  useEffect(() => {
    if (currentLap !== prevLapRef.current) {
      prevLapRef.current = currentLap;
      lapStartTimeRef.current = performance.now();
    }
  }, [currentLap]);

  // Saat Play/Pause ditoggle
  useEffect(() => {
    if (isPlaying && !finished) {
      // Lanjutkan dari posisi terakhir
      lapStartTimeRef.current = performance.now() - frozenProgressRef.current * (lapDuration * 1000);
    }
  }, [isPlaying, lapDuration, finished]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const trackLength = coordinates.length;
    if (trackLength < 2) return;

    // Normalisasi skala koordinat ke canvas
    const scaleX = canvas.width / 800;
    const scaleY = canvas.height / 800;

    const render = () => {
      // 1. Clear Canvas (Dark Telemetry Surface)
      ctx.fillStyle = "#090D14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Subtle Grid Lines (Pit Wall Aesthetic)
      ctx.strokeStyle = "#121824";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 3. Track Outer Border (Glow Foundation)
      ctx.beginPath();
      ctx.strokeStyle = "#1A2333";
      ctx.lineWidth = 26;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      coordinates.forEach((pt, idx) => {
        const x = pt.x * scaleX;
        const y = pt.y * scaleY;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();

      // 4. Track Asphalt Body
      ctx.beginPath();
      ctx.strokeStyle = "#273549";
      ctx.lineWidth = 14;
      coordinates.forEach((pt, idx) => {
        const x = pt.x * scaleX;
        const y = pt.y * scaleY;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();

      // 5. Track Center Racing Line
      ctx.beginPath();
      ctx.strokeStyle = "#384B66";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      coordinates.forEach((pt, idx) => {
        const x = pt.x * scaleX;
        const y = pt.y * scaleY;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // 6. Start / Finish Line Marker
      const startPt = coordinates[0];
      if (startPt) {
        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(startPt.x * scaleX, startPt.y * scaleY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 7. Hitung Progres Lap (0.0 sampai 1.0) Berdasarkan Durasi Lap yang Sinkron
      let progress = 0;
      if (finished) {
        // Balapan sudah selesai: mobil berhenti tepat di garis finish
        progress = 1.0;
        frozenProgressRef.current = 1.0;
        setLiveSector(3);
        setLapPercent(100);
        setLiveSpeed(0);
      } else if (isPlaying) {
        const now = performance.now();
        const durationMs = Math.max(300, lapDuration * 1000);
        const elapsed = now - lapStartTimeRef.current;
        // Progress bergerak mulus dari 0.0 ke 1.0 sepanjang 1 lap
        progress = Math.min(0.999, (elapsed % durationMs) / durationMs);
        frozenProgressRef.current = progress;

        const sector = progress < 0.33 ? 1 : progress < 0.66 ? 2 : 3;
        setLiveSector(sector);
        setLapPercent(Math.round(progress * 100));

        // Simulasi kurva kecepatan realistis di sirkuit
        const dynamicSpeed = Math.round(230 + Math.sin(progress * Math.PI * 4) * 85);
        setLiveSpeed(dynamicSpeed);
      } else {
        progress = frozenProgressRef.current;
      }

      // 8. Render Seluruh Mobil di Trek dengan Posisi Tersinkron
      const totalDrivers = Math.max(drivers.length, 1);

      drivers.forEach((drv, idx) => {
        const isSelected = String(drv.driver_number) === String(selectedDriverNumber);
        const meta = driversMeta[drv.driver_number] || {};
        const teamColor = meta.color || "#3B82F6";

        // Gap antar mobil: pembalap posisi 1 ada di paling depan, posisi berikutnya sedikit di belakang
        const carGap = (idx / totalDrivers) * 0.45; // stagger gap
        const carLapProgress = (progress - carGap + 1.0) % 1.0;
        const trackPointIndex = carLapProgress * trackLength;

        const currentIndex = Math.floor(trackPointIndex);
        const nextIndex = (currentIndex + 1) % trackLength;
        const t = trackPointIndex - currentIndex;

        const p1 = coordinates[currentIndex] || coordinates[0];
        const p2 = coordinates[nextIndex] || coordinates[0];

        const carX = (p1.x + (p2.x - p1.x) * t) * scaleX;
        const carY = (p1.y + (p2.y - p1.y) * t) * scaleY;

        ctx.save();

        if (isSelected) {
          // Highlight Halo Ring untuk Mobil yang Dipilih
          const haloGrad = ctx.createRadialGradient(carX, carY, 2, carX, carY, 24);
          haloGrad.addColorStop(0, teamColor);
          haloGrad.addColorStop(1, "transparent");
          ctx.fillStyle = haloGrad;
          ctx.beginPath();
          ctx.arc(carX, carY, 24, 0, Math.PI * 2);
          ctx.fill();

          // Outer glowing ring
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(carX, carY, 11, 0, Math.PI * 2);
          ctx.stroke();

          // Driver Tag Badge di atas mobil
          ctx.fillStyle = "#0F172A";
          ctx.strokeStyle = teamColor;
          ctx.lineWidth = 1.5;
          const tagText = `${meta.code || drv.driver_number}`;
          ctx.font = "bold 10px monospace";
          const textWidth = ctx.measureText(tagText).width;
          ctx.fillRect(carX - textWidth / 2 - 5, carY - 26, textWidth + 10, 16);
          ctx.strokeRect(carX - textWidth / 2 - 5, carY - 26, textWidth + 10, 16);

          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(tagText, carX - textWidth / 2, carY - 14);
        }

        // Inner car dot
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.arc(carX, carY, isSelected ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fill();

        // White core
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(carX, carY, isSelected ? 2.5 : 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    coordinates,
    drivers,
    driversMeta,
    selectedDriverNumber,
    isPlaying,
    lapDuration,
    finished,
  ]);

  const focusedMeta = driversMeta[selectedDriverNumber] || {
    name: "Focus Driver",
    code: "---",
    color: "#EF4444",
  };

  return (
    <div className="bg-[#0D111A] border border-slate-800/90 rounded-2xl p-4 flex flex-col items-center shadow-2xl relative overflow-hidden">
      {/* Top Bar: Circuit Header & Sync Status */}
      <div className="w-full flex items-center justify-between mb-3 text-slate-300 z-10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black font-mono text-white tracking-wider uppercase">
              {circuitName} CIRCUIT
            </h2>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                finished
                  ? "bg-amber-950/80 text-amber-400 border-amber-800"
                  : "bg-red-950/80 text-red-400 border-red-800/80"
              }`}
            >
              {finished ? <Flag size={10} /> : <Zap size={10} />}
              {finished ? "CHEQUERED FLAG" : "GPS SYNC ACTIVE"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            {coordinates.length} FastF1 Telemetry Waypoints
          </p>
        </div>

        {/* Lap Synchronized Counter */}
        <div className="bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-lg text-right font-mono flex items-center gap-2">
          <div className="text-right">
            <span className="text-[9px] text-slate-400 uppercase block">CANVAS LAP</span>
            <span
              className={`text-sm font-black ${
                finished ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {currentLap} / {totalLaps}
            </span>
          </div>
          <div
            className={`w-2 h-2 rounded-full ${
              finished ? "bg-amber-400" : "bg-emerald-500 animate-pulse"
            }`}
          />
        </div>
      </div>

      {/* HTML5 Canvas Element */}
      <div className="relative w-full aspect-square max-w-[540px] rounded-xl overflow-hidden border border-slate-800/90 bg-[#090D14]">
        <canvas
          ref={canvasRef}
          width={700}
          height={700}
          className="w-full h-full block"
        />

        {/* Start / Finish Marker Legend Overlay */}
        <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-800 text-[10px] font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white shadow-sm" />
          <span className="text-slate-300">Start / Finish Line</span>
        </div>

        {/* Finished Chequered Flag Overlay Banner */}
        {finished && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 animate-fadeIn">
            <div className="bg-slate-900/90 border border-amber-500/60 p-4 rounded-2xl shadow-2xl text-center max-w-xs">
              <span className="text-2xl block mb-1">🏁</span>
              <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                CHEQUERED FLAG
              </h3>
              <p className="text-xs text-amber-400 font-mono mt-0.5 font-bold">
                RACE COMPLETED • {totalLaps}/{totalLaps} LAPS
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Tekan tombol "REPLAY RACE" di atas untuk mengulang kembali simulasi.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* NEW: Comprehensive Pit Wall Telemetry HUD (Bottom Bar) */}
      <div className="w-full mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
        {/* Sector Tracker */}
        <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[9px] text-slate-400 uppercase block">SECTOR TIMING</span>
            <span className="text-xs font-bold text-white">
              {finished ? "RACE FINISHED" : `SECTOR ${liveSector}`}
            </span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map((sec) => (
              <span
                key={sec}
                className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                  finished
                    ? "bg-amber-600/30 text-amber-400 border border-amber-600/50"
                    : liveSector === sec
                    ? "bg-purple-600 text-white shadow-[0_0_8px_#9333ea]"
                    : liveSector > sec
                    ? "bg-emerald-600/30 text-emerald-400 border border-emerald-600/50"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                S{sec}
              </span>
            ))}
          </div>
        </div>

        {/* Focused Driver Telemetry */}
        <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-6 rounded-full"
              style={{ backgroundColor: focusedMeta.color || "#EF4444" }}
            />
            <div>
              <span className="text-[9px] text-slate-400 uppercase block">FOCUSED CAR</span>
              <span className="text-xs font-bold text-white">
                #{selectedDriverNumber || "--"} {focusedMeta.code}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-slate-400 uppercase block">SPEED</span>
            <span className="text-xs font-bold text-emerald-400">{liveSpeed} km/h</span>
          </div>
        </div>

        {/* Track Environment Sensors */}
        <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[9px] text-slate-400 uppercase block">TRACK TEMP</span>
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <Thermometer size={12} />
              36.4°C
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-slate-400 uppercase block">LAP PROGRESS</span>
            <span className="text-xs font-bold text-white">{lapPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
