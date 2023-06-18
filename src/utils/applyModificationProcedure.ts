import { getCommentForLanguage } from "./comments";
import { fuzzyReplaceTextInner } from "./fuzzyReplaceText";

export function applyModificationProcedure(originalCode: string, modificationProcedure: string, languageId: string, recentTaskComment: string = "") {

  let currentCode = originalCode;
  let lines = modificationProcedure.split("\n");
  let storedArg: string[] = [];
  let currentCommand: string = "";
  let currentArg: string[] = [];
  let firstEditApplied = recentTaskComment ? false : true;

  function finishLastCommand() {
    console.log(`finishLastCommand: ${currentCommand} ${currentArg.join("\n")}`);
    if (currentCommand.startsWith("REPLACE_ALL")) {
      let consolidatedContent = currentArg.join("\n");
      let innerContent = consolidatedContent.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      currentCode = innerContent;
      if (!firstEditApplied) {
        currentCode = getCommentForLanguage(languageId, recentTaskComment) + "\n" + currentCode;
        firstEditApplied = true;
      }
    } else if (currentCommand.startsWith("MODIFY_OTHER")) {
      console.log(`MODIFY_OTHER: ${currentArg.join("\n")}`);
      let commentContent = currentArg.join("\n");
      currentCode = getCommentForLanguage(languageId, commentContent) + "\n" + currentCode;
      if (!firstEditApplied) {
        currentCode = getCommentForLanguage(languageId, recentTaskComment) + "\n" + currentCode;
        firstEditApplied = true;
      }
    } else if (currentCommand.startsWith("REPLACE")) {
      storedArg = currentArg;
    } else if (currentCommand.startsWith("INSERT")) {
      storedArg = currentArg;
    } else if (currentCommand.startsWith("WITH")) {
      let replaceText = storedArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      let withText = currentArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");

      let replacementArray = fuzzyReplaceTextInner({ currentCode, replaceText, withText });

      if (replacementArray === undefined || replacementArray.length !== 3) {
        throw new Error(
          `
Could not find:
${replaceText}
`.trim()
        );
      }

      if (!firstEditApplied) {
        currentCode = [replacementArray[0], getCommentForLanguage(languageId, recentTaskComment) + "\n", replacementArray[1], replacementArray[2]].join("");
        console.log('APPLY MINION TASK', [replacementArray[0], getCommentForLanguage(languageId, recentTaskComment) + "\n", replacementArray[1], replacementArray[2]]);
        firstEditApplied = true;
      } else {
        currentCode = replacementArray.join("");
      }

      storedArg = [];
    } else if (currentCommand.startsWith("BEFORE")) {
      let insertText = storedArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
      let beforeText = currentArg.join("\n").replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");

      let replacementArray = fuzzyReplaceTextInner({ currentCode, replaceText: beforeText, withText: `${insertText}\n${beforeText}` });

      if (replacementArray === undefined || replacementArray.length !== 3) {
        throw new Error(
          `
Could not find:
${beforeText}
`.trim()
        );
      }

      if (!firstEditApplied) {
        currentCode = [replacementArray[0], getCommentForLanguage(languageId, recentTaskComment) + "\n", replacementArray[1], replacementArray[2]].join("");
        firstEditApplied = true;
      } else {
        currentCode = replacementArray.join("");
      }

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
