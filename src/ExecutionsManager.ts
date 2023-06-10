import { basename } from "path";
import * as vscode from "vscode";
import { MinionTask, SerializedMinionTask } from "./MinionTask";
import { postMessageToWebView } from "./TenMinionsViewProvider";
import { CANCELED_STAGE_NAME, MinionTaskUIInfo } from "./ui/MinionTaskUIInfo";
import { AnalyticsManager } from "./AnalyticsManager";

function extractExecutionIdFromUri(uri: vscode.Uri): string {
  return uri.path.match(/^minionTaskId\/([a-z\d\-]+)/)![1];
}

class LogProvider implements vscode.TextDocumentContentProvider {
  private executionsManager: ExecutionsManager;

  constructor(executionsManager: ExecutionsManager) {
    this.executionsManager = executionsManager;
  }

  // Create an EventEmitter to handle document updates
  private _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  // Use the getter to expose the onDidChange event using EventEmitter's event property
  get onDidChange(): vscode.Event<vscode.Uri> | undefined {
    return this._onDidChangeEmitter.event;
  }

  reportChange(uri: vscode.Uri) {
    // Emit the event to notify subscribers of the change in the URI
    this._onDidChangeEmitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const textKey = extractExecutionIdFromUri(uri);
    const logContent = this.executionsManager.getExecutionById(textKey)?.logContent;
    return logContent || "";
  }
}

export class ExecutionsManager {
  public static instance: ExecutionsManager;

  private executions: MinionTask[] = [];
  private readonly _context: vscode.ExtensionContext;
  private _view?: vscode.WebviewView;
  private _isThrottled = false;
  private _pendingUpdate = false;
  
  fullContentProvider: vscode.TextDocumentContentProvider;
  logProvider: LogProvider;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;

    const serializedExecutions = this._context.globalState.get<SerializedMinionTask[]>("10minions.executions") || [];
    this.executions = serializedExecutions.map((data: SerializedMinionTask) => MinionTask.deserialize(data));

    let self = this;
    this.fullContentProvider = new (class FullContentProvider implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        const textKey = extractExecutionIdFromUri(uri);
        const originalContent = self.executions.find((e) => e.id === textKey)?.originalContent;
        return originalContent || "";
      }
    });
  
    this.logProvider = new LogProvider(this);

    vscode.workspace.registerTextDocumentContentProvider("10minions-log", this.logProvider);
    vscode.workspace.registerTextDocumentContentProvider("10minions-originalContent", this.fullContentProvider);

    if (ExecutionsManager.instance) {
      throw new Error("ExecutionsManager already instantiated");
    }

    ExecutionsManager.instance = this;
  }

  async saveExecutions() {
    const serializedExecutions = this.executions.map((execution) => execution.serialize());
    await this._context.globalState.update("10minions.executions", serializedExecutions);
  }

  async showDiff(executionId: string) {
    let minionTask = this.getExecutionById(executionId);

    if (minionTask) {
      const documentUri = vscode.Uri.parse(minionTask.documentURI);
      await vscode.commands.executeCommand(
        "vscode.diff",
        vscode.Uri.parse(minionTask.logURI),
        documentUri,
        `(original) ↔ ${basename(documentUri.fsPath)} (${minionTask.shortName})`
      );
    }
  }

  async openDocument(executionId: string) {
    let minionTask = this.getExecutionById(executionId);

    if (minionTask) {
      let documentURI = vscode.Uri.parse(minionTask.documentURI);
      await vscode.workspace.openTextDocument(documentURI);
      await vscode.window.showTextDocument(documentURI);
    }  
  }

  async openLog(executionId: string) {
    let minionTask = this.getExecutionById(executionId);

    if (minionTask) {
      let documentURI = vscode.Uri.parse(minionTask.logURI);
      await vscode.workspace.openTextDocument(documentURI);
      await vscode.window.showTextDocument(documentURI);
    }
  }

  updateView(view: vscode.WebviewView) {
    this._view = view;
  }

  addExecution(execution: MinionTask) {
    this.executions = [execution, ...this.executions];
  }

  removeExecution(id: string) {
    this.executions = this.executions.filter((e) => e.id !== id);
  }

  getExecutionById(executionId: string): MinionTask | undefined {
    return this.executions.find((e) => e.id === executionId);
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

    if (activeEditor.document.uri.scheme.startsWith("10minions-")) {
      vscode.window.showErrorMessage("Please open a file before running 10Minions");
      return;
    }

    const execution = await MinionTask.create({
      userQuery,
      document: activeEditor.document,
      selection: activeEditor.selection,
      selectedText: activeEditor.document.getText(activeEditor.selection),
      minionIndex: this.acquireMinionIndex(),
      onChanged: async (important) => {
        if (important) {
          this.notifyExecutionsUpdatedImmediate(execution);
        } else {
          this.notifyExecutionsUpdated(execution);
        }
      },
    });

    const runningExecution = this.getRunningExecution(activeEditor.document.uri.toString());
    this.executions = [execution, ...this.executions];

    // Set the waiting flag if there's a running execution on the same file
    if (runningExecution) {
      execution.shortName = "Queued ...";
      execution.progress = 0;
      execution.waiting = true;
    } else {
      await execution.run();
    }

    this.notifyExecutionsUpdatedImmediate(execution);
  }

  acquireMinionIndex(): number {
    const NUM_TOTAL_ROBOTS = 12;
    //get all free indices
    const ALL_FILL_ROBOT_ICONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const freeIndices = ALL_FILL_ROBOT_ICONS.map((e, i) => i).filter((i) => !this.executions.find((e) => e.minionIndex === i));

    //return random
    if (freeIndices.length > 0) {
      return freeIndices[Math.floor(Math.random() * freeIndices.length)];
    } else {
      //return random one
      return Math.floor(Math.random() * NUM_TOTAL_ROBOTS);
    }
  }

  notifyExecutionsUpdated(minionTask: MinionTask) {
    if (this._isThrottled) {
      this._pendingUpdate = true;
      return;
    }

    this._isThrottled = true;
    this.notifyExecutionsUpdatedImmediate(minionTask);

    setTimeout(() => {
      this._isThrottled = false;
      if (this._pendingUpdate) this.notifyExecutionsUpdatedImmediate(minionTask);
      this._pendingUpdate = false;
    }, 500);
  }

  async forceExecution(executionId: string) {
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

    await oldExecution.run();

    this.notifyExecutionsUpdatedImmediate(oldExecution);
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
    this.notifyExecutionsUpdatedImmediate(oldExecution);

    //after 1 second add a new one
    setTimeout(async () => {
      let newExecution = await MinionTask.create({
        userQuery: newUserQuery || oldExecution.userQuery,
        document: await oldExecution.document(),
        selection: oldExecution.selection,
        selectedText: oldExecution.selectedText,
        minionIndex: oldExecution.minionIndex,
        onChanged: async (important) => {
          if (important) {
            this.notifyExecutionsUpdatedImmediate(newExecution);
          } else {
            this.notifyExecutionsUpdated(newExecution);
          }
        },
      });

      const runningExecution = this.getRunningExecution(newExecution.documentURI);
      this.executions = [newExecution, ...this.executions.filter((e) => e.id !== executionId)];

      // Set the waiting flag if there's a running execution on the same file
      if (runningExecution) {
        newExecution.shortName = "Queued ...";
        newExecution.progress = 0;
        newExecution.waiting = true;
      } else {
        await newExecution.run();
      }

      this.notifyExecutionsUpdatedImmediate(newExecution);
    }, 500);
  }

  notifyExecutionsUpdatedImmediate(minionTask?: MinionTask) {
    const executionInfo: MinionTaskUIInfo[] = this.executions.map((e) => ({
      id: e.id,
      minionIndex: e.minionIndex,
      fullContent: e.originalContent,
      userQuery: e.userQuery,
      executionStage: e.executionStage,
      documentName: e.baseName,
      documentURI: e.documentURI,
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

    if (minionTask) {
      AnalyticsManager.instance.reportOrUpdateMinionTask(minionTask);
    }
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
      this.notifyExecutionsUpdatedImmediate(execution);
    } else {
      vscode.window.showErrorMessage("No execution found for id", executionId);
    }
  }

  private getRunningExecution(documentURI: string): MinionTask | null {
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
