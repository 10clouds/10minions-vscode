import * as vscode from 'vscode';
import { convertUri } from './vscodeUtils';
import {
  EditorDocument,
  EditorManager,
  EditorUri,
  WorkspaceEdit,
  setEditorManager,
} from '10minions-engine/dist/src/managers/EditorManager';
import AsyncLock from 'async-lock';

export const editorLock = new AsyncLock();

export class VSEditorManager implements EditorManager {
  constructor() {
    setEditorManager(this);
  }

  createUri(uri: string): EditorUri {
    return vscode.Uri.parse(uri);
  }

  async openTextDocument(uri: EditorUri): Promise<EditorDocument> {
    const document = await vscode.workspace.openTextDocument(convertUri(uri));

    return document;
  }

  showErrorMessage(message: string): void {
    vscode.window.showErrorMessage(message);
  }

  showInformationMessage(message: string): void {
    vscode.window.showInformationMessage(message);
  }
  applyWorkspaceEdit(edit: (edit: WorkspaceEdit) => Promise<void>) {
    editorLock.acquire('streamLock', async () => {
      const workspaceEdit = new vscode.WorkspaceEdit();
      await edit({
        replace: workspaceEdit.replace.bind(workspaceEdit),
        insert: workspaceEdit.insert.bind(workspaceEdit),
        getEntries: workspaceEdit.entries.bind(
          workspaceEdit,
        ) as unknown as WorkspaceEdit['getEntries'],
      });

      try {
        await vscode.workspace.applyEdit(workspaceEdit);
      } catch (reason) {
        console.error('REASON', reason);
      }
    });
  }
}
