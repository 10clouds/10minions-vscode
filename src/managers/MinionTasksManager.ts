import * as vscode from "vscode";
import { MinionTask } from "../MinionTask";

export interface MinionTasksManager {
  saveExecutions(): Promise<void>;
  showDiff(minionTaskId: string): Promise<void>;
  openDocument(minionTaskId: string): Promise<void>;
  applyAndReviewTask(minionTaskId: string, reapply: boolean): Promise<void>;
  updateExecution(important: boolean, execution: MinionTask): Promise<void>;
  markAsApplied(minionTaskId: string): Promise<void>;
  openLog(minionTaskId: string): Promise<void>;
  addExecution(execution: MinionTask): void;
  removeExecution(id: string): void;
  getExecutionById(minionTaskId: string): MinionTask | undefined;
  getExecutionByUserQueryAndDoc(task: string, document: vscode.TextDocument): MinionTask | undefined;
  clearExecutions(): void;
  runMinionOnCurrentSelectionAndEditor(userQuery: string, customDocument?: vscode.TextDocument, customSelection?: vscode.Selection): Promise<void>;
  acquireMinionIndex(): number;
  notifyExecutionsUpdated(minionTask: MinionTask): void;
  reRunExecution(minionTaskId: any, newUserQuery?: string): Promise<void>;
  notifyExecutionsUpdatedImmediate(minionTask?: MinionTask, importantChange?: boolean): void;
  stopExecution(minionTaskId: any): void;
  closeExecution(minionTaskId: any): Promise<void>;
}

let globalManager: MinionTasksManager | undefined = undefined;

export function setMinionTasksManager(manager: MinionTasksManager) {
  if (globalManager) {
    throw new Error(`MinionTasksManager is already set.`);
  }
  globalManager = manager;
}

export function getMinionTasksManager(): MinionTasksManager {
  if (!globalManager) {
    throw new Error(`MinionTasksManager is not set.`);
  }
  return globalManager;
}