import * as vscode from 'vscode';
import * as crypto from 'crypto';
import {
  WorkspaceFilesKnowledge,
  generateDescriptionForFiles,
} from '10minions-engine/dist/src/minionTasks/generateDescriptionForWorkspaceFiles';
import { WorkspaceFileData } from '10minions-engine/dist/src/minionTasks/mutators/mutateCreateFileDescription';
import { findAllFilesInWorkspace } from './utils/findAllFilesInWorkspace';

type ProgressCountingFunction = (
  totalFiles: number,
  progress: number,
  inProgress: boolean,
  filePath?: string | undefined,
) => () => void;

export class WorkspaceFilesUpdater {
  public inProgress: boolean = false;
  public progress: number = 0;
  public totalFiles: number = 0;

  constructor(
    private context: vscode.ExtensionContext,
    private createProgressCountingFunction: ProgressCountingFunction,
    private onProcessEnd: (
      progress: number,
      inProgress: boolean,
    ) => Thenable<boolean>,
  ) {
    this.inProgress = false;
    this.progress = 0;
    const currentWorkspaceFiles = this.getCurrentWorkspaceFiles();
    console.log('WORKSPACE FILES: ', currentWorkspaceFiles);
    // TODO: need wider testing
    // this.registerFileSaveListener();
  }

  public getProgressData() {
    return {
      inProgress: this.inProgress,
      progress: this.progress,
      totalFiles: this.totalFiles,
    };
  }

  private registerFileSaveListener() {
    const disposable = vscode.workspace.onDidSaveTextDocument(
      async (document) => {
        if (
          vscode.workspace.workspaceFolders &&
          document.uri.scheme === 'file'
        ) {
          await this.updateWorkspaceFiles();
        }
      },
    );

    // Add the disposable to the class's subscriptions
    this.context.subscriptions.push(disposable);
  }

  // private getModifiedFilesList(
  //   workspaceFiles: WorkspaceFileData[],
  //   currentWorkspaceFiles: WorkspaceFilesKnowledge[],
  // ) {
  //   const newFiles: WorkspaceFileData[] = [];
  //   const updatedFiles: WorkspaceFileData[] = [];

  //   for (const newFile of workspaceFiles) {
  //     const existingFile = currentWorkspaceFiles.find(
  //       (file) => file.id === newFile.path,
  //     );

  //     if (existingFile) {
  //       // File with the same path exists
  //       const existingFileContentHash = this.generateHash(existingFile.content);
  //       const newFileContentHash = this.generateHash(newFile.content);

  //       if (existingFileContentHash !== newFileContentHash) {
  //         // Content has changed, consider it an updated file
  //         updatedFiles.push(newFile);
  //       }
  //     } else {
  //       // File with the same path does not exist, consider it a new file
  //       newFiles.push(newFile);
  //     }
  //   }

  //   const allChangedFiles = [...newFiles, ...updatedFiles];

  //   // Create a Set to store unique elements
  //   const uniqueFilesSet = new Set();

  //   // Loop through the combined array and add each file to the Set
  //   for (const file of allChangedFiles) {
  //     uniqueFilesSet.add(file);
  //   }

  //   // Convert the Set back to an array to get the final result
  //   const uniqueFilesArray = Array.from(uniqueFilesSet);

  //   return uniqueFilesArray;
  // }

  private createCountingFunction(totalFiles?: number): () => void {
    this.progress = 0;
    this.inProgress = true;
    return this.createProgressCountingFunction(
      totalFiles || 0,
      this.progress,
      this.inProgress,
    );
  }

  async updateWorkspaceFiles() {
    if (this.inProgress) return;
    this.inProgress = true;

    try {
      const currentWorkspaceFiles = this.getCurrentWorkspaceFiles();
      const workspaceFiles = await findAllFilesInWorkspace();
      // const modifiedFilesList = this.getModifiedFilesList(
      //   workspaceFiles,
      //   currentWorkspaceFiles,
      // );
      const progressCounting = this.createCountingFunction(
        workspaceFiles.length,
      );

      const filesToRemove = this.identifyFilesToRemove(
        currentWorkspaceFiles,
        workspaceFiles,
      );

      this.removeFiles(filesToRemove, currentWorkspaceFiles);

      for (const newFile of workspaceFiles) {
        await this.updateOrAddFile(
          newFile,
          currentWorkspaceFiles,
          progressCounting,
        );
      }

      this.updateGlobalState(currentWorkspaceFiles);

      this.inProgress = false;
      this.progress = 0;
    } catch (error) {
      console.error(error);
    }
    this.onProcessEnd(this.progress, this.inProgress);
  }

  private getCurrentWorkspaceFiles(): WorkspaceFilesKnowledge[] {
    return this.context.globalState.get('workspaceFilesKnowledge', []) || [];
  }

  private identifyFilesToRemove(
    currentFiles: WorkspaceFilesKnowledge[],
    newFiles: WorkspaceFileData[],
  ): WorkspaceFilesKnowledge[] {
    return currentFiles.filter(
      (existingFile) =>
        !newFiles.some((newFile) => newFile.path === existingFile.id),
    );
  }

  private removeFiles(
    filesToRemove: WorkspaceFilesKnowledge[],
    currentWorkspaceFiles: WorkspaceFilesKnowledge[],
  ) {
    for (const fileToRemove of filesToRemove) {
      const indexToRemove = currentWorkspaceFiles.indexOf(fileToRemove);
      currentWorkspaceFiles.splice(indexToRemove, 1);
      console.log('REMOVED FILE: ', fileToRemove.id);
    }
  }

  private async updateOrAddFile(
    newFile: WorkspaceFileData,
    currentWorkspaceFiles: WorkspaceFilesKnowledge[],
    progressCounting: () => void,
  ) {
    const existingFile = this.getFileById(newFile.path, currentWorkspaceFiles);
    if (existingFile) {
      await this.updateExistingFile(existingFile, newFile, progressCounting);
    } else {
      await this.addNewFile(newFile, currentWorkspaceFiles, progressCounting);
    }
  }

  private getFileById(
    id: string,
    currentWorkspaceFiles: WorkspaceFilesKnowledge[],
  ): WorkspaceFilesKnowledge | undefined {
    return currentWorkspaceFiles.find((file) => file.id === id);
  }

  private async updateExistingFile(
    existingFile: WorkspaceFilesKnowledge,
    newFile: WorkspaceFileData,
    progressCounting: () => void,
  ) {
    const existingFileContentHash = this.generateHash(existingFile.content);
    const newFileContentHash = this.generateHash(newFile.content);

    if (existingFileContentHash !== newFileContentHash) {
      existingFile.content = newFile.content;
      const [newKnowledgeFile] = await generateDescriptionForFiles(
        [
          {
            path: existingFile.id,
            content: existingFile.content,
          },
        ],
        progressCounting,
      );
      existingFile.description = newKnowledgeFile.description;
      console.log('UPDATED FILE: ', existingFile.id);
    }
  }

  private async addNewFile(
    newFile: WorkspaceFileData,
    currentWorkspaceFiles: WorkspaceFilesKnowledge[],
    progressCounting: () => void,
  ) {
    // Implement your logic to generate a new description
    const newKnowledgeFile = await generateDescriptionForFiles(
      [newFile],
      progressCounting,
    );

    if (newKnowledgeFile && newKnowledgeFile.length > 0) {
      currentWorkspaceFiles.push(newKnowledgeFile[0]);
      console.log('ADDED FILE: ', newFile.path);
    }
  }

  private updateGlobalState(currentWorkspaceFiles: WorkspaceFilesKnowledge[]) {
    this.context.globalState.update(
      'workspaceFilesKnowledge',
      currentWorkspaceFiles,
    );
  }

  private generateHash(content: string): string {
    const hash = crypto.createHash('md5');
    hash.update(content);
    return hash.digest('hex');
  }
}
