import { encode } from "gpt-tokenizer";
import * as vscode from "vscode";
import { generateCode } from "./generateCode";

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
          let tokenCount = encode(await this.fullPrompt(prompt)).length;

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

  public async fullPrompt(prompt: string) {
    let selectedText = await getSelectedText();
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return "";
    }
    const document = activeEditor.document;
    const content = document.getText();

    let showSelectedText = selectedText.length > 0 && selectedText !== content;

    let contextSections = `
===== CODE ====
${selectedText}

===== CONTEXT OF A FILE THE CODE IS IN (${document.fileName}) ====
${content}
`.trim();

    if (!showSelectedText) {
      contextSections = `
===== CODE ====
${content}
`.trim();
    }

    let finalPrompt = `${prompt}\n\n${contextSections}`;

    console.log("finalPrompt", finalPrompt);
    return finalPrompt;
  }



  public async executeGPT(prompt: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const document = activeEditor.document;
    const fullPrompt = await this.fullPrompt(prompt);

    const newDocument = await createNewDocument(document);
    await showDocumentComparison(newDocument, document);

    generateCode(fullPrompt, newDocument);
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
