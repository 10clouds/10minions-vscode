import * as vscode from "vscode";
import { gptExecute } from "./openai";
import { encode } from "gpt-tokenizer";

export async function convertToDiff(
  refCode: string,
  modification: string,
  onChunk: (chunk: string) => Promise<void>
) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  let promptWithContext = `
You are an AI Tool, that helps developers write code. You have been provided an exact modification that needs to be applied to the code.

Your job is to output a diff file that will produce modified code when applied to the original code.

If the description of the modification contains comments like "// ..." or "/* remainig code */" then you should follow their logic and inject appropriate sections from the original code.

===== CODE ====
${refCode}

===== REQUESTED MODIFICATION ====
${modification}

===== FINAL SUMMARY ====
You are an AI Tool, that helps developers write code. You have been provided an exact modification that needs to be applied to the code.

Your job is to output a diff file that will produce modified code when applied to the original code.

If the description of the modification contains comments like "// ..." or "/* remainig code */" then you should follow their logic and inject appropriate sections from the original code.

Start your answer with:

--- original
+++ modified

`.trim();

  let tokensCode = encode(promptWithContext).length;
  let tokensModification = encode(modification).length;

  let luxiouriosTokens = Math.max(tokensCode, tokensModification) * 1.5;

  let absoluteMinimumTokens = Math.max(tokensCode, tokensModification);

  let availableTokens = 8000 - encode(promptWithContext).length;

  console.log(`Tokens available: ${availableTokens} absolute minimum: ${absoluteMinimumTokens} luxiourios: ${luxiouriosTokens}`);

  if (availableTokens < absoluteMinimumTokens) {
    vscode.window.showErrorMessage(`Not enough tokens to perform the modification. Available tokens: ${availableTokens} absolute minimum: ${absoluteMinimumTokens} luxiourios: ${luxiouriosTokens}`);
    return;
  }

  return await gptExecute({fullPrompt: promptWithContext, onChunk, maxTokens: Math.round(Math.min(availableTokens, luxiouriosTokens))});
}


