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
    vscode.commands.registerCommand("codemind.test", () => {
      // Create a new decoration type for modified code
      const modifiedDecorationType =
        vscode.window.createTextEditorDecorationType({
          backgroundColor: "rgba(255, 0, 0, 0.3)", // Red background with 30% opacity
        });

      // Get the active text editor
      const activeEditor = vscode.window.activeTextEditor;

      if (activeEditor) {
        // Define the range of the code segment to modify
        const codeSegmentRange = new vscode.Range(1, 0, 1, 10); // Example: from line 0, column 0 to line 0, column 10

        // Get the text within the code segment
        const codeSegmentText = activeEditor.document.getText(codeSegmentRange);

        // Modify the code segment (example: add a comment)
        const modifiedCodeSegmentText = `// Modified code: ${codeSegmentText}`;

        // Create a decoration object for the modified code
        const modifiedDecoration = {
          range: codeSegmentRange,
        };

        // Apply the modified code decoration to the active text editor
        activeEditor.setDecorations(modifiedDecorationType, [
          modifiedDecoration,
        ]);
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
