import * as vscode from "vscode";
import { gptExecute } from "./openai";

export async function planAndWrite(
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

===== CODE ${
    selectedText
      ? `(starts on line ${selectionPosition.line + 1} column: ${
          selectionPosition.character + 1
        } in the file)`
      : ""
  }====
${selectedText ? selectedText : fullFileContents}

${fileContext}

===== TASK ====
${userQuery}

Keep in mind that this applies only to CODE and it should be your focus.

Let's take it step by step.
`.trim();

  onChunk("<<<< PROMPT >>>>\n\n");
  onChunk(promptWithContext + "\n\n");
  onChunk("<<<< EXECUTION >>>>\n\n");

  return gptExecute({
    fullPrompt: promptWithContext,
    onChunk,
    isCancelled,
  });
}
