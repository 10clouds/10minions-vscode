import * as vscode from 'vscode';

const extractFileNameFromPath = function (filepath: string) {
  return filepath.substring(filepath.lastIndexOf('/') + 1).split('.')[0];
};

export const getFileInfo = () => {
  const editor = vscode.window.activeTextEditor;
  const fileUri = editor?.document.uri;
  const filePath = fileUri?.fsPath;
  const fileName = extractFileNameFromPath(filePath || '');

  return {
    fileName,
  };
};
