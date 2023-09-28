import { WorkspaceFileData } from '10minions-engine/dist/src/minionTasks/mutators/mutateCreateFileDescription';
import * as vscode from 'vscode';
import { traverseDirectory } from './traverseDirectory';

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
