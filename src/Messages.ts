
import { MinionTaskUIInfo } from "./ui/MinionTaskUIInfo";
export enum MessageToWebViewType {
  ClearAndFocusOnInput,
  ExecutionsUpdated,
  UpdateSidebarVisibility,
  ApiKeySet,
  TokenCount,
  ChosenCodeUpdated,
  Suggestion,
  SuggestionError,
  SuggestionLoading,
  SuggestionLoadedOrCanceled,
}

export enum MessageToVSCodeType {
  NewMinionTask,
  OpenDocument,
  OpenLog,
  ShowDiff,
  ReRunExecution,
  StopExecution,
  SuggestionGet,
  SuggestionCancel,
  CloseExecution,
  ReadyForMessages,
  ApplyAndReviewTask,
  OpenSelection,
  MarkAsApplied,
}

export type MessageToWebView =
  | { type: MessageToWebViewType.ClearAndFocusOnInput }
  | { type: MessageToWebViewType.ExecutionsUpdated; executions: MinionTaskUIInfo[] }
  | { type: MessageToWebViewType.UpdateSidebarVisibility; value: boolean }
  | { type: MessageToWebViewType.ApiKeySet; value: boolean }
  | { type: MessageToWebViewType.TokenCount; value: number }
  | { type: MessageToWebViewType.ChosenCodeUpdated; code: string }
  | { type: MessageToWebViewType.Suggestion; suggestion: string, forCode: string, forInput : string }
  | { type: MessageToWebViewType.SuggestionError; error: string }
  | { type: MessageToWebViewType.SuggestionLoading; }
  | { type: MessageToWebViewType.SuggestionLoadedOrCanceled; };

export type MessageToVSCode =
  | { type: MessageToVSCodeType.NewMinionTask; value?: string }
  | { type: MessageToVSCodeType.OpenDocument; minionTaskId: string }
  | { type: MessageToVSCodeType.OpenLog; minionTaskId: string}
  | { type: MessageToVSCodeType.ShowDiff; minionTaskId: string }
  | { type: MessageToVSCodeType.ReRunExecution; minionTaskId: string; newUserQuery?: string }
  | { type: MessageToVSCodeType.StopExecution; minionTaskId: string }
  | { type: MessageToVSCodeType.SuggestionGet; input?: string }
  | { type: MessageToVSCodeType.SuggestionCancel }
  | { type: MessageToVSCodeType.CloseExecution; minionTaskId: string }
  | { type: MessageToVSCodeType.ReadyForMessages }
  | { type: MessageToVSCodeType.ApplyAndReviewTask; minionTaskId: string, reapply: boolean }
  | { type: MessageToVSCodeType.OpenSelection; minionTaskId: string }
  | { type: MessageToVSCodeType.MarkAsApplied; minionTaskId: string };
  
