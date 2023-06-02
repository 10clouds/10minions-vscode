import * as vscode from "vscode";
import { gptExecute } from "./openai";
import { executeCode } from "./codeExecution";

export async function applyCodeModification(
  document: vscode.TextDocument,
  modification: string,
  onChunk: (chunk: string) => Promise<void>,
  isCancelled?: () => boolean
) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  let promptWithContext = `
You are an AI Tool, that helps developers write code. You have been provided an exact modification that needs to be applied to the code.

Your job is to create a javascript function applyModification with this signature:

\`\`\`typescript
/**
 * Applies the modification to the code
 * @param {string} code - the code that needs to be modified
 * @returns {string} - the modified code
 */
function applyModification(code: string): string
\`\`\`

This function must perform the requested modification to the code and return the modified code.

Never generate a syntax error, so any remarks should be outputted as in comment blocks or line comments.

The modification code should be written in a way that it can be executed multiple times, and it will always produce the same result.

Keep the code consise and short, but in a way that still generates the requested modification. No comments are needed.

Do not invoke the function, just write the function body.

Modification code should not have any side effects, only string processing and modifications.

The modification code should be written in plain javascript, NOT typescript.

===== CODE ====
${document.getText()}

===== REQUESTED MODIFICATION ====
${modification}

===== FINAL SUMMARY ====
You are an AI Tool, that helps developers write code. You have been provided an exact modification that needs to be applied to the code.

Your job is to create a javascript function applyModification.

`.trim();

  let result = await gptExecute({
    fullPrompt: promptWithContext,
    onChunk,
    isCancelled,
  });

  console.log("Javascript intermidiate code");
  console.log(result);

  return executeCode(result, document.getText());
}
