import * as vscode from "vscode";
import { MinionTask } from "../../MinionTask";
import { convertUri } from "../../vscode/vscodeUtils";

export async function stageStarting(this: MinionTask) {
  let document = await vscode.workspace.openTextDocument(convertUri(this.documentURI));

  this.originalContent = document.getText();

  this.clearLog();
  this.appendToLog("Id: " + this.id + "\n");
  this.appendToLog("File: " + this.baseName + "\n");
  this.appendToLog("Task: " + this.userQuery + "\n");
  this.appendToLog("\n");
}
