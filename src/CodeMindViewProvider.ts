import * as AsyncLock from "async-lock";

import { randomUUID } from "crypto";
import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { AICursor } from "./AICursor";
import { MappedContent, mapFileContents } from "./MappedContent";
import { applyModification } from "./applyModification";
import { processLine } from "./processLine";
import { planAndWrite } from "./planAndWrite";

export const editorLock = new AsyncLock();

export class CodeMindViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codemind.chatView";
  runningExecutionId: string = "";
  document: vscode.TextDocument | undefined;
  aiCursor = new AICursor();

  private _view?: vscode.WebviewView;

  // In the constructor, we store the URI of the extension
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
        case "prompt": {
          this.executeFullGPTProcedure(data.value);
          break;
        }
        case "stopExecution": {
          this.stopExecution();
          break;
        }
      }
    });
  }

  public stopExecution() {
    this.runningExecutionId = "";
    if (this.document) {
      this.aiCursor.selection = undefined;
      this.document = undefined;
    }
    this._view?.webview.postMessage({
      type: "executionStopped",
    });
  }

  public async executeFullGPTProcedure(userQuery: string) {
    const executionId = randomUUID();

    this.runningExecutionId = executionId;

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    this.document = activeEditor.document;
    this.aiCursor.setDocument(activeEditor.document, activeEditor.selection);

    if (!this.document) {
      return;
    }

    let selectedText = activeEditor.document.getText(activeEditor.selection);
    let fullFileContent = this.document.getText();

    let mappedContent: MappedContent = mapFileContents(fullFileContent);

    if (
      activeEditor.selection.start.line !== activeEditor.selection.end.line ||
      activeEditor.selection.start.character !==
        activeEditor.selection.end.character
    ) {
      this.aiCursor.selection = activeEditor.selection;
    } else {
      this.aiCursor.selection = new vscode.Selection(
        new vscode.Position(0, 0),
        new vscode.Position(0, 0)
      );
    }

    let buffer = "";
    const onChunk = async (chunk: string) => {
      if (executionId !== this.runningExecutionId) {
        return;
      }
      buffer += chunk;

      while (buffer.includes("\n")) {
        if (!buffer.includes("\n")) {
          return;
        }

        let line = buffer.substring(0, buffer.indexOf("\n") + 1);

        await processLine(this.aiCursor, line, mappedContent).catch((e) => {
          console.error(e);
          this.stopExecution();
        });

        buffer = buffer.substring(buffer.indexOf("\n") + 1);
      }
    };

    let modification = await planAndWrite(
      userQuery,
      this.aiCursor.selection?.start || new vscode.Position(0, 0),
      selectedText,
      fullFileContent,
      async (chunk: string) => {}
    );

    await applyModification(
      modification,
      this.aiCursor.selection?.start || new vscode.Position(0, 0),
      selectedText,
      mappedContent,
      onChunk
    );

    if (buffer.length > 0) {
      await processLine(this.aiCursor, buffer, mappedContent).catch((e) => {
        console.error(e);
        this.stopExecution();
      });
    }

    this.aiCursor.position = undefined;
    this.stopExecution();
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
