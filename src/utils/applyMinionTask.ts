import * as vscode from "vscode";
import { MinionTask } from "../MinionTask";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { APPLIED_STAGE_NAME, FINISHED_STAGE_NAME } from "../ui/MinionTaskUIInfo";
import { decomposeMarkdownString } from "./decomposeMarkdownString";
import { applyModificationProcedure } from "./applyModificationProcedure";

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
    edit.insert(vscode.Uri.parse(minionTask.documentURI), new vscode.Position(0, 0), decomposedString + "\n");
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
      `Recently applied task: ${minionTask.userQuery}`
    );

    console.log(`modifiedContent: "${modifiedContent}"`);

    await applyWorkspaceEdit(async (edit) => {
      edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(document.lineAt(document.lineCount - 1).lineNumber, document.lineAt(document.lineCount - 1).text.length)
        ),
        modifiedContent
      );
    });

    minionTask.executionStage = APPLIED_STAGE_NAME;
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
