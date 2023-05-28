/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { AICursor } from "./AICursor";
import { MappedContent } from "./MappedContent";
import { editDocument } from "./editDocument";

import * as ts from 'typescript';

function getDeclarationRange(sourceCode: string, identifier: string): ts.TextRange | undefined {
  const sourceFile = ts.createSourceFile('temp.ts', sourceCode, ts.ScriptTarget.Latest, true);

  function findDeclaration(node: ts.Node): ts.Node | undefined {
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      const declarationName = node.name?.getText();
      if (declarationName === identifier) {
        return node;
      }
    }

    return ts.forEachChild(node, findDeclaration);
  }

  const declarationNode = findDeclaration(sourceFile);
  if (declarationNode) {
    const { pos, end } = declarationNode;
    const { line: startLine, character: startCharacter } = sourceFile.getLineAndCharacterOfPosition(pos);
    const { line: endLine, character: endCharacter } = sourceFile.getLineAndCharacterOfPosition(end);
    return {
      pos,
      end,
    };
  }

  return undefined;
}

export const COMMANDS = {
  /*"#UP": {
    description: "#UP - move the cursor up one line (clears selection)",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      if (aiCursor.position === undefined) {
        throw new Error("Position is not set");
      }

      let newPosition = aiCursor.position.line > 0 ? aiCursor.position.translate(-1, 0) : aiCursor.position;

      if (newPosition) {
        aiCursor.position = newPosition;
      }
    },
  },*/

  /*"#DOWN": {
    description: "#DOWN - move the cursor down one line (clears selection)",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      if (aiCursor.position === undefined) {
        throw new Error("Position is not set");
      }
      if (aiCursor.document === undefined) {
        throw new Error("Document is not set");
      }

      let newPosition = aiCursor.position.line < aiCursor.document.lineCount - 1 ? aiCursor.position.translate(+1, 0) : aiCursor.position;

      if (newPosition) {
        aiCursor.position = newPosition;
      }
    },
  },*/

  /*"#HOME": {
    description: "#HOME - move the cursor to the beginning of the line",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      if (aiCursor.position === undefined) {
        throw new Error("Position is not set");
      }

      aiCursor.position = new vscode.Position(aiCursor.position.line, 0);
    },
  },*/

  /*"#END": {
    description: "#END - move the cursor to the end of the line",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      if (aiCursor.document === undefined) { 
        throw new Error("Document is not set");
      }

      if (aiCursor.position === undefined) {
        throw new Error("Position is not set");
      }

      let actualLine = aiCursor.document.lineAt(aiCursor.position.line);

      aiCursor.position = new vscode.Position(
        aiCursor.position.line,
        actualLine.text.length
      );
    },
  },*/

  /*"#IN-COMMENT": { 
    description: "#IN-COMMENT - create a comment block at the current cursor position and move the cursor inside it, so if you output text it will be inside the comment. It creates 3 lines in total, the first and last line are the comment delimiters, and the middle line is empty.",

    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      if (aiCursor.isInComment) {
        console.log("Already in comment");
        return;
      }
      
      if (aiCursor.position === undefined) {
        throw new Error("Position is not set");
      }

      await editDocument(async (edit) => {
        if (aiCursor.document === undefined) { 
          throw new Error("Document is not set");
        }
  
        if (aiCursor.position === undefined) {
          throw new Error("Position is not set");
        }

        edit.insert(
          aiCursor.document.uri,
          new vscode.Position(aiCursor.position.line, 0),
          `/*\n\n*\/\n`
        );
      });

      aiCursor.position = new vscode.Position(aiCursor.position.line - 1, 0);
    },
  },*/

  /*"#MESSAGE": {
    description: "#MESSAGE <text> - output the text to a user as a toast message, use this to avoid syntax errors and unnecessary comments in the resulting CODE.",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      let message = command.split(" ").slice(1).join(" ").trim();
      vscode.window.showInformationMessage(message);
    },
  },*/

  /*"#DELETE-ONE-LINE": {
    description: "#DELETE-ONE-LINE <line id> - delete the contents of the specified line (by line id), and move the cursor to the beginning of the next line after the deleted one, the remaining line ids ill not be affected.",

    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      let lineSegments = command.split(" ");

      if (lineSegments.length < 2 || lineSegments[1].trim() === "" || lineSegments.length > 2) {
        throw new Error(`Invalid command: ${command}`);
      }

      let startLineId = lineSegments[1].trim();

      COMMANDS["#DELETE-LINES"].execute(aiCursor, `#DELETE-LINES ${startLineId} ${startLineId}`, mappedContent);
    },
  },*/

  /*"#DELETE-LINES": {
    description: "#DELETE-LINES <start line id> <end line id> - delete all the contents of the lines between the start and end lines, including both of them. The remaining line ids ill not be affected. Use this to delete blocks of rewriten code / comments.",

    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      if (aiCursor.document === undefined) { 
        throw new Error("Document is not set");
      }

      let lineSegments = command.split(" ");

      let startLineId = lineSegments.length > 1 ? lineSegments[1].trim() : "";
      let endLineId = lineSegments.length > 2 ? lineSegments[2].trim() : "";

      if (startLineId === "" || endLineId === "") {
        throw new Error(`Invalid command: ${command}`);
      }

      let possiblyStartLineToDelete = indentifyLine(startLineId, aiCursor.document, mappedContent);
      let possiblyEndLineToDelete = indentifyLine(endLineId, aiCursor.document, mappedContent);

      if (possiblyStartLineToDelete === undefined) {
        throw new Error(`Line with id ${startLineId} not found`);
      }

      if (possiblyEndLineToDelete === undefined) {
        throw new Error(`Line with id ${endLineId} not found`);
      }

      let startLineToDelete = possiblyStartLineToDelete;
      let endLineToDelete = possiblyEndLineToDelete;

      let lineToDeletePosition = new vscode.Position(startLineToDelete, 0);
      let lineToDeleteEndPosition = new vscode.Position(endLineToDelete + 1, 0);

      editDocument(async (edit) => {
        if (aiCursor.document === undefined) { 
          throw new Error("Document is not set");
        }

        edit.delete(
          aiCursor.document.uri,
          new vscode.Range(lineToDeletePosition, lineToDeleteEndPosition)
        );
      });

      aiCursor.position = lineToDeletePosition;
    },
  },*/

  "#DELETE": {
    description: "#DELETE - press the delete button, which, if something is selected, erases it, or erases the character before the cursor.",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      editDocument(async (edit) => {
        if (aiCursor.document === undefined) {
          throw new Error("Document is not set");
        }

        if (aiCursor.selection) {
          edit.delete(aiCursor.document.uri, aiCursor.selection);

          aiCursor.position = aiCursor.selection.start;
        } else {
          if (aiCursor.position === undefined) {
            throw new Error("Position is not set");
          }

          let newPosition = aiCursor.position.translate(0, -1);

          if (newPosition) {
            edit.delete(aiCursor.document.uri, new vscode.Range(newPosition, aiCursor.position));
          }

          aiCursor.position = newPosition;
          aiCursor.selection = new vscode.Selection(aiCursor.position, aiCursor.position);
        }
      });
    },
  },

  "#DESELECT": {
    description: "#DESELECT - clear the current selection, so you can continue writing from the current cursor position, which after the just cleared selection.",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      if (aiCursor.selection) {
        aiCursor.position = aiCursor.selection.end;
      }
    },
  },

  "#TOGGLE-COMMENT": {
    description: "#TOGGLE-COMMENT <additional info> - toggle the comment block on the current selection, if nothing is selected toggle comment on the line at the current position of the cursor. You can use it to comment old code that you just provided an implmentation for.",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      let additionalInfo = command.split(" ").slice(1).join(" ").trim();

      //write additional info as a comment

      if (additionalInfo !== "") {
        editDocument(async (edit) => {
          if (aiCursor.document === undefined) {
            throw new Error("Document is not set");
          }

          if (aiCursor.position === undefined) {
            throw new Error("Position is not set");
          }

          edit.insert(
            aiCursor.document.uri,
            aiCursor.position,
            `// ${additionalInfo}\n`
          );
        });
      } else {
        if (aiCursor.document === undefined) {
          throw new Error("Document is not set");
        }
  
        //use vscode toggle comment block command 
  
        if (aiCursor.selection) {
          await vscode.commands.executeCommand('editor.action.blockComment', {
            "selection": new vscode.Range(
                aiCursor.selection.start,
                aiCursor.selection.end,
            )
          });
        } else {
          if (aiCursor.position === undefined) {
            throw new Error("Position is not set");
          }
  
          await vscode.commands.executeCommand('editor.action.commentLine', {
            "selection": new vscode.Range(
                aiCursor.position,
                aiCursor.position,
            )
          });
        }
      }
    },
  },

  "#SELECT-IDENTIFIER": {
    description: "#SELECT-IDENTIFIER <identifier> - select the identifier, related declaration and body. This is useful if followed by for example #DELETE, in order to remove old function implementation stricly by providing the name of it. Keep in mind that if you write something without deselecting, it will replace the current selection.",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      let identifier = command.split(" ").slice(1).join(" ").trim();

      if (aiCursor.document === undefined) {
        throw new Error("Document is not set");
      }

      if (aiCursor.position === undefined) {
        throw new Error("Position is not set");
      }

      let sourceCode = aiCursor.document.getText();

      let declarationRange = getDeclarationRange(sourceCode, identifier);

      if (declarationRange) {
        aiCursor.selection = new vscode.Selection(
          aiCursor.document.positionAt(declarationRange.pos),
          aiCursor.document.positionAt(declarationRange.end),
        );
      }
    }
  },
  
  "#SELECT-TEXT": {
    description: "#SELECT-TEXT <plain text> - find the nearest specified plain text in the CODE, and select it. If any text is typed without #DESELECT, the current selection will be replaced.",

    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      editDocument(async (edit) => {
        let searchText = command.split(" ").slice(1).join(" ").trim();

        if (aiCursor.document === undefined) {
          throw new Error("Document is not set");
        }

        if (aiCursor.position === undefined) {
          throw new Error("Position is not set");
        }

        let line = aiCursor.document.lineAt(aiCursor.position.line);
        let lineText = line.text;

        //find all all search indexes in the document
        let allIndicesOfText = [];

        let currentIndex = lineText.indexOf(searchText);
        while (currentIndex !== -1) {
          allIndicesOfText.push(currentIndex);
          currentIndex = lineText.indexOf(searchText, currentIndex + 1);
        }
        
        if (allIndicesOfText.length === 0) {
          throw new Error(`Text ${searchText} not found`);
        }

        //find nearest search result to our current position
        let currentPosition = aiCursor.document.offsetAt(aiCursor.position);
        let indexOfText = allIndicesOfText.reduce((prev, curr) => {
          return Math.abs(curr - currentPosition) < Math.abs(prev - currentPosition) ? curr : prev;
        });

        let startPosition = new vscode.Position(
          aiCursor.position.line,
          indexOfText
        );

        let endPosition = new vscode.Position(
          aiCursor.position.line,
          indexOfText + searchText.length
        );

        aiCursor.selection = new vscode.Selection(startPosition, endPosition);
      });
    },
  },

  /*"#DELETE-TEXT": {
    description: "#DELETE-TEXT <plain ext> - find and delete the nearest instance of text, cursor will be set in place of the removed text, so you can continue writing from there as this would replace the previous text.",

    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      editDocument(async (edit) => {
        let searchText = command.split(" ").slice(1).join(" ").trim();

        if (aiCursor.document === undefined) {
          throw new Error("Document is not set");
        }

        if (aiCursor.position === undefined) {
          throw new Error("Position is not set");
        }

        let line = aiCursor.document.lineAt(aiCursor.position.line);
        let lineText = line.text;

        //find all all search indexes in the document
        let allIndicesOfText = [];

        let currentIndex = lineText.indexOf(searchText);
        while (currentIndex !== -1) {
          allIndicesOfText.push(currentIndex);
          currentIndex = lineText.indexOf(searchText, currentIndex + 1);
        }
        
        if (allIndicesOfText.length === 0) {
          throw new Error(`Text ${searchText} not found`);
        }

        //find nearest search result to our current position
        let currentPosition = aiCursor.document.offsetAt(aiCursor.position);
        let indexOfText = allIndicesOfText.reduce((prev, curr) => {
          return Math.abs(curr - currentPosition) < Math.abs(prev - currentPosition) ? curr : prev;
        });

        let startPosition = new vscode.Position(
          aiCursor.position.line,
          indexOfText
        );

        let endPosition = new vscode.Position(
          aiCursor.position.line,
          indexOfText + searchText.length
        );

        edit.delete(aiCursor.document.uri, new vscode.Range(startPosition, endPosition));
          
        aiCursor.position = startPosition;
      });
    },
  },*/

  /*"#GO-TO-BEGINING-OF-LINE": {
    description: "#GO-TO-BEGINING-OF-LINE <line id> - move the cursor to the begining of a specified line  (by line id). This is useful to write comments and code in specific places. It's not nessesary for deleting lines.",
    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      let lineId = command.split(" ")[1].trim();

      if (!aiCursor.document) {
        throw new Error("Document is not set");
      }

      if (lineId) {
        let lineToGoTo = indentifyLine(lineId, aiCursor.document, mappedContent);

        if (lineToGoTo) {
          aiCursor.position = new vscode.Position(lineToGoTo, 0);
        }
      } else {
        if (aiCursor.position === undefined) {
          throw new Error("Position is not set");
        }
  
        aiCursor.position = new vscode.Position(aiCursor.position.line, 0);
      }
    },
  },*/

  /*"#GO-TO-TEXT": {
    description: "#GO-TO-TEXT <plain text> - find the nearest occurence of the text and move the cursor to the beginning of it.",

    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      editDocument(async (edit) => {
        let searchText = command.split(" ").slice(1).join(" ").trim();

        if (aiCursor.document === undefined) {
          throw new Error("Document is not set");
        }

        if (aiCursor.position === undefined) {
          throw new Error("Position is not set");
        }

        let line = aiCursor.document.lineAt(aiCursor.position.line);
        let lineText = line.text;

        //find all all search indexes in the document
        let allIndicesOfText = [];

        let currentIndex = lineText.indexOf(searchText);
        while (currentIndex !== -1) {
          allIndicesOfText.push(currentIndex);
          currentIndex = lineText.indexOf(searchText, currentIndex + 1);
        }
        
        if (allIndicesOfText.length === 0) {
          throw new Error(`Text ${searchText} not found`);
        }

        //find nearest search result to our current position
        let currentPosition = aiCursor.document.offsetAt(aiCursor.position);
        let indexOfText = allIndicesOfText.reduce((prev, curr) => {
          return Math.abs(curr - currentPosition) < Math.abs(prev - currentPosition) ? curr : prev;
        });

        aiCursor.position = new vscode.Position(
          aiCursor.position.line,
          indexOfText
        );
      });
    },
  },*/

  /*"#GO-TO-AFTER-TEXT": {
    description:
      "#GO-TO-AFTER-TEXT <plain text> - find the nearest occurence of the text and move the cursor to the beginning of the next line after it. For multiline you can use '\n' character to specify the line break.",

    execute: async (aiCursor: AICursor, command: string, mappedContent: MappedContent) => {
      editDocument(async (edit) => {
        let searchText = command.split(" ").slice(1).join(" ").trim();

        if (aiCursor.document === undefined) {
          throw new Error("Document is not set");
        }

        if (aiCursor.position === undefined) {
          throw new Error("Position is not set");
        }

        let line = aiCursor.document.lineAt(aiCursor.position.line);
        let lineText = line.text;

        //find all all search indexes in the document
        let allIndicesOfText = [];

        //if search text starts and ends with ' or " strip them
        if (searchText.startsWith("'") && searchText.endsWith("'")) {
          searchText = searchText.substring(1, searchText.length - 1);
        }

        if (searchText.startsWith('"') && searchText.endsWith('"')) {
          searchText = searchText.substring(1, searchText.length - 1);
        }

        searchText = searchText.replace(/\\n/g, "\n");
        
        let currentIndex = lineText.indexOf(searchText);
        while (currentIndex !== -1) {
          allIndicesOfText.push(currentIndex);
          currentIndex = lineText.indexOf(searchText, currentIndex + 1);
        }
        
        if (allIndicesOfText.length === 0) {
          throw new Error(`Text ${searchText} not found`);
        }

        //find nearest search result to our current position
        let currentPosition = aiCursor.document.offsetAt(aiCursor.position);
        let indexOfText = allIndicesOfText.reduce((prev, curr) => {
          return Math.abs(curr - currentPosition) < Math.abs(prev - currentPosition) ? curr : prev;
        });

        aiCursor.position = new vscode.Position(
          aiCursor.position.line,
          indexOfText + searchText.length
        );
      });
    },
  },*/
};
