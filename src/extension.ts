import * as vscode from "vscode";
import { AnalyticsManager } from "./AnalyticsManager";
import { CodeActionProvider } from "./CodeActionProvider";
import { TenMinionsViewProvider } from "./TenMinionsViewProvider";
import { initPlayingSounds } from "./utils/playSound";

export function activate(context: vscode.ExtensionContext) {
  console.log("10Minions is now active");

  initPlayingSounds(context);

  const fixCommandId = "10minions.fixError";
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

        AnalyticsManager.instance.reportEvent("fixError", {
          message,
          lineAndColumn,
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: "file" },
      new CodeActionProvider(fixCommandId),
      {
        providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  const provider = new TenMinionsViewProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TenMinionsViewProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("10minions.ask", async () => {
      await provider.clearAndfocusOnInput();
    })
  );
}

export function deactivate() {}

