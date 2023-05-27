import * as AsyncLock from "async-lock";

import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import {
  ContextData,
  createFixedCodeUsingPrompt,
  translateUserQuery
} from "./gpt";
import path = require("path");
import { randomUUID } from "crypto";

const editorLock = new AsyncLock();

function handleError(error: Error, signal?: AbortSignal) {
  if (signal?.aborted) {
    console.log("Request aborted.");
  } else {
    console.error("Error:", error);
    console.log("Error occurred while generating.");
  }
}

async function createNewDocument(document: vscode.TextDocument) {
  return await vscode.workspace.openTextDocument({
    content: "",
    language: document.languageId,
  });
}

async function updateNewDocument(
  newDocument: vscode.TextDocument,
  position: vscode.Position,
  content: string,
) {
  return await editorLock.acquire("streamLock", async () => {
    try {
      console.log(content);
      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        newDocument.uri,
        position,
        content
      );
      await vscode.workspace.applyEdit(edit).then(
        (value) => {},
        (reason) => {
          console.log("REASON", reason);
        }
      );
    } catch (e) {
      console.error("ERRROR", e);
    }

    //return new injection point
    let character = content.split("\n").length > 1 ? content.split("\n")[content.split("\n").length - 1].length : position.character + content.length;
    return new vscode.Position(position.line + content.split("\n").length - 1, character);
  });
}

async function showDocumentComparison(
  document: vscode.TextDocument,
  newDocument: vscode.TextDocument
) {
  await vscode.commands.executeCommand(
    "vscode.diff",
    document.uri,
    newDocument.uri,
    "GPT → " + path.basename(newDocument.fileName)
  );
}

export class CodeMindViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codemind.chatView";
  runningExecutionId: string = "";
  private _view?: vscode.WebviewView;

  // In the constructor, we store the URI of the extension
  constructor(private readonly _extensionUri: vscode.Uri) {
    
  }

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
          let prompt = data.value;
          let tokenCount = activeEditor ? encode(
            activeEditor.document.getText() + "\n" + prompt
          ).length : 0;

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

    const document = activeEditor.document;

    const context: ContextData = {
      selectedText: activeEditor.document.getText(activeEditor.selection),
      fileName: document.fileName,
      fullFileContent: document.getText(),
    };

    let injectionPoint = (activeEditor.selection.start.line !== activeEditor.selection.end.line || activeEditor.selection.start.character !== activeEditor.selection.end.character) ? activeEditor.selection.start : new vscode.Position(0, 0);

    //const newDocument = await createNewDocument(document);
    //await showDocumentComparison(newDocument, document);

    let line = "";
    let previouslyAddedText = "";
    const onChunk = async (chunk: string) => {
      if (executionId !== this.runningExecutionId) {
        return;
      }
      line += chunk;

      while (line.includes("\n")) {

        //check whenever we are still just after the previously added text in the document
        let offset = document.offsetAt(injectionPoint);
        if (document.getText().substring(offset - previouslyAddedText.length, offset) !== previouslyAddedText) {
          console.log(`INJECTION POINT DISRUPTED "${previouslyAddedText}" "${document.getText().substring(offset - previouslyAddedText.length, offset)}"`);

          //find all indexes of previously added text
          let indexes = [];
          let i = -1;
          while ((i = document.getText().indexOf(previouslyAddedText, i + 1)) >= 0) {
            indexes.push(i);
          }

          console.log("INDEXES", indexes);

          //get the one which is the closest to the current offset
          let newOffset = indexes.reduce((prev, curr) => {
            return (Math.abs(curr - offset) < Math.abs(prev - offset) ? curr : prev);
          }, -10000000);

          if (newOffset === -10000000) {
            console.log(`ERROR: INJECTION POINT NOT FOUND "${previouslyAddedText}"`);
            if (executionId === this.runningExecutionId) {
              this.stopExecution();
            }
            return;
          }

          injectionPoint = new vscode.Position(document.positionAt(newOffset).line, document.positionAt(newOffset).character + previouslyAddedText.length);
        }

        previouslyAddedText = line.substring(0, line.indexOf("\n") + 1);
        injectionPoint = await updateNewDocument(document, injectionPoint, previouslyAddedText);
        line = line.substring(line.indexOf("\n") + 1);
      }
    };

    injectionPoint = await updateNewDocument(document, injectionPoint, "/*\n");
    await updateNewDocument(document, injectionPoint, "\n*/\n");

    let { prompt } = await translateUserQuery(userQuery, context, onChunk);

    onChunk("\n\n================\n\n");

    await createFixedCodeUsingPrompt(userQuery, prompt, context, onChunk);

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

