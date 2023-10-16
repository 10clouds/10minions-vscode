import {
  WorkspaceFilesKnowledge,
  generateDescriptionForFile,
} from '10minions-engine/dist/src/minionTasks/generateDescriptionForWorkspaceFiles';
import { ImportedFile, readFilesFromImports } from './readFilesFromImports';
import * as vscode from 'vscode';
import crypto from 'crypto';

export const getKnowledge = async (
  context: vscode.ExtensionContext,
  filePath: string,
  fileContent: string,
) => {
  const currentWorkspaceFiles = getCurrentWorkspaceFiles(context);

  try {
    const importFiles = await readFilesFromImports(filePath, fileContent);

    for (const newFile of importFiles) {
      await updateOrAddFile(newFile, currentWorkspaceFiles, context);
    }
    console.log('UPDATED KNOWLEDGE: ', getCurrentWorkspaceFiles(context));
    const chosenKnowledge = chooseKnowledgeForTask(context, importFiles);

    console.log('CHOSEN KNOWLEDGE: ', chosenKnowledge);

    return chosenKnowledge;
  } catch (error) {
    console.error(error);
  }
};

const updateOrAddFile = async (
  newFile: ImportedFile,
  currentWorkspaceFiles: WorkspaceFilesKnowledge[],
  context: vscode.ExtensionContext,
) => {
  const existingFile = getFileById(newFile.path, currentWorkspaceFiles);
  if (existingFile) {
    await updateExistingFile(existingFile, newFile, context);
  } else {
    await addNewFile(newFile, context);
  }
};

const getFileById = (
  id: string,
  currentWorkspaceFiles: WorkspaceFilesKnowledge[],
): WorkspaceFilesKnowledge | undefined => {
  return currentWorkspaceFiles.find((file) => file.id === id);
};

const updateExistingFile = async (
  existingFile: WorkspaceFilesKnowledge,
  newFile: ImportedFile,
  context: vscode.ExtensionContext,
) => {
  const existingFileContentHash = generateHash(existingFile.content);
  const newFileContentHash = generateHash(newFile.fileContent);

  if (existingFileContentHash !== newFileContentHash) {
    existingFile.content = newFile.fileContent;
    const newKnowledgeFile = await generateDescriptionForFile({
      path: existingFile.id,
      content: existingFile.content,
    });
    existingFile.description = newKnowledgeFile?.description || '';
    const currentWorkspaceFiles = getCurrentWorkspaceFiles(context);
    const updatedWorkspaceKnowledge = updateWorkspaceKnowledge(
      currentWorkspaceFiles,
      existingFile.id,
      existingFile,
    );
    updateKnowledgeWorkspaceState(updatedWorkspaceKnowledge, context);
    console.log('UPDATED FILE: ', existingFile.id);
  }
};

const addNewFile = async (
  newFile: ImportedFile,
  context: vscode.ExtensionContext,
) => {
  const currentWorkspaceFiles = getCurrentWorkspaceFiles(context);

  const newKnowledgeFile = await generateDescriptionForFile({
    content: newFile.fileContent,
    path: newFile.path,
  });

  if (newKnowledgeFile) {
    updateKnowledgeWorkspaceState(
      [...currentWorkspaceFiles, newKnowledgeFile],
      context,
    );
    console.log('ADDED FILE: ', newFile.path);
  }
};

const generateHash = (content: string): string => {
  const hash = crypto.createHash('md5');
  hash.update(content);
  return hash.digest('hex');
};

const getCurrentWorkspaceFiles = (
  context: vscode.ExtensionContext,
): WorkspaceFilesKnowledge[] => {
  const projectKnowledge = context.workspaceState.get<
    WorkspaceFilesKnowledge[]
  >('workspaceFilesKnowledge', []);

  return projectKnowledge;
};

const updateKnowledgeWorkspaceState = (
  knowledge: WorkspaceFilesKnowledge[] = [],
  context: vscode.ExtensionContext,
) => {
  context.workspaceState.update('workspaceFilesKnowledge', knowledge);
};

const updateWorkspaceKnowledge = (
  workspaceFiles: WorkspaceFilesKnowledge[],
  idToUpdate: string,
  updatedProperties: Partial<WorkspaceFilesKnowledge>,
): WorkspaceFilesKnowledge[] =>
  workspaceFiles.map((file) => {
    if (file.id === idToUpdate) {
      return {
        ...file,
        ...updatedProperties,
      };
    }
    return file;
  });

const chooseKnowledgeForTask = (
  context: vscode.ExtensionContext,
  importFiles: ImportedFile[],
): WorkspaceFilesKnowledge[] => {
  const currentWorkspaceFiles = getCurrentWorkspaceFiles(context);

  return currentWorkspaceFiles.filter((file) =>
    importFiles.some((importFile) => importFile.path === file.id),
  );
};
