export type EditorPosition = {
  readonly line: number;
  readonly character: number;
};

export type EditorRange = {
  readonly start: EditorPosition;
  readonly end: EditorPosition;
};

export type EditorUri = {
  readonly fsPath: string;
  toString(): string;
};

export type EditorDocument = {
  readonly languageId: string;
  getText(range?: EditorRange): string;
  readonly lineCount: number;
  readonly uri: EditorUri;
  lineAt(line: number): {
    readonly text: string;
    readonly lineNumber: number;
  };
};

export interface EditorManager {
  openTextDocument(uri: EditorUri): Promise<EditorDocument>;
  showErrorMessage(message: string): void;
  createUri(uri: string): EditorUri;
}

let globalEditorManger: EditorManager | undefined = undefined;

export function setEditorManager(editorManager: EditorManager) {
  if (globalEditorManger) {
    throw new Error(`EditorManager is already set.`);
  }
  globalEditorManger = editorManager;
}

export function getEditorManager(): EditorManager {
  if (!globalEditorManger) {
    throw new Error(`EditorManager is not set.`);
  }
  return globalEditorManger;
}
