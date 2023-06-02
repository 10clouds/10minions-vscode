import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { ExecutionInfo } from "./ExecutionInfo";
import { GPTExecution } from "./GPTExecution";
import { createWorkingdocument } from "./createWorkingdocument";

export class CodeMindViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codemind.chatView";

  private executions: { [fileUri: string]: GPTExecution } = {};
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    // set options for the webview, allow scripts
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // set the HTML for the webview
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // add an event listener for messages received by the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      console.log("CMD", data);
      const activeEditor = vscode.window.activeTextEditor;

      switch (data.type) {
        case "getTokenCount": {
          let tokenCount = activeEditor
            ? encode(activeEditor.document.getText()).length
            : 0;

          this._view?.webview.postMessage({
            type: "tokenCount",
            value: tokenCount,
          });

          break;
        }
        case "newExecution": {
          let prompt = data.value ? data.value : "Refactor this code";

          this.executeFullGPTProcedure(prompt);
          break;
        }
        case "openDocument": {
          //if it's open and focused close it
          if (
            activeEditor &&
            activeEditor.document.uri.toString() === data.documentURI
          ) {
            vscode.commands.executeCommand(
              "workbench.action.closeActiveEditor"
            );
          } else {
            let documentURI = vscode.Uri.parse(data.documentURI);
            await vscode.workspace.openTextDocument(documentURI);
            await vscode.window.showTextDocument(documentURI);
          }

          break;
        }
        case "stopExecution": {
          let executionId = data.executionId;
          let execution = Object.values(this.executions).find(
            (e) => e.id === executionId
          );

          if (execution) {
            execution.stopExecution("Canceled by user");
          } else {
            console.error("No execution found for id", executionId);
          }

          break;
        }
        case "closeExecution": {
          let executionId = data.executionId;

          let execution = Object.values(this.executions).find(
            (e) => e.id === executionId
          );

          if (execution) {
            delete this.executions[execution.documentURI];
          } else {
            vscode.window.showErrorMessage(
              "No execution found for id",
              executionId
            );
          }

          //notify webview
          this.notifyExecutionsUpdated();

          break;
        }
      }
    });
  }

  notifyExecutionsUpdated() {
    let executionInfo: ExecutionInfo[] = Object.values(this.executions).map(
      (e) => ({
        id: e.id,
        fullContent: e.fullContent,
        userQuery: e.userQuery,
        executionStage: e.executionStage,
        documentName: e.baseName,
        documentURI: e.documentURI,
        logFileURI: e.workingDocumentURI,
        progress: e.progress,
        stopped: e.stopped,
      })
    );

    this._view?.webview.postMessage({
      type: "executionsUpdated",
      executions: executionInfo,
    });
  }

  async clearAndfocusOnInput() {
    //make sure that our extension bar is visible
    if (!this._view) {
      await vscode.commands.executeCommand("codemind.chatView.focus");
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
      await vscode.commands.executeCommand("codemind.chatView.focus");
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
      vscode.window.showErrorMessage(
        "Please open a file before running CodeMind"
      );
      return;
    }

    if (activeEditor.document.fileName.endsWith(".log")) {
      vscode.window.showErrorMessage(
        "Please open a file before running CodeMind"
      );
      return;
    }

    if (this.executions[activeEditor.document.uri.toString()]) {
      vscode.window.showErrorMessage(
        "I'm already working on this file."
      );
      return;
    }
    

    const document = activeEditor.document;
    const workingDocument = await createWorkingdocument(document.fileName);
    const execution = new GPTExecution({
      fullContent: document.getText(),
      documentURI: document.uri.toString(),
      workingDocumentURI: workingDocument.uri.toString(),
      userQuery,
      selection: activeEditor.selection,
      selectedText: document.getText(activeEditor.selection),
      onStopped: () => {
        this._view?.webview.postMessage({
          type: "executionStopped",
        });
      },
      onChanged: () => {
        this.notifyExecutionsUpdated();
      },
    });

    this.executions[execution.documentURI] = execution;
    this.notifyExecutionsUpdated();

    await execution.run();
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <base href="${webview.asWebviewUri(this._extensionUri)}/">
      <script src="${webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "resources", "tailwind.min.js")
      )}"></script>
    </head>
    <body>
      <div id="root"></div>
      <script src="${webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, "dist", "sideBar.js")
      )}"></script>
    </body>
    </html>`;
  }
}
