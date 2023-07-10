import { EditorTextEdit } from '../managers/EditorManager';

export class CLIEditEntry implements EditorTextEdit {
  constructor(
    public action: string,
    public startLine: number,
    public startCharacter: number,
    public text: string,
    public endLine?: number,
    public endCharacter?: number,
  ) {}
}
