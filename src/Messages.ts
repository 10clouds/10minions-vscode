
import { MinionTaskUIInfo } from "./ui/MinionTaskUIInfo";

export enum MessageToWebViewType {
  ClearAndFocusOnInput = "clearAndfocusOnInput",
  ExecutionsUpdated = "executionsUpdated",
  UpdateSidebarVisibility = "updateSidebarVisibility",
  ApiKeySet = "apiKeySet",
  TokenCount = "tokenCount",
  ChosenCodeUpdated = "chosenCodeUpdated",
  Suggestion = "suggestion",
  SuggestionError = "suggestionError",
  SuggestionLoading = "suggestionLoading",
  SuggestionLoadedOrCanceled = "suggestionLoadedOrCanceled",
}

export enum MessageToVSCodeType {
  GetTokenCount = "getTokenCount",
  NewMinionTask = "newMinionTask",
  OpenDocument = "openDocument",
  OpenLog = "openLog",
  ShowDiff = "showDiff",
  ReRunExecution = "reRunExecution",
  StopExecution = "stopExecution",
  GetSuggestions = "getSuggestions",
  CloseExecution = "closeExecution",
  ReadyForMessages = "readyForMessages",
  ApplyAndReviewTask = "applyAndReviewTask",
  OpenSelection = "openSelection",
  MarkAsApplied = "markAsApplied",
}

export type MessageToWebView =
  | { type: MessageToWebViewType.ClearAndFocusOnInput }
  | { type: MessageToWebViewType.ExecutionsUpdated; executions: MinionTaskUIInfo[] }
  | { type: MessageToWebViewType.UpdateSidebarVisibility; value: boolean }
  | { type: MessageToWebViewType.ApiKeySet; value: boolean }
  | { type: MessageToWebViewType.TokenCount; value: number }
  | { type: MessageToWebViewType.Suggestion; suggestion: string }
  | { type: MessageToWebViewType.ChosenCodeUpdated; code: string }
  | { type: MessageToWebViewType.SuggestionError; error: string }
  | { type: MessageToWebViewType.SuggestionLoading; }
  | { type: MessageToWebViewType.SuggestionLoadedOrCanceled; };

export type MessageToVSCode =
  | { type: MessageToVSCodeType.GetTokenCount }
  | { type: MessageToVSCodeType.NewMinionTask; value?: string }
  | { type: MessageToVSCodeType.OpenDocument; minionTaskId: string }
  | { type: MessageToVSCodeType.OpenLog; minionTaskId: string}
  | { type: MessageToVSCodeType.ShowDiff; minionTaskId: string }
  | { type: MessageToVSCodeType.ReRunExecution; minionTaskId: string; newUserQuery?: string }
  | { type: MessageToVSCodeType.StopExecution; minionTaskId: string }
  | { type: MessageToVSCodeType.GetSuggestions; input?: string }
  | { type: MessageToVSCodeType.CloseExecution; minionTaskId: string }
  | { type: MessageToVSCodeType.ReadyForMessages }
  | { type: MessageToVSCodeType.ApplyAndReviewTask; minionTaskId: string }
  | { type: MessageToVSCodeType.OpenSelection; minionTaskId: string }
  | { type: MessageToVSCodeType.MarkAsApplied; minionTaskId: string };
  

