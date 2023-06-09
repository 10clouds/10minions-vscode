export type TASK_CLASSIFICATION_NAME =
  | "AnswerQuestion"
  | "FileWideChange"
  | "LocalChange";

export const FINISHED_STAGE_NAME = "Finished";
export const CANCELED_STAGE_NAME = "Canceled";

export type ExecutionInfo = {
  id: string;
  minionIndex: number;
  documentName: string;
  documentURI: string;
  logFileURI: string;
  userQuery: string;
  executionStage: string;
  progress: number;
  stopped: boolean;
  waiting: boolean;
  classification?: TASK_CLASSIFICATION_NAME;
  modificationDescription: string;
  selectedText: string;
  shortName: string;
};
