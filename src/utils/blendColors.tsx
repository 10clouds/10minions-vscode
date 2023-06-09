import { CANCELED_STAGE_NAME, ExecutionInfo, FINISHED_STAGE_NAME } from "../ui/ExecutionInfo";

export const BRAND_COLOR = "#5e20e5";
export const ERROR_COLOR = "#D8595A";
export const SUCESS_COLOR = "#2AB678";

export function convertToHex(color: string): string {
  return color.indexOf("#") === 0
    ? color
    : getComputedStyle(document.documentElement).getPropertyValue(color).trim();
}

/**
 * Blends two colors based on a blend ratio. Converts the input colors to HEX if they are not already in HEX format.
 */
export function blendColors(color1: string, color2: string, blendRatio: number = 0.25) {
  color1 = convertToHex(color1);
  color2 = convertToHex(color2);

  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);

  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);

  const r = Math.round(r1 * blendRatio + r2 * (1 - blendRatio));
  const g = Math.round(g1 * blendRatio + g2 * (1 - blendRatio));
  const b = Math.round(b1 * blendRatio + b2 * (1 - blendRatio));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function blendWithBackground(color: string, blendRatio: number = 0.75) {
  return blendColors(
    color,
    "--vscode-sideBar-background",
    blendRatio
  );
}

export function blendWithForeground(color: string, blendRatio: number = 0.75) {
  return blendColors(
    color,
    "--vscode-sideBar-foreground",
    blendRatio
  );
}

export function getOpacity(execution: ExecutionInfo) {
  if (execution.executionStage === CANCELED_STAGE_NAME) {
    return "opacity-0";
  }

  return "opacity-1";
}

/**
 * Get the base color based on the execution object. Returns one of the predefined colors
 * depending on the execution's state.
 */
export function getBaseColor(execution: ExecutionInfo) {
  return execution.stopped
    ? execution.executionStage === FINISHED_STAGE_NAME
      ? SUCESS_COLOR
      : execution.executionStage === CANCELED_STAGE_NAME
      ? '--vscode-sideBar-background'
      : ERROR_COLOR
    : BRAND_COLOR;
}