import * as vscode from "vscode";
import { MinionTasksManager } from "./MinionTasksManager";

function extractExecutionIdFromUri(uri: vscode.Uri): string {
  return uri.path.match(/^minionTaskId\/([a-z\d\-]+)\/.*/)![1];
}

export class LogProvider implements vscode.TextDocumentContentProvider {
  private executionsManager: MinionTasksManager;

  constructor(executionsManager: MinionTasksManager) {
    this.executionsManager = executionsManager;
  }

  // Create an EventEmitter to handle document updates
  private _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  // Use the getter to expose the onDidChange event using EventEmitter's event property
  get onDidChange(): vscode.Event<vscode.Uri> | undefined {
    return this._onDidChangeEmitter.event;
  }

  reportChange(uri: vscode.Uri) {
    // Emit the event to notify subscribers of the change in the URI
    this._onDidChangeEmitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const textKey = extractExecutionIdFromUri(uri);
    const execution = this.executionsManager.getExecutionById(textKey);
    const logContent = execution?.logContent;
    return logContent || "";
  }
}

export class OriginalContentProvider implements vscode.TextDocumentContentProvider {
  private executionsManager: MinionTasksManager;

  constructor(executionsManager: MinionTasksManager) {
    this.executionsManager = executionsManager;
  }

  // Create an EventEmitter to handle document updates
  private _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  // Use the getter to expose the onDidChange event using EventEmitter's event property
  get onDidChange(): vscode.Event<vscode.Uri> | undefined {
    return this._onDidChangeEmitter.event;
  }

  reportChange(uri: vscode.Uri) {
    // Emit the event to notify subscribers of the change in the URI
    this._onDidChangeEmitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const textKey = extractExecutionIdFromUri(uri);
    const execution = this.executionsManager.getExecutionById(textKey);
    const originalContent = execution?.originalContent;
    return originalContent || "";
  }
}
