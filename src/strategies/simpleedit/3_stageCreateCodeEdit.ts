import { MinionTask } from '../../MinionTask';
import { countTokens, ensureIRunThisInRange, gptExecute } from '../../openai';
import { TASK_STRATEGY_ID } from '../strategies';
import { EditorDocument, EditorPosition } from '../../managers/EditorManager';
import { getFileInfo } from '../utils/getFileInfo';

function createPrompt(
  classification: TASK_STRATEGY_ID,
  selectedText: string,
  document: EditorDocument,
  fullFileContents: string,
  selectionPosition: EditorPosition,
  userQuery: string,
) {
  const settingsKeyword = 'TODO'; //vscode.workspace.getConfiguration('10minions').get('taskCommentKeyword') || "TODO";
  const { fileName } = getFileInfo();

  return `
You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to help him with some code, the task is provided below in TASK section.
Perform that task.

Your job is to do the task, so your college will be exteremely happy. If asked for them, propose changes, deliver insightfull comments in the code and output to the user all of your logic and remarks in nice looking block comment.

Think about what your collegue might have in mind when he wrote his task, and try to fulfill his intention. Try to follow the task as pricesely as possible.

Take this step by step, first describe your plan, then elaborate on each step while providing code that needs to be changed.

Make sure to add a comment to each spot where you are making modifications, so it's clear to the collegue what and where you have modified.

Your collegue will only look at the final code, without you around, so make sure to provide all the necessary comments and explanations in the final code.

If you only modify a section of the code and leave the rest as is, as your final code segment, only output that specific section.

Do not provide the entire file or any bigger chunks than necessary.

You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to help him with some code, the task is provided below in TASK section.
Perform that task.

Your job is to do the task, so your college will be exteremely happy. If asked for them, propose changes, deliver insightfull comments in the code and output to the user all of your logic and remarks in nice looking block comment.

==== STRATEGIES FOR SPECIFIC TASKS ====
If asked to refactor code, critically analyze the provided code and propose a refactoring plan focusing on improving readability and maintainability. Your revised code should remain functional with no change in output or side effects. Suggest renaming functions, creating subroutines, or modifying types as needed, to achieve the aim of simplicity and readability. Ensure your code and any documentation meet the quality standards of a top open source project.  
If asked to write documentation, write nice comment at the top and consise to the point JSdocs above the signatures of each function.
If asked to remove comments, don't add your own comments as this is probably not what your college wants.
If asked to perform a task from a "${settingsKeyword}:" comment, perform the task and remove the comment.

${
  selectedText
    ? `
==== FILE CONTEXT (Language: ${document.languageId}) ====
${fullFileContents}  
`
    : ''
}

===== CODE SNIPPET ${
    selectedText
      ? `(starts on line ${selectionPosition.line + 1} column: ${
          selectionPosition.character + 1
        } in the file)`
      : `(Language: ${document.languageId})`
  } ====
${selectedText ? selectedText : fullFileContents}

===== TASK (applies to CODE SNIPPET section only, not the entire FILE CONTEXT) ====
${userQuery}

If the task is not clear or there is lack of details try to generate response base on file name.
File name: ${fileName}

Let's take it step by step.
`.trim();
}

export async function stageCreateModification(this: MinionTask) {
  if (this.strategy === undefined) {
    throw new Error('Classification is undefined');
  }

  this.modificationDescription = '';

  const document = await this.document();
  const classification = this.strategy;
  const userQuery = this.userQuery;
  const selectedText = this.selectedText;
  const fullFileContents = this.originalContent;
  const isCancelled = () => {
    return this.stopped;
  };

  const promptWithContext = createPrompt(
    classification,
    selectedText,
    document,
    fullFileContents,
    this.selection.start,
    userQuery,
  );

  const tokensCode = countTokens(promptWithContext, 'QUALITY');
  const luxiouriosTokens = tokensCode * 1.5;
  const absoluteMinimumTokens = tokensCode;

  const tokensToUse = ensureIRunThisInRange({
    prompt: promptWithContext,
    mode: 'QUALITY',
    preferedTokens: luxiouriosTokens,
    minTokens: absoluteMinimumTokens,
  });

  const { result, cost } = await gptExecute({
    fullPrompt: promptWithContext,
    onChunk: async (chunk: string) => {
      this.modificationDescription += chunk;
      this.appendToLog(chunk);
      this.reportSmallProgress();
    },
    isCancelled,
    mode: 'QUALITY',
    maxTokens: tokensToUse,
    controller: new AbortController(),
    outputType: 'string',
  });

  this.modificationDescription = result;
  this.totalCost += cost;

  this.reportSmallProgress();
  this.appendToLog('\n\n');
}
