import * as vscode from 'vscode';
import {
  AnalyticsManager,
  getAnalyticsManager,
  setAnalyticsManager,
} from '10minions-engine/dist/src/managers/AnalyticsManager';
import { SimpleOpenAICacheManager } from '10minions-engine/dist/src/managers/SimpleOpenAICacheManager';
import { getViewProvider } from '10minions-engine/dist/src/managers/ViewProvider';
import {
  initPlayingSounds,
  setCompletionSoundsEnabled,
} from '10minions-engine/dist/src/utils/playSound';
import { VSCodeActionProvider } from './VSCodeActionProvider';
import { VSCommandHistoryManager } from './VSCommandHistoryManager';
import { VSEditorManager } from './VSEditorManager';
import { VSLogProvider } from './VSLogProvider';
import { VSMinionTasksManager } from './VSMinionTasksManager';
import { VSOriginalContentProvider } from './VSOriginalContentProvider';
import { VSViewProvider } from './VSViewProvider';
import { setOpenAICacheManager } from '10minions-engine/dist/src/managers/OpenAICacheManager';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { WorkspaceFileData } from '10minions-engine/dist/src/minionTasks/mutators/mutateCreateFileDescription';
import { generateDescriptionForFiles } from '10minions-engine/dist/src/minionTasks/generateDescriptionForWorkspaceFiles';

const readFileAsync = promisify(fs.readFile);
let globalState: vscode.Memento;

export async function findAllFilesInWorkspace(): Promise<WorkspaceFileData[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const fileList: { path: string; content: string }[] = [];
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const rootFolder = folder.uri.fsPath;
      await traverseDirectory(rootFolder, fileList);
    }
  }

  return fileList;
}

async function shouldSkipFile(
  filePath: string,
  directoryPath: string,
): Promise<boolean> {
  const gitignorePath = path.join(directoryPath, '.gitignore');

  try {
    // Read the .gitignore file
    const gitignoreContent = await readFileAsync(gitignorePath, 'utf-8');

    // Parse the .gitignore patterns and check if filePath matches any of them
    const patterns = gitignoreContent
      .split('\n')
      .filter((line) => !!line.trim());
    return patterns.some((pattern) => {
      const isMatch = new RegExp(pattern).test(filePath);
      return isMatch;
    });
  } catch (error) {
    // .gitignore file not found or couldn't be read, so don't skip the file
    return false;
  }
}

async function traverseDirectory(
  directoryPath: string,
  fileList: WorkspaceFileData[],
) {
  const items = fs.readdirSync(directoryPath);

  for (const item of items) {
    // Check if the filename starts with a dot
    if (item.startsWith('.')) {
      continue; // Skip hidden files
    }

    const itemPath = path.join(directoryPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isFile()) {
      // Check if the file should be skipped based on .gitignore rules
      const shouldSkip = await shouldSkipFile(itemPath, directoryPath);

      if (!shouldSkip) {
        const fileContent = fs.readFileSync(itemPath, 'utf-8');
        fileList.push({
          path: itemPath, // Store the file path
          content: fileContent,
        });
      }
    } else if (stats.isDirectory()) {
      await traverseDirectory(itemPath, fileList);
    }
  }
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('10Minions is now active');
  context.globalState.update('workspaceFiles', []);

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

  new VSOriginalContentProvider(context);
  new VSLogProvider(context);
  new VSViewProvider(context);
  new VSCommandHistoryManager(context);
  new VSEditorManager();
  new VSMinionTasksManager(context);
  new VSCodeActionProvider(context);
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
  let inProgress = true;
  context.subscriptions.push(
    vscode.commands.registerCommand('10minions.getKnowledge', async () => {
      if (!inProgress) return;
      const workspaceFiles = await findAllFilesInWorkspace();
      const workspaceFilesKnowledge = await generateDescriptionForFiles(
        workspaceFiles,
      );
      inProgress = false;
      context.globalState.update('workspaceFiles', workspaceFilesKnowledge);
      globalState = context.globalState;
    }),
  );
}

export function deactivate() {}
