import { MinionTask } from "../../MinionTask";
import { APPLIED_STAGE_NAME, APPLYING_STAGE_NAME, FINISHED_STAGE_NAME } from "../../ui/MinionTaskUIInfo";
import { decomposeMarkdownString } from "./decomposeMarkdownString";
import { applyModificationProcedure } from "./applyModificationProcedure";
import { getEditorManager } from "../../managers/EditorManager";

async function applyFallback(minionTask: MinionTask) {
  const document = await minionTask.document();
  const language = document.languageId || "javascript";

  const decomposedString = decomposeMarkdownString(
    `
Task: ${minionTask.userQuery}

${minionTask.modificationDescription}
`.trim(),
    language
  ).join("\n");

  minionTask.appendToLog(`\nPLAIN COMMENT FALLBACK\n`);

  minionTask.originalContent = document.getText();

  await getEditorManager().applyWorkspaceEdit(async (edit) => {
    edit.insert(minionTask.documentURI, { line: 0, character: 0 }, decomposedString + "\n");
  });

  getEditorManager().showInformationMessage(`Modification applied successfully.`);
}

export async function applyMinionTask(minionTask: MinionTask) {
  let document = await minionTask.document();

  if (minionTask.executionStage !== FINISHED_STAGE_NAME) {
    getEditorManager().showErrorMessage(`Cannot apply unfinished task.`);
    return;
  }
  
  minionTask.executionStage = APPLYING_STAGE_NAME;
  minionTask.progress = 0;
  await minionTask.onChanged(true);

  let interval = setInterval(() => {
    minionTask.progress = minionTask.progress + (1 - minionTask.progress) * 0.3;
    minionTask.onChanged(false);
  }, 100);

  try {
    if (!minionTask.modificationProcedure) {
      throw new Error(`Modification procedure is empty.`);
    }

    
    let currentDocContent = document.getText();

    if (minionTask.contentAfterApply === currentDocContent) {
      
      minionTask.executionStage = APPLIED_STAGE_NAME;
      minionTask.progress = 1;
      
      minionTask.onChanged(true);
      getEditorManager().showErrorMessage(`Already applied.`);

      return;
    }

    minionTask.originalContent = currentDocContent;

    let preprocessedContent = minionTask.originalContent;

    let modifiedContent = await applyModificationProcedure(
      preprocessedContent,
      minionTask.modificationProcedure,
      document.languageId,
    );

    await getEditorManager().applyWorkspaceEdit(async (edit) => {
      edit.replace(
        document.uri,
        {
          start: { line: 0, character: 0},
          end: { line: document.lineCount - 1, character: document.lineAt(document.lineCount - 1).text.length}
        },
        modifiedContent
      );
    });

    minionTask.executionStage = APPLIED_STAGE_NAME;
    minionTask.contentAfterApply = document.getText();
    minionTask.progress = 1;
    minionTask.appendToLog(`Applied changes for user review.\n\n`);
    minionTask.onChanged(true);

    getEditorManager().showInformationMessage(`Modification applied successfully.`);
  } catch (error) {
    console.log(`Failed to apply modification: ${String(error)}`);

    await applyFallback(minionTask);

    minionTask.executionStage = APPLIED_STAGE_NAME;
    minionTask.contentAfterApply = document.getText();
    minionTask.progress = 1;
    minionTask.appendToLog(`Applied modification as plain top comments\n\n`);
    minionTask.onChanged(true);
  } finally {
    clearInterval(interval);
  }
}