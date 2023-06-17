import * as vscode from "vscode";
import { MinionTask } from "../../MinionTask";
import { countTokens, ensureIRunThisInRange, gptExecute } from "../../openai";
import { TASK_STRATEGY_ID } from "../strategies";


function createPrompt(classification: TASK_STRATEGY_ID, selectedText: string, document: vscode.TextDocument, fullFileContents: string, selectionPosition: vscode.Position, userQuery: string) {
  return `
You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to tell him about something, the task is provided below in TASK section.
Perform that task.

Your job is to professionally answer the question.

Think about what your collegue might have in mind when he wrote his task, and try to fulfill his intention. Try to follow the task as pricesely as possible.

Take this step by step, and describe your reasoning along the way.

At the end provide your final answer, this is the only thing that will be supplied to your collegue as a result of this task.

${selectedText
      ? `
==== FILE CONTEXT (Language: ${document.languageId}) ====
${fullFileContents}  
`
      : ""}

===== CODE SNIPPET ${selectedText
      ? `(starts on line ${selectionPosition.line + 1} column: ${selectionPosition.character + 1} in the file)`
      : `(Language: ${document.languageId})`} ====
${selectedText ? selectedText : fullFileContents}

===== TASK (applies to CODE SNIPPET section only, not the entire FILE CONTEXT) ====
${userQuery}

Let's take it step by step.
`.trim();
}

export async function stageCreateModification(this: MinionTask) {
  if (this.strategy === undefined) {
    throw new Error("Classification is undefined");
  }

  this.modificationDescription = "";

  const document = await this.document();
  const classification = this.strategy;
  const userQuery = this.userQuery;
  const selectedText = this.selectedText;
  const fullFileContents = this.originalContent;
  const isCancelled = () => {
    return this.stopped;
  };

  // Begin inlined planAndWrite function code
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  let promptWithContext = createPrompt(classification, selectedText, document, fullFileContents, this.selection.start, userQuery);

  let tokensCode = countTokens(promptWithContext, "QUALITY");
  let luxiouriosTokens = tokensCode * 1.5;
  let absoluteMinimumTokens = tokensCode;

  let tokensToUse = ensureIRunThisInRange({
    prompt: promptWithContext,
    mode: "QUALITY",
    preferedTokens: luxiouriosTokens,
    minTokens: absoluteMinimumTokens,
  });

  let {result, cost} = await gptExecute({
    fullPrompt: promptWithContext,
    onChunk: async (chunk: string) => {
      this.modificationDescription += chunk;
      this.appendToLog(chunk);
      this.reportSmallProgress();
    },
    isCancelled,
    mode: "QUALITY",
    maxTokens: tokensToUse,
    controller: new AbortController(),
    outputType: "string",
  });

  this.modificationDescription = result;
  this.totalCost += cost;

  this.reportSmallProgress();
  this.appendToLog("\n\n");
}