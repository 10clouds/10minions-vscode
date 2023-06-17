import * as vscode from "vscode";
import AsyncLock = require("async-lock");

export const editorLock = new AsyncLock();

export async function applyWorkspaceEdit(
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
