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

==== Format of the answer ====

Stard your answer with the overview of what you are going to do, and then, when ready to output the final consolidated result, start it with the following command:

REPLACE ALL

or 

REPLACE <start line> <end line>

Use the first case if you are going to replace the entire file, and the second case if you are going to replace a specific range of lines. There can be only one such command in the answer, and it preceeds the final consolidated result.

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

Let's take this step by step, first, describe in detail what you are going to do, and then once you are ready to output the consolidated code, start with the REPLACE command:

REPLACE (followed eithger by ALL or <start line> <end line> where start line and end line are numbers)

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
  let commandLineIndex = allConsolidatedLines.findIndex((line) => line.startsWith("REPLACE "));
  let command = allConsolidatedLines[commandLineIndex];
  let consolidatedContent = allConsolidatedLines.slice(commandLineIndex + 1).join("\n").trim().split("\n");
  let consolidatedContentInner = extractInnerBlock(consolidatedContent);

  if (command === "REPLACE ALL") {
    return consolidatedContentInner.join("\n");
  } else if (command.startsWith("REPLACE ")) {
    let [_, startLine, endLine] = command.split(" ");
    let start = parseInt(startLine);
    let end = parseInt(endLine);

    if (isNaN(start) || isNaN(end)) {
      throw new Error(`Invalid REPLACE command: ${command}`);
    }

    let originalCodeLines = originalCode.split("\n");
    originalCodeLines.splice(start, end - start, ...consolidatedContentInner);
    return originalCodeLines.join("\n");
  } else {
    throw new Error(`No REPLACE command found in the answer.`);
  }
}