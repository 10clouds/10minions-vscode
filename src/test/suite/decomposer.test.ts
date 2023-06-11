import * as assert from "assert";
import { decomposeMarkdownString } from "../../utils/decomposeMarkdownString";

suite("Replace With Sliding Indent Test Suite", () => {
  test("Basic test case: Exact match found", () => {
    const currentCode = `
Task: Implement this

Step 1: Plan
To implement the missing functionality after the "//Make sure that our document is visible and the selection is visible" comment, we need to make sure the document editor is visible at the current selection. We can use the "revealRange" function in the editor.

Step 2: Code modification
Replace the comment with the following code:

\`\`\`typescript
// Reveal the range of the selected text in the editor
if (editor) {
  editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
\`\`\`

Here's the final modified segment:
\`\`\`typescript
// ...
if (minionTask) {
  const document = await minionTask.document();
  const editor = await vscode.window.showTextDocument(document);

  let { startIndex, endIndex, confidence } = fuzzyFindText({ currentCode: document.getText(), findText: minionTask.selectedText });

  if (confidence > 0.75) {
    const startPos = editor.document.positionAt(startIndex);
    const endPos = editor.document.positionAt(endIndex);
    editor.selection = new vscode.Selection(startPos, endPos);
  } else {
    editor.selection = minionTask.selection;
  }

  // Reveal the range of the selected text in the editor
  if (editor) {
    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

} else {
  vscode.window.showErrorMessage(\`Minion task not found.\`);
}
// ...
\`\`\`

`;
    
    const expectedOutput = `/*
Task: Implement this

Step 1: Plan
To implement the missing functionality after the "//Make sure that our document
is visible and the selection is visible" comment, we need to make sure the
document editor is visible at the current selection. We can use the
"revealRange" function in the editor.

Step 2: Code modification
Replace the comment with the following code:
*/

// Reveal the range of the selected text in the editor
if (editor) {
  editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/*
Here's the final modified segment:
*/

// ...
if (minionTask) {
  const document = await minionTask.document();
  const editor = await vscode.window.showTextDocument(document);

  let { startIndex, endIndex, confidence } = fuzzyFindText({ currentCode: document.getText(), findText: minionTask.selectedText });

  if (confidence > 0.75) {
    const startPos = editor.document.positionAt(startIndex);
    const endPos = editor.document.positionAt(endIndex);
    editor.selection = new vscode.Selection(startPos, endPos);
  } else {
    editor.selection = minionTask.selection;
  }

  // Reveal the range of the selected text in the editor
  if (editor) {
    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

} else {
  vscode.window.showErrorMessage(\`Minion task not found.\`);
}
// ...
`;

    let result = decomposeMarkdownString(currentCode, "tsx").join("\n");
    assert.strictEqual(result, expectedOutput);
  });
});



