import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { gptExecute } from "./openai";

export async function createConsolidated(
  refCode: string,
  modification: string,
  onChunk: (chunk: string) => Promise<void>
) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

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

Use this variant if you are going to replace a specific range of lines. There can be only one such command in the answer, and it preceeds the final consolidated result.

If the REQUESTED MODIFICATION modifies only a given line range which is less than 33% of the file, use this variant, otherwise use the first one.

==== Things to take into consideration ====

* You have been provided an exact modification (REQUESTED MODIFICATION section) that needs to be applied to the code (ORIGINAL CODE section).
* Your job is to output a full consolidated final, production ready, code, described in REQUESTED MODIFICATION.
* Make sure to exactly match the structure of the original and exactly the intention of the modification.
* If the description of the modification contains comments like "// ..." or "/* remainig code */" then you should follow their logic and inline appropriate sections from the original code, you are producting final production ready code.

==== ORIGINAL CODE ====
${refCode}

==== REQUESTED MODIFICATION ====
${modification}

==== FINAL SUMMARY ====
You are a higly intelligent AI file composer tool, you can take a piece of text and a modification described in natural langue, and return a consolidated answer.

Let's take this step by step, first, describe in detail what you are going to do, choose a variant of format of the output and then proceed with that variant.
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


function getLinesBetween(inputLines: string[], start: number, end: number) {
  let lines = [];
  for (let i = start; i < end; i++) {
    lines.push(inputLines[i]);
  }
  return lines;
}

function extractInnerBlock(lines: string[]) {
  let startLine = 0;
  let endLine = lines.length;

  if (lines[startLine].startsWith("```") && lines[endLine - 1].startsWith("```")) {
    startLine++;
    endLine--;
  }

  return getLinesBetween(lines, startLine, endLine);
}

export function applyConsolidated(
  originalCode: string,
  consolidated: string
) {
  let allConsolidatedLines = consolidated.split("\n");
  let commandLineIndex = allConsolidatedLines.findIndex((line) => line.startsWith("REPLACE"));
  let command = allConsolidatedLines[commandLineIndex];

  if (command === "REPLACE ALL") {
    let consolidatedContent = allConsolidatedLines.slice(commandLineIndex + 1).join("\n").trim().split("\n");
    let consolidatedContentInner = extractInnerBlock(consolidatedContent);
  
    return consolidatedContentInner.join("\n");
  } else if (command === "REPLACE") {
    let withLineIndex = allConsolidatedLines.findIndex((line) => line.startsWith("WITH"));
    
    let replaceContent = allConsolidatedLines.slice(commandLineIndex + 1, withLineIndex).join("\n").trim().split("\n");
    let replaceContentInner = extractInnerBlock(replaceContent);
    let replaceString = replaceContentInner.join("\n");

    let withContent = allConsolidatedLines.slice(withLineIndex + 1).join("\n").trim().split("\n");
    let withContentInner = extractInnerBlock(withContent);
    let withString = withContentInner.join("\n");

    return originalCode.replace(replaceString, withString);
  } else {
    throw new Error(`No REPLACE command found in the answer.`);
  }
}