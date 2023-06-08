import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { GPTExecution } from "../GPTExecution";
import { EXTENSIVE_DEBUG } from "../const";
import { gptExecute } from "../openai";
import { appendToFile } from "../utils/appendToFile";
import { TASK_CLASSIFICATION_NAME } from "../ui/ExecutionInfo";

export const CLASSIFICATION_OUTPUT_FORMATS = {
  "AnswerQuestion": `

Star with the overview of what you are going to do, and then, when ready to output the final consolidated result, start it with the following command:

INSERT

Followed by lines of block comment

BEFORE

Followed by lines of code that the comment will be attached to.

You can then start with the next INSERT line to repeat this sequence, or finish the output. Keep in mind that all lines between INSERT and BEFORE will be used, even the empty ones.

Further more, do not invent your own commands, use only the ones described above.
`.trim(),

  "FileWideChange": `

Star your answer with the overview of what you are going to do, and then, when ready to output the final consolidated result, start it with the following command:

REPLACE ALL

Your job is to output a full consolidated final, production ready, code, described in REQUESTED MODIFICATION when applied to ORIGINAL CODE.

There can be only one such command in the answer, and it preceeds the final consolidated result.
`.trim(),

  "LocalChange": `

Star your answer with the overview of what you are going to do, and then, when ready to output the final consolidated result, start it with the following command:

REPLACE

Followed by the lines of code you are replacing, and then, when ready to output the final consolidated result, start it with the following command:

WITH

Followed by the code you are replacing with. End the sequence with the following command:

END_REPLACE

You may follow this pattern multiple times. If followed by next REPLACE, END_REPLACE is not required.

Follow this rules when using REPLACE / WITH / END_REPLACE command sequence:
* All lines and whitespace in the text you are replacing matter, try to keep the newlines and indentation the same so proper match can be found.
* Keep in mind that all lines after WITH, and until next REPLACE, will be used, even the empty ones. So any output after final WITH will be part of the final replacement.
* Do not invent your own commands, use only the ones described above.
* After REPLACEments the code should be final, production ready, as described in REQUESTED MODIFICATION.

`.trim(),
};

async function createConsolidated(
  classification: TASK_CLASSIFICATION_NAME,
  refCode: string,
  modification: string,
  onChunk: (chunk: string) => Promise<void>
) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  //replace any lines with headers in format ===== HEADER ==== (must start and end the line without any additioanl characters) with # HEADER
  modification = modification.replace(
    /^(====+)([^=]+)(====+)$/gm,
    (match, p1, p2, p3) => {
      return `#${p2}`;
    }
  );

  let promptWithContext = `
You are a higly intelligent AI file composer tool, you can take a piece of text and a modification described in natural langue, and return a consolidated answer.

==== FORMAT OF THE ANSWER ====
${CLASSIFICATION_OUTPUT_FORMATS[classification]}

==== THINGS TO TAKE INTO CONSIDERATION ====

* You have been provided an exact modification (REQUESTED MODIFICATION section) that needs to be applied to the code (ORIGINAL CODE section).
* Make sure to exactly match the structure of the original and exactly the intention of the modification.
* You MUST ALWAYS expand all comments like "// ...", "/* remainig code */" or "// ...rest of the code remains the same..." to the exact code that they refer to. You are producting final production ready code, so you need complete code.
* If in the REQUESTED MODIFICATION section there are only comments, and user asked something that does not requrie modification of the code. Write the answer as a code comment in appropriate spot.
* You must always leave a mark on the final file, if there is nothing to modify in the file, you must leave a comment in the file describing why there is nothing to modify.

==== ORIGINAL CODE ====
${refCode}

==== REQUESTED MODIFICATION ====
${modification}

==== FINAL SUMMARY ====
You are a higly intelligent AI file composer tool, you can take a piece of text and a modification described in natural langue, and return a consolidated answer.

Let's take this step by step, first, describe in detail what you are going to do, and then perform previously described commands in FORMAT OF THE ANSWER section.
`.trim();

  let tokensCode = encode(promptWithContext).length;
  let tokensModification = encode(modification).length;

  let luxiouriosTokens = Math.max(tokensCode, tokensModification) * 1.5;

  let absoluteMinimumTokens = Math.max(tokensCode, tokensModification);

  let availableTokens = 8000 - encode(promptWithContext).length;

  console.log(
    `Tokens available: ${availableTokens} absolute minimum: ${absoluteMinimumTokens} luxiourios: ${luxiouriosTokens}`
  );

  if (availableTokens < absoluteMinimumTokens) {
    throw new Error(
      `Not enough tokens to perform the modification. Available tokens: ${availableTokens} absolute minimum: ${absoluteMinimumTokens} luxiourios: ${luxiouriosTokens}`
    );
  }

  if (EXTENSIVE_DEBUG) {
    onChunk(
      `Tokens available: ${availableTokens} absolute minimum: ${absoluteMinimumTokens} luxiourios: ${luxiouriosTokens}\n\n`
    );
    onChunk("<<<< PROMPT >>>>\n\n");
    onChunk(promptWithContext + "\n\n");
    onChunk("<<<< EXECUTION >>>>\n\n");
  }

  return await gptExecute({
    fullPrompt: promptWithContext,
    onChunk,
    maxTokens: Math.round(Math.min(availableTokens, luxiouriosTokens)),
    temperature: 0,
    controller: new AbortController(),
  });
}

export async function stageCreateModificationProcedure(this: GPTExecution) {
  if (this.classification === undefined) {
    throw new Error("Classification is undefined");
  }

  if (this.classification === "AnswerQuestion") {
    return;
  }

  if (this.modificationApplied) {
    return;
  }

  this.reportSmallProgress();
  
  this.modificationProcedure = await createConsolidated(
    this.classification,
    this.fullContent,
    this.modificationDescription,
    async (chunk: string) => {
      this.reportSmallProgress();
      await appendToFile(this.workingDocumentURI, chunk);
    }
  );
}
