import * as vscode from "vscode";
import { MinionTask } from "../../MinionTask";
import { EXTENSIVE_DEBUG } from "../../const";
import { ensureICanRunThis, gptExecute } from "../../openai";
import { TASK_STRATEGIES } from "../strategies";

export async function stageClassifyTask(this: MinionTask) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  const document = await this.document();

  let fileContext = this.selectedText
    ? `
==== FILE CONTEXT (Language: ${document.languageId}) ====
${this.originalContent}  
`
    : "";

  let promptWithContext = `
You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to help him with some code, the task is provided below in TASK section.

Your job is to classify the task, so tomorrow, when you get back to this task, you know what to do.

Possible classifications:
${TASK_STRATEGIES.map((c) => `* ${c.name} - ${c.description}`).join("\n")}

===== CODE ${
    this.selectedText
      ? `(starts on line ${this.selection.start.line + 1} column: ${this.selection.start.character + 1} in the file)`
      : `(Language: ${document.languageId})`
  } ====
${this.selectedText ? this.selectedText : this.originalContent}

${fileContext}

===== TASK (applies to CODE) ====
${this.userQuery}


Classify the task.
`.trim();

  if (EXTENSIVE_DEBUG) {
    this.appendSectionToLog(this.executionStage);
    this.appendToLog("<<<< PROMPT >>>>\n\n");
    this.appendToLog(promptWithContext + "\n\n");
    this.appendToLog("<<<< EXECUTION >>>>\n\n");
  }

  ensureICanRunThis({ prompt: promptWithContext, maxTokens: 50, mode: "FAST" });

  let classification = await gptExecute({
    fullPrompt: promptWithContext,
    onChunk: async (chunk: string) => {
      this.reportSmallProgress();
      if (EXTENSIVE_DEBUG) {
        this.appendToLog(chunk);
      } else {
        this.appendToLog(".");
      }
    },
    isCancelled: () => {
      return this.stopped;
    },
    maxTokens: 50,
    mode: "FAST",
    controller: new AbortController(),
    outputType: {
      name: "classification",
      description: "Classification",
      parameters: {
        type: "object",
        properties: {
          classification: { type: "string", enum: ["AnswerQuestion", "CodeChange"] },
        },
        required: ["classification"],
      },
    },
  });

  console.log("Classification: ", classification);

  this.appendToLog("\n\n");

  //find classification in text
  let classifications = TASK_STRATEGIES.filter((c) => classification.indexOf(c.name) !== -1);

  if (classifications.length !== 1) {
    throw new Error(`Could not find classification in the text: ${classification}`);
  }

  this.strategy = classifications[0].name;

  if (EXTENSIVE_DEBUG) {
    this.appendToLog(`Classification: ${this.strategy}\n\n`);
  }
}
