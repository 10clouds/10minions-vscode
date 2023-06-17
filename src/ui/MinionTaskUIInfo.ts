export const APPLIED_STAGE_NAME = "Applied";
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
  inlineMessage: string;
  modificationDescription: string;
  modificationProcedure: string;
  selectedText: string;
  shortName: string;
};
