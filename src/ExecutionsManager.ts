import { basename } from "path";
import * as vscode from "vscode";
import { GPTExecution, SerializedGPTExecution } from "./GPTExecution";
import { CANCELED_STAGE_NAME, ExecutionInfo } from "./ui/ExecutionInfo";
import { postMessageToWebView } from "./TenMinionsViewProvider";
import { exec } from "child_process";

export class ExecutionsManager implements vscode.TextDocumentContentProvider {
  private executions: GPTExecution[] = [];
  private readonly _context: vscode.ExtensionContext;
  private _view?: vscode.WebviewView;
  private _isThrottled = false;
  private _pendingUpdate = false;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;

    const serializedExecutions = this._context.globalState.get<SerializedGPTExecution[]>("10minions.executions") || [];
    this.executions = serializedExecutions.map((data: SerializedGPTExecution) => GPTExecution.deserialize(data));
  }

  async saveExecutions() {
    const serializedExecutions = this.executions.map((execution) => execution.serialize());
    await this._context.globalState.update("10minions.executions", serializedExecutions);
  }

  async showDiff(executionId: any) {
    let execution = this.executions.find((e) => e.id === executionId);

    if (execution) {
      const makeUriString = (textKey: string): string => `10minions:text/${textKey}`; // `_ts` to avoid cache

      const documentUri = vscode.Uri.parse(execution.documentURI);
      await vscode.commands.executeCommand(
        "vscode.diff",
        vscode.Uri.parse(makeUriString(executionId)),
        documentUri,
        `(original) ↔ ${basename(documentUri.fsPath)}`
      );
    }
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const extractTextKey = (uri: vscode.Uri): string => uri.path.match(/^text\/([a-z\d\-]+)/)![1];

    console.log("CONTENT", uri);
    const textKey = extractTextKey(uri);
    const originalContent = this.executions.find((e) => e.id === textKey)?.fullContent;
    return originalContent || "";
  }


  updateView(view: vscode.WebviewView) {
    this._view = view;
  }

  addExecution(execution: GPTExecution) {
    this.executions = [execution, ...this.executions];
  }

  removeExecution(id: string) {
    this.executions = this.executions.filter((e) => e.id !== id);
  }

  findExecution(id: string) {
    return this.executions.find((e) => e.id === id);
  }

  clearExecutions() {
    this.executions = [];
  }

  public async runMinionOnCurrentSelectionAndEditor(userQuery: string) {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
      vscode.window.showErrorMessage("Please open a file before running 10Minions");
      return;
    }

    if (activeEditor.document.fileName.endsWith(".log")) {
      vscode.window.showErrorMessage("Please open a file before running 10Minions");
      return;
    }

    const execution = await GPTExecution.create({
      userQuery,
      document: activeEditor.document,
      selection: activeEditor.selection,
      selectedText: activeEditor.document.getText(activeEditor.selection),
      onChanged: async (important) => {
        if (important) {
          this.notifyExecutionsUpdatedImmediate();
        } else {
          this.notifyExecutionsUpdated();
        }
      },
    });


    const runningExecution = this.getRunningExecution(activeEditor.document.uri.toString());
    this.executions = [execution, ...this.executions];

    // Set the waiting flag if there's a running execution on the same file
    if (runningExecution) {
      execution.shortName = "Queued ..."
      execution.progress = 0;
      execution.waiting = true;
    } else {
      await execution.run();
    }

    this.notifyExecutionsUpdatedImmediate();
  }


  

  notifyExecutionsUpdated() {
    if (this._isThrottled) {
      this._pendingUpdate = true;
      return;
    }

    this._isThrottled = true;
    this.notifyExecutionsUpdatedImmediate();

    setTimeout(() => {
      this._isThrottled = false;
      if (this._pendingUpdate) this.notifyExecutionsUpdatedImmediate();
      this._pendingUpdate = false;
    }, 500);
  }

  reRunExecution(executionId: any, newUserQuery?: string) {
    
    let oldExecutionMaybe = this.executions.find((e) => e.id === executionId);

    if (!oldExecutionMaybe) {
      vscode.window.showErrorMessage("No execution found for id", executionId);
      throw new Error(`No execution found for id ${executionId}`);
    }

    let oldExecution = oldExecutionMaybe;

    if (!oldExecution.stopped) {
      vscode.window.showErrorMessage("Execution is still running", executionId);
      return;
    }

    //remove old execution
    this.executions = this.executions.filter((e) => e.id !== executionId);
    this.notifyExecutionsUpdatedImmediate();

    //after 1 second add a new one
    setTimeout(async () => {
      let newExecution = await GPTExecution.create({
        userQuery: newUserQuery || oldExecution.userQuery,
        document: await oldExecution.document(),
        selection: oldExecution.selection,
        selectedText: oldExecution.selectedText,
        onChanged: async (important) => {
          if (important) {
            this.notifyExecutionsUpdatedImmediate();
          } else {
            this.notifyExecutionsUpdated();
          }
        },
      });


      const runningExecution = this.getRunningExecution(newExecution.documentURI);
      this.executions = [newExecution, ...this.executions.filter((e) => e.id !== executionId)];

      // Set the waiting flag if there's a running execution on the same file
      if (runningExecution) {
        newExecution.shortName = "Queued ..."
        newExecution.progress = 0;
        newExecution.waiting = true;
      } else {
        await newExecution.run();
      }

      this.notifyExecutionsUpdatedImmediate();
    }, 500);

  }

  notifyExecutionsUpdatedImmediate() {
    const executionInfo: ExecutionInfo[] = this.executions.map((e) => ({
      id: e.id,
      fullContent: e.fullContent,
      userQuery: e.userQuery,
      executionStage: e.executionStage,
      documentName: e.baseName,
      documentURI: e.documentURI,
      logFileURI: e.workingDocumentURI,
      progress: e.progress,
      stopped: e.stopped,
      classification: e.classification,
      modificationDescription: e.modificationDescription,
      selectedText: e.selectedText,
      shortName: e.shortName,
      waiting: e.waiting,
    }));

    postMessageToWebView(this._view, {
      type: "executionsUpdated",
      executions: executionInfo,
    });

    this.saveExecutions();
    this.runNextWaitingExecution();
  }

  stopExecution(executionId: any) {
    let execution = this.executions.find((e) => e.id === executionId);

    if (execution) {
      execution.stopExecution(CANCELED_STAGE_NAME);
    } else {
      console.error("No execution found for id", executionId);
    }
  }

  closeExecution(executionId: any) {
    
    let execution = this.executions.find((e) => e.id === executionId);

    if (execution) {
      execution.stopExecution(CANCELED_STAGE_NAME, false);
      this.executions = this.executions.filter((e) => e.id !== executionId);
    } else {
      vscode.window.showErrorMessage("No execution found for id", executionId);
    }

    //notify webview
    this.notifyExecutionsUpdatedImmediate();

  }

  private getRunningExecution(documentURI: string): GPTExecution | null {
    for (const execution of this.executions) {
      if (execution.documentURI === documentURI && !execution.stopped && !execution.waiting) {
        return execution;
      }
    }
    return null;
  }

  private async runNextWaitingExecution() {
    for (const execution of [...this.executions].reverse()) {
      if (execution.waiting && !execution.stopped) {
        const runningExecution = this.getRunningExecution(execution.documentURI);

        if (!runningExecution) {
          execution.waiting = false;
          execution.run();
          break;
        }
      }
    }
  }
}
