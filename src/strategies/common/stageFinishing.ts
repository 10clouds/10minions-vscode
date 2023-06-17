import * as vscode from "vscode";
import { playNotificationSound } from "../../utils/playSound";
import { MinionTask } from "../../MinionTask";

export async function stageFinishing(this: MinionTask) {
  vscode.window.showInformationMessage(`${this.shortName} is ready to be applied!`);

  this.appendSectionToLog(this.executionStage);

  this.stopExecution();

  playNotificationSound();
}
