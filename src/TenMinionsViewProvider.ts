import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { AnalyticsManager } from "./AnalyticsManager";
import { CommandHistoryManager } from "./CommandHistoryManager";
import { MinionTasksManager } from "./MinionTasksManager";
import { findNewPositionForOldSelection } from "./utils/findNewPositionForOldSelection";
import { MessageToVSCode, MessageToVSCodeType, MessageToWebView, MessageToWebViewType } from "./Messages";

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

  // Add an event listener for visibility change
  webviewView.onDidChangeVisibility(() => this.updateSidebarVisibility(webviewView.visible));

  // Adding an event listener for when the active text editor selection changes
  vscode.window.onDidChangeTextEditorSelection(() => this.handleSelectionChange());

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
          type: MessageToWebViewType.ApiKeySet,
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
          value: !!vscode.workspace.getConfiguration("10minions").get("enableCompletionSounds"),
        });
      }

      if (e.affectsConfiguration("10minions.sendDiagnosticsData")) {
        AnalyticsManager.instance.reportEvent(
          "setSendDiagnosticsData",
          {
            value: !!vscode.workspace.getConfiguration("10minions").get("sendDiagnosticsData"),
          },
          true
        ); // Force send even if just disabled
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
      type: MessageToWebViewType.ClearAndFocusOnInput,
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

  timeoutRef?: NodeJS.Timeout;

private handleSelectionChange() {
  const activeEditor = vscode.window.activeTextEditor;
  const selectedText = activeEditor?.document.getText(activeEditor.selection) || "";

  // Clear previous timeout before setting a new one
  if (this.timeoutRef) {
    clearTimeout(this.timeoutRef);
  }

  // Set a new timeout for 1 second and fire postMessageToVsCode if uninterrupted
  this.timeoutRef = setTimeout(() => {
    postMessageToWebView(this._view, {
      type: MessageToWebViewType.ChosenCodeUpdated,
      code: selectedText ? selectedText : (activeEditor?.document.getText() || ""),
    });
  }, 1000);
}

private updateSidebarVisibility(visible: boolean) {
  postMessageToWebView(this._view, {
    type: MessageToWebViewType.UpdateSidebarVisibility,
    value: visible,
  });
}

  async handleWebviewMessage(data: MessageToVSCode) {
    console.log("CMD", data);
    const activeEditor = vscode.window.activeTextEditor;

    switch (data.type) {
      case MessageToVSCodeType.GetTokenCount: {
        let tokenCount = activeEditor ? encode(activeEditor.document.getText()).length : 0;

        postMessageToWebView(this._view, {
          type: MessageToWebViewType.TokenCount,
          value: tokenCount,
        });

        break;
      }
      case MessageToVSCodeType.NewMinionTask: {
        let prompt = data.value ? data.value : "Refactor this code";

        await this.commandHistoryManager.updateCommandHistory(prompt);

        this.executionsManager.runMinionOnCurrentSelectionAndEditor(prompt);
        break;
      }
      case MessageToVSCodeType.OpenDocument: {
        this.executionsManager.openDocument(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.OpenSelection: {
        let minionTask = this.executionsManager.getExecutionById(data.minionTaskId);

        if (minionTask) {
          const document = await minionTask.document();
          const editor = await vscode.window.showTextDocument(document);
          editor.selection = await findNewPositionForOldSelection(minionTask.selection, minionTask.selectedText, document);

          // Reveal the range of the selected text in the editor
          editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        } else {
          vscode.window.showErrorMessage(`Minion task not found.`);
        }
        break;
      }
      case MessageToVSCodeType.OpenLog: {
        this.executionsManager.openLog(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.ShowDiff: {
        this.executionsManager.showDiff(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.MarkAsApplied: {
        this.executionsManager.markAsApplied(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.ApplyAndReviewTask: {
        this.executionsManager.applyAndReviewTask(data.minionTaskId, data.reapply);
        break;
      }
      case MessageToVSCodeType.ReRunExecution: {
        this.executionsManager.reRunExecution(data.minionTaskId, data.newUserQuery);
        break;
      }
      case MessageToVSCodeType.StopExecution: {
        this.executionsManager.stopExecution(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.GetSuggestions: {
        const input = data.input || "";
        const activeEditor = vscode.window.activeTextEditor;
        const code = (activeEditor?.selection.isEmpty ? activeEditor?.document.getText() : activeEditor?.document.getText(activeEditor?.selection)) || ""
        
        this.commandHistoryManager.getCommandSuggestionGPT(
          input,
          code,
          activeEditor?.document.languageId || ""
        );

        break;
      }
      case MessageToVSCodeType.CloseExecution: {
        let minionTaskId = data.minionTaskId;
        this.executionsManager.closeExecution(minionTaskId);
        break;
      }
      case MessageToVSCodeType.ReadyForMessages: {
        postMessageToWebView(this._view, {
          type: MessageToWebViewType.ApiKeySet,
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

/*
Recently applied task: Fix this error:

Identifier expected.
Line: 177 Column: 31
*/
