import * as vscode from "vscode";
import { COMMANDS } from "./commands";
import { gptExecute } from "./openai";

export async function fixCodeInEditor(
  userQuery: string,
  selectionPosition: vscode.Position,
  selectedText: string,
  mappedContent: {
    id: string;
    lastKnownPosition: number;
    line: string;
  }[],
  onChunk: (chunk: string) => Promise<void>
) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  let startingInfo = `You start with ${selectedText
    ? "the selected text selected, so if you want to preserve it, do something that clears the selection first"
    : "the cursor at the top of the CODE"
  }, and the CODE is already open in the editor.`.trim();

  let finishingInfoAboutSelectedText = (selectedText
  ? "Keep in mind that this applies only to SELECTED TEXT as the SELECTED TEXT should be your focus."
  : "");

  let promptWithContext = `
You are an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.
Your collegue asked you to help him with some code, the task is provided below in TASK section.
Perform that task.
You must do it in the confines of an editor window.
${startingInfo}
While you might be writing code, the thing that you write will not be executed and will not help you witn your task - this needs to be done manually by you.
Every character and word you say will be put be inserted into the editor at the current cursor position. Keep in mind that empty lines will also be inserted, so do not add extra new lines in the output.
While you want to tell your college what you are doing, do your best to never generate a syntax error, so any remarks should be outputted as in comment blocks or line comments.
Besides just outputing code at the cursor, you can use the following commands (output them as seperate lines of plain text, they will not be written to the editor):

${Object.values(COMMANDS)
      .map((c) => c.description)
      .join("\n")}

Keep in mind that the commands must be exactly as specified, with a leading #, always at the beigning of a line and in this exact format.

Your job is to do the task, so your college will be exteremely happy. If asked for them, propose changes, deliver insightfull comments in the code and output to the user all of your logic and remarks in nice looking block comment.

Think about what the user might have in mind when he wrote the query, and try to fulfill his intention. Try to follow the task as pricesely as possible.

Take this step by step, first describe your plan on top of the editor window. Then perform the task, rememeber to clean up the code after you written your adjustments, remove any old unnecessary identifiers and old function implementation.

If you provide new updated implementations, after that, perform a series of #SELECT-IDENTIFIER commands followed by #DELETE commands:
#SELECT-IDENTIFIER <functionThatWasImplementedByYou>
#DELETE
#SELECT-IDENTIFIER <anotherFunctionThatYouimplmented>
#DELETE
etc

==== STRATEGIES FOR SPECIFIC TASKS ====
If asked to refactor code, critically analyze the provided code and propose a refactoring plan focusing on improving readability and maintainability. Your revised code should remain functional with no change in output or side effects. Suggest renaming functions, creating subroutines, or modifying types as needed, to achieve the aim of simplicity and readability. Ensure your code and any documentation meet the quality standards of a top open source project.  
If asked to write documentation, write nice comment at the top and consise to the point JSdocs above the signatures of each function.
If asked to remove comments, don't add your own comments as this is probably not what your college wants.

===== SELECTED TEXT (starts on line: ${selectionPosition.line + 1} column: ${selectionPosition.character + 1} )====
${selectedText
      ? selectedText
      : "User did not select any text, so the command applies to the whole CODE."}

===== CODE ====
${mappedContent.map((line) => `${line.line}`).join("\n")}

===== TASK ====
The task that you have been given: ${userQuery}

${finishingInfoAboutSelectedText}

Now do it.
`.trim();

  return gptExecute(promptWithContext, onChunk);
}
