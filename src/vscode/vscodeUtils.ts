import { EditorRange, EditorUri } from "../managers/EditorManager";
import * as vscode from "vscode";

export function convertSelection(selection: EditorRange) {
  if (selection instanceof vscode.Selection) {
    return selection;
  }
  
  return new vscode.Selection(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
}

export function convertUri(uri: EditorUri) {
  if (uri instanceof vscode.Uri) {
    return uri;
  }

  return vscode.Uri.parse(uri.toString());
}
