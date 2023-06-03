import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { gptExecute } from "../openai";

export async function createConsolidated(
  refCode: string,
  modification: string,
  onChunk: (chunk: string) => Promise<void>
) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  //replace any lines with headers in format ===== HEADER ==== (must start and end the line without any additioanl characters) with # HEADER 
  modification = modification.replace(/^(====+)([^=]+)(====+)$/gm, (match, p1, p2, p3) => {
    return `#${p2}`;
  });

  let promptWithContext = `
You are a higly intelligent AI file composer tool, you can take a piece of text and a modification described in natural langue, and return a consolidated answer.

==== Format of the answer (Variant #1) ====

Star your answer with the overview of what you are going to do, and then, when ready to output the final consolidated result, start it with the following command:

REPLACE ALL

Use this variant if you are going to replace the entire file.

There can be only one such command in the answer, and it preceeds the final consolidated result.

==== Format of the answer (Variant #2) ====

Star your answer with the overview of what you are going to do, and then, when ready to output the final consolidated result, start it with the following command:

REPLACE

Followed by the lines of code you are replacing, and then, when ready to output the final consolidated result, start it with the following command:

WITH

Followed by the code you are replacing with.

You can then start with the next REPLACE line to repeat this sequence, or finish the output. Keep in mind that all lines between REPLACE and WITH will be used, even the empty ones.

You MUST end the answer with the final consolidated result, do not continue output after that.

Further more, do not invent your own commands, use only the ones described above.

Use this variant if you are going to replace a specific range of lines. There can be only one such command in the answer, and it preceeds the final consolidated result.

If the REQUESTED MODIFICATION modifies only a given line range which is less than 33% of the file, use this variant, otherwise use the first one.

==== Things to take into consideration ====

* You have been provided an exact modification (REQUESTED MODIFICATION section) that needs to be applied to the code (ORIGINAL CODE section).
* Your job is to output a full consolidated final, production ready, code, described in REQUESTED MODIFICATION.
* Make sure to exactly match the structure of the original and exactly the intention of the modification.
* If the description of the modification contains comments like "// ..." or "/* remainig code */" then you should follow their logic and inline appropriate sections from the original code, you are producting final production ready code.
* If in the REQUESTED MODIFICATION section there are only comments, and user asked something that does not requrie modification of the code. Write the answer as a code comment in appropriate spot.

==== ORIGINAL CODE ====
${refCode}

==== REQUESTED MODIFICATION ====
${modification}

==== FINAL SUMMARY ====
You are a higly intelligent AI file composer tool, you can take a piece of text and a modification described in natural langue, and return a consolidated answer.

Let's take this step by step, first, describe in detail what you are going to do, and then proceed with one of the output variants.
`.trim();

  let tokensCode = encode(promptWithContext).length;
  let tokensModification = encode(modification).length;

  let luxiouriosTokens = Math.max(tokensCode, tokensModification) * 1.5;

  let absoluteMinimumTokens = Math.max(tokensCode, tokensModification);

  let availableTokens = 8000 - encode(promptWithContext).length;

  console.log(`Tokens available: ${availableTokens} absolute minimum: ${absoluteMinimumTokens} luxiourios: ${luxiouriosTokens}`);

  if (availableTokens < absoluteMinimumTokens) {
    throw new Error(`Not enough tokens to perform the modification. Available tokens: ${availableTokens} absolute minimum: ${absoluteMinimumTokens} luxiourios: ${luxiouriosTokens}`);
  }

  onChunk(`Tokens available: ${availableTokens} absolute minimum: ${absoluteMinimumTokens} luxiourios: ${luxiouriosTokens}\n\n`);
  onChunk("<<<< PROMPT >>>>\n\n");
  onChunk(promptWithContext + "\n\n");
  onChunk("<<<< EXECUTION >>>>\n\n");

  return await gptExecute({fullPrompt: promptWithContext, onChunk, maxTokens: Math.round(Math.min(availableTokens, luxiouriosTokens)), temperature: 0});
}

export function applyConsolidated(
  originalCode: string,
  consolidated: string
) {
  if (consolidated.indexOf("REPLACE ALL\n") !== -1) {
    let consolidatedContent = consolidated.replace(/(.*)REPLACE ALL\n/sg, "");
    let innerContent = consolidatedContent.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
                                             
    return innerContent;
  } else {
    originalCode = applyReplaceWithSegments(consolidated, originalCode);

    return originalCode;
  }
}

function applyReplaceWithSegments(consolidated: string, originalCode: string) {
  let matches = [];
              
  let regex = /REPLACE\n((?:(?!REPLACE).)*\n)WITH\n((?:(?!REPLACE).)*\n)(?=\nREPLACE|$)/gs;
  let match;

  while ((match = regex.exec(consolidated)) !== null) {
    let replaceText = match[1];
    let withText = match[2];

    //make sure that withText ends with newline
    if (withText[withText.length - 1] !== "\n") {
      withText += "\n";
    }

    matches.push({ replaceText, withText });
  }

  if (matches.length === 0) {
    throw new Error(`No REPLACE command found in the answer.`);
  }

  for (let { replaceText, withText } of matches) {
    let replaceContent = replaceText.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
    let withContent = withText.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");

    if (originalCode.indexOf(replaceContent) === -1) {
      throw new Error(`REPLACE command found in the answer, but the original code does not contain the replace string. Replace string: ${replaceContent}`);
    }

    originalCode = originalCode.replace(replaceContent, withContent);
  }
  return originalCode;
}
