import { EditorTextEdit } from '../managers/EditorManager';

export class CLIEditEntry implements EditorTextEdit {
  constructor(
    private action: string,
    private startLine: number,
    private startCharacter: number,
    private text: string,
    private endLine?: number,
    private endCharacter?: number,
  ) {}
}
