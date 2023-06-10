import * as vscode from "vscode";

export class CodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  private fixCommandId: string;

  constructor(fixCommandId: string) {
    this.fixCommandId = fixCommandId;
  }

  private createCommandCodeAction(
    diagnostic: vscode.Diagnostic,
    uri: vscode.Uri
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Fix with 10Minions",
      CodeActionProvider.providedCodeActionKinds[0]
    );
    action.command = {
      command: this.fixCommandId,
      title: "Let AI fix this",
      arguments: [uri, diagnostic],
    };
    action.diagnostics = [diagnostic];
    return action;
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
    return context.diagnostics
      .filter((diagnostic) => this.canFixDiagnostic(diagnostic))
      .map((diagnostic) => this.createCommandCodeAction(diagnostic, document.uri)
      );
  }

  private canFixDiagnostic(diagnostic: vscode.Diagnostic): boolean {
    return true;
  }
}
