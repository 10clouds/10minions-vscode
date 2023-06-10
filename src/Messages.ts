import { ExecutionInfo } from "./ui/ExecutionInfo";

export type MessageToWebView =
  | { type: "clearAndfocusOnInput" }
  | { type: "executionsUpdated"; executions: ExecutionInfo[] }
  | { type: "apiKeySet"; value: boolean }
  | { type: "tokenCount"; value: number }
  | { type: "suggestion"; value: string };

export type MessageToVSCode =
  | { type: "getTokenCount" }
  | { type: "newExecution"; value?: string }
  | { type: "openDocument"; documentURI: string }
  | { type: "showDiff"; executionId: string }
  | { type: "reRunExecution"; executionId: string; newUserQuery?: string }
  | { type: "stopExecution"; executionId: string }
  | { type: "forceExecution"; executionId: string }
  | { type: "getSuggestions"; input?: string }
  | { type: "closeExecution"; executionId: string }
  | { type: "readyForMessages" };
