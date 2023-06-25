import { getCommentForLanguage } from "./comments";
import { fuzzyReplaceTextInner } from "./fuzzyReplaceText";

type CommandSegment = {
  name: string;
  params?: string[];
  followedBy?: CommandSegment[];
  execute?: (currentContent: string, languageId: string, params: { [key: string]: string }) => string;
};

let COMMAND_STRUCTURE: CommandSegment[] = [
  {
    name: "REPLACE",
    followedBy: [
      {
        name: "WITH",
        followedBy: [
          {
            name: "END_REPLACE",
            execute: (currentContent, languageId, params) => {
              let findText = params.REPLACE.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
              let withText = params.WITH.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
              let replacementArray = fuzzyReplaceTextInner({ currentCode: currentContent, findText, withText });
              if (replacementArray === undefined || replacementArray.length !== 3) {
                throw new Error(`Could not find:\n${findText}`);
              }

              return replacementArray.join("");
            },
          },
        ],
      },
    ],
  },

  {
    name: "REPLACE_ALL",
    followedBy: [
      {
        name: "END_REPLACE_ALL",
        execute: (currentContent, languageId, params) => {
          return params.REPLACE_ALL.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
        },
      },
    ],
  },
  {
    name: "INSERT",
    followedBy: [
      {
        name: "BEFORE",
        followedBy: [
          {
            name: "END_INSERT",
            execute: (currentContent, languageId, params) => {
              let beforeText = params.BEFORE.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
              let insertText = params.INSERT.replace(/^(?:(?!```).)*```[^\n]*\n(.*?)\n```(?:(?!```).)*$/s, "$1");
              let replacementArray = fuzzyReplaceTextInner({ currentCode: currentContent, findText: beforeText, withText: `${insertText}\n${beforeText}` });
              if (replacementArray === undefined || replacementArray.length !== 3) {
                throw new Error(`Could not find:\n${beforeText}`);
              }

              return replacementArray.join("");
            },
          },
        ],
      },
    ],
  },

  {
    name: "MODIFY_OTHER",
    followedBy: [
      {
        name: "END_MODIFY_OTHER",
        execute: (currentContent, languageId, params) => {
          return getCommentForLanguage(languageId, params.MODIFY_OTHER) + "\n" + currentContent;
        },
      },
    ],
  },

  {
    name: "RENAME",
    params: ["from", "to"],
    followedBy: [
      {
        name: "END_RENAME",
        execute: (currentContent, languageId, params) => {
          let context = params.RENAME.trim();

          return currentContent;

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
        },
      },
    ],
  },
];

export async function applyModificationProcedure(originalCode: string, modificationProcedure: string, languageId: string) {
  let currentCode = originalCode;
  let lines = modificationProcedure.split("\n");
  let inCommand: CommandSegment | undefined;
  let params: { [key: string]: string } = {};

  function newCommand(command: CommandSegment, basedOnLine: string) {
    inCommand = command;

    let lineWithoutCommand = basedOnLine.substring(inCommand.name.length).trim();
    let readParams = lineWithoutCommand.split(" ");
    for (let paramName of inCommand.params || []) {
      params[paramName] = readParams.shift() || "";
    }

    if (inCommand.execute) {
      currentCode = inCommand.execute(currentCode, languageId, params);
    }

    if (!inCommand.followedBy || inCommand.followedBy.length === 0) {
      inCommand = undefined;
      params = {};
    } else {
      params[inCommand.name] = "";
    }
  }

  for await (let line of lines) {
    await new Promise(resolve => setTimeout(resolve, 1));
  
    let possibiltiies: CommandSegment[] = inCommand ? inCommand.followedBy || [] : COMMAND_STRUCTURE;
    let possibleNextCommands = possibiltiies.filter((command) => line.startsWith(command.name));
  
    if (possibleNextCommands.length === 0) {
      if (inCommand) {
        let outOfOrderNewCommands = COMMAND_STRUCTURE.filter((command) => line.startsWith(command.name));
  
        if (outOfOrderNewCommands.length > 0) {
          let outOfOrderNewCommand = outOfOrderNewCommands.sort((a, b) => a.name.length - b.name.length)[0];
          let findEnd = inCommand.followedBy?.find((followedBy) => followedBy.name.startsWith("END_") && followedBy.execute);
  
          if (findEnd) {
            currentCode = findEnd.execute!(currentCode, languageId, params);
            inCommand = undefined;
            params = {};
          } else {
            throw new Error(`Missing any of: ${(inCommand.followedBy || []).map((c) => c.name).join(", ")}`);
          }
  
          newCommand(outOfOrderNewCommand, line);
        } else {
          params[inCommand.name] += (params[inCommand.name] ? "\n" : "") + line;
        }
        continue;
      }
    }
  
    if (possibleNextCommands.length > 0) {
      newCommand(possibleNextCommands.sort((a, b) => a.name.length - b.name.length)[0], line);
    }
  }

  if (inCommand) {
    throw new Error(`Missing any of: ${(inCommand.followedBy || []).map((c) => c.name).join(", ")}`);
  }

  if (originalCode === currentCode) {
    throw new Error("No procedure");
  }

  return currentCode;
}
