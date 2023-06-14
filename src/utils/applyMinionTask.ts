import * as vscode from "vscode";
import { fuzzyReplaceText } from "./fuzzyReplaceText";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { MinionTask } from "../MinionTask";
import { decomposeMarkdownString } from "./decomposeMarkdownString";
import { APPLIED_STAGE_NAME, FINISHED_STAGE_NAME } from "../ui/MinionTaskUIInfo";
import { canAddComment, getCommentForLanguage } from "./comments";

function applyModificationProcedure(originalCode: string, modificationProcedure: string, languageId: string) {
  let currentCode = originalCode;
  let lines = modificationProcedure.split("\n");
  let storedArg: string[] = [];
  let currentCommand: string = "";
  let currentArg: string[] = [];

  function finishLastCommand() {
    console.log(`finishLastCommand: ${currentCommand} ${currentArg.join("\n")}`);
    if (currentCommand.startsWith("REPLACE_ALL")) {
      let consolidatedContent = currentArg.join("\n");
      let innerContent = consolidatedContent.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      currentCode = innerContent;
    } else if (currentCommand.startsWith("MODIFY_OTHER")) {
      console.log(`MODIFY_OTHER: ${currentArg.join("\n")}`);
      let commentContent = currentArg.join("\n");
      currentCode = getCommentForLanguage(languageId, commentContent) + "\n" + currentCode;
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
    } else if (currentCommand.startsWith("END_REPLACE_ALL")) {
      // Do nothing
    } else if (currentCommand.startsWith("END_MODIFY_OTHER")) {
      // Do nothing
    }

    currentArg = [];
  }

  for (let line of lines) {
    let isANewCommand = false;

    if (currentCommand.startsWith("INSERT")) {
      isANewCommand = line.startsWith("BEFORE");
    } else if (currentCommand.startsWith("REPLACE") && !currentCommand.startsWith("REPLACE_ALL")) {
      isANewCommand = line.startsWith("WITH");
    } else if (currentCommand.startsWith("MODIFY_OTHER")) {
      isANewCommand = line.startsWith("END_MODIFY_OTHER");
    } else if (currentCommand.startsWith("REPLACE_ALL")) {
      isANewCommand = line.startsWith("END_REPLACE_ALL");
    } else if (currentCommand.startsWith("WITH")) {
      isANewCommand =
        line.startsWith("END_REPLACE") ||
        line.startsWith("REPLACE_ALL") ||
        line.startsWith("REPLACE") ||
        line.startsWith("RENAME") ||
        line.startsWith("INSERT");
    } else {
      isANewCommand = line.startsWith("REPLACE_ALL") || line.startsWith("REPLACE") || line.startsWith("RENAME") || line.startsWith("INSERT") || line.startsWith("MODIFY_OTHER");
    }

    console.log(`isANewCommand: ${isANewCommand} currentCommand: ${currentCommand} line: ${line}`);

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
  minionTask.contentAfterApply = document.getText();
  minionTask.appendToLog(`Applied modification as plain top comments\n\n`);
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

    minionTask.originalContent = document.getText();

    let preprocessedContent = canAddComment(document.languageId) ? `${minionTask.originalContent}\n\n${getCommentForLanguage(document.languageId, `Recently applied task: ${minionTask.userQuery}`)}` : minionTask.originalContent;

    let modifiedContent = applyModificationProcedure(
      preprocessedContent,
      minionTask.modificationProcedure,
      document.languageId
    );

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

    minionTask.executionStage = APPLIED_STAGE_NAME;
    minionTask.contentAfterApply = document.getText();
    minionTask.appendToLog(`Applied changes for user review.\n\n`);
    minionTask.onChanged(true);

    vscode.window.showInformationMessage(`Modification applied successfully.`);
  } catch (error) {
    console.log(`Failed to apply modification: ${String(error)}`);
    applyFallback(minionTask);
  }
}
