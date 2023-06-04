import * as vscode from "vscode";
import { playNotificationSound } from "../utils/playSound";
import { GPTExecution } from "../GPTExecution";

export async function stageFinishing(this: GPTExecution) {
  vscode.window.showInformationMessage(`Finished processing ${this.baseName}`);

  this.stopExecution();

  playNotificationSound();
}
