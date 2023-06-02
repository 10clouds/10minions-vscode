import * as vscode from "vscode";
import AsyncLock = require("async-lock");

export const editorLock = new AsyncLock();

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
    document: vscode.TextDocument
  ) {
    this.document = document;
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

      if (changeStartOffset >= selectionEndOffset) {
        //no effects
      } else if (changeEndOffset <= selectionStartOffset) {
        this.aiSelection = new vscode.Selection(
          editor.document.positionAt(selectionStartOffset + diff),
          editor.document.positionAt(selectionEndOffset + diff)
        );
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

export async function editDocument(
  edit: (edit: vscode.WorkspaceEdit) => Promise<void>
) {
  await editorLock.acquire("streamLock", async () => {
    const workspaceEdit = new vscode.WorkspaceEdit();
    await edit(workspaceEdit);
    await vscode.workspace.applyEdit(workspaceEdit).then(
      (value) => { },
      (reason) => {
        console.log("REASON", reason);
      }
    );
  });
}

export async function insertIntoNewDocument(
  aiCursor: AICursor,
  content: string,
  autoSave: boolean) {
  return await editorLock.acquire("streamLock", async () => {
    try {
      const edit = new vscode.WorkspaceEdit();

      if (!aiCursor.selection || !aiCursor.document) {
        throw new Error("No selection");
      }

      if (aiCursor.selection.isEmpty) {
        edit.insert(
          aiCursor.document.uri,
          aiCursor.selection.start,
          content
        );
      } else {
        edit.replace(
          aiCursor.document.uri,
          new vscode.Range(
            aiCursor.selection.start,
            aiCursor.selection.end
          ),
          content
        );
      }

      await vscode.workspace.applyEdit(edit).then(
        (value) => {
          aiCursor.position = aiCursor.document!.positionAt(aiCursor.document!.offsetAt(aiCursor.position!) + content.length);
        },
        (reason) => {
          console.log("REASON", reason); 
        }
      );

      if (autoSave) {
        // Write the content buffer to the target file
        const contentBuffer = Buffer.from("", "utf8");
        await vscode.workspace.fs.writeFile(aiCursor.document.uri, contentBuffer);
      }
    } catch (e) {
      console.error("ERRROR", e);
    }
  });
}

export async function startWritingComment(aiCursor: AICursor) {
  if (aiCursor.isInComment) {
    console.log("Already in comment");
    return;
  }
  
  if (aiCursor.position === undefined) {
    throw new Error("Position is not set");
  }

  await editDocument(async (edit) => {
    if (aiCursor.document === undefined) { 
      throw new Error("Document is not set");
    }

    if (aiCursor.position === undefined) {
      throw new Error("Position is not set");
    }

    edit.insert(
      aiCursor.document.uri,
      new vscode.Position(aiCursor.position.line, 0),
      `/*\n\n*\/\n\n`
    );
  });

  aiCursor.position = new vscode.Position(aiCursor.position!.line + 1, 0);
}