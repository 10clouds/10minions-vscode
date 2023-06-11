import * as vscode from "vscode";
import { fuzzyReplaceText } from "./fuzzyReplaceText";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { MinionTask } from "../MinionTask";
import { decomposeMarkdownString } from "./decomposeMarkdownString";
import { APPLIED_STAGE_NAME, FINISHED_STAGE_NAME } from "../ui/MinionTaskUIInfo";

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

      let replacement = fuzzyReplaceText({ currentCode, replaceText, withText });

      if (replacement === undefined) {
        throw new Error(
          `
Failed replace

replaceText:
${replaceText}

originalCode:
${originalCode}

`.trim()
        );
      }

      currentCode = replacement;

      storedArg = [];
    } else if (currentCommand.startsWith("BEFORE")) {
      let insertText = storedArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      let beforeText = currentArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");

      let replacement = fuzzyReplaceText({ currentCode, replaceText: beforeText, withText: `${insertText}\n${beforeText}` });

      if (replacement === undefined) {
        throw new Error(
          `
Failed replace

replaceText:
${beforeText}

originalCode:
${originalCode}

`.trim()
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
      isANewCommand =
        line.startsWith("END_REPLACE") ||
        line.startsWith("REPLACE ALL") ||
        line.startsWith("REPLACE") ||
        line.startsWith("RENAME") ||
        line.startsWith("INSERT");
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

export async function applyFallback(minionTask: MinionTask) {
  const document = await minionTask.document();
  const language = document.languageId || "javascript";

  const decomposedString = decomposeMarkdownString(
    `
Task: ${minionTask.userQuery}

${minionTask.modificationDescription}
`.trim(),
    language
  ).join("\n");

  minionTask.appendToLog(`\nPLAIN COMMENT FALLBACK\n`);

  minionTask.originalContent = document.getText();
  await applyWorkspaceEdit(async (edit) => {
    edit.insert(vscode.Uri.parse(minionTask.documentURI), new vscode.Position(0, 0), decomposedString + "\n");
  });

  minionTask.executionStage = APPLIED_STAGE_NAME;
  minionTask.onChanged(true);
  vscode.window.showInformationMessage(`Modification applied successfully.`);
}

export async function applyMinionTask(minionTask: MinionTask) {
  if (minionTask.classification === "AnswerQuestion") {
    vscode.window.showErrorMessage(`Cannot apply AnswerQuestion task.`);
    return;
  }

  if (minionTask.executionStage !== FINISHED_STAGE_NAME) {
    vscode.window.showErrorMessage(`Cannot apply unfinished task.`);
    return;
  }

  try {
    if (!minionTask.modificationProcedure) {
      throw new Error(`Modification procedure is empty.`);
    }

    let document = await minionTask.document();

    let modifiedContent = applyModificationProcedure(minionTask.originalContent, minionTask.modificationProcedure);

    console.log(`modifiedContent: "${modifiedContent}"`);

    minionTask.originalContent = document.getText();
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

    minionTask.executionStage = APPLIED_STAGE_NAME;
    minionTask.onChanged(true);

    vscode.window.showInformationMessage(`Modification applied successfully.`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to apply modification: ${String(error)}. Applying fallback.`);
    applyFallback(minionTask);
  }
}
