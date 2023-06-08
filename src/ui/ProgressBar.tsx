import * as React from "react";
import { ExecutionInfo } from "./ExecutionInfo";
import { getMinionBlendedColor } from "../utils/blendColors";
import { getOpacityAndColor } from "../utils/getOpacityAndColor";

export function ProgressBar({ execution }: { execution: ExecutionInfo }) {
  const percentage = `${(execution.progress * 100).toFixed(1)}%`;

  let { opacity, color } = getOpacityAndColor(execution);

  color = getMinionBlendedColor(execution)

  return (
    <div className={`bg-gray-300 relative h-1 w-full transition-opacity ${opacity}`}>
      <div
        className={`absolute top-0 left-0 flex h-full items-center justify-center transition-all duration-1000 ease-in-out ${
          !execution.stopped ? "wave-animation" : ""
        }`}
        style={{ width: percentage, backgroundColor: color }}
      ></div>
    </div>
  );
}
