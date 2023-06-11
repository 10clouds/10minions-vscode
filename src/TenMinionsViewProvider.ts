import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { CommandHistoryManager } from "./CommandHistoryManager";
import { MinionTasksManager } from "./MinionTasksManager";
import { MessageToVSCode, MessageToWebView } from "./Messages";
import { AnalyticsManager } from "./AnalyticsManager";

export function postMessageToWebView(view: vscode.WebviewView | undefined, message: MessageToWebView) {
  return view?.webview.postMessage(message);
}

export class TenMinionsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "10minions.sideBar";

  private _view?: vscode.WebviewView;
  private commandHistoryManager: CommandHistoryManager;
  private executionsManager: MinionTasksManager;
  private analyticsManager: AnalyticsManager;

  constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this.commandHistoryManager = new CommandHistoryManager(context);
    this.executionsManager = new MinionTasksManager(context);
    this.analyticsManager = new AnalyticsManager(context);
  }

  public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    this._view = webviewView;

    this.commandHistoryManager.updateView(webviewView);
    this.executionsManager.updateView(webviewView);

    // set options for the webview, allow scripts
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // set the HTML for the webview
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // add an event listener for messages received by the webview
    webviewView.webview.onDidReceiveMessage(async (data: MessageToVSCode) => await this.handleWebviewMessage(data));

    //post message with update to set api key, each time appropriate config is updated
    vscode.workspace.onDidChangeConfiguration((e) => {
      console.log(`Changed`);
      if (e.affectsConfiguration("10minions.apiKey")) {
        postMessageToWebView(this._view, {
          type: "apiKeySet",
          value: !!vscode.workspace.getConfiguration("10minions").get("apiKey"),
        });

        if (vscode.workspace.getConfiguration("10minions").get("apiKey")) {
          AnalyticsManager.instance.reportEvent("setOpenAIApiKey");
        } else {
          AnalyticsManager.instance.reportEvent("unsetOpenAIApiKey");
        }
      }

      if (e.affectsConfiguration("10minions.enableCompletionSounds")) {
        AnalyticsManager.instance.reportEvent("setEnableCompletionSounds", { 
          value: !!vscode.workspace.getConfiguration("10minions").get("enableCompletionSounds")
        });
      }

      if (e.affectsConfiguration("10minions.sendDiagnosticsData")) {
        AnalyticsManager.instance.reportEvent("setSendDiagnosticsData", { 
          value: !!vscode.workspace.getConfiguration("10minions").get("sendDiagnosticsData")
        }, true); // Force send even if just disabled
      }
    });
  }

  async clearAndfocusOnInput() {
    //make sure that our extension bar is visible
    if (!this._view) {
      await vscode.commands.executeCommand("10minions.chatView.focus");
    } else {
      this._view?.show?.(true);
    }

    postMessageToWebView(this._view, {
      type: "clearAndfocusOnInput",
    });
  }

  async preFillPrompt(prompt: string) {
    //make sure that our extension bar is visible
    if (!this._view) {
      await vscode.commands.executeCommand("10minions.chatView.focus");
    } else {
      this._view?.show?.(true);
    }

    this.executionsManager.runMinionOnCurrentSelectionAndEditor(prompt);
  }

  async handleWebviewMessage(data: MessageToVSCode) {
    console.log("CMD", data);
    const activeEditor = vscode.window.activeTextEditor;

    switch (data.type) {
      case "getTokenCount": {
        let tokenCount = activeEditor ? encode(activeEditor.document.getText()).length : 0;

        postMessageToWebView(this._view, {
          type: "tokenCount",
          value: tokenCount,
        });

        break;
      }
      case "newExecution": {
        let prompt = data.value ? data.value : "Refactor this code";

        await this.commandHistoryManager.updateCommandHistory(prompt);

        this.executionsManager.runMinionOnCurrentSelectionAndEditor(prompt);
        break;
      }
      case "openDocument": {
        this.executionsManager.openDocument(data.minionTaskId);
        break;
      }
      case "openLog": {
        this.executionsManager.openLog(data.minionTaskId);
        break;
      }
      case "showDiff": {
        this.executionsManager.showDiff(data.minionTaskId);
        break;
      }
      case "applyAndReviewTask": {
        this.executionsManager.applyAndReviewTask(data.minionTaskId);
        break;
      }
      case "reRunExecution": {
        this.executionsManager.reRunExecution(data.minionTaskId, data.newUserQuery);
        break;
      }
      case "forceExecution":
        this.executionsManager.forceExecution(data.minionTaskId);
        break;
      case "stopExecution": {
        this.executionsManager.stopExecution(data.minionTaskId);
        break;
      }
      case "getSuggestions": {
        const input = data.input || "";
        const suggestion = this.commandHistoryManager.getCommandSuggestion(input);
        console.log(`Suggestion: ${suggestion}`);
        postMessageToWebView(this._view, {
          type: "suggestion",
          value: suggestion,
        });
        break;
      }
      case "closeExecution": {
        let minionTaskId = data.minionTaskId;
        this.executionsManager.closeExecution(minionTaskId);
        break;
      }
      case "readyForMessages": {
        postMessageToWebView(this._view, {
          type: "apiKeySet",
          value: !!vscode.workspace.getConfiguration("10minions").get("apiKey"),
        });

        //update initial executions
        this.executionsManager.notifyExecutionsUpdatedImmediate();

        break;
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <base href="${webview.asWebviewUri(this._extensionUri)}/">
      <script src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "resources", "tailwind.min.js"))}"></script>
      <link rel="stylesheet" href="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "resources", "global.css"))}" />
    </head>
    <body>
      <div id="root"></div>
      <script src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist", "sideBar.js"))}"></script>
    </body>
    </html>`;
  }
}
