import { MinionTask } from "../MinionTask";
import { appendToFile } from "../utils/appendToFile";
import * as vscode from "vscode";
import { gptExecute } from "../openai";
import { EXTENSIVE_DEBUG } from "../const";
import { TASK_CLASSIFICATION_NAME } from "../ui/MinionTaskUIInfo";

export const TASK_CLASSIFICATION: {
  name: TASK_CLASSIFICATION_NAME;
  description: string;
}[] = [
  {
    name: "AnswerQuestion",
    description:
      "You are asked a question, and you need to answer it or asked to comment on something. The result is not code, but textual description. For example: explain a concept, desribe a bug, etc.",
  },
  {
    name: "FileWideChange",
    description:
      "You are asked to make a change that will affect multiple places in the file, or the entire file. For example: refactor code, write documentation, remove comments, etc.",
  },
  {
    name: "LocalChange",
    description:
      "Most of the file will be unaffected, we will be modifing a small region or up to 3 small regions. For example: fix a bug, add a feature, add a test, etc.",
  },
];

export async function classifyTask(
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

  let fileContext = selectedText
    ? `
==== FILE CONTEXT ====
${fullFileContents}  
`
    : "";

  let promptWithContext = `
You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to help him with some code, the task is provided below in TASK section.

Your job is to classify the task, so tomorrow, when you get back to this task, you know what to do.

Possible classifications:
${TASK_CLASSIFICATION.map((c) => `* ${c.name} - ${c.description}`).join("\n")}

===== CODE ${selectedText ? `(starts on line ${selectionPosition.line + 1} column: ${selectionPosition.character + 1} in the file)` : ""}====
${selectedText ? selectedText : fullFileContents}

${fileContext}

===== TASK (applies to CODE) ====
${userQuery}


Classify the task.
`.trim();

  if (EXTENSIVE_DEBUG) {
    onChunk("<<<< PROMPT >>>>\n\n");
    onChunk(promptWithContext + "\n\n");
    onChunk("<<<< EXECUTION >>>>\n\n");
  }

  return gptExecute({
    fullPrompt: promptWithContext,
    onChunk,
    isCancelled,
    maxTokens: 50,
    controller: new AbortController(),
  });
}

export async function stageClassifyTask(this: MinionTask) {
  let classification = await classifyTask(
    this.userQuery,
    this.selection.start,
    this.selectedText,
    this.originalContent,
    async (chunk: string) => {
      this.reportSmallProgress();
      await this.appendToLog(chunk);
    },
    () => {
      return this.stopped;
    }
  );
  await this.appendToLog("\n\n");

  //find classification in text
  let classifications = TASK_CLASSIFICATION.filter((c) => classification.indexOf(c.name) !== -1);

  if (classifications.length !== 1) {
    throw new Error(`Could not find classification in the text: ${classification}`);
  }

  this.classification = classifications[0].name;

  this.appendToLog(`Classification: ${this.classification}\n\n`);
}
