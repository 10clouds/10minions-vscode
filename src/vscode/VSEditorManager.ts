import * as vscode from "vscode";
import { convertUri } from "./vscodeUtils";
import { EditorDocument, EditorManager, EditorUri, setEditorManager } from "../managers/EditorManager";
import AsyncLock = require("async-lock");

export const editorLock = new AsyncLock();

export class VSEditorManager implements EditorManager {

  constructor(context: vscode.ExtensionContext) {
    setEditorManager(this);
  }

  createUri(uri: string): EditorUri {
    return vscode.Uri.parse(uri);
  }
  
  async openTextDocument(uri: EditorUri): Promise<EditorDocument> {
    let document = await vscode.workspace.openTextDocument(convertUri(uri));

    return document;
  }

  showErrorMessage(message: string): void {
    vscode.window.showErrorMessage(message);
  }

  showInformationMessage(message: string): void {
    vscode.window.showInformationMessage(message);
  }

  async applyWorkspaceEdit(
    edit: (edit: vscode.WorkspaceEdit) => Promise<void>
  ) {
    await editorLock.acquire("streamLock", async () => {
      const workspaceEdit = new vscode.WorkspaceEdit();
      await edit(workspaceEdit);
  
      try {
        await vscode.workspace.applyEdit(workspaceEdit);
      } catch (reason) {
        console.error("REASON", reason);
      }
    });
  }
  
}
