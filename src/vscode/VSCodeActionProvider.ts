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
      VSCodeActionProvider.providedCodeActionKinds[0],
    );
    action.command = {
      command: '10minions.fixError',
      title: 'Let AI fix this',
      arguments: [uri, diagnostic],
    };
    action.diagnostics = [diagnostic];
    return action;
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
    return context.diagnostics
      .filter(() => this.canFixDiagnostic())
      .map((diagnostic) =>
        this.createCommandCodeAction(diagnostic, document.uri),
      );
  }

  private canFixDiagnostic(): boolean {
    return true;
  }
}
