import * as vscode from "vscode";
import { editorLock } from "./CodeMindViewProvider";


export async function editDocument(
  edit: (edit: vscode.WorkspaceEdit) => Promise<void>
) {
  await editorLock.acquire("streamLock", async () => {
    const editOOO = new vscode.WorkspaceEdit();
    await edit(editOOO);
    await vscode.workspace.applyEdit(editOOO).then(
      (value) => { },
      (reason) => {
        console.log("REASON", reason);
      }
    );
  });
}
