import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { GPTExecution } from "./GPTExecution";
import { CANCELED_STAGE_NAME, ExecutionInfo } from "./ui/ExecutionInfo";
import { basename } from "path";

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
      .filter((command) => command.toLowerCase().startsWith(input.toLowerCase()) && command.toLowerCase() !== input.toLowerCase())
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

  private async updateCommandHistory(prompt: string) {
    // Update command history
    const newCommandHistory = { ...this.commandHistory };
    if (newCommandHistory[prompt]) {
      newCommandHistory[prompt].weight += 1;
    } else {
      newCommandHistory[prompt] = { weight: 1, timeStamp: Date.now() };
    }

    this.commandHistory = newCommandHistory;
    await this._context.globalState.update("10minions.commandHistory", newCommandHistory);
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

          await this.updateCommandHistory(prompt);

          this.runMinionOnCurrentSelectionAndEditor(prompt);
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
            const makeUriString = (textKey: string): string => `10minions:text/${textKey}`; // `_ts` to avoid cache

            const documentUri = vscode.Uri.parse(execution.documentURI);
            await vscode.commands.executeCommand(
              "vscode.diff",
              vscode.Uri.parse(makeUriString(executionId)),
              documentUri,
              `(original) ↔ ${basename(documentUri.fsPath)}`
            );
          }
          break;
        }
        case "reRunExecution": {
          let executionId = data.executionId;
          let oldExecutionMaybe = this.executions.find((e) => e.id === executionId);

          if (!oldExecutionMaybe) {
            vscode.window.showErrorMessage("No execution found for id", executionId);
            throw new Error(`No execution found for id ${executionId}`);
          }

          let oldExecution = oldExecutionMaybe;

          if (!oldExecution.stopped) {
            vscode.window.showErrorMessage("Execution is still running", executionId);
            break;
          }

          //remove old execution
          this.executions = this.executions.filter((e) => e.id !== executionId);

          //after 1 second add a new one
          setTimeout(async () => {
            let newExecution = await GPTExecution.create({
              userQuery: data.newUserQuery || oldExecution.userQuery,
              document: await oldExecution.document(),
              selection: oldExecution.selection,
              selectedText: oldExecution.selectedText,
              onChanged: async (important) => {
                if (important) {
                  this.notifyExecutionsUpdatedImmediate();
                } else {
                  this.notifyExecutionsUpdated();
                }
              },
            });

            this.executions = [newExecution, ...this.executions.filter((e) => e.id !== executionId)];

            await newExecution.run();
          }, 1000);

          break;
        }

        case "stopExecution": {
          let executionId = data.executionId;
          let execution = this.executions.find((e) => e.id === executionId);

          if (execution) {
            execution.stopExecution(CANCELED_STAGE_NAME);
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
            execution.stopExecution(CANCELED_STAGE_NAME, false);
            this.executions = this.executions.filter((e) => e.id !== executionId);
          } else {
            vscode.window.showErrorMessage("No execution found for id", executionId);
          }

          //notify webview
          this.notifyExecutionsUpdatedImmediate();

          break;
        }
        case "readyForMessages": {
          this._view?.webview.postMessage({
            type: "apiKeySet",
            value: !!vscode.workspace.getConfiguration("10minions").get("apiKey"),
          });

          break;
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
      selectedText: e.selectedText,
      shortName: e.shortName,
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

    this.runMinionOnCurrentSelectionAndEditor(prompt);
  }

  public async runMinionOnCurrentSelectionAndEditor(userQuery: string) {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
      vscode.window.showErrorMessage("Please open a file before running 10Minions");
      return;
    }

    if (activeEditor.document.fileName.endsWith(".log")) {
      vscode.window.showErrorMessage("Please open a file before running 10Minions");
      return;
    }

    const execution = await GPTExecution.create({
      userQuery,
      document: activeEditor.document,
      selection: activeEditor.selection,
      selectedText: activeEditor.document.getText(activeEditor.selection),
      onChanged: async (important) => {
        if (important) {
          this.notifyExecutionsUpdatedImmediate();
        } else {
          this.notifyExecutionsUpdated();
        }
      },
    });

    this.executions = [execution, ...this.executions];

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
