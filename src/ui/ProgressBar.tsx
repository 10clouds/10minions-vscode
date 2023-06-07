import * as React from "react";

export function ProgressBar({ progress, stopped }: { progress: number; stopped: boolean }) {
  const percentage = `${(progress * 100).toFixed(1)}%`;

  return (
    <div className="bg-gray-300 relative h-4 w-full rounded-2xl">
      <div
        className={`absolute top-0 left-0 flex h-full items-center justify-center rounded-2xl transition-all duration-1000 ease-in-out ${!stopped ? "wave-animation" : ""}`}
        style={{ width: percentage, backgroundColor: "#5e20e5" }}
      >
        <span
          className="text-xs font-semibold text-white transition-all duration-1000 ease-in-out"
          style={{ opacity: progress > 0.20 && progress < 1.0 ? 1 : 0 }}
        >
          {percentage}
        </span>
      </div>
    </div>
  );
}
