import { basename } from "path";
import * as vscode from "vscode";
import { MinionTask, SerializedMinionTask } from "./MinionTask";
import { postMessageToWebView } from "./TenMinionsViewProvider";
import { CANCELED_STAGE_NAME, MinionTaskUIInfo } from "./ui/MinionTaskUIInfo";
import { AnalyticsManager } from "./AnalyticsManager";
import { applyMinionTask } from "./utils/applyMinionTask";

function extractExecutionIdFromUri(uri: vscode.Uri): string {
  return uri.path.match(/^minionTaskId\/([a-z\d\-]+)\/.*/)![1];
}

class LogProvider implements vscode.TextDocumentContentProvider {
  private executionsManager: MinionTasksManager;

  constructor(executionsManager: MinionTasksManager) {
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
    const execution = this.executionsManager.getExecutionById(textKey);
    const logContent = execution?.logContent || "";
    return logContent;
  }
}

export class MinionTasksManager {
  
  public static instance: MinionTasksManager;

  private minionTasks: MinionTask[] = [];
  private readonly _context: vscode.ExtensionContext;
  private _view?: vscode.WebviewView;
  private _isThrottled = false;
  private _pendingUpdate = false;
  
  fullContentProvider: vscode.TextDocumentContentProvider;
  logProvider: LogProvider;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;

    const serializedExecutions = this._context.globalState.get<SerializedMinionTask[]>("10minions.executions") || [];
    this.minionTasks = serializedExecutions.map((data: SerializedMinionTask) => MinionTask.deserialize(data));

    let self = this;
    this.fullContentProvider = new (class FullContentProvider implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        const textKey = extractExecutionIdFromUri(uri);
        const originalContent = self.minionTasks.find((e) => e.id === textKey)?.originalContent;
        return originalContent || "";
      }
    });
  
    this.logProvider = new LogProvider(this);

    vscode.workspace.registerTextDocumentContentProvider("10minions-log", this.logProvider);
    vscode.workspace.registerTextDocumentContentProvider("10minions-originalContent", this.fullContentProvider);

    if (MinionTasksManager.instance) {
      throw new Error("ExecutionsManager already instantiated");
    }

    MinionTasksManager.instance = this;
  }

  async saveExecutions() {
    const serializedExecutions = this.minionTasks.map((execution) => execution.serialize());
    await this._context.globalState.update("10minions.executions", serializedExecutions);
  }

  async showDiff(minionTaskId: string) {
    let minionTask = this.getExecutionById(minionTaskId);

    if (minionTask) {
      const documentUri = vscode.Uri.parse(minionTask.documentURI);
      await vscode.commands.executeCommand(
        "vscode.diff",
        vscode.Uri.parse(minionTask.originalContentURI),
        documentUri,
        `${basename(documentUri.fsPath)} ↔ ${minionTask.shortName}`
      );
    }
  }

  async openDocument(minionTaskId: string) {
    let minionTask = this.getExecutionById(minionTaskId);

    if (minionTask) {
      let documentURI = vscode.Uri.parse(minionTask.documentURI);
      await vscode.workspace.openTextDocument(documentURI);
      await vscode.window.showTextDocument(documentURI);
    }
  }

  async applyAndReviewTask(minionTaskId: string) {
    let minionTask = this.getExecutionById(minionTaskId);
    if (minionTask) {
      await applyMinionTask(minionTask);
      await this.showDiff(minionTaskId);
    }  
  }

  async openLog(minionTaskId: string) {
    let minionTask = this.getExecutionById(minionTaskId);

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
    this.minionTasks = [execution, ...this.minionTasks];
  }

  removeExecution(id: string) {
    this.minionTasks = this.minionTasks.filter((e) => e.id !== id);
  }

  getExecutionById(minionTaskId: string): MinionTask | undefined {
    return this.minionTasks.find((e) => e.id === minionTaskId);
  }

  clearExecutions() {
    this.minionTasks = [];
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
          this.notifyExecutionsUpdatedImmediate(execution, important);
        } else {
          this.notifyExecutionsUpdated(execution);
        }
      },
    });

    const runningExecution = this.getRunningExecution(activeEditor.document.uri.toString());
    this.minionTasks = [execution, ...this.minionTasks];

    // Set the waiting flag if there's a running execution on the same file
    if (runningExecution) {
      execution.shortName = "Queued ...";
      execution.progress = 0;
      execution.waiting = true;
    } else {
      await execution.run();
    }

    this.notifyExecutionsUpdatedImmediate(execution, true);
  }

  acquireMinionIndex(): number {
    const NUM_TOTAL_ROBOTS = 12;
    //get all free indices
    const ALL_FILL_ROBOT_ICONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const freeIndices = ALL_FILL_ROBOT_ICONS.map((e, i) => i).filter((i) => !this.minionTasks.find((e) => e.minionIndex === i));

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
    this.notifyExecutionsUpdatedImmediate(minionTask, false);

    setTimeout(() => {
      this._isThrottled = false;
      if (this._pendingUpdate) this.notifyExecutionsUpdatedImmediate(minionTask, false);
      this._pendingUpdate = false;
    }, 500);
  }

  async forceExecution(minionTaskId: string) {
    let oldExecutionMaybe = this.minionTasks.find((e) => e.id === minionTaskId);

    if (!oldExecutionMaybe) {
      vscode.window.showErrorMessage("No execution found for id", minionTaskId);
      throw new Error(`No execution found for id ${minionTaskId}`);
    }

    let oldExecution = oldExecutionMaybe;

    if (!oldExecution.waiting) {
      vscode.window.showErrorMessage("Execution is not waiting", minionTaskId);
      return;
    }

    await oldExecution.run();

    this.notifyExecutionsUpdatedImmediate(oldExecution, true);
  }

  reRunExecution(minionTaskId: any, newUserQuery?: string) {
    let oldExecutionMaybe = this.minionTasks.find((e) => e.id === minionTaskId);

    if (!oldExecutionMaybe) {
      vscode.window.showErrorMessage("No execution found for id", minionTaskId);
      throw new Error(`No execution found for id ${minionTaskId}`);
}

    let oldExecution = oldExecutionMaybe;

    if (!oldExecution.stopped) {
      vscode.window.showErrorMessage("Execution is still running", minionTaskId);
      return;
    }

    //remove old execution
    this.minionTasks = this.minionTasks.filter((e) => e.id !== minionTaskId);
    this.notifyExecutionsUpdatedImmediate(oldExecution, true);

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
            this.notifyExecutionsUpdatedImmediate(newExecution, true);
          } else {
            this.notifyExecutionsUpdated(newExecution);
          }
        },
      });

      const runningExecution = this.getRunningExecution(newExecution.documentURI);
      this.minionTasks = [newExecution, ...this.minionTasks.filter((e) => e.id !== minionTaskId)];

      // Set the waiting flag if there's a running execution on the same file
      if (runningExecution) {
        newExecution.shortName = "Queued ...";
        newExecution.progress = 0;
        newExecution.waiting = true;
      } else {
        await newExecution.run();
      }

      this.notifyExecutionsUpdatedImmediate(newExecution, true);
    }, 500);
  }

  notifyExecutionsUpdatedImmediate(minionTask?: MinionTask, importantChange?: boolean) {
    const executionInfo: MinionTaskUIInfo[] = this.minionTasks.map((e) => ({
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
      modificationApplied: e.modificationApplied,
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

    if (minionTask && importantChange) {
      AnalyticsManager.instance.reportOrUpdateMinionTask(minionTask);
    }
  }

  stopExecution(minionTaskId: any) {
    let execution = this.minionTasks.find((e) => e.id === minionTaskId);

    if (execution) {
      execution.stopExecution(CANCELED_STAGE_NAME);
    } else {
      console.error("No execution found for id", minionTaskId);
    }
  }

  closeExecution(minionTaskId: any) {
    let execution = this.minionTasks.find((e) => e.id === minionTaskId);

    if (execution) {
      execution.stopExecution(CANCELED_STAGE_NAME, false);
      this.minionTasks = this.minionTasks.filter((e) => e.id !== minionTaskId);
      this.notifyExecutionsUpdatedImmediate(execution, true);
    } else {
      vscode.window.showErrorMessage("No execution found for id", minionTaskId);
    }
  }

  private getRunningExecution(documentURI: string): MinionTask | null {
    for (const execution of this.minionTasks) {
      if (execution.documentURI === documentURI && !execution.stopped && !execution.waiting) {
        return execution;
      }
    }
    return null;
  }

  private async runNextWaitingExecution() {
    for (const execution of [...this.minionTasks].reverse()) {
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
