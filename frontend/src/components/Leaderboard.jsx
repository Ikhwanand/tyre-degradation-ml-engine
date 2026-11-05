import React from "react";
import { Gauge, CheckCircle2 } from "lucide-react";

// Official F1 Compound badge styles
const COMPOUND_STYLES = {
  SOFT: { bg: "bg-red-500/20", border: "border-red-500", text: "text-red-400", letter: "S" },
  MEDIUM: { bg: "bg-amber-500/20", border: "border-amber-400", text: "text-amber-300", letter: "M" },
  HARD: { bg: "bg-slate-100/20", border: "border-slate-200", text: "text-slate-100", letter: "H" },
  INTERMEDIATE: { bg: "bg-emerald-500/20", border: "border-emerald-400", text: "text-emerald-300", letter: "I" },
  WET: { bg: "bg-blue-500/20", border: "border-blue-400", text: "text-blue-300", letter: "W" },
  UNKNOWN: { bg: "bg-slate-800", border: "border-slate-700", text: "text-slate-400", letter: "?" },
};

export default function Leaderboard({
  drivers = [],
  driversMeta = {},
  selectedDriverNumber,
  onSelectDriver,
}) {
  return (
    <div className="bg-[#0D111A] border border-slate-800/90 rounded-2xl p-4 flex flex-col h-full shadow-2xl overflow-hidden">
      {/* Leaderboard Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-2">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-red-500" />
          <h2 className="text-xs font-black tracking-wider uppercase text-white font-mono">
            RACE LEADERBOARD
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          CLICK DRIVER TO PREDICT
        </span>
      </div>

      {/* Driver List Table */}
      <div className="overflow-y-auto pr-1 flex-1 space-y-1.5 custom-scrollbar max-h-[620px]">
        {drivers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            Awaiting telemetry session...
          </div>
        ) : (
          drivers.map((drv, idx) => {
            const meta = driversMeta[drv.driver_number] || {};
            const isSelected = String(drv.driver_number) === String(selectedDriverNumber);
            const compound = (drv.compound || "MEDIUM").toUpperCase();
            const badge = COMPOUND_STYLES[compound] || COMPOUND_STYLES.UNKNOWN;
            const teamColor = meta.color || "#475569";

            return (
              <div
                key={drv.driver_number}
                onClick={() => onSelectDriver(String(drv.driver_number))}
                className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? "bg-slate-800/90 border-red-500/80 shadow-lg shadow-red-950/20"
                    : "bg-slate-900/60 border-slate-800/60 hover:bg-slate-800/50 hover:border-slate-700"
                }`}
              >
                {/* Left: Position & Driver info */}
                <div className="flex items-center gap-2.5">
                  {/* Position number */}
                  <span
                    className={`font-mono text-xs font-black w-5 text-center ${
                      idx === 0
                        ? "text-amber-400"
                        : idx === 1
                        ? "text-slate-300"
                        : idx === 2
                        ? "text-amber-600"
                        : "text-slate-500"
                    }`}
                  >
                    {drv.position || idx + 1}
                  </span>

                  {/* Team color vertical accent bar */}
                  <div
                    className="w-1 h-7 rounded-full transition-transform group-hover:scale-y-110"
                    style={{ backgroundColor: teamColor }}
                  />

                  {/* Driver Name & Code */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-white tracking-wide">
                        {meta.code || drv.driver_number}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        #{drv.driver_number}
                      </span>
                      {isSelected && (
                        <CheckCircle2 size={12} className="text-red-400" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate max-w-[110px]">
                      {meta.team || "F1 Team"}
                    </p>
                  </div>
                </div>

                {/* Right: Tyre & Lap Time info */}
                <div className="flex items-center gap-3 font-mono">
                  {/* Compound Circle Pill */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border ${badge.bg} ${badge.border} ${badge.text}`}
                      title={`${compound} compound`}
                    >
                      {badge.letter}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300">
                      {drv.tyre_life}L
                    </span>
                  </div>

                  {/* Lap Time */}
                  <div className="text-right w-16">
                    <span className="text-xs text-slate-200 font-semibold block">
                      {drv.lap_time ? `${drv.lap_time.toFixed(2)}s` : "--"}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase">
                      STINT {drv.stint || 1}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

