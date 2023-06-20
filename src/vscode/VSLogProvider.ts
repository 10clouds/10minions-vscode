import * as vscode from "vscode";
import { extractExecutionIdFromUri } from "../utils/extractExecutionIdFromUri";
import { getMinionTasksManager } from "../managers/MinionTasksManager";
import { LogProvider, setLogProvider } from "../managers/LogProvider";

export class VSLogProvider implements vscode.TextDocumentContentProvider, LogProvider {
  // Create an EventEmitter to handle document updates
  private _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  constructor(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("10minions-log", this));

    setLogProvider(this);
  }

  // Use the getter to expose the onDidChange event using EventEmitter's event property
  get onDidChange(): vscode.Event<vscode.Uri> | undefined {
    return this._onDidChangeEmitter.event;
  }

  reportChange(uri: string) {
    // Emit the event to notify subscribers of the change in the URI
    this._onDidChangeEmitter.fire(vscode.Uri.parse(uri));
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const textKey = extractExecutionIdFromUri(uri);
    const execution = getMinionTasksManager().getExecutionById(textKey);
    const logContent = execution?.logContent;
    return logContent || "";
  }
}
