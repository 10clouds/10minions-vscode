import * as vscode from "vscode";
import { MinionTask } from "../MinionTask";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { appendToFile } from "../utils/appendToFile";
import { replaceWithSlidingIndent } from "../utils/replaceWithSlidingIndent";

function applyModificationProcedure(originalCode: string, modificationProcedure: string) {
  let currentCode = originalCode;
  let lines = modificationProcedure.split("\n");
  let storedArg: string[] = [];
  let currentCommand: string = "";
  let currentArg: string[] = [];

  function finishLastCommand() {
    if (currentCommand.startsWith("REPLACE ALL")) {
      let consolidatedContent = currentArg.join("\n");
      let innerContent = consolidatedContent.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      currentCode = innerContent;
    } else if (currentCommand.startsWith("REPLACE")) {
      storedArg = currentArg;
    } else if (currentCommand.startsWith("INSERT")) {
      storedArg = currentArg;
    } else if (currentCommand.startsWith("WITH")) {
      let replaceText = storedArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      let withText = currentArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");

      let replacement = replaceWithSlidingIndent(currentCode, replaceText, withText);

      if (replacement === undefined) {
        throw new Error(`
Failed replace

replaceText:
${replaceText}

originalCode:
${originalCode}

`.trim());
      }

      currentCode = replacement;

      storedArg = [];
    } else if (currentCommand.startsWith("BEFORE")) {
      let insertText = storedArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      let beforeText = currentArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");

      let replacement = replaceWithSlidingIndent(currentCode, beforeText, `${insertText}\n${beforeText}`);

      if (replacement === undefined) {
        throw new Error(`
Failed replace

replaceText:
${beforeText}

originalCode:
${originalCode}

`.trim());
      }

      currentCode = replacement;

      storedArg = [];
    } else if (currentCommand.startsWith("RENAME")) {
      //parse currentCommand with regex (RENAME from to)
      let renameCommand = currentCommand.match(/^RENAME\s+(.*?)\s+(.*?)$/);
      if (!renameCommand) {
        throw new Error(`Unable to parse RENAME command: ${currentCommand}`);
      }

      let renameFrom = renameCommand[1];
      let renameTo = renameCommand[2];
      let context = currentArg.join("\n").trim();

      console.log(`renameFrom: "${renameFrom}" renameTo: "${renameTo}" context: "${context}"`);

      /*
      
      TODO:
      const document = editor.document;
      const position = editor.selection.active;

      const oldFunctionName = "oldFunction";
      const newFunctionName = "newFunction";

      vscode.commands.executeCommand(
        "editor.action.rename",
        document.uri,
        position,
        {
          newName: newFunctionName,
        }
      );*/
    } else if (currentCommand.startsWith("END_REPLACE")) {
      // Do nothing
    }

    currentArg = [];
  }

  for (let line of lines) {
    let isANewCommand = false;

    if (currentCommand.startsWith("INSERT")) {
      isANewCommand = line.startsWith("BEFORE");
    } else if (currentCommand.startsWith("REPLACE") && !currentCommand.startsWith("REPLACE ALL")) {
      isANewCommand = line.startsWith("WITH");
    } else if (currentCommand.startsWith("WITH")) {
      isANewCommand = line.startsWith("END_REPLACE") || line.startsWith("REPLACE ALL") || line.startsWith("REPLACE") || line.startsWith("RENAME") || line.startsWith("INSERT");
    } else {
      isANewCommand = line.startsWith("REPLACE ALL") || line.startsWith("REPLACE") || line.startsWith("RENAME") || line.startsWith("INSERT");
    }

    if (isANewCommand) {
      finishLastCommand();
      currentCommand = line;
    } else {
      currentArg.push(line);
    }
  }

  finishLastCommand();

  return currentCode;
}

export async function stageApplyModificationProcedure(this: MinionTask) {
  if (this.classification === "AnswerQuestion") {
    return;
  }

  if (this.modificationApplied) {
    return;
  }

  if (!this.modificationProcedure) {
    this.appendToLog( `\n\nModification procedure is empty.\n`);
    return;
  }

  try {
    let document = await this.document();
    this.originalContent = document.getText();

    let modifiedContent = applyModificationProcedure(this.originalContent, this.modificationProcedure);

    console.log(`modifiedContent: "${modifiedContent}"`);

    await applyWorkspaceEdit(async (edit) => {
      edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(document.lineAt(document.lineCount - 1).lineNumber, document.lineAt(document.lineCount - 1).text.length)
        ),
        modifiedContent
      );
    });

    this.modificationApplied = true;

    this.reportSmallProgress();
    await this.appendToLog( `\n\nCONSOLIDATION SUCCESFULY APPLIED\n\n`);
  } catch (error) {
    this.reportSmallProgress();
    await this.appendToLog( `\n\nError in applying consolidation: ${error}\n`);
  }
}
