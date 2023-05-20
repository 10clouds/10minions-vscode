import fetch, { Response } from "node-fetch";
import * as vscode from "vscode";

const DEFAULT_PROMPT = `You are an expert senior coder with IQ of 200, first provide critique of the code given, and provide a plan for changes and then provide a new version of it.

Your code should be simple, consise, maintainable, readable and ready for production. Rewrite parts of it if needed, but keep the final result and side effects the same. Split and join the functions as needed. Introduce or remove types. You may optimise the code, especially if it will make it more parallelized. You may change the names of the functions and create subroutines. Either provide simple documentation or make the code readable enough that it does not need docs. The code quality and documentation should be on par with top open source projects, as this is a part of a top open source project.`;


import * as AsyncLock from 'async-lock';

const editorLock = new AsyncLock();

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "10clouds-gpt" is now active!');

  const config = vscode.workspace.getConfiguration('codemind');

	// Put configuration settings into the provider
	let OPENAI_API_KEY = config.get('apiKey');

  vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
		if (event.affectsConfiguration('codemind.apiKey')) {
			const config = vscode.workspace.getConfiguration('codemind');
      OPENAI_API_KEY = config.get('apiKey');
			console.log("API key changed");
		}
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codemind.fix",
      async () => {
        try {
          console.log("10clouds-gpt.process running");
  
          const selectedText = await getSelectedText();
          const prompt = await getInputPrompt();
  
          const activeEditor = vscode.window.activeTextEditor;
          if (!activeEditor) {
            return;
          }
  
          const document = activeEditor.document;
          const content = document.getText();
  
          const newDocument = await createNewDocument(document);
          await showDocumentComparison(document, newDocument);
  
          generateCode(document, content, selectedText, prompt, newDocument);
        } catch (e) {
          console.error(e);
        }
      }
    ),
    vscode.commands.registerCommand(
      "codemind.setApiKey",
      async () => {
        try {
          console.log("10clouds-gpt.setApiKey running");

          const apiKey = await vscode.window.showInputBox({
            prompt: "Enter your OpenAI API key",
            value: '',
          });

          if (apiKey) {
            vscode.workspace.getConfiguration('codemind').update('apiKey', apiKey, true);
          }

        } catch (e) {
          console.error(e);
        }
      }
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

async function getInputPrompt() {
  return (
    (await vscode.window.showInputBox({
      prompt:
        "Enter a prompt for OpenAI Chat Completion, leave empty for default",
      value: DEFAULT_PROMPT,
    })) || ""
  );
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

async function generateCode(
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
    const response = await fetchResponse(
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

async function fetchResponse(
  apiUrl: string,
  document: vscode.TextDocument,
  content: string,
  selectedText: string,
  prompt: string,
  signal: AbortSignal
) {
  return await fetch(apiUrl, {
    method: "POST",
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Content-Type": "application/json",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: `Bearer ${vscode.workspace.getConfiguration('codemind').get('apiKey')}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: `${prompt}

===== CODE ====
${selectedText}

===== CODE IN THE CONTEXT OF IT'S FILE (${document.fileName}) ====
${content}`,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      max_tokens: 3000,
      stream: true,
    }),
    signal,
  });
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
  await editorLock.acquire('streamLock', async () => {
    try {
      console.log(content);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(
      newDocument.uri,
      newDocument.positionAt(newDocument.getText().length),
      content
    );
    await vscode.workspace.applyEdit(edit).then((value) => {
      console.log("OK");
    }, (reason) => {
      console.log("REASON", reason);
    });
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
