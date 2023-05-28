import * as vscode from "vscode";
import { COMMANDS } from "./commands";
import { gptExecute } from "./openai";
import { formatMappedContent } from "./MappedContent";

export async function applyModification(
  modification: string,
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

  let promptWithContext = `
You are an AI Tool, that helps developers write code. You have been provided an exact modification that needs to be applied to in the VS Code  editor environment.
Keep in mind that the editor already contains provided code and by the end of your operation it needs to contain the modified code.
${startingInfo}
While you might be writing code, the thing that you write will not be executed and will not help you witn your task - this needs to be done manually by you.
Every character and word you say will be put be inserted into the editor at the current cursor position. Keep in mind that empty lines will also be inserted, so do not add extra new lines in the output.
Never generate a syntax error, so any remarks should be outputted as in comment blocks or line comments.
Besides just outputing code at the cursor, you can use the following commands (output them as seperate lines of plain text, they will not be written to the editor):

${Object.values(COMMANDS)
      .map((c) => c.description)
      .join("\n")}

Keep in mind that the commands must be exactly as specified, with a leading #, always at the beigning of a line and in this exact format.

Make sure that the provided modification is executed preciselly and in full.

Rememeber to clean up the code from things which were superceeded by new code, remove any old unnecessary identifiers and old function implementation.

If you provide new updated implementations, after that, perform a series of #SELECT-IDENTIFIER commands followed by #DELETE commands:
#SELECT-IDENTIFIER <functionThatWasImplementedByYou>
#DELETE
#SELECT-IDENTIFIER <anotherFunctionThatYouimplmented>
#DELETE
etc

If asked to remove comments, don't add your own comments as this is probably not what your college wants.

===== SELECTED TEXT (starts on line: ${selectionPosition.line + 1} column: ${selectionPosition.character + 1} )====
${selectedText
      ? selectedText
      : "User did not select any text, so the command applies to the whole CODE."}

===== CODE ====
${formatMappedContent(mappedContent)}

===== REQUESTED MODIFICATION ====
${modification}


===== FINAL SUMMARY ====
You are an AI Tool, that helps developers write code. You have been provided an exact modification that needs to be applied to in the VS Code  editor environment.

Keep in mind that the editor already contains provided code and by the end of your operation it needs to contain the modified code.

`.trim();

  return gptExecute(promptWithContext, onChunk);
}
