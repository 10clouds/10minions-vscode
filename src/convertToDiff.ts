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

Your job is to output a unified diff file that will produce modified code when applied to the original code.

### CODE
${refCode}

### REQUESTED MODIFICATION
${modification}

### UNIFIED FILE CREATION GUIDELINES

A unified diff file consists of one or more hunk headers, each followed by two sections: the first showing lines removed from the first file, and the second showing lines added to the second file.

Here's an example of what a simple unified diff might look like:

diff
Copy code
--- original
+++ modified
@@ -1,3 +1,4 @@
 This is an example.
-This line will be removed.
 This line will not change.
+This line will be added.
Let's break down the parts of this diff:

--- original: The first line shows the name of the original file.
+++ modified: The second line shows the name of the modified file.
@@ -1,3 +1,4 @@: This is the hunk header, and it shows where changes have been made in the files. The -1,3 means that the hunk starts at line 1 of the original file and covers 3 lines. The +1,4 means that the corresponding part of the modified file starts at line 1 and covers 4 lines.
The lines that follow the hunk header show the changes between the original and modified files. Lines that are in the original file but not in the modified file are marked with -. Lines that are in the modified file but not in the original file are marked with +. Lines that are unchanged are not marked.
When creating a unified diff manually:

* Make sure to include the original and modified file names and timestamps at the beginning of the diff.
* Make sure to exactly match the structure of the original and modified files. Including the number of empty lines between sections.
* If the original file contains multiple consequitive newlines, make sure to reflect that in the diff file and do not omit them.
* For each set of changes, include a hunk header with the line numbers and counts in the original and modified files.
* Mark changed lines appropriately with - and +. Include enough unchanged lines for context.
* Be careful to ensure that line numbers, counts, and changes align correctly between the original and modified files.
* Keep the context lines (lines that will not change) to a minimum (around 2-3) that allows the diff to be applied correctly.
* If the description of the modification contains comments like "// ..." or "/* remainig code */" then you should follow their logic and inline appropriate sections from the original code.

### FINAL SUMMARY
You are an AI Tool, that helps developers write code. You have been provided an exact modification that needs to be applied to the code.

Your job is to output a unified diff (also known as a unidiff) file that will produce modified code when applied to the original code.

Think how to do it, and then once you are ready to output the diff, start with the follwing lines:

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


