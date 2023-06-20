import * as vscode from "vscode";
import { MinionTask } from "../MinionTask";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { APPLIED_STAGE_NAME, FINISHED_STAGE_NAME } from "../ui/MinionTaskUIInfo";
import { decomposeMarkdownString } from "./decomposeMarkdownString";
import { applyModificationProcedure } from "./applyModificationProcedure";
import { convertUri } from "../vscode/vscodeUtils";

export async function applyFallback(minionTask: MinionTask) {
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
  await applyWorkspaceEdit(async (edit) => {
    edit.insert(convertUri(minionTask.documentURI), new vscode.Position(0, 0), decomposedString + "\n");
  });

  minionTask.executionStage = APPLIED_STAGE_NAME;
  minionTask.contentAfterApply = document.getText();
  minionTask.appendToLog(`Applied modification as plain top comments\n\n`);
  minionTask.onChanged(true);
  vscode.window.showInformationMessage(`Modification applied successfully.`);
}

export async function applyMinionTask(minionTask: MinionTask) {
  if (minionTask.executionStage !== FINISHED_STAGE_NAME) {
    vscode.window.showErrorMessage(`Cannot apply unfinished task.`);
    return;
  }
  
  minionTask.executionStage = APPLIED_STAGE_NAME;
  await minionTask.onChanged(true);

  try {
    if (!minionTask.modificationProcedure) {
      throw new Error(`Modification procedure is empty.`);
    }

    let document = await minionTask.document();

    minionTask.originalContent = document.getText();

    let preprocessedContent = minionTask.originalContent;

    let modifiedContent = applyModificationProcedure(
      preprocessedContent,
      minionTask.modificationProcedure,
      document.languageId,
    );

    console.log(`modifiedContent: "${modifiedContent}"`);

    await applyWorkspaceEdit(async (edit) => {
      edit.replace(
        convertUri(document.uri),
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(document.lineAt(document.lineCount - 1).lineNumber, document.lineAt(document.lineCount - 1).text.length)
        ),
        modifiedContent
      );
    });

    minionTask.contentAfterApply = document.getText();
    minionTask.appendToLog(`Applied changes for user review.\n\n`);
    minionTask.onChanged(true);

    vscode.window.showInformationMessage(`Modification applied successfully.`);
  } catch (error) {
    console.log(`Failed to apply modification: ${String(error)}`);
    applyFallback(minionTask);
  }
}


/*
Recently applied task: Add this not at the start, but at the first edditing position.
*/
