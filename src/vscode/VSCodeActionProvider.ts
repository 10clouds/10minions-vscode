import * as vscode from 'vscode';

export class VSCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  constructor(private context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, this, {
        providedCodeActionKinds: VSCodeActionProvider.providedCodeActionKinds,
      }),
    );
  }

  private createCommandCodeAction(
    diagnostic: vscode.Diagnostic,
    uri: vscode.Uri,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Fix with 10Minions',
      vscode.CodeActionKind.QuickFix,
    );
    action.command = {
      command: '10minions.fixError',
      title: 'Let AI fix this',
      arguments: [uri, diagnostic],
    };
    action.isPreferred = false;
    action.diagnostics = [diagnostic];
    return action;
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
    return context.diagnostics
      .filter(
        (diagnostic) =>
          diagnostic.severity === vscode.DiagnosticSeverity.Error ||
          diagnostic.severity === vscode.DiagnosticSeverity.Warning,
      )
      .map((diagnostic) =>
        this.createCommandCodeAction(diagnostic, document.uri),
      );
  }
}
