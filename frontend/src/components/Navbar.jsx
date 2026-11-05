import React from "react";
import { Play, Pause, RotateCcw, Activity, Zap, Flag } from "lucide-react";

export default function Navbar({
  circuits,
  selectedCircuit,
  onSelectCircuit,
  isPlaying,
  onTogglePlay,
  onReset,
  speed,
  onChangeSpeed,
  currentLap,
  totalLaps,
  isRaceFinished = false,
  wsConnected,
}) {
  return (
    <header className="w-full bg-[#0D111A] border-b border-slate-800/80 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 backdrop-blur-md">
      {/* Brand & Season Badge */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-red-600 text-white font-black text-xs px-2 py-1 rounded tracking-widest shadow-lg shadow-red-900/30 flex items-center gap-1">
            <Flag size={12} />
            <span>F1</span>
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              PITWALL<span className="text-red-500">IQ</span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                2026 REGULATION
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Real-Time Tyre Degradation ML Engine
            </p>
          </div>
        </div>

        {/* Live Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-800">
          <span
            className={`w-2 h-2 rounded-full ${
              wsConnected ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_#10B981]" : "bg-amber-500"
            }`}
          />
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            {wsConnected ? "TELEMETRY LIVE" : "CONNECTING..."}
          </span>
        </div>
      </div>

      {/* Center: Circuit Selector */}
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider hidden md:block">
          CIRCUIT:
        </label>
        <select
          value={selectedCircuit}
          onChange={(e) => onSelectCircuit(e.target.value)}
          className="bg-slate-900 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700/80 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer shadow-inner font-sans"
        >
          {circuits.map((c) => (
            <option key={c.circuit_name || c.name} value={c.circuit_name || c.name}>
              R{c.round} • {c.event_name || c.name} ({c.location || c.country})
            </option>
          ))}
        </select>
      </div>

      {/* Right Controls: Lap Counter & Playback Engine */}
      <div className="flex items-center gap-3">
        {/* Lap Badge */}
        <div className="bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-lg flex items-center gap-2 font-mono">
          <span className="text-[10px] text-slate-500 uppercase">
            {isRaceFinished ? "CHECKERED" : "LAP"}
          </span>
          <span
            className={`text-sm font-black ${
              isRaceFinished ? "text-amber-400" : "text-white"
            }`}
          >
            {currentLap}
          </span>
          <span className="text-xs text-slate-600">/</span>
          <span className="text-xs text-slate-400">{totalLaps || "--"}</span>
          {isRaceFinished && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50">
              FINISHED
            </span>
          )}
        </div>

        {/* Play / Pause / Replay Toggle */}
        <button
          onClick={onTogglePlay}
          className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
            isRaceFinished
              ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30"
              : isPlaying
              ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30"
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
          }`}
        >
          {isRaceFinished ? (
            <RotateCcw size={13} />
          ) : isPlaying ? (
            <Pause size={13} />
          ) : (
            <Play size={13} />
          )}
          <span>
            {isRaceFinished ? "REPLAY RACE" : isPlaying ? "PAUSE" : "RESUME"}
          </span>
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition-all"
          title="Reset Simulation"
        >
          <RotateCcw size={14} />
        </button>

        {/* Speed Multiplier */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`px-2 py-1 text-[11px] font-mono font-bold rounded transition-all ${
                speed === s
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

