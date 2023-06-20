import * as vscode from "vscode";
import { VSCodeAnalyticsManager } from "./vscode/VSCodeAnalyticsManager";
import { VSCodeActionProvider } from "./vscode/VSCodeActionProvider";
import { VSViewProvider } from "./vscode/VSViewProvider";
import { initPlayingSounds } from "./utils/playSound";
import { VSOriginalContentProvider } from "./vscode/VSOriginalContentProvider";
import { VSLogProvider } from "./vscode/VSLogProvider";
import { getAnalyticsManager } from "./managers/AnalyticsManager";
import { VSCommandHistoryManager } from "./vscode/VSCommandHistoryManager";
import { VSMinionTasksManager } from "./vscode/VSMinionTasksManager";
import { VSEditorManager } from "./vscode/VSEditorManager";
import { getViewProvider } from "./managers/ViewProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("10Minions is now active");

  initPlayingSounds(context);

  const originalContentProvider = new VSOriginalContentProvider(context);
  const logProvider = new VSLogProvider(context);
  const viewProvider = new VSViewProvider(context);
  const commandHistoryManager = new VSCommandHistoryManager(context);
  const editorManager = new VSEditorManager(context);
  const executionsManager = new VSMinionTasksManager(context);
  const analyticsManager = new VSCodeAnalyticsManager(context);
  const codeActionProvider = new VSCodeActionProvider(context);
  //const taskAutoRunner = new MinionTaskAutoRunner(context); // Initialized MinionTaskAutoRunner

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "10minions.fixError",
      (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => {
        let range = diagnostic.range;
        let start = range.start;
        let line = start.line;
        let column = start.character;
        let message = diagnostic.message;
        let lineAndColumn = `Line: ${line} Column: ${column}`;

        getViewProvider().preFillPrompt(
          `Fix this error:\n\n${message}\n${lineAndColumn}`
        );

        getAnalyticsManager().reportEvent("fixError", {
          message,
          lineAndColumn,
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("10minions.ask", async () => {
      await getViewProvider().clearAndfocusOnInput();
    })
  );
}

export function deactivate() {}

