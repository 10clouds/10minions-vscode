import * as vscode from "vscode";
import { VSCodeActionProvider } from "./VSCodeActionProvider";
import { VSViewProvider } from "./VSViewProvider";
import { initPlayingSounds, setCompletionSoundsEnabled } from "../utils/playSound";
import { VSOriginalContentProvider } from "./VSOriginalContentProvider";
import { VSLogProvider } from "./VSLogProvider";
import { AnalyticsManager, getAnalyticsManager } from "../managers/AnalyticsManager";
import { VSCommandHistoryManager } from "./VSCommandHistoryManager";
import { VSMinionTasksManager } from "./VSMinionTasksManager";
import { VSEditorManager } from "./VSEditorManager";
import { getViewProvider } from "../managers/ViewProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("10Minions is now active");

  initPlayingSounds(context.extensionPath);
  
  const analyticsManager = new AnalyticsManager(
    context.globalState.get<string>("10minions.installationId") || "",
    vscode.version,
  );

  analyticsManager.setSendDiagnosticsData(!!vscode.workspace.getConfiguration("10minions").get("sendDiagnosticsData"));

  const originalContentProvider = new VSOriginalContentProvider(context);
  const logProvider = new VSLogProvider(context);
  const viewProvider = new VSViewProvider(context);
  const commandHistoryManager = new VSCommandHistoryManager(context);
  const editorManager = new VSEditorManager(context);
  const executionsManager = new VSMinionTasksManager(context);
  const codeActionProvider = new VSCodeActionProvider(context);
  //const taskAutoRunner = new MinionTaskAutoRunner(context); // Initialized MinionTaskAutoRunner

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("10minions.enableCompletionSounds")) {
        getAnalyticsManager().reportEvent("setEnableCompletionSounds", {
          value: !!vscode.workspace.getConfiguration("10minions").get("enableCompletionSounds"),
        });

        setCompletionSoundsEnabled(!!vscode.workspace.getConfiguration("10minions").get("enableCompletionSounds"));
      }

      if (e.affectsConfiguration("10minions.sendDiagnosticsData")) {
        getAnalyticsManager().reportEvent(
          "setSendDiagnosticsData",
          {
            value: !!vscode.workspace.getConfiguration("10minions").get("sendDiagnosticsData"),
          },
          true
        ); // Force send even if just disabled

        analyticsManager.setSendDiagnosticsData(!!vscode.workspace.getConfiguration("10minions").get("sendDiagnosticsData"));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("10minions.fixError", (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => {
      let range = diagnostic.range;
      let start = range.start;
      let line = start.line;
      let column = start.character;
      let message = diagnostic.message;
      let lineAndColumn = `Line: ${line} Column: ${column}`;

      getViewProvider().preFillPrompt(`Fix this error:\n\n${message}\n${lineAndColumn}`);

      getAnalyticsManager().reportEvent("fixError", {
        message,
        lineAndColumn,
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("10minions.ask", async () => {
      await getViewProvider().clearAndfocusOnInput();
    })
  );
}

export function deactivate() {}
