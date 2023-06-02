export type ExecutionInfo = {
  id: string;
  documentName: string;
  documentURI: string;
  logFileURI: string;
  userQuery: string;
  executionStage: string;
  progress: number;
  stopped: boolean;
};
