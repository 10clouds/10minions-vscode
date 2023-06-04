import * as vscode from "vscode";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { GPTExecution } from "../GPTExecution";
import { appendToFile } from "../utils/appendToFile";

export async function stageFallingBackToComment(this: GPTExecution) {
  if (this.modificationApplied) {
    return;
  }

  this.reportSmallProgress();
  await appendToFile(this.workingDocumentURI, `\nPLAIN COMMENT FALLBACK\n`);

  await applyWorkspaceEdit(async (edit) => {
    edit.insert(
      vscode.Uri.parse(this.documentURI),
      new vscode.Position(0, 0),
      `/*\n10Clouds CodeMind: I was unable to modify the code myself, but you can do it yourself based on my remarks below:\n\n${this.modificationDescription.replace(
        /\*\//g,
        "*\\/"
      )}\n*\/\n\n`
    );
  });

  this.modificationApplied = true;
}
