import React from 'react';
import { BRAND_COLOR, blendWithForeground } from './utils/blendColors';

interface ProgressBarProps {
  progress: number;
  stopped: boolean;
  opacity?: number;
  color?: string;
}

export function ProgressBar({
  progress,
  opacity = 1,
  color = BRAND_COLOR,
  stopped,
}: ProgressBarProps) {
  const percentage = `${(progress * 100).toFixed(1)}%`;

  return (
    <div
      className={`relative h-1 w-full transition-opacity `}
      style={{ opacity, backgroundColor: blendWithForeground('#D1D5D8') }}
    >
      <div
        className={`absolute top-0 left-0 flex h-full items-center justify-center transition-all duration-1000 ease-in-out ${
          !stopped ? 'wave-animation' : ''
        }`}
        style={{ width: percentage, backgroundColor: color }}
      ></div>
    </div>
  );
}
