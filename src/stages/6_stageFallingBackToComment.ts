import * as vscode from "vscode";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { GPTExecution } from "../GPTExecution";
import { appendToFile } from "../utils/appendToFile";

function escapeContentForLanguage(language: string, content: string) {
  switch (language) {
    case "python":
      return content.replace(/'''/g, "'''\\");
    default:
      return content.replace(/\*\//g, "*\\/");
  }
}

function getCommentForLanguage(language: string, content: string) {
  const escapedContent = escapeContentForLanguage(language, content);
  switch (language) {
    case "python":
      return `'''\n${escapedContent}\n'''\n\n`;
    default:
      return `/*\n${escapedContent}\n*/\n\n`;
  }
}

export async function stageFallingBackToComment(this: GPTExecution) {
  if (this.modificationApplied) {
    return;
  }

  this.reportSmallProgress();

  const language = (await this.document()).languageId || "javascript";

  const languageSpecificComment = getCommentForLanguage(
    language,
    `
10Clouds CodeMind: I was unable to modify the code myself, but you can do it yourself based on my remarks below:

${this.modificationDescription}
`.trim()
  );

  await appendToFile(this.workingDocumentURI, `\nPLAIN COMMENT FALLBACK\n`);

  await applyWorkspaceEdit(async (edit) => {
    edit.insert(
      vscode.Uri.parse(this.documentURI),
      new vscode.Position(0, 0),
      languageSpecificComment
    );
  });

  this.modificationApplied = true;
}
