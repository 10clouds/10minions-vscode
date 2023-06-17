import { basename } from "path";
import * as vscode from "vscode";
import { AnalyticsManager } from "./AnalyticsManager";
import { MinionTask } from "./MinionTask";
import { SerializedMinionTask, deserializeMinionTask, serializeMinionTask } from "./SerializedMinionTask";
import { postMessageToWebView } from "./TenMinionsViewProvider";
import { APPLIED_STAGE_NAME, CANCELED_STAGE_NAME, FINISHED_STAGE_NAME, MinionTaskUIInfo } from "./ui/MinionTaskUIInfo";
import { applyMinionTask } from "./utils/applyMinionTask";
import { findNewPositionForOldSelection } from "./utils/findNewPositionForOldSelection";
import { MessageToWebViewType } from "./Messages";

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
    const logContent = execution?.logContent;
    return logContent || "";
  }
}

class OriginalContentProvider implements vscode.TextDocumentContentProvider {
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
    const originalContent = execution?.originalContent;
    return originalContent || "";
  }
}

export class MinionTasksManager {

  public static instance: MinionTasksManager;

  private minionTasks: MinionTask[] = [];
  private readonly _context: vscode.ExtensionContext;
  private _view?: vscode.WebviewView;
  private _isThrottled = false;
  private _pendingUpdate = false;

  originalContentProvider: OriginalContentProvider;
  logProvider: LogProvider;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;

    const serializedExecutions = this._context.globalState.get<SerializedMinionTask[]>("10minions.executions") || [];
    this.minionTasks = serializedExecutions.map((data: SerializedMinionTask) => deserializeMinionTask(data));

    let self = this;
    this.originalContentProvider = new OriginalContentProvider(this);

    this.logProvider = new LogProvider(this);

    vscode.workspace.registerTextDocumentContentProvider("10minions-log", this.logProvider);
    vscode.workspace.registerTextDocumentContentProvider("10minions-originalContent", this.originalContentProvider);

    if (MinionTasksManager.instance) {
      throw new Error("ExecutionsManager already instantiated");
    }

    MinionTasksManager.instance = this;
  }

  async saveExecutions() {
    const serializedExecutions = this.minionTasks.map((execution) => serializeMinionTask(execution));
    await this._context.globalState.update("10minions.executions", serializedExecutions);
  }

  async showDiff(minionTaskId: string) {
    let minionTask = this.getExecutionById(minionTaskId);

    if (minionTask) {
      const documentUri = vscode.Uri.parse(minionTask.documentURI);

      const document = await vscode.workspace.openTextDocument(documentUri);
      await vscode.window.showTextDocument(document);

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

  async applyAndReviewTask(minionTaskId: string, reapply: boolean) {
    let minionTask = this.getExecutionById(minionTaskId);
    if (minionTask) {
      if (reapply) {
        minionTask.executionStage = FINISHED_STAGE_NAME;
      }
      await applyMinionTask(minionTask);
      await this.showDiff(minionTaskId);
    }
  }

  async markAsApplied(minionTaskId: string) {
    let minionTask = this.getExecutionById(minionTaskId);
    if (minionTask) {
      minionTask.executionStage = APPLIED_STAGE_NAME;
      await minionTask.onChanged(true);
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
        //TODO: This is copied around code at least 3 times. Refactor it.
        if (important) {
          this.notifyExecutionsUpdatedImmediate(execution, true);
        } else {
          this.notifyExecutionsUpdated(execution);
        }
      },
    });

    this.minionTasks = [execution, ...this.minionTasks];

    await execution.run();

    this.notifyExecutionsUpdatedImmediate(execution, true);
  }

  acquireMinionIndex(): number {
    const NUM_TOTAL_ROBOTS = 10;
    //get all free indices
    const ALL_FILL_ROBOT_ICONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
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

  async reRunExecution(minionTaskId: any, newUserQuery?: string) {
    let oldExecutionMaybe = this.minionTasks.find((e) => e.id === minionTaskId);

    if (!oldExecutionMaybe) {
      vscode.window.showErrorMessage("No execution found for id", minionTaskId);
      throw new Error(`No execution found for id ${minionTaskId}`);
    }

    let oldExecution = oldExecutionMaybe;

    await this.closeExecution(oldExecution.id);

    let document = await oldExecution.document();

    let newSelection = oldExecution.selectedText ? await findNewPositionForOldSelection(oldExecution.selection, oldExecution.selectedText, document) : oldExecution.selection;
    setTimeout(async () => {
      let newMinionTask = await MinionTask.create({
        userQuery: newUserQuery || oldExecution.userQuery,
        document: await oldExecution.document(),
        selection: newSelection,
        selectedText: document.getText(newSelection),
        minionIndex: oldExecution.minionIndex,
        onChanged: async (important) => {
          //TODO: This is copied around code at least 3 times. Refactor it.
          if (important) {
            this.notifyExecutionsUpdatedImmediate(newMinionTask, true);
          } else {
            this.notifyExecutionsUpdated(newMinionTask);
          }
        },
      });

      this.minionTasks = [newMinionTask, ...this.minionTasks.filter((e) => e.id !== minionTaskId)];

      await newMinionTask.run();

      this.notifyExecutionsUpdatedImmediate(newMinionTask, true);
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
      classification: e.strategy,
      modificationDescription: e.modificationDescription,
      modificationProcedure: e.modificationProcedure,
      inlineMessage: e.inlineMessage,
      selectedText: e.selectedText,
      shortName: e.shortName,
    }));

    postMessageToWebView(this._view, {
      type: MessageToWebViewType.ExecutionsUpdated,
      executions: executionInfo,
    });

    this._view!.badge = {
      tooltip: `${this.minionTasks.length} minion tasks`,
      value:  this.minionTasks.filter((e) => e.executionStage === FINISHED_STAGE_NAME).length
    };

    this.saveExecutions();

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

async closeExecution(minionTaskId: any) {
  let execution = this.minionTasks.find((e) => e.id === minionTaskId);

  if (execution) {
    await execution.stopExecution(CANCELED_STAGE_NAME, false);
    execution.contentWhenDismissed = execution.logContent;
    this.minionTasks = this.minionTasks.filter((e) => e.id !== minionTaskId);
    this.notifyExecutionsUpdatedImmediate(execution, true);
  } else {
    vscode.window.showErrorMessage("No execution found for id", minionTaskId);
  }
}
}
