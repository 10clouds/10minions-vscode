import { MinionTask } from "../MinionTask";
import * as vscode from "vscode";
import { gptExecute } from "../gptExecute";
import { EXTENSIVE_DEBUG } from "../const";
import { TASK_CLASSIFICATION_NAME } from "../ui/MinionTaskUIInfo";
import { encode } from "gpt-tokenizer/cjs/model/gpt-4";
import { MODEL_DATA } from "../openai";

export const TASK_CLASSIFICATION: {
  name: TASK_CLASSIFICATION_NAME;
  description: string;
}[] = [
  {
    name: "AnswerQuestion",
    description:
      "Choose this classification if you don't want to modify code when doing this task or it's not appropriate to modifiy code based on this task. The result is not code, but textual description. A good example of this is when you are asked a question, and you need to answer it. For example: For example: are strings immutable in java? explain how this works, come up with 5 ideas for a name etc.",
  },
  {
    name: "CodeChange",
    description:
      "Choose if it's makes sense to modify code for this task. For example: fix a bug, add a feature, add a test, are there any bugs?, critisize this code, refactor this code, document this code etc.",
  },
];

export async function classifyTask(
  document: vscode.TextDocument,
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
==== FILE CONTEXT (Language: ${document.languageId}) ====
${fullFileContents}  
`
    : "";

  let promptWithContext = `
You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to help him with some code, the task is provided below in TASK section.

Your job is to classify the task, so tomorrow, when you get back to this task, you know what to do.

Possible classifications:
${TASK_CLASSIFICATION.map((c) => `* ${c.name} - ${c.description}`).join("\n")}

===== CODE ${selectedText ? `(starts on line ${selectionPosition.line + 1} column: ${selectionPosition.character + 1} in the file)` : `(Language: ${document.languageId})`} ====
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

  let tokensCode = encode(promptWithContext).length;

  if (tokensCode > MODEL_DATA['gpt-4'].maxTokens) {
    throw new Error(`Combination of file size, selection and your command, is too big for us to handle.`);
  }

  return gptExecute({
    fullPrompt: promptWithContext,
    onChunk,
    isCancelled,
    maxTokens: 50,
    controller: new AbortController()
  });
}

export async function stageClassifyTask(this: MinionTask) {
  let classification = await classifyTask(
    await this.document(),
    this.userQuery,
    this.selection.start,
    this.selectedText,
    this.originalContent,
    async (chunk: string) => {
      this.reportSmallProgress();
      if (EXTENSIVE_DEBUG) {
        this.appendToLog(chunk);
      } else {
        this.appendToLog(".");
      }
    },
    () => {
      return this.stopped;
    }
  );
  this.appendToLog("\n\n");

  //find classification in text
  let classifications = TASK_CLASSIFICATION.filter((c) => classification.indexOf(c.name) !== -1);

  if (classifications.length !== 1) {
    throw new Error(`Could not find classification in the text: ${classification}`);
  }

  this.classification = classifications[0].name;

  if (EXTENSIVE_DEBUG) {
    this.appendToLog(`Classification: ${this.classification}\n\n`);
  }
}
