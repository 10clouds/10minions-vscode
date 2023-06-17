import { MinionTask } from "./MinionTask";
import { MinionTasksManager } from "./MinionTasksManager";
import * as vscode from "vscode";
import { TASK_STRATEGY_ID } from "./strategies/strategies";

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
  inlineMessage: string;
  executionStage: string;
  strategy: TASK_STRATEGY_ID | null;
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
    finalContent: minionTask.contentAfterApply,
    startTime: minionTask.startTime,
    shortName: minionTask.shortName,
    modificationDescription: minionTask.modificationDescription,
    modificationProcedure: minionTask.modificationProcedure,
    inlineMessage: minionTask.inlineMessage,
    executionStage: minionTask.executionStage,
    strategy: minionTask.strategy === undefined ? null : minionTask.strategy,
    logContent: minionTask.logContent,
    contentWhenDismissed: minionTask.contentWhenDismissed,
  };
}

export function deserializeMinionTask(data: SerializedMinionTask): MinionTask {
  let minionTask = new MinionTask({
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
    strategy: data.strategy === null ? undefined : data.strategy,
    onChanged: async (important) => {
      MinionTasksManager.instance.updateExecution(important, minionTask);
    },
    logContent: data.logContent,
    contentWhenDismissed: data.contentWhenDismissed,
  });

  return minionTask;
}