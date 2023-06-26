import { EditorTextEdit } from "../managers/EditorManager";

export class CLIEditEntry implements EditorTextEdit {
  action: string;
  startLine: number;
  startCharacter: number;
  endLine?: number;
  endCharacter?: number;
  text: string;

  constructor(action: string, startLine: number, startCharacter: number, text: string, endLine?: number, endCharacter?: number) {
    this.action = action;
    this.startLine = startLine;
    this.startCharacter = startCharacter;
    this.endLine = endLine;
    this.endCharacter = endCharacter;
    this.text = text;
  }
}
