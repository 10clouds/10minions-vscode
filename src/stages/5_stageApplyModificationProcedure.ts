import * as vscode from "vscode";
import { GPTExecution } from "../GPTExecution";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { appendToFile } from "../utils/appendToFile";
import { replaceWithSlidingIndent } from "./replaceWithSlidingIndent";

function applyModificationProcedure(
  originalCode: string,
  modificationProcedure: string
) {
  let currentCode = originalCode;
  let lines = modificationProcedure.split("\n");
  let storedArg: string[] = [];
  let currentCommand: string = "";
  let currentArg: string[] = [];

  function finishLastCommand() {
    if (currentCommand.startsWith("REPLACE ALL")) {
      let consolidatedContent = currentArg.join("\n");
      let innerContent = consolidatedContent.replace(
        /^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s,
        "$1"
      );
      currentCode = innerContent;
    } else if (currentCommand.startsWith("REPLACE")) {
      storedArg = currentArg;
    } else if (currentCommand.startsWith("INSERT")) {
      storedArg = currentArg;
    } else if (currentCommand.startsWith("WITH")) {
      let replaceText = storedArg
        .join("\n")
        .replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      let withText = currentArg
        .join("\n")
        .replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");

      let replacement = replaceWithSlidingIndent(
        currentCode,
        replaceText,
        withText
      );

      if (replacement === undefined) {
        throw new Error(
          `REPLACE WITH command found in the answer, but the original code does not contain the replace string. replaceText: ${replaceText}`
        );
      }

      currentCode = replacement;

      storedArg = [];
    } else if (currentCommand.startsWith("BEFORE")) {
      let insertText = storedArg
        .join("\n")
        .replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      let beforeText = currentArg
        .join("\n")
        .replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");

      let replacement = replaceWithSlidingIndent(
        currentCode,
        beforeText,
        `${insertText}\n${beforeText}`
      );

      if (replacement === undefined) {
        throw new Error(
          `INSERT BEFORE command found in the answer, but the original code does not contain the replace string. replaceText: ${beforeText}`
        );
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

      console.log(
        `renameFrom: "${renameFrom}" renameTo: "${renameTo}" context: "${context}"`
      );

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
    }
    currentArg = [];
  }

  for (let line of lines) {
    let commandFound = true;

    if (currentCommand.startsWith("INSERT")) {
      if (line.startsWith("BEFORE")) {
        finishLastCommand();
        currentCommand = "BEFORE";
      } else {
        commandFound = false;
      }
    } else if (
      currentCommand.startsWith("REPLACE") &&
      !currentCommand.startsWith("REPLACE ALL")
    ) {
      if (line.startsWith("WITH")) {
        finishLastCommand();
        currentCommand = "WITH";
      } else {
        commandFound = false;
      }
    } else {
      if (line.startsWith("REPLACE ALL")) {
        finishLastCommand();
        currentCommand = line;
      } else if (line.startsWith("REPLACE")) {
        finishLastCommand();
        currentCommand = line;
      } else if (line.startsWith("RENAME")) {
        finishLastCommand();
        currentCommand = line;
      } else if (line.startsWith("INSERT")) {
        finishLastCommand();
        currentCommand = line;
      } else {
        commandFound = false;
      }
    }

    if (!commandFound) {
      currentArg.push(line);
    }
  }

  finishLastCommand();

  return currentCode;
}

export async function stageApplyModificationProcedure(this: GPTExecution) {
  if (this.modificationApplied) {
    return;
  }

  if (!this.modificationProcedure) {
    throw new Error(`Modification procedure is empty.`);
  }

  try {
    let document = await this.document();
    this.fullContent = document.getText();

    let modifiedContent = applyModificationProcedure(
      this.fullContent,
      this.modificationProcedure
    );

    console.log(`modifiedContent: "${modifiedContent}"`);

    await applyWorkspaceEdit(async (edit) => {
      edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(
            document.lineAt(document.lineCount - 1).lineNumber,
            document.lineAt(document.lineCount - 1).text.length
          )
        ),
        modifiedContent
      );
    });

    this.modificationApplied = true;

    this.reportSmallProgress();
    await appendToFile(
      this.workingDocumentURI,
      `\n\nCONSOLIDATION SUCCESFULY APPLIED\n\n`
    );
  } catch (error) {
    this.reportSmallProgress();
    await appendToFile(
      this.workingDocumentURI,
      `\n\nError in applying consolidation: ${error}\n`
    );
  }
}