import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { generateFullPrompt, processOpenAIResponseStream, queryOpenAI } from "./generateCode";
import * as AsyncLock from "async-lock";

const editorLock = new AsyncLock();

function handleError(error: Error, signal?: AbortSignal) {
  if (signal?.aborted) {
    console.log("Request aborted.");
  } else {
    console.error("Error:", error);
    console.log("Error occurred while generating.");
  }
}

async function getSelectedText() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  return activeEditor.document.getText(activeEditor.selection);
}

async function createNewDocument(document: vscode.TextDocument) {
  return await vscode.workspace.openTextDocument({
    content: "",
    language: document.languageId,
  });
}


async function updateNewDocument(
  newDocument: vscode.TextDocument,
  content: string
) {
  await editorLock.acquire("streamLock", async () => {
    try {
      console.log(content);
      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        newDocument.uri,
        newDocument.positionAt(newDocument.getText().length),
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
    "Refactored → Original"
  );
}


export class CodeMindViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codemind.chatView";
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

      switch (data.type) {
        case "getTokenCount": {
          let prompt = data.value;
          let tokenCount = encode(await generateFullPrompt(prompt, await getSelectedText())).length;

          this._view?.webview.postMessage({
            type: "tokenCount",
            value: tokenCount,
          });

          break;
        }
        case "prompt": {
          this.executeGPT(data.value);

          break;
        }
      }
    });
  }

  public async executeGPT(prompt: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const document = activeEditor.document;
    const fullPrompt = await generateFullPrompt(prompt, await getSelectedText());

    const newDocument = await createNewDocument(document);
    await showDocumentComparison(newDocument, document);

    try {
      const response = await queryOpenAI(fullPrompt);
  
      await processOpenAIResponseStream(response, (goodContent) => {
        updateNewDocument(newDocument, goodContent);
      }).catch((error) => {
        handleError(error);
      });
    } catch (error) {
      console.error("Error:", error);
    }
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
