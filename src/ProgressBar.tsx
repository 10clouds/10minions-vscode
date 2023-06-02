import * as React from "react";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ProgressBar({ progress }: { progress: number; }) {
  // Calculate percentage from progress
  const percentage = `${(progress * 100).toFixed(1)}%`;

  return (
    <div className="bg-gray-300 relative h-4 w-full rounded-2xl">
      <div
        className="bg-indigo-500 absolute top-0 left-0 flex h-full items-center justify-center rounded-2xl transition-all duration-1000 ease-in-out"
        style={{ width: percentage }}
      >
        <span
          className="text-xs font-semibold text-white transition-all duration-1000 ease-in-out"
          style={{ opacity: progress > 0.15 ? 1 : 0 }}
        >
          {percentage}
        </span>
      </div>
    </div>
  );
}
