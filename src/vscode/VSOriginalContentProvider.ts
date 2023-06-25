import * as vscode from "vscode";
import { extractExecutionIdFromUri } from "./utils/extractExecutionIdFromUri";
import { getMinionTasksManager } from "../managers/MinionTasksManager";
import { OriginalContentProvider, setOriginalContentProvider } from "../managers/OriginalContentProvider";

export class VSOriginalContentProvider implements OriginalContentProvider, vscode.TextDocumentContentProvider {

  constructor(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("10minions-originalContent", this));

    setOriginalContentProvider(this);
  }

  private _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  get onDidChange(): vscode.Event<vscode.Uri> | undefined {
    return this._onDidChangeEmitter.event;
  }

  reportChange(uri: string) {
    this._onDidChangeEmitter.fire(vscode.Uri.parse(uri));
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const textKey = extractExecutionIdFromUri(uri);
    const execution = getMinionTasksManager().getExecutionById(textKey);
    const originalContent = execution?.originalContent;
    return originalContent || "";
  }
}
