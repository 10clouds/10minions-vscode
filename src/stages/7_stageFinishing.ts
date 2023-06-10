import * as vscode from "vscode";
import { playNotificationSound } from "../utils/playSound";
import { MinionTask } from "../MinionTask";

export async function stageFinishing(this: MinionTask) {
  vscode.window.showInformationMessage(`Finished processing ${this.baseName}`);

  this.stopExecution();

  playNotificationSound();
}
