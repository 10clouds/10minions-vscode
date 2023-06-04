import * as vscode from "vscode";
import { CodeMindViewProvider } from "./CodeMindViewProvider";
import { initPlayingSounds } from "./utils/playSound";

class MyCodeActionProvider implements vscode.CodeActionProvider {
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
      "👨‍🍳 Fix with CodeChef AI",
      MyCodeActionProvider.providedCodeActionKinds[0]
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
      .map((diagnostic) =>
        this.createCommandCodeAction(diagnostic, document.uri)
      );
  }

  private canFixDiagnostic(diagnostic: vscode.Diagnostic): boolean {
    return true;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("CodeMind is now active");

  //Code actions
  initPlayingSounds(context);

  const diagnostics = vscode.languages.createDiagnosticCollection("codemind");
  context.subscriptions.push(diagnostics);

  const fixCommandId = "codemind.fixError";
  context.subscriptions.push(
    vscode.commands.registerCommand(
      fixCommandId,
      (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => {
        let range = diagnostic.range;
        let start = range.start;
        let line = start.line;
        let column = start.character;
        let message = diagnostic.message;
        let lineAndColumn = `Line: ${line} Column: ${column}`;

        provider.preFillPrompt(
          `Fix this error:\n\n${message}\n${lineAndColumn}`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: "file" },
      new MyCodeActionProvider(fixCommandId),
      {
        providedCodeActionKinds: MyCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  const provider = new CodeMindViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand("codemind.setApiKey", async () => {
      try {
        const apiKey = await vscode.window.showInputBox({
          prompt: "Enter your OpenAI API key",
          value: "",
        });

        if (apiKey) {
          vscode.workspace
            .getConfiguration("codemind")
            .update("apiKey", apiKey, true);
        }
      } catch (e) {
        console.error(e);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CodeMindViewProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("codemind.ask", async () => {
      await provider.clearAndfocusOnInput();
    })
  );
}

export function deactivate() {}
