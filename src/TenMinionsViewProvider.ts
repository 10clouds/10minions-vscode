import { randomUUID } from "crypto";
import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { ExecutionInfo } from "./ui/ExecutionInfo";
import { GPTExecution } from "./GPTExecution";
import { createWorkingdocument } from "./utils/createWorkingdocument";

export class TenMinionsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "10minions.chatView";

  private executions: GPTExecution[] = [];
  private _view?: vscode.WebviewView;

  private readonly _context: vscode.ExtensionContext;

  constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._context = context;
  }

  private commandHistory: Record<string, { weight: number; timeStamp: number }> = {};

  private getCommandSuggestions(input: string) {
    if (!input) return "";

    const ONE_DAY = 24 * 60 * 60 * 1000;

    const suggestions = Object.keys(this.commandHistory)
      .filter((command) => command.toLowerCase().startsWith(input.toLowerCase()))
      .map((command) => {
        const { weight, timeStamp } = this.commandHistory[command];
        const daysOld = Math.floor((Date.now() - timeStamp) / ONE_DAY);
        return { command, weight: weight - daysOld, originalCommand: command };
      })
      .sort((a, b) => b.weight - a.weight);

    if (suggestions.length === 0) return "";

    // Concatenate the input and the rest of the matched command, preserving the input's original case
    const matchedCommand = suggestions[0].originalCommand;
    const inputLength = input.length;
    return input + matchedCommand.slice(inputLength);
  }

  public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    this.commandHistory = this._context.globalState.get("10minions.commandHistory") || {
      "Refactor this": { weight: 0, timeStamp: Date.now() },
      "Explain": { weight: 0, timeStamp: Date.now() },
      "Make it pretty": { weight: 0, timeStamp: Date.now() },
      "Rename this to something sensible": { weight: 0, timeStamp: Date.now() },
      "Are there any bugs? Fix them": { weight: 0, timeStamp: Date.now() },
      "Rework this so now it also does X": { weight: 0, timeStamp: Date.now() },
    };
    this._view = webviewView;

    // set options for the webview, allow scripts
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const extractTextKey = (uri: vscode.Uri): string => uri.path.match(/^text\/([a-z\d\-]+)/)![1];

    const self = this;

    class ContentProvider implements vscode.TextDocumentContentProvider {
      constructor() {}

      provideTextDocumentContent(uri: vscode.Uri): string {
        console.log("CONTENT", uri);
        const textKey = extractTextKey(uri);
        const originalContent = self.executions.find((e) => e.id === textKey)?.fullContent;
        return originalContent || "";
      }
    }

    vscode.workspace.registerTextDocumentContentProvider("10minions", new ContentProvider());

    // set the HTML for the webview
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // add an event listener for messages received by the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      console.log("CMD", data);
      const activeEditor = vscode.window.activeTextEditor;

      switch (data.type) {
        case "getTokenCount": {
          let tokenCount = activeEditor ? encode(activeEditor.document.getText()).length : 0;

          this._view?.webview.postMessage({
            type: "tokenCount",
            value: tokenCount,
          });

          break;
        }
        case "newExecution": {
          let prompt = data.value ? data.value : "Refactor this code";

          // Update command history
          const newCommandHistory = { ...this.commandHistory };
          if (newCommandHistory[prompt]) {
            newCommandHistory[prompt].weight += 1;
          } else {
            newCommandHistory[prompt] = { weight: 1, timeStamp: Date.now() };
          }

          this.commandHistory = newCommandHistory;
          await this._context.globalState.update("10minions.commandHistory", newCommandHistory);

          this.executeFullGPTProcedure(prompt);
          break;
        }
        case "openDocument": {
          //if it's open and focused close it

          let documentURI = vscode.Uri.parse(data.documentURI);
          await vscode.workspace.openTextDocument(documentURI);
          await vscode.window.showTextDocument(documentURI);

          break;
        }
        case "showDiff": {
          let executionId = data.executionId;
          let execution = this.executions.find((e) => e.id === executionId);

          if (execution) {
            const makeUriString = (textKey: string): string => `10minions:text/${textKey}?_ts=${Date.now()}`; // `_ts` to avoid cache

            await vscode.commands.executeCommand(
              "vscode.diff",
              vscode.Uri.parse(makeUriString(executionId)),
              vscode.Uri.parse(execution.documentURI),
              `(original) ↔ (generated)`
            );
          }
          break;
        }
        case "reRunExecution": {
          let executionId = data.executionId;
          let execution = this.executions.find((e) => e.id === executionId);

          if (execution) {
            if (!execution.stopped) {
              vscode.window.showErrorMessage("Execution is still running", executionId);
              break;
            }

            execution.stopped = false;
            execution.userQuery = data.newUserQuery || execution.userQuery;
            this.notifyExecutionsUpdatedImmediate();

            await execution.run();
          } else {
            vscode.window.showErrorMessage("No execution found for id", executionId);
          }

          break;
        }

        case "stopExecution": {
          let executionId = data.executionId;
          let execution = this.executions.find((e) => e.id === executionId);

          if (execution) {
            execution.stopExecution("Canceled by user");
          } else {
            console.error("No execution found for id", executionId);
          }

          break;
        }
        case "getSuggestions": {
          const input = data.input || "";
          const suggestion = this.getCommandSuggestions(input);
          console.log(`Suggestion: ${suggestion}`);
          this._view?.webview.postMessage({
            type: "suggestion",
            value: suggestion,
          });
          break;
        }
        case "closeExecution": {
          let executionId = data.executionId;

          let execution = this.executions.find((e) => e.id === executionId);

          if (execution) {
            execution.stopExecution("Canceled by user", false);
            this.executions = this.executions.filter((e) => e.id !== executionId);
          } else {
            vscode.window.showErrorMessage("No execution found for id", executionId);
          }

          //notify webview
          this.notifyExecutionsUpdatedImmediate();

          break;
        }
        case "readyForMessages" : {
          // Post the apiKeySet message when the event fires.
          this._view?.webview.postMessage({
            type: "apiKeySet",
            value: !!vscode.workspace.getConfiguration("10minions").get("apiKey"),
          });
          console.log(`Sent`);
          return;
        }
      }
    });

    //post message with update to set api key, each time appropriate config is updated
    vscode.workspace.onDidChangeConfiguration((e) => {
      console.log(`Changed`);
      if (e.affectsConfiguration("10minions.apiKey")) {
        this._view?.webview.postMessage({
          type: "apiKeySet",
          value: !!vscode.workspace.getConfiguration("10minions").get("apiKey"),
        });
      }
    });
  }

  private _isThrottled = false;
  private _pendingUpdate = false;

  notifyExecutionsUpdated() {
    if (this._isThrottled) {
      this._pendingUpdate = true;
      return;
    }

    this._isThrottled = true;
    this.notifyExecutionsUpdatedImmediate();

    setTimeout(() => {
      this._isThrottled = false;
      if (this._pendingUpdate) this.notifyExecutionsUpdatedImmediate();
      this._pendingUpdate = false;
    }, 500);
  }

  notifyExecutionsUpdatedImmediate() {
    const executionInfo: ExecutionInfo[] = this.executions.map((e) => ({
      id: e.id,
      fullContent: e.fullContent,
      userQuery: e.userQuery,
      executionStage: e.executionStage,
      documentName: e.baseName,
      documentURI: e.documentURI,
      logFileURI: e.workingDocumentURI,
      progress: e.progress,
      stopped: e.stopped,
      classification: e.classification,
      modificationDescription: e.modificationDescription,
    }));

    this._view?.webview.postMessage({
      type: "executionsUpdated",
      executions: executionInfo,
    });
  }

  async clearAndfocusOnInput() {
    //make sure that our extension bar is visible
    if (!this._view) {
      await vscode.commands.executeCommand("10minions.chatView.focus");
    } else {
      this._view?.show?.(true);
    }

    this._view?.webview.postMessage({
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

    this._view?.webview.postMessage({
      type: "preFillPrompt",
      value: prompt,
    });
  }

  public async executeFullGPTProcedure(userQuery: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage("Please open a file before running 10Minions");
      return;
    }

    if (activeEditor.document.fileName.endsWith(".log")) {
      vscode.window.showErrorMessage("Please open a file before running 10Minions");
      return;
    }

    const document = activeEditor.document;
    const executionId = randomUUID();
    const workingDocument = await createWorkingdocument(executionId);

    const execution = new GPTExecution({
      id: executionId,
      documentURI: document.uri.toString(),
      workingDocumentURI: workingDocument.uri.toString(),
      userQuery,
      selection: activeEditor.selection,
      selectedText: document.getText(activeEditor.selection),
      onChanged: (important) => {
        if (important) {
          this.notifyExecutionsUpdatedImmediate();
        } else {
          this.notifyExecutionsUpdated();
        }
      },
    });

    this.executions = [execution, ...this.executions];
    this.notifyExecutionsUpdatedImmediate();

    await execution.run();
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
