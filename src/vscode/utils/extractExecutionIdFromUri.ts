import * as vscode from "vscode";

export function extractExecutionIdFromUri(uri: vscode.Uri): string {
  return uri.path.match(/^minionTaskId\/([a-z\d\-]+)\/.*/)![1];
}
