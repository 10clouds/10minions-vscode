import { MinionTaskUIInfo } from './ui/MinionTaskUIInfo';
export enum MessageToWebViewType {
  ClearAndFocusOnInput,
  ExecutionsUpdated,
  UpdateSidebarVisibility,
  ApiKeySet,
  ApiKeyMissingModels,
  TokenCount,
  ChosenCodeUpdated,
  Suggestions,
}

export enum MessageToVSCodeType {
  NewMinionTask,
  OpenDocument,
  OpenLog,
  ShowDiff,
  ReRunExecution,
  StopExecution,
  SuggestionGet,
  CloseExecution,
  ReadyForMessages,
  ApplyAndReviewTask,
  OpenSelection,
  MarkAsApplied,
  EditApiKey,
}

export type MessageToWebView =
  | { type: MessageToWebViewType.ClearAndFocusOnInput }
  | {
      type: MessageToWebViewType.ExecutionsUpdated;
      executions: MinionTaskUIInfo[];
    }
  | { type: MessageToWebViewType.UpdateSidebarVisibility; value: boolean }
  | { type: MessageToWebViewType.ApiKeySet; value: boolean }
  | { type: MessageToWebViewType.ApiKeyMissingModels; models: string[] }
  | { type: MessageToWebViewType.TokenCount; value: number }
  | { type: MessageToWebViewType.ChosenCodeUpdated; code: string }
  | {
      type: MessageToWebViewType.Suggestions;
      suggestions: string[];
      forInput: string;
    };

export type MessageToVSCode =
  | { type: MessageToVSCodeType.NewMinionTask; value?: string }
  | { type: MessageToVSCodeType.OpenDocument; minionTaskId: string }
  | { type: MessageToVSCodeType.OpenLog; minionTaskId: string }
  | { type: MessageToVSCodeType.ShowDiff; minionTaskId: string }
  | {
      type: MessageToVSCodeType.ReRunExecution;
      minionTaskId: string;
      newUserQuery?: string;
    }
  | { type: MessageToVSCodeType.StopExecution; minionTaskId: string }
  | { type: MessageToVSCodeType.SuggestionGet; input: string }
  | { type: MessageToVSCodeType.CloseExecution; minionTaskId: string }
  | { type: MessageToVSCodeType.ReadyForMessages }
  | { type: MessageToVSCodeType.EditApiKey }
  | {
      type: MessageToVSCodeType.ApplyAndReviewTask;
      minionTaskId: string;
      reapply: boolean;
    }
  | { type: MessageToVSCodeType.OpenSelection; minionTaskId: string }
  | { type: MessageToVSCodeType.MarkAsApplied; minionTaskId: string };
