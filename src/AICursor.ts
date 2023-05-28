import * as vscode from "vscode";

export class AICursor implements vscode.Disposable {
  public document?: vscode.TextDocument;
  
  private subscriptions: vscode.Disposable[] = [];
  private blinkIn: boolean = true;
  private aiSelection?: vscode.Selection;
  private blinkingInterval: NodeJS.Timeout | undefined;

  private readonly modifiedDecorationType =
    vscode.window.createTextEditorDecorationType({
      after: {
        contentText: "​",
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        width: "2px",
        margin: "0 0 0 0", // Add some right margin to separate the "cursor" from the text
        textDecoration: "absolute",
      },
    });

  private readonly modifiedDecorationBlinkOffType =
    vscode.window.createTextEditorDecorationType({
      after: {
        contentText: "​",
        backgroundColor: "rgba(255, 255, 255, 0.0)",
        width: "2px",
        margin: "0 0 0 0", // Add some right margin to separate the "cursor" from the text
        textDecoration: "absolute",
      },
    });

  constructor() {
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) =>
        this.onDidChangeTextDocument(e)
      )
    );

    this.subscriptions.push(
      vscode.window.onDidChangeVisibleTextEditors((e) =>
        this.onDidChangeVisibleTextEditors(e)
      )
    );

    this.blinkingInterval = setInterval(() => {
      this.toggleBlink();
    }, 300);
  }

  get isInComment(): boolean {
    if (!this.document || !this.position) {
      return false;
    }

    let text = this.document.getText();

    let lineTextBeforeCursor = text.substring(
      0,
      this.document.offsetAt(this.position)
    );

    let commentStartIndex = lineTextBeforeCursor.lastIndexOf("/*");
    let commentEndIndex = lineTextBeforeCursor.lastIndexOf("*/");

    if (commentStartIndex > commentEndIndex) {
      return true;
    }

    return false;
  }

  public dispose() {
    clearInterval(this.blinkingInterval);
    this.subscriptions.forEach((s) => s.dispose());
  }

  public get selection(): vscode.Selection | undefined {
    return this.aiSelection;
  }

  public set selection(selection: vscode.Selection | undefined) {
    this.aiSelection = selection;
    this.redrawDecorations(vscode.window.visibleTextEditors);
  }

  public get position(): vscode.Position | undefined {
    return this.aiSelection?.start;
  }

  public set position(position: vscode.Position | undefined) {
    if (!position) {
      this.aiSelection = undefined;
    } else {
      this.aiSelection = new vscode.Selection(position, position);
    }

    this.redrawDecorations(vscode.window.visibleTextEditors);
  }

  public setDocument(
    document: vscode.TextDocument,
    selection: vscode.Selection
  ) {
    this.document = document;
    this.aiSelection = selection;
  }

  private toggleBlink() {
    this.blinkIn = !this.blinkIn;
    this.redrawDecorations(vscode.window.visibleTextEditors);
  }

  private async onDidChangeVisibleTextEditors(
    editors: readonly vscode.TextEditor[]
  ): Promise<void> {
    this.redrawDecorations(editors);
  }

  private onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
    const editor = vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri === e.document.uri
    );

    if (!editor) {
      return;
    }

    // Update all existing ranges offsets.
    for (const change of e.contentChanges) {
      const changeStartOffset = editor.document.offsetAt(change.range.start);
      const changeEndOffset = editor.document.offsetAt(change.range.end);
      const diff = change.text.length - change.rangeLength;

      if (diff === 0 || !this.aiSelection) {
        continue;
      }

      const selectionStartOffset = editor.document.offsetAt(
        this.aiSelection.start
      );
      const selectionEndOffset = editor.document.offsetAt(this.aiSelection.end);

      if (changeEndOffset <= selectionStartOffset) {
        this.aiSelection = new vscode.Selection(
          editor.document.positionAt(selectionStartOffset + diff),
          editor.document.positionAt(selectionEndOffset + diff)
        );
      } else if (changeStartOffset >= selectionEndOffset) {
        // no effects on selection
      } else {
        this.aiSelection = undefined;
      }
    }

    this.redrawDecorations([editor]);
  }

  private redrawDecorations(editors: readonly vscode.TextEditor[]): void {
    for (const editor of editors) {
      if (editor.document.uri === this.document?.uri && this.aiSelection) {
        editor.setDecorations(
          this.modifiedDecorationType,
          this.blinkIn ? [this.aiSelection] : []
        );
        editor.setDecorations(
          this.modifiedDecorationBlinkOffType,
          !this.blinkIn ? [this.aiSelection] : []
        );
      }
    }
  }
}
