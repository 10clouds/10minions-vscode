import React, { useMemo } from 'react';
import { MinionTaskUIInfo } from '10minions-engine/dist/managers/MinionTaskUIInfo';
import {
  blendWithForeground,
  getBaseColor,
  getOpacity,
} from './utils/blendColors';

export function ProgressBar({ execution }: { execution: MinionTaskUIInfo }) {
  const percentage = `${(execution.progress * 100).toFixed(1)}%`;

  const opacity = useMemo(() => getOpacity(execution), [execution]);
  const color = useMemo(
    () => blendWithForeground(getBaseColor(execution)),
    [execution],
  );

  return (
    <div
      className={`relative h-1 w-full transition-opacity `}
      style={{ opacity, backgroundColor: blendWithForeground('#D1D5D8') }}
    >
      <div
        className={`absolute top-0 left-0 flex h-full items-center justify-center transition-all duration-1000 ease-in-out ${
          !execution.stopped ? 'wave-animation' : ''
        }`}
        style={{ width: percentage, backgroundColor: color }}
      ></div>
    </div>
  );
}
