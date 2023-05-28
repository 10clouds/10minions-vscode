import * as vscode from "vscode";
import { AICursor } from "./AICursor";
import { editorLock } from "./CodeMindViewProvider";

export async function insertIntoNewDocument(
  cursorDecorators: AICursor,
  content: string) {
  return await editorLock.acquire("streamLock", async () => {
    try {
      const edit = new vscode.WorkspaceEdit();

      if (!cursorDecorators.selection || !cursorDecorators.document) {
        throw new Error("No selection");
      }

      edit.replace(
        cursorDecorators.document.uri,
        new vscode.Range(
          cursorDecorators.selection.start,
          cursorDecorators.selection.end
        ),
        content
      );

      await vscode.workspace.applyEdit(edit).then(
        (value) => { },
        (reason) => {
          console.log("REASON", reason);
        }
      );
    } catch (e) {
      console.error("ERRROR", e);
    }
  });
}
