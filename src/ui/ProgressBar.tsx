import * as React from "react";
import { MinionTaskUIInfo } from "./MinionTaskUIInfo";
import { blendWithForeground, getBaseColor, getOpacity } from "./utils/blendColors";
import { useMemo } from "react";

export function ProgressBar({ execution }: { execution: MinionTaskUIInfo }) {
  const percentage = `${(execution.progress * 100).toFixed(1)}%`;

  let opacity = useMemo(() => getOpacity(execution), [execution]);
  let color = useMemo(() => blendWithForeground(getBaseColor(execution)), [execution]);

  return (
    <div className={`relative h-1 w-full transition-opacity `} style={{opacity, backgroundColor: blendWithForeground("#D1D5D8")}}>
      <div
        className={`absolute top-0 left-0 flex h-full items-center justify-center transition-all duration-1000 ease-in-out ${
          !execution.stopped ? "wave-animation" : ""
        }`}
        style={{ width: percentage, backgroundColor: color }}
      ></div>
    </div>
  );
}
