import { MinionTask } from "./MinionTask";
import { TASK_CLASSIFICATION_NAME } from "./ui/MinionTaskUIInfo";
import * as vscode from "vscode";

export type SerializedMinionTask = {
  id: string;
  minionIndex: number;
  documentURI: string;
  userQuery: string;
  selection: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
  selectedText: string;
  originalContent: string;
  finalContent: string;
  startTime: number;
  shortName: string;
  modificationDescription: string;
  modificationProcedure: string;
  executionStage: string;
  classification: TASK_CLASSIFICATION_NAME | null;
  logContent: string;
  contentWhenDismissed: string;
};

export function serializeMinionTask(minionTask: MinionTask): SerializedMinionTask {
  return {
    id: minionTask.id,
    minionIndex: minionTask.minionIndex,
    documentURI: minionTask.documentURI,
    userQuery: minionTask.userQuery,
    selection: {
      startLine: minionTask.selection.start.line,
      startCharacter: minionTask.selection.start.character,
      endLine: minionTask.selection.end.line,
      endCharacter: minionTask.selection.end.character,
    },
    selectedText: minionTask.selectedText,
    originalContent: minionTask.originalContent,
    finalContent: minionTask.finalContent,
    startTime: minionTask.startTime,
    shortName: minionTask.shortName,
    modificationDescription: minionTask.modificationDescription,
    modificationProcedure: minionTask.modificationProcedure,
    executionStage: minionTask.executionStage,
    classification: minionTask.classification === undefined ? null : minionTask.classification,
    logContent: minionTask.logContent,
    contentWhenDismissed: minionTask.contentWhenDismissed,
  };
}

export function deserializeMinionTask(data: SerializedMinionTask): MinionTask {
  return new MinionTask({
    id: data.id,
    minionIndex: data.minionIndex || 0,
    documentURI: data.documentURI,
    userQuery: data.userQuery,
    selection: new vscode.Selection(
      new vscode.Position(data.selection.startLine, data.selection.startCharacter),
      new vscode.Position(data.selection.endLine, data.selection.endCharacter)
    ),
    selectedText: data.selectedText,
    originalContent: data.originalContent,
    finalContent: data.finalContent,
    startTime: data.startTime,
    shortName: data.shortName,
    modificationDescription: data.modificationDescription,
    modificationProcedure: data.modificationProcedure,
    executionStage: data.executionStage,
    classification: data.classification === null ? undefined : data.classification,
    onChanged: async (important: boolean) => {},
    logContent: data.logContent,
    contentWhenDismissed: data.contentWhenDismissed,
  });
}