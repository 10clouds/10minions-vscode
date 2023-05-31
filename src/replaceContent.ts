import * as vscode from "vscode";
import { editDocument } from "./AICursor";

export async function replaceContent(
  document: vscode.TextDocument,
  newContent: string
) {
  await editDocument(async (edit) => {
    if (document) {
      edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(
            document.lineCount,
            document.lineAt(document.lineCount - 1).text.length
          )
        ),
        newContent!
      );
    }
  });
}
