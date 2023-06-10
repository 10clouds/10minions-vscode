import { MinionTask } from "../MinionTask";

import * as vscode from "vscode";
import { gptExecute } from "../gptExecute";
import { TASK_CLASSIFICATION_NAME } from "../ui/MinionTaskUIInfo";

export const CLASSIFICATION_PROMPTS = {
  AnswerQuestion: (selectedText?: string) =>
    `

You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to tell him about something, the task is provided below in TASK section.
Perform that task.

Your job is to professionally answer the question.

Think about what the user might have in mind when he wrote his task, and try to fulfill his intention. Try to follow the task as pricesely as possible.

At the end provide your final answer, this is the only thing that will be supplied to your collegue as a result of this task.

  `.trim(),

  FileWideChange: (selectedText?: string) =>
    `

You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to help him with some code, the task is provided below in TASK section.
Perform that task.

Your job is to do the task, so your college will be exteremely happy. If asked for them, propose changes, deliver insightfull comments in the code and output to the user all of your logic and remarks in nice looking block comment.

Think about what the user might have in mind when he wrote the query, and try to fulfill his intention. Try to follow the task as pricesely as possible.

Take this step by step, first describe your plan, then elaborate on each step while providing code that needs to be changed.

Make sure to add a comment to each spot where you are making modifications, so it's clear to the collegue what and where you have modified.

Your collegue will only look at the final code, without you around, so make sure to provide all the necessary comments and explanations in the final code.

If you only modify a section of the code and leave the rest as is, as your final code segment, only output that specific section.

Do not provide the entire file or any bigger chunks than necessary.

==== STRATEGIES FOR SPECIFIC TASKS ====
If asked to refactor code, critically analyze the provided code and propose a refactoring plan focusing on improving readability and maintainability. Your revised code should remain functional with no change in output or side effects. Suggest renaming functions, creating subroutines, or modifying types as needed, to achieve the aim of simplicity and readability. Ensure your code and any documentation meet the quality standards of a top open source project.  
If asked to write documentation, write nice comment at the top and consise to the point JSdocs above the signatures of each function.
If asked to remove comments, don't add your own comments as this is probably not what your college wants.

`.trim(),

  LocalChange: (selectedText?: string) =>
    `

You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to help him with some code, the task is provided below in TASK section.
Perform that task.

Your job is to do the task, so your college will be exteremely happy. If asked for them, propose changes, deliver insightfull comments in the code and output to the user all of your logic and remarks in nice looking block comment.

Think about what the user might have in mind when he wrote the query, and try to fulfill his intention. Try to follow the task as pricesely as possible.

Take this step by step, first describe your plan, then elaborate on each step while providing code that needs to be changed.

Make sure to add a comment to each spot where you are making modifications, so it's clear to the collegue what and where you have modified.

Your collegue will only look at the final code, without you around, so make sure to provide all the necessary comments and explanations in the final code.

If you only modify a section of the code and leave the rest as is, as your final code segment, only output that specific section.

Do not provide the entire file or any bigger chunks than necessary.

==== STRATEGIES FOR SPECIFIC TASKS ====
If asked to refactor code, critically analyze the provided code and propose a refactoring plan focusing on improving readability and maintainability. Your revised code should remain functional with no change in output or side effects. Suggest renaming functions, creating subroutines, or modifying types as needed, to achieve the aim of simplicity and readability. Ensure your code and any documentation meet the quality standards of a top open source project.  
If asked to write documentation, write nice comment at the top and consise to the point JSdocs above the signatures of each function.
If asked to remove comments, don't add your own comments as this is probably not what your college wants.
  
`.trim(),
};

async function planAndWrite(
  document: vscode.TextDocument,
  classification: TASK_CLASSIFICATION_NAME,
  userQuery: string,
  selectionPosition: vscode.Position,
  selectedText: string,
  fullFileContents: string,
  onChunk: (chunk: string) => Promise<void>,
  isCancelled: () => boolean
) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  let promptWithContext = `
${CLASSIFICATION_PROMPTS[classification](selectedText)}

${
  selectedText
    ? `
==== FILE CONTEXT (Language: ${document.languageId}) ====
${fullFileContents}  
`
    : ""
}

===== CODE SNIPPET ${selectedText ? `(starts on line ${selectionPosition.line + 1} column: ${selectionPosition.character + 1} in the file)` : ""}====
${selectedText ? selectedText : fullFileContents}

===== TASK (applies to CODE SNIPPET section only, not the entire FILE CONTEXT) ====
${userQuery}

Let's take it step by step.
`.trim();

  return gptExecute({
    fullPrompt: promptWithContext,
    onChunk,
    isCancelled,
    controller: new AbortController(),
  });
}

export async function stageCreateModification(this: MinionTask) {
  if (this.classification === undefined) {
    throw new Error("Classification is undefined");
  }

  this.modificationDescription = "";
  this.modificationDescription = await planAndWrite(
    await this.document(),
    this.classification,
    this.userQuery,
    this.selection.start,
    this.selectedText,
    this.originalContent,
    async (chunk: string) => {
      this.modificationDescription += chunk;
      this.appendToLog( chunk);
      this.reportSmallProgress();
    },
    () => {
      return this.stopped;
    }
  );

  this.reportSmallProgress();
  this.appendToLog( "\n\n");
}
