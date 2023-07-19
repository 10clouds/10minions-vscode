import { MinionTask } from '../../MinionTask';
import {
  APPLIED_STAGE_NAME,
  APPLYING_STAGE_NAME,
  FINISHED_STAGE_NAME,
} from '../../ui/MinionTaskUIInfo';
import { applyModificationProcedure } from './applyModificationProcedure';
import { getEditorManager } from '../../managers/EditorManager';
import { applyFallback } from './applyFallback';

export const LOG_NO_FALLBACK_MARKER = `Applied changes for user review.\n\n`;

export async function applyMinionTask(minionTask: MinionTask) {
  const document = await minionTask.document();

  if (minionTask.executionStage !== FINISHED_STAGE_NAME) {
    getEditorManager().showErrorMessage(`Cannot apply unfinished task.`);
    return;
  }

  minionTask.executionStage = APPLYING_STAGE_NAME;
  minionTask.progress = 0;
  await minionTask.onChanged(true);

  const interval = setInterval(() => {
    minionTask.progress = minionTask.progress + (1 - minionTask.progress) * 0.3;
    minionTask.onChanged(false);
  }, 100);

  try {
    if (!minionTask.modificationProcedure) {
      throw new Error(`Modification procedure is empty.`);
    }

    const currentDocContent = document.getText();

    if (minionTask.contentAfterApply === currentDocContent) {
      minionTask.executionStage = APPLIED_STAGE_NAME;
      minionTask.progress = 1;

      minionTask.onChanged(true);
      getEditorManager().showErrorMessage(`Already applied.`);

      return;
    }

    minionTask.originalContent = currentDocContent;

    const preprocessedContent = minionTask.originalContent;

    const modifiedContent = await applyModificationProcedure(
      preprocessedContent,
      minionTask.modificationProcedure,
      document.languageId,
    );

    await getEditorManager().applyWorkspaceEdit(async (edit) => {
      edit.replace(
        document.uri,
        {
          start: { line: 0, character: 0 },
          end: {
            line: document.lineCount - 1,
            character: document.lineAt(document.lineCount - 1).text.length,
          },
        },
        modifiedContent,
      );
    });
  } catch (error) {
    await applyFallback(minionTask);

    minionTask.executionStage = APPLIED_STAGE_NAME;
    minionTask.contentAfterApply = document.getText();
    minionTask.progress = 1;
    minionTask.appendToLog(`Applied modification as plain top comments\n\n`);
    minionTask.onChanged(true);
    return;
  } finally {
    clearInterval(interval);
  }

  minionTask.executionStage = APPLIED_STAGE_NAME;
  minionTask.contentAfterApply = document.getText();
  minionTask.progress = 1;
  minionTask.appendToLog(LOG_NO_FALLBACK_MARKER);
  minionTask.onChanged(true);

  getEditorManager().showInformationMessage(
    `Modification applied successfully.`,
  );
}
