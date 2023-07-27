import * as vscode from 'vscode';
import {
  MessageToVSCode,
  MessageToVSCodeType,
  MessageToWebView,
  MessageToWebViewType,
} from '10minions-engine/dist/Messages';
import { setOpenAIApiKey } from '10minions-engine/dist/openai';
import { findNewPositionForOldSelection } from './utils/findNewPositionForOldSelection';
import { convertSelection, convertUri } from './vscodeUtils';
import { getAnalyticsManager } from '10minions-engine/dist/managers/AnalyticsManager';
import { getCommandHistoryManager } from '10minions-engine/dist/managers/CommandHistoryManager';
import { getMinionTasksManager } from '10minions-engine/dist/managers/MinionTasksManager';
import {
  ViewProvider,
  setViewProvider,
} from '10minions-engine/dist/managers/ViewProvider';
import { getMissingOpenAIModels } from '10minions-engine/dist/utils/getMissingOpenAIModels';

export class VSViewProvider
  implements vscode.WebviewViewProvider, ViewProvider
{
  public static readonly viewType = '10minions.sideBar';

  private _view?: vscode.WebviewView;

  constructor(private context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(VSViewProvider.viewType, this, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
    );

    //post message with update to set api key, each time appropriate config is updated
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('10minions.apiKey')) {
          this.updateApiKeyAndModels();

          if (vscode.workspace.getConfiguration('10minions').get('apiKey')) {
            getAnalyticsManager().reportEvent('setOpenAIApiKey');
          } else {
            getAnalyticsManager().reportEvent('unsetOpenAIApiKey');
          }
        }

        if (e.affectsConfiguration('10minions.enableCompletionSounds')) {
          getAnalyticsManager().reportEvent('setEnableCompletionSounds', {
            value: !!vscode.workspace
              .getConfiguration('10minions')
              .get('enableCompletionSounds'),
          });
        }
      }),
    );

    setViewProvider(this);
  }

  private async updateApiKeyAndModels() {
    const apiKey: string =
      vscode.workspace.getConfiguration('10minions').get('apiKey') || '';
    setOpenAIApiKey(apiKey);
    this.postMessageToWebView({
      type: MessageToWebViewType.ApiKeySet,
      value: !!vscode.workspace.getConfiguration('10minions').get('apiKey'),
    });

    this.postMessageToWebView({
      type: MessageToWebViewType.ApiKeyMissingModels,
      models: await getMissingOpenAIModels(apiKey),
    });
  }

  public postMessageToWebView(message: MessageToWebView) {
    if (!this._view) {
      throw new Error('Webview not initialized');
    }

    return this._view.webview.postMessage(message);
  }

  public setBadge(tooltip: string, value: number) {
    if (!this._view) {
      throw new Error('Webview not initialized');
    }

    this._view.badge = {
      tooltip,
      value,
    };
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    // Add an event listener for visibility change
    webviewView.onDidChangeVisibility(() =>
      this.updateSidebarVisibility(webviewView.visible),
    );

    // Adding an event listener for when the active text editor selection changes
    vscode.window.onDidChangeTextEditorSelection(() =>
      this.handleSelectionChange(),
    );

    // set options for the webview, allow scripts
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    // set the HTML for the webview
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // add an event listener for messages received by the webview
    webviewView.webview.onDidReceiveMessage(
      async (data: MessageToVSCode) => await this.handleWebviewMessage(data),
    );
  }

  async clearAndfocusOnInput() {
    //make sure that our extension bar is visible
    if (!this._view) {
      await vscode.commands.executeCommand('10minions.chatView.focus');
    } else {
      this._view?.show?.(true);
    }

    this.postMessageToWebView({
      type: MessageToWebViewType.ClearAndFocusOnInput,
    });
  }

  async preFillPrompt(prompt: string) {
    //make sure that our extension bar is visible
    if (!this._view) {
      await vscode.commands.executeCommand('10minions.chatView.focus');
    } else {
      this._view?.show?.(true);
    }

    getMinionTasksManager().runMinionOnCurrentSelectionAndEditor(prompt);
  }

  timeoutRef?: NodeJS.Timeout;

  private handleSelectionChange() {
    // Clear previous timeout before setting a new one
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    // Set a new timeout for 1 second and fire postMessageToVsCode if uninterrupted
    this.timeoutRef = setTimeout(() => {
      const activeEditor = vscode.window.activeTextEditor;
      const selectedText =
        activeEditor?.document.getText(activeEditor.selection) || '';

      this.postMessageToWebView({
        type: MessageToWebViewType.ChosenCodeUpdated,
        code: selectedText
          ? selectedText
          : activeEditor?.document.getText() || '',
      });
    }, 100);
  }

  private updateSidebarVisibility(visible: boolean) {
    this.postMessageToWebView({
      type: MessageToWebViewType.UpdateSidebarVisibility,
      value: visible,
    });
  }

  async handleWebviewMessage(data: MessageToVSCode) {
    console.log('CMD', data);

    switch (data.type) {
      case MessageToVSCodeType.NewMinionTask: {
        const prompt = data.value ? data.value : 'Refactor this code';

        await getCommandHistoryManager().updateCommandHistory(prompt);

        getMinionTasksManager().runMinionOnCurrentSelectionAndEditor(prompt);
        break;
      }
      case MessageToVSCodeType.OpenDocument: {
        getMinionTasksManager().openDocument(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.OpenSelection: {
        const minionTask = getMinionTasksManager().getExecutionById(
          data.minionTaskId,
        );

        if (minionTask) {
          const document = await vscode.workspace.openTextDocument(
            convertUri(minionTask.documentURI),
          );
          const editor = await vscode.window.showTextDocument(document);
          editor.selection = convertSelection(
            await findNewPositionForOldSelection(
              minionTask.selection,
              minionTask.selectedText,
              document,
            ),
          );

          // Reveal the range of the selected text in the editor
          editor.revealRange(
            editor.selection,
            vscode.TextEditorRevealType.InCenterIfOutsideViewport,
          );
        } else {
          vscode.window.showErrorMessage(`Minion task not found.`);
        }
        break;
      }
      case MessageToVSCodeType.OpenLog: {
        getMinionTasksManager().openLog(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.ShowDiff: {
        getMinionTasksManager().showDiff(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.MarkAsApplied: {
        getMinionTasksManager().markAsApplied(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.ApplyAndReviewTask: {
        getMinionTasksManager().applyAndReviewTask(
          data.minionTaskId,
          data.reapply,
        );
        break;
      }
      case MessageToVSCodeType.ReRunExecution: {
        getMinionTasksManager().reRunExecution(
          data.minionTaskId,
          data.newUserQuery,
        );
        break;
      }
      case MessageToVSCodeType.StopExecution: {
        getMinionTasksManager().stopExecution(data.minionTaskId);
        break;
      }
      case MessageToVSCodeType.EditApiKey: {
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '10minions.apiKey',
        );
        break;
      }
      case MessageToVSCodeType.SuggestionGet: {
        getCommandHistoryManager().sendCommandSuggestions(data.input);
        break;
      }
      case MessageToVSCodeType.CloseExecution: {
        const minionTaskId = data.minionTaskId;
        getMinionTasksManager().closeExecution(minionTaskId);
        break;
      }
      case MessageToVSCodeType.ReadyForMessages: {
        this.updateApiKeyAndModels();

        //update initial executions
        getMinionTasksManager().notifyExecutionsUpdatedImmediate();

        break;
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <base href="${webview.asWebviewUri(this.context.extensionUri)}/">
      <script src="${webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'resources',
          'tailwind.min.js',
        ),
      )}"></script>
      <link rel="stylesheet" href="${webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'resources',
          'global.css',
        ),
      )}" />
    </head>
    <body>
      <div id="root"></div>
      <script src="${webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'sideBar.js'),
      )}"></script>
    </body>
    </html>`;
  }
}
