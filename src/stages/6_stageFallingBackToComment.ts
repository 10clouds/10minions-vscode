import * as vscode from "vscode";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { MinionTask } from "../MinionTask";
import { appendToFile } from "../utils/appendToFile";
import { getCommentForLanguage } from "../utils/comments";

export async function stageFallingBackToComment(this: MinionTask) {
  if (this.classification === "AnswerQuestion") {
    return;
  }

  if (this.modificationApplied) {
    return;
  }

  this.reportSmallProgress();

  const language = (await this.document()).languageId || "javascript";

  const languageSpecificComment = getCommentForLanguage(
    language,
    `
10Minions: I was unable to modify the code myself, but you can do it yourself based on my remarks below:

${this.modificationDescription}
`.trim()
  );

  await this.appendToLog( `\nPLAIN COMMENT FALLBACK\n`);

  await applyWorkspaceEdit(async (edit) => {
    edit.insert(
      vscode.Uri.parse(this.documentURI),
      new vscode.Position(0, 0),
      languageSpecificComment + "\n"
    );
  });

  this.modificationApplied = true;
}
