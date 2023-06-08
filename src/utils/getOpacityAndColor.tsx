import { CANCELED_STAGE_NAME, ExecutionInfo, FINISHED_STAGE_NAME } from "../ui/ExecutionInfo";

export function getOpacityAndColor(execution: ExecutionInfo) {
  let opacity = "opacity-1";
  let color = "#5e20e5";

  if (execution.stopped) {
    color = getComputedStyle(document.documentElement).getPropertyValue('--vscode-terminalCommandDecoration-errorBackground').trim()

    if (execution.executionStage === FINISHED_STAGE_NAME) {
      color = getComputedStyle(document.documentElement).getPropertyValue('--vscode-terminalCommandDecoration-successBackground').trim();
    }

    if (execution.executionStage === CANCELED_STAGE_NAME) {
      color = getComputedStyle(document.documentElement).getPropertyValue('--vscode-sideBar-background').trim();
      opacity = "opacity-0";
    }
  }

  return { opacity, color };
}
