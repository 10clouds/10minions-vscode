import {
  EditorDocument,
  EditorManager,
  EditorUri,
  WorkspaceEdit,
} from '../managers/EditorManager';
import { CLIWorkspaceEdit } from './CLIWorkspaceEdit';
import { CLIEditorDocument } from './CLIEditorDocument';

export class CLIEditorManager implements EditorManager {
  openDocuments: EditorDocument[] = [];

  applyWorkspaceEdit(fillEdit: (edit: WorkspaceEdit) => Promise<void>) {
    const edit = new CLIWorkspaceEdit();
    fillEdit(edit);
    this.applyEdit(edit);
  }

  async applyEdit(edit: CLIWorkspaceEdit) {
    const promises = edit.entries().map(async ([uri, edits]) => {
      const document = (await this.openTextDocument(uri)) as CLIEditorDocument;

      edits.forEach((edit) => {
        const range = {
          start: { line: edit.startLine, character: edit.startCharacter },
          end: {
            line: edit.endLine ?? edit.startLine,
            character: edit.endCharacter ?? edit.startCharacter,
          },
        };
        const text = edit.text;

        if (edit.action === 'replace') {
          document.replace(range, text);
        } else if (edit.action === 'insert') {
          document.insert(range.start, text);
        }
      });
    });

    // Await for all the promises to complete.
    await Promise.all(promises);
  }

  showErrorMessage(message: string): void {}

  showInformationMessage(message: string): void {}

  async openTextDocument(uri: EditorUri) {
    const existingDocument = this.openDocuments.find(
      (doc) => doc.uri.toString() === uri.toString(),
    );
    if (existingDocument) {
      return existingDocument;
    }

    const document = new CLIEditorDocument(uri);
    this.openDocuments.push(document);
    return document;
  }

  createUri(uri: string): EditorUri {
    return {
      fsPath: uri + '.original.txt',
      toString: () => uri,
    };
  }
}
