import * as vscode from "vscode";
import { CodeMindViewProvider } from "./CodeMindViewProvider";

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

export function extractParsedLines(chunk: string) {
  const lines = chunk.split("\n");
  return lines
    .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
    .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
    .map((line) => JSON.parse(line));
}

export function deactivate() {}
