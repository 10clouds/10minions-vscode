import { MinionTask } from "../../MinionTask";
import { DEBUG_PROMPTS, DEBUG_RESPONSES } from "../../const";
import { ensureICanRunThis, gptExecute } from "../../openai";
import { PRE_STAGES, TASK_STRATEGIES } from "../strategies";

export async function stageChooseStrategy(this: MinionTask) {
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

Your job is to choose strategy for handling the task, so tomorrow, when you get back to this task, you know what to do.

Possible strategies:
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


Choose strategy for the task.
`.trim();

  if (DEBUG_PROMPTS) {
    this.appendSectionToLog(this.executionStage);
    this.appendToLog("<<<< PROMPT >>>>\n\n");
    this.appendToLog(promptWithContext + "\n\n");
    this.appendToLog("<<<< EXECUTION >>>>\n\n");
  }

  ensureICanRunThis({ prompt: promptWithContext, maxTokens: 50, mode: "FAST" });

  let {result, cost} = await gptExecute({
    fullPrompt: promptWithContext,
    onChunk: async (chunk: string) => {
      this.reportSmallProgress();
      if (DEBUG_RESPONSES) {
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
          strategy: { type: "string", enum: TASK_STRATEGIES.map((c) => c.name) },
        },
        required: ["classification"],
      },
    },
  });

  this.totalCost += cost;

  this.appendToLog("\n\n");

  //find classification in text
  let strategies = TASK_STRATEGIES.filter((c) => result.indexOf(c.name) !== -1);

  if (strategies.length !== 1) {
    throw new Error(`Could not find strategy in the text: ${result}`);
  }

  this.strategy = strategies[0].name;

  this.stages = [...PRE_STAGES, ...strategies[0].stages];
  this.currentStageIndex = PRE_STAGES.length - 1;

  if (DEBUG_PROMPTS) {
    this.appendToLog(`Strategy: ${this.strategy}\n\n`);
  }
}
