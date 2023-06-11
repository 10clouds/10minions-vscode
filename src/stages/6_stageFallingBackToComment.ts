import * as vscode from "vscode";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { MinionTask } from "../MinionTask";
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
/**
 * Decompose a markdown string into an array of string parts, with
 * comments and code blocks properly formatted based on the document language.
 *
 * @param {string} markdownString The markdown string to decompose.
 * @param {string} languageId The language ID of the document.
 * @returns {string[]} An array of string parts, formatted as comments and code blocks.
 */
function decomposeMarkdownString(markdownString: string, languageId: string): string[] {
  const decomposedStringParts: string[] = [];
  const lines = markdownString.split('\n');
  let inCodeBlock = false;
  let codeLanguage = '';

  // Temporary buffer to store lines for comment blocks
  let commentBuffer: string[] = [];

  lines.forEach((line, index) => {
    if (line.startsWith("```")) {
      // Switch between code block and comment states.
      inCodeBlock = !inCodeBlock;

      // Add the entire comment buffer as a comment block when switching states
      if (!inCodeBlock && commentBuffer.length > 0) {
        const languageSpecificComment = getCommentForLanguage(languageId, commentBuffer.join('\n'));
        decomposedStringParts.push(languageSpecificComment);
        // Clear the comment buffer for the next block
        commentBuffer = [];
      }
      
      // Update codeLanguage when entering a code block.
      if (inCodeBlock) {
        codeLanguage = line.slice(3);
      }
    } else if (inCodeBlock && codeLanguage === languageId) {
      // Add line as is when inside a code block with matching language.
      decomposedStringParts.push(line);
    } else {
      // Add the line to the comment buffer when outside of a compatible code block.
      commentBuffer.push(line);
    }

    // Add the remaining comment buffer as a comment block at the end of the file
    if (index === lines.length - 1 && commentBuffer.length > 0) {
      const languageSpecificComment = getCommentForLanguage(languageId, commentBuffer.join('\n'));
      decomposedStringParts.push(languageSpecificComment);
    }
  });

  return decomposedStringParts;
}

const decomposedString = decomposeMarkdownString(
  `
Task: ${this.userQuery}

${this.modificationDescription}
`.trim(),
  language
).join('\n');

  this.appendToLog( `\nPLAIN COMMENT FALLBACK\n`);

  await applyWorkspaceEdit(async (edit) => {
    edit.insert(
      vscode.Uri.parse(this.documentURI),
      new vscode.Position(0, 0),
      decomposedString + "\n"
    );
  });

  this.modificationApplied = true;
}
