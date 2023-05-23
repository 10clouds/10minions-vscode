import fetch, { Response } from "node-fetch";
import * as vscode from "vscode";
import * as AsyncLock from "async-lock";

const editorLock = new AsyncLock();

type Settings = {
  selectedInsideCodeblock?: boolean;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "10clouds-gpt" is now active!');

  const config = vscode.workspace.getConfiguration("codemind");
  // Create a new CodeGPTViewProvider instance and register it with the extension's context
  const provider = new CodeGPTViewProvider(context.extensionUri);

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

  provider.setSettings({
    selectedInsideCodeblock: config.get("selectedInsideCodeblock") || false,
    maxTokens: config.get("maxTokens") || 1500,
    temperature: config.get("temperature") || 0.5,
    model: config.get("model") || "gpt-4",
  });

  // Register the provider with the extension's context
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CodeGPTViewProvider.viewType,
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
        .join("\n");

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
        (value) => {
          console.log("OK");
        },
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

class CodeGPTViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codemind.chatView";
  private _view?: vscode.WebviewView;

  private _settings: Settings = {
    selectedInsideCodeblock: false,
    maxTokens: 500,
    temperature: 0.5,
  };

  // In the constructor, we store the URI of the extension
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public setSettings(settings: Settings) {
    this._settings = { ...this._settings, ...settings };
  }

  public getSettings() {
    return this._settings;
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
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "codeSelected": {
          let code = data.value;
          //code = code.replace(/([^\\])(\$)([^{0-9])/g, "$1\\$$$3");
          const snippet = new vscode.SnippetString();
          snippet.appendText(code);
          // insert the code as a snippet into the active text editor
          vscode.window.activeTextEditor?.insertSnippet(snippet);
          break;
        }
        case "prompt": {
          this.executeGPT(data.value);
        }
      }
    });
  }

  private async fetchResponse(
    apiUrl: string,
    document: vscode.TextDocument,
    content: string,
    selectedText: string,
    prompt: string,
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
            content: `${prompt}

  ===== CODE ====
  ${selectedText}

  ===== CONTEXT OF A FILE THE CODE IS IN (${document.fileName}) ====
  ${content}`,
          },
        ],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        max_tokens: config.get("codemind.maxTokens"),
        stream: true,
      }),
      signal,
    });
  }

  public async focus() {
    // focus gpt activity from activity bar
    if (!this._view) {
      await vscode.commands.executeCommand("codemind.chatView.focus");
    } else {
      this._view?.show?.(true);
    }

    // Show the view and send a message to the webview with the response
    // if (this._view) {
    // 	this._view.show?.(true);
    // 	this._view.webview.postMessage({ type: 'addResponse', value: response });
    // }
  }

  public async executeGPT(prompt: string) {
    const selectedText = await getSelectedText();

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const document = activeEditor.document;
    const content = document.getText();

    const newDocument = await createNewDocument(document);
    await showDocumentComparison(document, newDocument);

    this.generateCode(document, content, selectedText, prompt, newDocument);
  }

  public async generateCode(
    document: vscode.TextDocument,
    content: string,
    selectedText: string,
    prompt: string,
    newDocument: vscode.TextDocument
  ) {
    const API_URL = "https://api.openai.com/v1/chat/completions";

    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const response = await this.fetchResponse(
        API_URL,
        document,
        content,
        selectedText,
        prompt,
        signal
      );

      await processResponseStream(response, newDocument);
    } catch (error) {
      handleError(error as Error, signal);
    } finally {
      controller.abort();
    }

    console.log("Finished");
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const microlightUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "resources", "microlight.min.js")
    );
    const tailwindUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "resources", "showdown.min.js")
    );
    const showdownUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "resources", "tailwind.min.js")
    );

    const DEFAULT_PROMPT = `You are an expert senior coder with IQ of 200, first provide critique of the code given, and provide a plan for changes and then provide a new version of it.

Your code should be simple, consise, maintainable, readable and ready for production. Rewrite parts of it if needed, but keep the final result and side effects the same. Split and join the functions as needed. Introduce or remove types. You may optimise the code, especially if it will make it more parallelized. You may change the names of the functions and create subroutines. Either provide simple documentation or make the code readable enough that it does not need docs. The code quality and documentation should be on par with top open source projects, as this is a part of a top open source project.`;

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<script src="${tailwindUri}"></script>
				<script src="${showdownUri}"></script>
				<script src="${microlightUri}"></script>
			</head>
			<body class="font-sans leading-normal tracking-normal">
        
        <div class="container mx-auto px-4 py-8">
          <div class="text-center mb-4">
            <img class="w-3/6 mx-auto" src="data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgNTk4LjkgOTUuOSI+PHN0eWxlPi5zdDB7ZmlsbDojZmZmfS5zdDF7ZmlsbDojNWUyMGU1fS5zdDJ7ZmlsbDojMWJmZWMwfTwvc3R5bGU+PHBhdGggY2xhc3M9InN0MCIgZD0iTTE4MS42IDQuMmMwLS43LjMtMS40LjgtMS45czEuMi0uOCAyLjEtLjhoMTIuN2MxLjcgMCAyLjYuOSAyLjcgMi43djczaDM2LjVjLjcgMCAxLjQuMyAxLjkuOHMuOCAxLjIuOCAyLjF2MTEuNGMwIDEuNy0uOSAyLjYtMi43IDIuN2gtNTIuMWMtMS44IDAtMi43LS45LTIuNy0yLjdWNC4yek0yNDMuOSA0OGMwLTQuNC42LTguNiAxLjctMTIuN3MyLjctNy45IDQuOC0xMS40YzIuMS0zLjYgNC42LTYuOCA3LjUtOS43IDIuOS0yLjkgNi4xLTUuNCA5LjYtNy41IDMuNS0yLjEgNy4zLTMuNyAxMS40LTQuOEMyODMgLjggMjg3LjIuMiAyOTEuNi4yYzQuNCAwIDguNi42IDEyLjcgMS43czcuOSAyLjcgMTEuNCA0LjhjMy41IDIuMSA2LjggNC41IDkuNyA3LjVhNDcuNTYyIDQ3LjU2MiAwIDAgMSAxMi4zIDIxLjFjMS4xIDQuMSAxLjcgOC4zIDEuNyAxMi43IDAgNC40LS42IDguNi0xLjcgMTIuN3MtMi43IDcuOC00LjggMTEuM2MtMi4xIDMuNS00LjUgNi43LTcuNSA5LjYtMi45IDIuOS02LjEgNS40LTkuNyA3LjUtMy41IDIuMS03LjMgMy43LTExLjQgNC44LTQuMSAxLjEtOC4zIDEuNy0xMi43IDEuNy00LjQgMC04LjYtLjYtMTIuNy0xLjdzLTcuOC0yLjctMTEuNC00LjhjLTMuNS0yLjEtNi43LTQuNi05LjYtNy41LTIuOS0yLjktNS40LTYuMS03LjUtOS42LTIuMS0zLjUtMy43LTcuMy00LjgtMTEuMy0xLjItNC0xLjctOC4zLTEuNy0xMi43em0xOC41IDBjMCA0LjIuNyA4LjEgMi4yIDExLjhzMy40IDYuOSA2IDkuNmMyLjYgMi43IDUuNiA0LjkgOS4yIDYuNSAzLjUgMS42IDcuNCAyLjQgMTEuNyAyLjQgNC4yIDAgOC4xLS44IDExLjYtMi40IDMuNi0xLjYgNi42LTMuNyA5LjItNi41IDIuNi0yLjcgNC42LTYgNi05LjYgMS41LTMuNyAyLjItNy42IDIuMi0xMS44IDAtNC4yLS43LTguMi0yLjItMTEuOS0xLjUtMy43LTMuNS02LjktNi05LjctMi42LTIuNy01LjYtNC45LTkuMi02LjUtMy42LTEuNi03LjQtMi40LTExLjYtMi40LTQuMiAwLTguMS44LTExLjcgMi40LTMuNSAxLjYtNi42IDMuOC05LjIgNi41LTIuNiAyLjctNC42IDYtNiA5LjctMS41IDMuNy0yLjIgNy43LTIuMiAxMS45em0xMDYuNSA5LjZjMCAyLjkuNSA1LjcgMS40IDguMiAxIDIuNiAyLjMgNC44IDQuMSA2LjggMS43IDEuOSAzLjggMy41IDYuMyA0LjYgMi40IDEuMSA1LjEgMS43IDggMS43IDIuOSAwIDUuNi0uNiA4LTEuNyAyLjQtMS4xIDQuNS0yLjcgNi4yLTQuNiAxLjctMS45IDMuMS00LjIgNC4xLTYuOCAxLTIuNiAxLjQtNS4zIDEuNC04LjJWNC40YzAtLjcuMy0xLjQuOC0xLjkuNi0uNSAxLjMtLjggMi4xLS44aDEyLjNjLjcgMCAxLjUuMiAyLjEuNy43LjUgMSAxLjIgMSAydjUzLjNjMCA1LjItMSAxMC4yLTMgMTQuOC0yIDQuNi00LjcgOC43LTguMiAxMi4xLTMuNSAzLjUtNy41IDYuMi0xMi4xIDguMnMtOS41IDMtMTQuOCAzYy0zLjUgMC02LjktLjUtMTAuMS0xLjQtMy4yLS45LTYuMy0yLjItOS4xLTMuOS0yLjgtMS43LTUuNC0zLjYtNy43LTZzLTQuMy00LjktNi03LjdjLTEuNy0yLjgtMy01LjktMy45LTkuMS0uOS0zLjItMS40LTYuNi0xLjQtMTAuMVY0LjRjMC0uNi4yLTEuMi43LTEuOC41LS42IDEuMS0uOSAxLjktLjloMTNjLjYgMCAxLjIuMyAxLjkuOHMxIDEuMiAxIDEuOXY1My4yek01MjIuNyA0OGMwIDQuNC0uNiA4LjYtMS43IDEyLjZzLTIuNyA3LjctNC44IDExLjFjLTIuMSAzLjQtNC42IDYuNS03LjUgOS4zLTIuOSAyLjgtNi4xIDUuMi05LjYgNy4xLTMuNSAyLTcuMyAzLjUtMTEuNCA0LjUtNC4xIDEuMS04LjMgMS42LTEyLjcgMS42aC0yOC43Yy0uMyAwLS43IDAtMS0uMS0uMyAwLS43LS4xLTEtLjMtLjMtLjItLjYtLjQtLjctLjctLjItLjMtLjMtLjgtLjMtMS40VjQuNmMwLTIuMSAxLTMuMSAzLTMuMUg0NzVjNC40IDAgOC42LjYgMTIuNiAxLjcgNC4xIDEuMSA3LjggMi42IDExLjMgNC42IDMuNSAyIDYuNyA0LjQgOS42IDcuMiAyLjkgMi44IDUuNCA1LjkgNy41IDkuNCAyLjEgMy41IDMuNyA3LjIgNC44IDExLjIgMS4zIDMuOSAxLjkgOCAxLjkgMTIuNHptLTYwLjgtMjkuNnY1OC44aDExLjljNC4yIDAgOC4xLS43IDExLjgtMi4yIDMuNy0xLjQgNi45LTMuNCA5LjYtNiAyLjctMi42IDQuOS01LjcgNi41LTkuMiAxLjYtMy42IDIuNC03LjUgMi40LTExLjggMC00LjMtLjgtOC4yLTIuNC0xMS44LTEuNi0zLjYtMy44LTYuNy02LjUtOS40LTIuNy0yLjYtNi00LjctOS42LTYuMS0zLjctMS41LTcuNi0yLjItMTEuOC0yLjNoLTExLjl6TTU4NSAyNi4zYy0uNSAwLTEtLjEtMS41LS40LS41LS4zLTEtLjYtMS42LTEuMWwtLjEtLjFjLS44LS44LTEuOC0xLjctMy4xLTIuNi0xLjItMS0yLjYtMS44LTQuMi0yLjctMS41LS44LTMuMi0xLjUtNS0yLjEtMS44LS42LTMuNi0uOS01LjQtLjktMi4zIDAtNC40LjMtNi4yLjgtMS44LjUtMy4zIDEuMi00LjUgMi4xLTEuMi45LTIuMSAxLjktMi43IDMuMS0uNiAxLjItLjkgMi41LS45IDMuOSAwIDEuNS41IDIuOCAxLjQgMy45LjkgMS4xIDIuMiAyLjEgMy44IDMgMS42LjkgMy40IDEuNyA1LjUgMi40czQuMyAxLjQgNi41IDIuMWMzLjkgMS4yIDcuOCAyLjUgMTEuNiA0czcuMiAzLjMgMTAuMiA1LjRjMyAyLjEgNS40IDQuNyA3LjMgNy42IDEuOCAzIDIuOCA2LjYgMi44IDEwLjggMCA0LjUtLjkgOC42LTIuNyAxMi4zLTEuOCAzLjctNC40IDYuOC03LjYgOS40LTMuMiAyLjYtNyA0LjYtMTEuMyA2LTQuMyAxLjQtOSAyLjEtMTQgMi4xLTMuMiAwLTYuNC0uNC05LjUtMS4xLTMuMi0uNy02LjItMS44LTkuMS0zLjItMi45LTEuNC01LjctMy04LjMtNS0yLjYtMS45LTQuOS00LjEtNy02LjV2LjFsLS4xLS4yYy0uOS0xLTEuNC0yLTEuNC0yLjkgMC0uOC41LTEuNyAxLjUtMi43bC45LS45IDEuMi0xLjFjLjYtLjUgMS4zLTEuMSAyLTEuOHMxLjQtMS4zIDIuMS0xLjhjLjctLjUgMS40LTEgMi0xLjQuNi0uNCAxLjEtLjYgMS41LS42LjYgMCAxLjEuMiAxLjYuNi41LjQuOS43IDEuMiAxLjFsLjIuMmgtLjFjMS41IDEuNCAzLjEgMi43IDQuOSAzLjkgMS44IDEuMiAzLjcgMi40IDUuNiAzLjMgMS45IDEgMy44IDEuNyA1LjcgMi4zIDEuOS42IDMuNy44IDUuMy44IDIuMyAwIDQuNC0uMyA2LjQtLjkgMi0uNiAzLjctMS40IDUuMi0yLjVzMi42LTIuMyAzLjQtMy44Yy44LTEuNSAxLjItMy4yIDEuMi01IDAtMS44LS41LTMuNC0xLjYtNC43LTEuMS0xLjMtMi41LTIuNS00LjItMy40LTEuNy0xLTMuNy0xLjgtNS45LTIuNXMtNC40LTEuNC02LjYtMmMtNS4xLTEuNS05LjUtMy4yLTEzLjMtNS0zLjgtMS44LTctMy44LTkuNS02cy00LjQtNC43LTUuNy03LjVjLTEuMy0yLjgtMS45LTUuOS0xLjktOS4zIDAtMy45LjgtNy40IDIuMy0xMC42IDEuNi0zLjIgMy44LTUuOSA2LjYtOC4yIDIuOS0yLjMgNi4zLTQgMTAuNC01LjNDNTU0LjUuNiA1NTkgMCA1NjQgMGMzLjggMCA3LjYuNiAxMS41IDEuOCAzLjkgMS4yIDcuNSAyLjggMTAuOSA0LjkgMSAuNiAyIDEuMyAzLjEgMi4xIDEgLjggMiAxLjYgMi45IDIuNC45LjggMS42IDEuNiAyLjIgMi40LjYuOC44IDEuNC44IDIgMCAuNS0uMSAxLjEtLjQgMS41LS4yLjUtLjYuOS0uOSAxLjRsLTEuOSAydi0uMWMtLjYuNy0xLjMgMS40LTEuOSAyLjEtLjcuNy0xLjMgMS4zLTIgMS45LS43LjYtMS4zIDEtMS44IDEuNC0uNy4zLTEuMi41LTEuNS41eiIvPjxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik04MS44LjlDNjMuMi45IDQ3LjIgMTEuNSAzOS40IDI3VjQuNGMwLS44LS4zLTEuNS0uOS0yLS42LS41LTEuMy0uNy0yLjEtLjdIMjFjLTEuNiAwLTMgLjEtNCAuMnMtMi4xLjUtMy4yIDEuMkwyLjcgOS44Qy45IDEwLjggMCAxMi4xIDAgMTMuN1YzMWMwIC44LjIgMS41LjcgMi4xLjQuNiAxIC45IDEuOC45IDAgMCAuNy0uMSAxLjEtLjNsMTEuMS02Ljh2NjVjMCAuNi4yIDEuMi42IDEuOC40LjYgMS4xLjggMi4yLjhoMTljMiAwIDIuOS0uOSAyLjktMi43VjY5LjdjNy44IDE1LjUgMjMuOSAyNi4yIDQyLjQgMjYuMiAyNi4yIDAgNDcuNS0yMS4zIDQ3LjUtNDcuNUMxMjkuMyAyMi4xIDEwOCAuOSA4MS44Ljl6Ii8+PHBhdGggY2xhc3M9InN0MiIgZD0iTTExOC44IDY5LjdjLTIuNi0yLjctNC42LTYtNi05LjYtMS40LTMuNy0yLjItNy42LTIuMi0xMS44IDAtNC4yLjctOC4yIDIuMi0xMS45IDEuNC0zLjcgMy40LTYuOSA2LTkuNyAxLjEtMS4yIDIuMy0yLjIgMy41LTMuMS0zLjEtNS03LjEtOS41LTExLjgtMTMtMS42IDEuMi0zIDIuNS00LjQgMy45YTQ3LjU2MiA0Ny41NjIgMCAwIDAtMTIuMyAyMS4xYy0xLjEgNC4xLTEuNyA4LjMtMS43IDEyLjcgMCA0LjQuNiA4LjYgMS43IDEyLjdzMi43IDcuOCA0LjggMTEuM2MyLjEgMy41IDQuNiA2LjcgNy41IDkuNiAxLjUgMS41IDMuMSAyLjkgNC43IDQuMSA0LjctMy42IDguNi04IDExLjctMTMuMS0xLjMtLjktMi42LTItMy43LTMuMnoiLz48cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTIyLjMgMjMuNmMxLjctMS4zIDMuNi0yLjUgNS43LTMuNCAzLjUtMS42IDcuNC0yLjQgMTEuNy0yLjQgMy40IDAgNi42LjUgOS42IDEuNiAzIDEgNS44IDIuNSA4LjQgNC40LjkuNSAxLjYuNyAyLjIuNi42LS4xIDEuMi0uNiAxLjktMS40bDYtMTAuM2MuNS0uOS41LTEuNy4yLTIuNHMtLjktMS4yLTEuNi0xLjZjLTMuOS0yLjYtOC4xLTQuNi0xMi41LTYtNC40LTEuNC05LjEtMi4xLTE0LjEtMi4xLTQuNCAwLTguNi42LTEyLjcgMS43UzExOS4yIDUgMTE1LjcgN2MtMS44IDEuMS0zLjUgMi4yLTUuMiAzLjUgNC43IDMuNiA4LjcgOCAxMS44IDEzLjF6TTE2OCA4My43bC02LjItMTAuNGMtLjYtLjgtMS4yLTEuMy0xLjgtMS40LS42LS4xLTEuNC4xLTIuMy43LTIuNSAxLjktNS4zIDMuMy04LjQgNC40LTMuMSAxLTYuMyAxLjYtOS43IDEuNi00LjIgMC04LjEtLjgtMTEuNy0yLjQtMi0uOS0zLjgtMi01LjUtMy4yLTMuMSA1LjEtNyA5LjUtMTEuNyAxMy4xIDEuNiAxLjIgMy4yIDIuMyA0LjkgMy4zIDMuNSAyLjEgNy4zIDMuNyAxMS40IDQuOCA0LjEgMS4xIDguMyAxLjcgMTIuNyAxLjcgNC45IDAgOS43LS43IDE0LjItMi4yIDQuNi0xLjQgOC44LTMuNSAxMi42LTYuMS43LS40IDEuMi0uOSAxLjYtMS42LjQtLjYuMy0xLjMtLjEtMi4zeiIvPjwvc3ZnPg==" alt="10clouds logo">
          </div>
          <h1 style="color: #602ae0" class="text-4xl font-bold text-center mb-4">CodeMind</h1>
          <h3 class="text-xl font-semibold text-center mb-6">GPT-4 Powered Coding Assistant</h3>
          <p class="text-base mb-4">Describe what you want to do with the selected code. Keep in mind that GPT will know only about the context of what is in this file alone.</p>
          <textarea style="height: 26rem" class="w-full h-96 text-white bg-gray-700 p-4 text-sm resize-none mb-4" placeholder="Ask GPT3 something" id="prompt-input">${DEFAULT_PROMPT}</textarea>
          <button style="background-color: #602ae0" class="w-full hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" type="submit" id="prompt-submit">Fix</button>
        </div>

				<script>
          const vscode = acquireVsCodeApi();

          document
            .getElementById("prompt-submit")
            .addEventListener("click", handlePromptSubmission);

          function handlePromptSubmission(e) {
            vscode.postMessage({
              type: "prompt",
              value: document.getElementById("prompt-input").value,
            });
          }
        </script>
			</body>
			</html>`;
  }
}
