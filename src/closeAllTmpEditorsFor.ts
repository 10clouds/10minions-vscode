import * as vscode from "vscode";

export function closeAllTmpEditorsFor(document: vscode.TextDocument) {
  vscode.window.visibleTextEditors.forEach(async (editor) => {
    if (editor.document.uri.toString() === document.uri.toString()) {
      //close editor
      vscode.window
        .showTextDocument(editor.document, {
          preserveFocus: true,
          preview: false,
        })
        .then(async () => {
          await vscode.window.showTextDocument(document);

          await vscode.commands.executeCommand("workbench.action.files.save");

          await vscode.workspace.fs.delete(document.uri);

          // close the active editor (which is now the one we want to close)
          await vscode.commands.executeCommand(
            "workbench.action.closeActiveEditor"
          );
        });
    }
  });
}
