export type TASK_CLASSIFICATION_NAME =
  | "AnswerQuestion"
  | "FileWideChange"
  | "LocalChange";

export const FINISHED_STAGE_NAME = "Finished";

export type ExecutionInfo = {
  id: string;
  documentName: string;
  documentURI: string;
  logFileURI: string;
  userQuery: string;
  executionStage: string;
  progress: number;
  stopped: boolean;
  classification: TASK_CLASSIFICATION_NAME;
  modificationDescription: string;
};
