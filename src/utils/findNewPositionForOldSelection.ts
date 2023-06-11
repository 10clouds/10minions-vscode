import * as vscode from "vscode";
import { fuzzyFindText } from "./fuzzyReplaceText";

export async function findNewPositionForOldSelection(selection: vscode.Selection, selectedText: string, document: vscode.TextDocument) {
  let { lineStartIndex, lineEndIndex, confidence } = fuzzyFindText({ currentCode: document.getText(), findText: selectedText });

  if (confidence > 0.75) {
    const startPos = new vscode.Position(lineStartIndex, 0);
    const endPos = new vscode.Position(lineEndIndex - 1, document.lineAt(lineEndIndex - 1).text.length);
    return new vscode.Selection(startPos, endPos);
  } else {
    return selection;
  }
}
