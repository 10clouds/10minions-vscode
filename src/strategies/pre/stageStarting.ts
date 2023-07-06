import { MinionTask } from '../../MinionTask';
import { getEditorManager } from '../../managers/EditorManager';

export async function stageStarting(this: MinionTask) {
  const document = await getEditorManager().openTextDocument(this.documentURI);

  this.originalContent = document.getText();

  this.clearLog();
  this.appendToLog('Id: ' + this.id + '\n');
  this.appendToLog('File: ' + this.baseName + '\n');
  this.appendToLog('Task: ' + this.userQuery + '\n');
  this.appendToLog('\n');
}
