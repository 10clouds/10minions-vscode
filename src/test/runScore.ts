import { MinionTask } from "../MinionTask";
import { EditorDocument, EditorRange, EditorUri, WorkspaceEdit, setEditorManager, EditorManager, EditorPosition } from "../managers/EditorManager";
import fs, { readFileSync } from "fs";
import path from "path";
import { applyMinionTask } from "../strategies/utils/applyMinionTask";
import { setLogProvider } from "../managers/LogProvider";
import { setOpenAIApiKey } from "../openai";
import { OpenAICacheManager } from "../managers/OpenAICacheManager";
import { AnalyticsManager } from "../managers/AnalyticsManager";
import { setOriginalContentProvider } from "../managers/OriginalContentProvider";

export class FileUri implements EditorUri {
  readonly fsPath: string;

  constructor(fsPath: string) {
    this.fsPath = fsPath;
  }

  toString(): string {
    return this.fsPath;
  }
}

setLogProvider({
  reportChange: (uri: string) => {},
});

setOriginalContentProvider({
  reportChange: (uri: string) => {},
});

class EditEntry {
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

class WorkspaceEditImplementation implements WorkspaceEdit {
  private _entries: [EditorUri, EditEntry[]][] = [];

  replace(uri: EditorUri, range: EditorRange, newText: string): void {
    this._entries.push([uri, [new EditEntry("replace", range.start.line, range.start.character, newText, range.end.line, range.end.character)]]);
  }

  insert(uri: EditorUri, position: EditorPosition, newText: string): void {
    this._entries.push([uri, [new EditEntry("insert", position.line, position.character, newText)]]);
  }

  entries() {
    return this._entries;
  }
}

class TestEditorManager implements EditorManager {
  openDocuments: EditorDocument[] = [];

  applyWorkspaceEdit(fillEdit: (edit: WorkspaceEdit) => Promise<void>) {
    let edit = new WorkspaceEditImplementation();
    fillEdit(edit);
    this.applyEdit(edit);
  }

  async applyEdit(edit: WorkspaceEditImplementation) {
    const promises = edit.entries().map(async ([uri, edits]) => {
      const document = await this.openTextDocument(uri) as MyEditorDocument;

      edits.forEach((edit) => {
        const range = {
          start: { line: edit.startLine, character: edit.startCharacter },
          end: {
            line: edit.endLine ?? edit.startLine,
            character: edit.endCharacter ?? edit.startCharacter,
          },
        };
        const text = edit.text;

        if (edit.action === "replace") {
          document.replace(range, text);
        } else if (edit.action === "insert") {
          document.insert(range.start, text);
        }
      });
    });

    // Await for all the promises to complete.
    await Promise.all(promises);
  }

  showInformationMessage(message: string) {}

  async openTextDocument(uri: EditorUri) {
    let existingDocument = this.openDocuments.find((doc) => doc.uri.fsPath === uri.fsPath);
    if (existingDocument) {
      return existingDocument;
    }

    let document = new MyEditorDocument(uri.fsPath);
    this.openDocuments.push(document);
    return document;
  }

  showErrorMessage(message: string): void {}

  createUri(uri: string): EditorUri {
    return {
      fsPath: uri,
      toString: () => uri,
    };
  }
}

setEditorManager(new TestEditorManager());

const baseDir = path.resolve(__dirname);

setOpenAIApiKey(JSON.parse(readFileSync(path.resolve(baseDir, "openAIKey.json"), "utf8")).openAIKey);

const openAiCacheManager = new OpenAICacheManager(JSON.parse(readFileSync(path.resolve(baseDir, "serviceAccount.json"), "utf8")));

const analyticsManager = new AnalyticsManager("localTests-installationId", "VsCodeStub");
analyticsManager.setSendDiagnosticsData(true);

export class MyEditorDocument implements EditorDocument {
  readonly languageId: string;
  readonly lineCount: number;
  readonly uri: EditorUri;
  private _textLines: any[] = []; // This will store our text lines.
  private _numberLines: number[] = []; // This will store our line numbers.

  constructor(fileName: string) {
    this.uri = new FileUri(fileName);

    // Reading file contents synchronously for simplicity. Consider using async I/O in production code
    const fileContent = fs.readFileSync(fileName, "utf8");
    this._textLines = fileContent.split("\n");
    this.lineCount = this._textLines.length;

    // Derive languageId from file extension. This is simplistic and might not always be correct.
    this.languageId = path.extname(fileName).slice(1);

    // Populate _numberLines assuming 1-based line numbers
    this._numberLines = Array(this.lineCount)
      .fill(0)
      .map((_, i) => i + 1);
  }

  getText(range?: EditorRange): string {
    // Return joined text from _textLines array within given range or whole text if range is not provided
    return (range ? this._textLines.slice(range.start.line, range.end.line) : this._textLines).join("\n");
  }

  lineAt(line: number): {
    readonly text: string;
    readonly lineNumber: number;
  } {
    if (line < 0 || line >= this.lineCount) {
      throw new Error(`Illegal value for line ${line}`);
    }

    // Return object with text and line number from the given line
    return {
      text: this._textLines[line],
      lineNumber: this._numberLines[line],
    };
  }

  insert(start: { line: number; character: number }, text: string) {
    // First, get the existing text for the line
    const existingText = this.lineAt(start.line).text;

    // Insert the new text at the character position
    const newText = existingText.slice(0, start.character) + text + existingText.slice(start.character);

    // Update the line with the new text
    this._textLines[start.line] = newText;
  }

  replace(range: { start: { line: number; character: number }; end: { line: number; character: number } }, text: string) {
    // Here we need to replace the text from start to end within the range
    const startLineNumber = range.start.line;
    const endLineNumber = range.end.line;

    // Get the existing texts for start and end lines
    const startLineText = this.lineAt(startLineNumber).text;
    const endLineText = this.lineAt(endLineNumber).text;

    // Replace the text within the range
    const newTextStart = startLineText.slice(0, range.start.character) + text;
    const newTextEnd = endLineText.slice(range.end.character);

    // If start and end line numbers are same, then it's a replacement within same line
    if (startLineNumber === endLineNumber) {
      this._textLines[startLineNumber] = newTextStart + newTextEnd;
    } else {
      // Update start, end lines and remove lines between them
      this._textLines[startLineNumber] = newTextStart;
      this._textLines[endLineNumber] = newTextEnd;
      this._textLines.splice(startLineNumber + 1, endLineNumber - startLineNumber);
    }
  }
}

async function run(): Promise<void> {
  console.log("Running tests...");

  let userQuery = `Junior zrobił PR do funkcjonalności, która na podstawie zawartości formularza sprawdza, czy użytkownikowi trzeba pokazać jakiś komunikat. Formularz ma dwa checkboxy (tu wymyślam jakie mają znaczenie, chodzi o to, żeby tknęło kandydata o słabe nazwy zmiennych). Kod działa poprawnie, bo był pisany pod okiem PO i ma testy. Robisz code review, zaproponuj zmiany.`;

  const execution = await MinionTask.create({
    userQuery,
    document: new MyEditorDocument(path.join(__dirname, "score", "code-review.js")),
    selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    selectedText: "",
    minionIndex: 0,
    onChanged: async (important) => {
      console.log(".");
    },
  });

  await execution.run();

  await applyMinionTask(execution);

  console.log("File contents");
  console.log((await execution.document()).getText());
  console.log("Done!");
}

const expectedOutput = `
function checkForm(req, res) {
    const { a, b } = getCheckboxValues(req);
    const showMessage = (a || b) && getInputValues(req).some(checkInput);
    res.send({ showMessage });
  }
`;

run();
