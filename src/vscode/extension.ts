import * as vscode from 'vscode';
import {
  AnalyticsManager,
  getAnalyticsManager,
  setAnalyticsManager,
} from '../managers/AnalyticsManager';
import { SimpleOpenAICacheManager } from '../managers/SimpleOpenAICacheManager';
import { getViewProvider } from '../managers/ViewProvider';
import {
  initPlayingSounds,
  setCompletionSoundsEnabled,
} from '../utils/playSound';
import { VSCodeActionProvider } from './VSCodeActionProvider';
import { VSCommandHistoryManager } from './VSCommandHistoryManager';
import { VSEditorManager } from './VSEditorManager';
import { VSLogProvider } from './VSLogProvider';
import { VSMinionTasksManager } from './VSMinionTasksManager';
import { VSOriginalContentProvider } from './VSOriginalContentProvider';
import { VSViewProvider } from './VSViewProvider';
import { setOpenAICacheManager } from '../managers/OpenAICacheManager';

export function activate(context: vscode.ExtensionContext) {
  console.log('10Minions is now active');

  initPlayingSounds(context.extensionPath);

  const analyticsManager = new AnalyticsManager(
    context.globalState.get<string>('10minions.installationId') || '',
    vscode.version,
  );
  analyticsManager.setSendDiagnosticsData(
    !!vscode.workspace.getConfiguration('10minions').get('sendDiagnosticsData'),
  );
  setAnalyticsManager(analyticsManager);

  const openAiCacheManager = new SimpleOpenAICacheManager();
  setOpenAICacheManager(openAiCacheManager);

  const originalContentProvider = new VSOriginalContentProvider(context);
  const logProvider = new VSLogProvider(context);
  const viewProvider = new VSViewProvider(context);
  const commandHistoryManager = new VSCommandHistoryManager(context);
  const editorManager = new VSEditorManager(context);
  const executionsManager = new VSMinionTasksManager(context);
  const codeActionProvider = new VSCodeActionProvider(context);
  //const taskAutoRunner = new MinionTaskAutoRunner(context); // Initialized MinionTaskAutoRunner

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('10minions.enableCompletionSounds')) {
        getAnalyticsManager().reportEvent('setEnableCompletionSounds', {
          value: !!vscode.workspace
            .getConfiguration('10minions')
            .get('enableCompletionSounds'),
        });

        setCompletionSoundsEnabled(
          !!vscode.workspace
            .getConfiguration('10minions')
            .get('enableCompletionSounds'),
        );
      }

      if (e.affectsConfiguration('10minions.sendDiagnosticsData')) {
        getAnalyticsManager().reportEvent(
          'setSendDiagnosticsData',
          {
            value: !!vscode.workspace
              .getConfiguration('10minions')
              .get('sendDiagnosticsData'),
          },
          true,
        ); // Force send even if just disabled

        analyticsManager.setSendDiagnosticsData(
          !!vscode.workspace
            .getConfiguration('10minions')
            .get('sendDiagnosticsData'),
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      '10minions.fixError',
      (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => {
        const range = diagnostic.range;
        const start = range.start;
        const line = start.line;
        const column = start.character;
        const message = diagnostic.message;
        const lineAndColumn = `Line: ${line} Column: ${column}`;

        getViewProvider().preFillPrompt(
          `Fix this error:\n\n${message}\n${lineAndColumn}`,
        );

        getAnalyticsManager().reportEvent('fixError', {
          message,
          lineAndColumn,
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('10minions.ask', async () => {
      await getViewProvider().clearAndfocusOnInput();
    }),
  );
}

export function deactivate() {}
