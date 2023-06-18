



import * as vscode from "vscode";
import { MinionTasksManager } from "./MinionTasksManager";

//TODO: Add a lot of logging to this class so it's easy to track wha tis going on.
export class MinionTaskAutoRunner {
  public static instance: MinionTaskAutoRunner;
  private documentTimeouts: Map<string, NodeJS.Timeout> = new Map();


  constructor(context: vscode.ExtensionContext) {
    this.monitorFilesForTasks();

    if (MinionTaskAutoRunner.instance) {
      throw new Error("ExecutionsManager already instantiated");
    }

    MinionTaskAutoRunner.instance = this;
  }


  private monitorFilesForTasks() {
    //TODO: Use the scan pattern to filter out files that we don't want to scan.
    let scanPattern = vscode.workspace.getConfiguration("10minions").get<string>("taskCommentScanPattern");

    //TOOD: Initially check for tasks in all files, make it slow, and throttled, so we don't kill the entire system.

    //TODO: Any changes to the file should cancel the timeout AND if the minion is working on this, it should cancel the minion as well.


vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
    const uri = event.document.uri.toString();
    const existingTimeout = this.documentTimeouts.get(uri);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    // Additional modification to handle Minion task cancellation
    // Cancel any ongoing Minion task related to the file
    //MinionTasksManager.instance.cancelMinionForDoc(event.document);

    // Store the timeout for the file to check after 5 seconds
    const timeoutId = setTimeout(() => {
        if (!this.checkIfCursorInTaskCommentLine(event.document)) {
            this.checkForTaskComments(event.document);
        }
        this.documentTimeouts.delete(uri);
    }, 5000);
  
    this.documentTimeouts.set(uri, timeoutId);
});
  
    // Add event listener for the cursor movement
    vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
      const oldPosition = event.selections[0].anchor;
      const newPosition = event.selections[0].active;
  
      if (oldPosition.line !== newPosition.line) {
        const oldLineHadTask = this.checkIfCursorInTaskCommentLine(event.textEditor.document, oldPosition);
        if (oldLineHadTask) {
          this.checkForTaskComments(event.textEditor.document);
        }
      }
    });
  }
  
  private checkForTaskComments(document: vscode.TextDocument) {
    const taskCommentKeyword = vscode.workspace.getConfiguration("10minions").get<string>("taskCommentKeyword");

    if (!taskCommentKeyword || !document) {
      return;
    }

    const pattern = new RegExp(`(${taskCommentKeyword}: .*)`, "g");
    const lines = document.getText().split("\n");

    lines.forEach((line, lineNumber) => {
      const match = pattern.exec(line);
      if (match) {
        const task = match[1];
        const selectionStart = Math.max(0, lineNumber - 10);
        const selectionEnd = Math.min(lines.length, lineNumber + 20 + 1);
        const selection = new vscode.Selection(selectionStart, 0, selectionEnd, 0);

        if (!MinionTasksManager.instance.getExecutionByUserQueryAndDoc(task.trim(), document)) {
          this.createMinionTaskForTaskComment(task.trim(), document, selection);
        }
      }
      pattern.lastIndex = 0;
    });
  }

  private checkIfCursorInTaskCommentLine(document: vscode.TextDocument, position?: vscode.Position): boolean {
    const activeEditor = vscode.window.activeTextEditor;
    const cursorPosition = position || (activeEditor?.document.uri.toString() === document.uri.toString() ? activeEditor.selection.active : null);
  
    if (cursorPosition) {
      const currentLine = document.lineAt(cursorPosition.line).text;
      const taskCommentKeyword = vscode.workspace.getConfiguration("10minions").get<string>("taskCommentKeyword") || "";
      const pattern = new RegExp(`${taskCommentKeyword}: (.*)`, "g");
  
      return pattern.test(currentLine);
    }
  
    return false;
  }

  private createMinionTaskForTaskComment(task: string, document: vscode.TextDocument, selection: vscode.Selection) {
    const existingTask = MinionTasksManager.instance.getExecutionByUserQueryAndDoc(task, document);

    if (!existingTask) {
      // The message shown can be modified accordingly
      // Added clickable button to the vscode.window.showInformationMessage
      vscode.window.showInformationMessage('The task is being executed: ' + task, {
        modal: true,
      }, 
      {
        title: "Go to Task", // This is the clickable button
      }).then(clicked => { // Contains the action performed when the button is clicked
        if (clicked?.title === "Go to Task") {
          // Add the action you want to perform when the go to task button is clicked
          vscode.workspace.openTextDocument(document.uri) // Opens up the document where the task is located 
          .then(doc => {
              vscode.window.showTextDocument(doc);  // Display the newly opened document to the user
          });
        }
      });
      
      MinionTasksManager.instance.runMinionOnCurrentSelectionAndEditor(task, document, selection);
    }
  }
}
