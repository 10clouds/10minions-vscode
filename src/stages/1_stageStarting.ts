import * as vscode from "vscode";
import { MinionTask } from "../MinionTask";
import { appendToFile } from "../utils/appendToFile";
import { clearFile } from "../utils/clearFile";

export async function stageStarting(this: MinionTask) {
  let document = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(this.documentURI)
  );

  this.fullContent = document.getText();

  clearFile(this.workingDocumentURI);

  this.reportSmallProgress();
  await appendToFile(
    this.workingDocumentURI,
    "File: " + this.baseName + "\n"
  );

  await appendToFile(
    this.workingDocumentURI,
    "Task: " + this.userQuery + "\n"
  );

  await appendToFile(
    this.workingDocumentURI,
    "\n"
  );
}
