import * as vscode from "vscode";

export function closeAllTmpEditorsFor(document: vscode.TextDocument) {
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.uri.toString() === document.uri.toString()) {
      saveAndCloseDocument(document);
      break;
    }
  }
}

async function saveAndCloseDocument(document: vscode.TextDocument) {
  await vscode.window.showTextDocument(document);

  await document.save();
  await vscode.workspace.fs.delete(document.uri);
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
}
