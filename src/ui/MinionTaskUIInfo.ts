export type TASK_CLASSIFICATION_NAME =
  | "AnswerQuestion"
  | "FileWideChange"
  | "LocalChange";

export const FINISHED_STAGE_NAME = "Finished";
export const CANCELED_STAGE_NAME = "Canceled";

export type MinionTaskUIInfo = {
  id: string;
  minionIndex: number;
  documentName: string;
  documentURI: string;
  userQuery: string;
  executionStage: string;
  progress: number;
  stopped: boolean;
  waiting: boolean;
  classification?: TASK_CLASSIFICATION_NAME;
  modificationDescription: string;
  modificationApplied: boolean;
  selectedText: string;
  shortName: string;
};
