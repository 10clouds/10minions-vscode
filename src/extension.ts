import fetch, { Response } from "node-fetch";
import * as vscode from "vscode";
import * as AsyncLock from "async-lock";
import { encode } from "gpt-tokenizer";

const editorLock = new AsyncLock();

export function activate(context: vscode.ExtensionContext) {
  console.log("CodeMind is now active");

  const provider = new CodeMindViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand("codemind.setApiKey", async () => {
      try {
        console.log("10clouds-gpt.setApiKey running");

        const apiKey = await vscode.window.showInputBox({
          prompt: "Enter your OpenAI API key",
          value: "",
        });

        if (apiKey) {
          vscode.workspace
            .getConfiguration("codemind")
            .update("apiKey", apiKey, true);
        }
      } catch (e) {
        console.error(e);
      }
    })
  );

  // Register the provider with the extension's context
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CodeMindViewProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );

  const commandHandler = (command: string) => {
    const config = vscode.workspace.getConfiguration("codemind");
    const prompt = config.get(command) as string;
    provider.executeGPT(prompt);
  };

  // Register the commands that can be called from the extension's package.json
  context.subscriptions.push(
    vscode.commands.registerCommand("codemind.ask", () =>
      vscode.window
        .showInputBox({ prompt: "What do you want to do?" })
        .then((value) => provider.executeGPT(value || ""))
    ),
    vscode.commands.registerCommand("codemind.explain", () =>
      commandHandler("promptPrefix.explain")
    ),
    vscode.commands.registerCommand("codemind.refactor", () =>
      commandHandler("promptPrefix.refactor")
    ),
    vscode.commands.registerCommand("codemind.optimize", () =>
      commandHandler("promptPrefix.optimize")
    ),
    vscode.commands.registerCommand("codemind.findProblems", () =>
      commandHandler("promptPrefix.findProblems")
    ),
    vscode.commands.registerCommand("codemind.documentation", () =>
      commandHandler("promptPrefix.documentation")
    )
  );
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

async function showDocumentComparison(
  document: vscode.TextDocument,
  newDocument: vscode.TextDocument
) {
  await vscode.commands.executeCommand(
    "vscode.diff",
    document.uri,
    newDocument.uri,
    "Original → Refactored"
  );
}

async function processResponseStream(
  response: Response,
  newDocument: vscode.TextDocument
) {
  const stream = response.body!;
  const decoder = new TextDecoder("utf-8");

  return await new Promise<void>((resolve, reject) => {
    stream.on("data", async (value) => {
      const chunk = decoder.decode(value);

      const parsedLines = extractParsedLines(chunk);
      const goodContent = parsedLines
        .map((l) => l.choices[0].delta.content)
        .filter((c) => c)
        .join("");

      await updateNewDocument(newDocument, goodContent);
    });

    stream.on("end", () => {
      console.log("end");
      resolve();
    });

    stream.on("error", (err) => {
      console.error("Error: ", err);
      reject(err);
    });
  });
}

function extractParsedLines(chunk: string) {
  const lines = chunk.split("\n");
  return lines
    .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
    .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
    .map((line) => JSON.parse(line));
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

function handleError(error: Error, signal: AbortSignal) {
  if (signal.aborted) {
    console.log("Request aborted.");
  } else {
    console.error("Error:", error);
    console.log("Error occurred while generating.");
  }
}

export function deactivate() {}

class CodeMindViewProvider implements vscode.WebviewViewProvider {
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

  private async fetchResponse(
    apiUrl: string,
    fullPrompt: string,
    signal: AbortSignal
  ) {
    const config = vscode.workspace.getConfiguration("codemind");

    return await fetch(apiUrl, {
      method: "POST",
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Content-Type": "application/json",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: `Bearer ${vscode.workspace
          .getConfiguration("codemind")
          .get("apiKey")}`,
      },
      body: JSON.stringify({
        model: config.get("codemind.model") || "gpt-4",
        messages: [
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        max_tokens: config.get("codemind.maxTokens"),
        stream: true,
      }),
      signal,
    });
  }

  public async executeGPT(prompt: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const document = activeEditor.document;
    const fullPrompt = await this.fullPrompt(prompt);

    const newDocument = await createNewDocument(document);
    await showDocumentComparison(document, newDocument);

    this.generateCode(fullPrompt, newDocument);
  }

  public async generateCode(
    fullPrompt: string,
    newDocument: vscode.TextDocument
  ) {
    const API_URL = "https://api.openai.com/v1/chat/completions";

    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const response = await this.fetchResponse(API_URL, fullPrompt, signal);

      await processResponseStream(response, newDocument);
    } catch (error) {
      handleError(error as Error, signal);
    } finally {
      controller.abort();
    }

    console.log("Finished");
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <base href="${webview.asWebviewUri(this._extensionUri)}/">
      <script src="${webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._extensionUri,
          "resources",
          "tailwind.min.js"
        )
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
