import * as vscode from 'vscode';

export function extractExecutionIdFromUri(uri: vscode.Uri): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return uri.path.match(/^minionTaskId\/([a-z\d\-]+)\/.*/)![1];
}
