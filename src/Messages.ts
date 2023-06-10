import { MinionTaskUIInfo } from "./ui/MinionTaskUIInfo";

export type MessageToWebView =
  | { type: "clearAndfocusOnInput" }
  | { type: "executionsUpdated"; executions: MinionTaskUIInfo[] }
  | { type: "apiKeySet"; value: boolean }
  | { type: "tokenCount"; value: number }
  | { type: "suggestion"; value: string };

export type MessageToVSCode =
  | { type: "getTokenCount" }
  | { type: "newExecution"; value?: string }
  | { type: "openDocument"; minionTaskId: string }
  | { type: "openLog"; minionTaskId: string}
  | { type: "showDiff"; minionTaskId: string }
  | { type: "reRunExecution"; minionTaskId: string; newUserQuery?: string }
  | { type: "stopExecution"; minionTaskId: string }
  | { type: "forceExecution"; minionTaskId: string }
  | { type: "getSuggestions"; input?: string }
  | { type: "closeExecution"; minionTaskId: string }
  | { type: "readyForMessages" };
