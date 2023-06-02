import * as vscode from "vscode";
import AsyncLock = require("async-lock");

export const editorLock = new AsyncLock();

export async function editDocument(
    edit: (edit: vscode.WorkspaceEdit) => Promise<void>
  ) {
    await editorLock.acquire("streamLock", async () => {
      const workspaceEdit = new vscode.WorkspaceEdit();
      await edit(workspaceEdit);
      await vscode.workspace.applyEdit(workspaceEdit).then(
        (value) => { },
        (reason) => {
          console.log("REASON", reason);
        }
      );
    });
  }