import { CANCELED_STAGE_NAME, MinionTaskUIInfo, FINISHED_STAGE_NAME, APPLIED_STAGE_NAME, APPLYING_STAGE_NAME } from "../MinionTaskUIInfo";

export const BRAND_COLOR = "#5e20e5";
export const ERROR_COLOR = "#D8595A";
export const SUCCESS_COLOR = "#2AB678";

export function convertToHex(...colors: string[]): string {
  for (let color of colors) {
    if (color.indexOf("#") === 0) {
      return color;
    }

    let computed = getComputedStyle(document.documentElement).getPropertyValue(color).trim();
    if (computed.indexOf("#") === 0) {
      return computed;
    }
  }

  throw new Error("Could not convert color to HEX");
}

/**
 * Blends two colors based on a blend ratio. Converts the input colors to HEX if they are not already in HEX format.
 */
export function blendColors(color1: string, colorFallback: string[], blendRatio: number = 0.25) {
  color1 = convertToHex(color1);
  let color2 = convertToHex(...colorFallback);

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
    ["--vscode-sideBar-background", "--vscode-editor-background", "#000000"],
    blendRatio
  );
}

export function blendWithForeground(color: string, blendRatio: number = 0.75) {
  return blendColors(
    color,
    ["--vscode-sideBar-foreground", "--vscode-editor-foreground", "#FFFFFF"],
    blendRatio
  );
}

export function getOpacity(execution: MinionTaskUIInfo) {
  if (execution.executionStage === CANCELED_STAGE_NAME) {
    return 0.2;
  }

  return 1;
}

/**
 * Get the base color based on the execution object. Returns one of the predefined colors
 * depending on the execution's state.
 */
export function getBaseColor(execution: MinionTaskUIInfo) {
  if (execution.stopped) {
    if (execution.executionStage === FINISHED_STAGE_NAME) {
      return SUCCESS_COLOR;
    }

    if (execution.executionStage === CANCELED_STAGE_NAME) {
      return "--vscode-sideBar-background";
    }

    if (execution.executionStage === APPLYING_STAGE_NAME) {
      return SUCCESS_COLOR;
    }

    if (execution.executionStage === APPLIED_STAGE_NAME) {
      return blendWithForeground(SUCCESS_COLOR, 0.5);
    }

    return ERROR_COLOR;
  } else {
    return BRAND_COLOR;
  }
}

