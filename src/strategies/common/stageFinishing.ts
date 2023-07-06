import { playNotificationSound } from '../../utils/playSound';
import { MinionTask } from '../../MinionTask';
import { getEditorManager } from '../../managers/EditorManager';

export async function stageFinishing(this: MinionTask) {
  getEditorManager().showInformationMessage(
    `${this.shortName} is ready to be applied!`,
  );

  this.appendSectionToLog(this.executionStage);

  this.stopExecution();

  this.appendToLog(`Total Cost: ~${this.totalCost.toFixed(2)}$\n\n`);

  playNotificationSound();
}
