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

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CodeMindViewProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codemind.ask", () =>
      vscode.window
        .showInputBox({ prompt: "What do you want to do?" })
        .then((value) => provider.executeFullGPTProcedure(value || ""))
    )
  );
}

export function deactivate() {}
