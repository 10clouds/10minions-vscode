import { randomUUID } from "crypto";
import { encode } from "gpt-tokenizer";
import * as path from "path";
import * as vscode from "vscode";
import { AICursor, editDocument, insertIntoNewDocument } from "./AICursor";
import { convertToDiff } from "./convertToDiff";
import { createWorkingdocument } from "./createWorkingdocument";
import { planAndWrite } from "./planAndWrite";
import { lockDocument } from "./progress";
import { replaceContentWithDiff } from "./replaceContent";

export class CodeMindViewProvider implements vscode.WebviewViewProvider {
  aiCursor = new AICursor();
  unlockDocument?: () => void;
  gptProcedureSubscriptions: vscode.Disposable[] = [];

  rejectProgress?: (error: string) => void;
  resolveProgress?: () => void;

  async preFillPrompt(prompt: string) {
    //make sure that our extension bar is visible
    if (!this._view) {
      await vscode.commands.executeCommand("codemind.chatView.focus");
    } else {
      this._view?.show?.(true);
    }

    this._view?.webview.postMessage({
      type: "preFillPrompt",
      value: prompt,
    });
  }
  public static readonly viewType = "codemind.chatView";
  runningExecutionId: string = "";
  document: vscode.TextDocument | undefined;

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
      const activeEditor = vscode.window.activeTextEditor;

      switch (data.type) {
        case "getTokenCount": {
          let tokenCount = activeEditor
            ? encode(activeEditor.document.getText()).length
            : 0;

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
          this.stopExecution("Canceled by user");
          break;
        }
      }
    });
  }

  public stopExecution(error?: string) {
    this.runningExecutionId = "";
    this.aiCursor.selection = undefined;

    this.gptProcedureSubscriptions.forEach((subscription) => {
      subscription.dispose();
    });

    this.gptProcedureSubscriptions = [];

    if (this.unlockDocument) this.unlockDocument();

    this.unlockDocument = undefined;

    if (this.rejectProgress && error) this.rejectProgress(error);
    else if (this.resolveProgress) this.resolveProgress();

    this.rejectProgress = undefined;
    this.resolveProgress = undefined;

    //delete tmp file
    //vscode.workspace.fs.delete(refDocument.uri);

    if (this.document) {
      this.document = undefined;
    }

    this._view?.webview.postMessage({
      type: "executionStopped",
    });
  }

  async handleDiffAndReplace(
    fullFileContent: string,
    modification: string,
    reportSmallProgress: () => void
  ) {
    const maxRetries = 3;
    for (let retryAttempt = 1; retryAttempt <= maxRetries; retryAttempt++) {
      try {
        let diff = await convertToDiff(
          fullFileContent,
          modification,
          async (chunk: string) => {
            reportSmallProgress();

            if (this.document) {
              await insertIntoNewDocument(this.aiCursor, chunk);
            }
          }
        );
      } catch (error) {
        // Log the error
        console.error(`Error in retry attempt #${retryAttempt}:`, error);
        // If we reached the maximum number of retries, rethrow the error
        if (retryAttempt === maxRetries) {
          throw error;
        }
      }
    }
  }

  public async executeFullGPTProcedure(userQuery: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage(
        "Please open a file before running CodeMind"
      );
      return;
    }

    this.document = activeEditor.document;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `🧠 ${userQuery} (${path.basename(this.document?.fileName)})`,
        cancellable: true,
      },
      async (progress, token) => {
        return new Promise<void>(async (resolve, reject) => {
          this.resolveProgress = resolve;
          this.rejectProgress = reject;

          let starTime = Date.now();

          vscode.window.showTextDocument(this.document!, { preview: false });

          let workingDocument = await createWorkingdocument(
            this.document!.fileName
          );

          await vscode.window.showTextDocument(workingDocument);

          //on closed documents
          this.gptProcedureSubscriptions.push(
            vscode.workspace.onDidCloseTextDocument((cloedDoc) => {
              if (
                cloedDoc.uri.toString() === workingDocument.uri.toString() ||
                cloedDoc.uri.toString() === this.document?.uri.toString()
              ) {
                this.stopExecution("Canceled by user");
              }
            })
          );

          this.aiCursor.setDocument(workingDocument);

          const TOTAL_BIG_TASKS = 3;
          const TOTAL_PROGRESS_FOR_BIG = 95 / TOTAL_BIG_TASKS;
          let currentProgressInBigTask = 0;

          this.unlockDocument = lockDocument(this.document!);

          let justRelocked = false;
          let pendingRelock = false;

          /*let progressMessage = getRandomProgressMessage();

          progress.report({
            message: progressMessage,
            increment: 0,
          });*/

          const markJustRelocked = () => {
            if (!justRelocked) {
              justRelocked = true;

              //this.unlockDocument = lockDocument(this.document!);

              setTimeout(() => {
                justRelocked = false;

                if (pendingRelock) {
                  pendingRelock = false;
                  markJustRelocked();
                }
              }, 1000);
            } else {
              pendingRelock = true;
            }
          };

          const reportSmallProgress = () => {
            const totalPending =
              TOTAL_PROGRESS_FOR_BIG - currentProgressInBigTask;
            let increment = totalPending * 0.01;
            progress.report({
              //message: progressMessage,
              increment,
            });

            markJustRelocked();

            currentProgressInBigTask += increment;
          };

          const reportBigTaskFinished = () => {
            //progressMessage = getRandomProgressMessage();

            progress.report({
              //message: progressMessage,

              increment: TOTAL_PROGRESS_FOR_BIG - currentProgressInBigTask,
            });

            markJustRelocked();

            currentProgressInBigTask = 0;
          };

          reportSmallProgress();

          token.onCancellationRequested(() => {
            this.stopExecution("Canceled by user");
          });

          const executionId = randomUUID();

          this.runningExecutionId = executionId;

          reportSmallProgress();

          if (!this.document) {
            return;
          }

          let selectedText = activeEditor.document.getText(
            activeEditor.selection
          );

          this.aiCursor.position = new vscode.Position(0, 0);

          reportSmallProgress();

          let fullFileContent = this.document.getText();

          reportSmallProgress();

          await insertIntoNewDocument(
            this.aiCursor,
            "User: " + userQuery + "\n\n"
          );

          let modification = await planAndWrite(
            userQuery,
            activeEditor.selection?.start || new vscode.Position(0, 0),
            selectedText,
            fullFileContent,
            async (chunk: string) => {
              reportSmallProgress();

              //escape */ in chunk
              chunk = chunk.replace(/\*\//g, "*\\/");

              await insertIntoNewDocument(this.aiCursor, chunk);
            },
            () => {
              return this.runningExecutionId !== executionId;
            }
          );

          reportBigTaskFinished();

          this.aiCursor.position = new vscode.Position(
            this.aiCursor.position!.line + 2,
            0
          );

          await insertIntoNewDocument(this.aiCursor, "\n\n");

          // Replace the relevant code with the call to the new function
          await handleDiffAndReplace(this.document, userQuery, starTime);

          reportBigTaskFinished();

          await replaceContentWithDiff(
            this.document,
            prepareModificationInfo(userQuery, starTime),
            diff || "???"
          );

          vscode.window.showInformationMessage(
            `Finished processing ${path.basename(this.document?.fileName)}`
          );

          //closeAllTmpEditorsFor(workingDocument);

          this.stopExecution();
        });
      }
    );
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

function prepareModificationInfo(userQuery: string, startTime: number) {
  let seconds = (Date.now() - startTime) / 1000;

  //format time to 00:00:00
  let hours = Math.floor(seconds / 3600);
  seconds = seconds % 3600;
  let minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;

  let formatted = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toFixed(0).padStart(2, "0")}`;
  let userQueryPreview = userQuery.split("\n")[0].substring(0, 500);

  let prefix = `
/*
 * 10Clouds CodeMind AI
 *
 * ${userQueryPreview}
 * Duration: ${formatted}
 * Time: ${new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")}
 *\/
`.trim();
  return prefix;
}

/*
 * 10Clouds CodeMind AI
 *
 * How to handle rejection here? I want to retry convertion to diff and try to replace content again.
 * Duration: 00:04:14
 * Time: 2023-06-01 05:55:27
 */
