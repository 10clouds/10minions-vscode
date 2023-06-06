import * as vscode from "vscode";
import { GPTExecution } from "../GPTExecution";
import { appendToFile } from "../utils/appendToFile";
import { clearFile } from "../utils/clearFile";

export async function stageStarting(this: GPTExecution) {
  this.startTime = Date.now(); // Assign startTime
  this.modificationApplied = false;
  this.modificationDescription = "";
  this.modificationProcedure = "";
  this.stopped = false;
  this.progress = 0;
  this.executionStage = "Starting ...";
  this.classification = "AnswerQuestion";

  let document = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(this.documentURI)
  );

  this.fullContent = document.getText();

  clearFile(this.workingDocumentURI);

  this.reportSmallProgress();
  await appendToFile(
    this.workingDocumentURI,
    "File: " + this.baseName + "\n\n"
  );

  await appendToFile(
    this.workingDocumentURI,
    "User: " + this.userQuery + "\n\n"
  );
}
