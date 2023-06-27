import * as vscode from "vscode";
import { fuzzyFindText } from "../../strategies/utils/fuzzyReplaceText";
import { EditorDocument, EditorRange } from "../../managers/EditorManager";

export async function findNewPositionForOldSelection(selection: EditorRange, selectedText: string, document: EditorDocument) {
  let { lineStartIndex, lineEndIndex, confidence } = await fuzzyFindText({ currentCode: document.getText(), findText: selectedText });

  console.log(`confidence: ${confidence} ${lineStartIndex} ${lineEndIndex}`);
  if (confidence > 0.5) {
    const startPos = new vscode.Position(lineStartIndex, 0);
    const endPos = new vscode.Position(Math.max(0, lineEndIndex - 1), document.lineAt(Math.max(0, lineEndIndex - 1)).text.length);
    return new vscode.Selection(startPos, endPos);
  } else {
    return selection;
  }
}
