import { ExecutionInfo } from "../ui/ExecutionInfo";
import { getOpacityAndColor } from "./getOpacityAndColor";

export function blendColors(color1: string, color2: string, blendRatio: number) {
  const r1 = parseInt(color1.substr(1, 2), 16);
  const g1 = parseInt(color1.substr(3, 2), 16);
  const b1 = parseInt(color1.substr(5, 2), 16);

  const r2 = parseInt(color2.substr(1, 2), 16);
  const g2 = parseInt(color2.substr(3, 2), 16);
  const b2 = parseInt(color2.substr(5, 2), 16);

  const r = Math.round(r1 * blendRatio + r2 * (1 - blendRatio));
  const g = Math.round(g1 * blendRatio + g2 * (1 - blendRatio));
  const b = Math.round(b1 * blendRatio + b2 * (1 - blendRatio));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function getMinionBlendedColor(execution: ExecutionInfo) {
  return blendColors(getComputedStyle(document.documentElement).getPropertyValue('--vscode-sideBar-foreground').trim(), getOpacityAndColor(execution).color, 0.25);
}