import { MinionTask } from './MinionTask';
import { getEditorManager } from './managers/EditorManager';
import { getMinionTasksManager } from './managers/MinionTasksManager';
import { TASK_STRATEGY_ID } from './strategies/strategies';

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

export function serializeMinionTask(
  minionTask: MinionTask,
): SerializedMinionTask {
  return {
    id: minionTask.id,
    minionIndex: minionTask.minionIndex,
    documentURI: minionTask.documentURI.toString(),
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
  const minionTask = new MinionTask({
    id: data.id,
    minionIndex: data.minionIndex || 0,
    documentURI: getEditorManager().createUri(data.documentURI),
    userQuery: data.userQuery,
    selection: {
      start: {
        line: data.selection.startLine,
        character: data.selection.startCharacter,
      },
      end: {
        line: data.selection.endLine,
        character: data.selection.endCharacter,
      },
    },
    selectedText: data.selectedText,
    originalContent: data.originalContent,
    finalContent: data.finalContent,
    startTime: data.startTime,
    shortName: data.shortName,
    modificationDescription: data.modificationDescription,
    modificationProcedure: data.modificationProcedure,
    inlineMessage: data.inlineMessage,
    executionStage: data.executionStage,
    strategy: data.strategy === null ? undefined : data.strategy,
    onChanged: async (important) => {
      getMinionTasksManager().updateExecution(important, minionTask);
    },
    logContent: data.logContent,
    contentWhenDismissed: data.contentWhenDismissed,
  });

  return minionTask;
}
