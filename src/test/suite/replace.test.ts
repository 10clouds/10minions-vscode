import * as assert from "assert";
import { fuzzyReplaceText } from "../../utils/fuzzyReplaceText";

suite("Replace With Sliding Indent Test Suite", () => {
  test("Basic test case: Exact match found", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `      }`
    ].join("\n");
    
    const replaceText = [
      `console.log("Hello, world!");`
    ].join("\n");

    const withText = [
      `console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        console.log("Hello, moon!");`,
      `      }`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Only replace with same indentation", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `      }`,
      `      console.log("Hello, world!");`
    ].join("\n");

    const replaceText = [
      `      console.log("Hello, world!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `      }`,
      `      console.log("Hello, moon!");`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Only replace with same indentation (multiline)", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `      }`,
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`
    ].join("\n");

    const replaceText = [
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `      }`,
      `      console.log("Hello, moon!");`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Only replace with nearest indentation (multiline)", () => {
    const currentCode = [
      `        function example() {`,
      `          console.log("Hello, world!");`, 
      `          console.log("Hello, warg!");`, 
      `        }`,
      `       console.log("Hello, world!");`,
      `       console.log("Hello, warg!");`,
      `        function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `        }`,
    ].join("\n");

    const replaceText = [
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `        function example() {`,
      `          console.log("Hello, world!");`, 
      `          console.log("Hello, warg!");`, 
      `        }`,
      `       console.log("Hello, moon!");`,
      `        function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `        }`,
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Multiline with different indentation", () => {
    const currentCode = [
      `      function example() {`,
      `        if (true) {`,
      `          console.log("Hello, world!");`,
      `          console.log("Hello, warg!");`,
      `        }`,
      `      }`
    ].join("\n");

    const replaceText = [
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`,
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        if (true) {`,
      `          console.log("Hello, moon!");`,
      `        }`,
      `      }`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("First line without indentation", () => {
    const currentCode = [
      `      function example() {`,
      `        if (true) {`,
      `          console.log("Hello, world!");`,
      `          console.log("Hello, warg!");`,
      `        }`,
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`,
      `      }`
    ].join("\n");

    const replaceText = [
      `console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`,
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        if (true) {`,
      `          console.log("Hello, world!");`,
      `          console.log("Hello, warg!");`,
      `        }`,
      `      console.log("Hello, moon!");`,
      `      }`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Fuzzy match with different syntax", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log(say_hello("world"));`,
      `      }`
    ].join("\n");

    const replaceText = [
      `      console.log(say_hello("world"));`
    ].join("\n");

    const withText = [
      `      console.log(say_hello("moon"));`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        console.log(say_hello("moon"));`,
      `      }`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("No match found", () => {
    const currentCode = [
      `      function example() {`,
      `        handleClearAndFocus();`,
      `      }`
    ].join("\n");

    const replaceText = [
      `      console.log("Hello, world!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, undefined);
  });

  test("package main", () => {
    const currentCode = 
`
package main

import "fmt"

func main() {

}
`.trim();

    const replaceText = `func main() {
    }`.trim();

    const withText = `func main() {
  // Print "Hello, World!" to the console
  fmt.Println("Hello, World!")
}`.trim();

const expectedOutput = 
`
package main

import "fmt"

func main() {
  // Print "Hello, World!" to the console
  fmt.Println("Hello, World!")
}
`.trim();

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });

  test("Real life #1", () => {
    const currentCode = `
import * as vscode from "vscode";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { MinionTask } from "../MinionTask";
import { getCommentForLanguage } from "../utils/comments";

export async function stageFallingBackToComment(this: MinionTask) {
  if (this.classification === "AnswerQuestion") {
    return;
  }

  if (this.modificationApplied) {
    return;
  }

  this.reportSmallProgress();

  const language = (await this.document()).languageId || "javascript";

/**
 * Decompose a markdown string into an array of string parts, with
 * comments and code blocks properly formatted based on the document language.
 *
 * @param {string} markdownString The markdown string to decompose.
 * @param {string} languageId The language ID of the document.
 * @returns {string[]} An array of string parts, formatted as comments and code blocks.
 */
function decomposeMarkdownString(markdownString: string, languageId: string): string[] {
  const decomposedStringParts: string[] = [];
  const lines = markdownString.split('\n');
  let inCodeBlock = false;
  let codeLanguage = '';
  
  lines.forEach(line => {
    if (line.startsWith("\`\`\`")) {
      // Switch between code block and comment states.
      inCodeBlock = !inCodeBlock;
      
      // Update codeLanguage when entering a code block.
      if (inCodeBlock) {
        codeLanguage = line.slice(3);
      }
    } else if (inCodeBlock && codeLanguage === languageId) {
      // Add line as is when inside a code block with matching language.
      decomposedStringParts.push(line);
    } else {
      // Add line as a comment when outside of a compatible code block.
      const languageSpecificComment = getCommentForLanguage(languageId, line);
      decomposedStringParts.push(languageSpecificComment);
    }
  });

  return decomposedStringParts;
}

const decomposedString = decomposeMarkdownString(
  \`
Task: \${this.userQuery}

\${this.modificationDescription}
\`.trim(),
  language
).join('\n');

  this.appendToLog( \`\nPLAIN COMMENT FALLBACK\n\`);

  await applyWorkspaceEdit(async (edit) => {
    edit.insert(
      vscode.Uri.parse(this.documentURI),
      new vscode.Position(0, 0),
      decomposedString + "\n"
    );
  });

  this.modificationApplied = true;
}

    `;

    const replaceText = `function decomposeMarkdownString(markdownString: string, languageId: string): string[] {
  const decomposedStringParts: string[] = [];
  const lines = markdownString.split('\n');
  let inCodeBlock = false;
  let codeLanguage = '';
  
  lines.forEach(line => {
    if (line.startsWith("\`\`\`")) {
      // Switch between code block and comment states.
      inCodeBlock = !inCodeBlock;
      
      // Update codeLanguage when entering a code block.
      if (inCodeBlock) {
        codeLanguage = line.slice(3);
      }
    } else if (inCodeBlock && codeLanguage === languageId) {
      // Add line as is when inside a code block with matching language.
      decomposedStringParts.push(line);
    } else {
      // Add line as a comment when outside of a compatible code block.
      const languageSpecificComment = getCommentForLanguage(languageId, line);
      decomposedStringParts.push(languageSpecificComment);
    }
  });

  return decomposedStringParts;
}`;

    const withText = `function decomposeMarkdownString(markdownString: string, languageId: string): string[] {
  const decomposedStringParts: string[] = [];
  const lines = markdownString.split('\n');
  let inCodeBlock = false;
  let codeLanguage = '';
  let commentLines = []; // Added new variable to store lines that will be in the comment block
  
  lines.forEach(line => {
    if (line.startsWith("\`\`\`")) {
      // Switch between code block and comment states.
      inCodeBlock = !inCodeBlock;
      
      if (!inCodeBlock) { // Added condition to handle the lines in the comment block once we exit the code block
        const languageSpecificComment = getCommentForLanguage(languageId, commentLines.join('\n'));
        decomposedStringParts.push(languageSpecificComment);
        commentLines = []; // Reset the commentLines array for further use
      }
      
      // Update codeLanguage when entering a code block.
      if (inCodeBlock) {
        codeLanguage = line.slice(3);
      }
    } else if (inCodeBlock && codeLanguage === languageId) {
      // Add line as is when inside a code block with matching language.
      decomposedStringParts.push(line);
    } else {
      // Add line to commentLines when outside of a compatible code block.
      commentLines.push(line);
    }
  });

  // Handle remaining lines in the comment block after the loop has finished
  if (commentLines.length > 0) {
    const languageSpecificComment = getCommentForLanguage(languageId, commentLines.join('\n'));
    decomposedStringParts.push(languageSpecificComment);
  }

  return decomposedString
}`;

    const expectedOutput = `
import * as vscode from "vscode";
import { applyWorkspaceEdit } from "../applyWorkspaceEdit";
import { MinionTask } from "../MinionTask";
import { getCommentForLanguage } from "../utils/comments";

export async function stageFallingBackToComment(this: MinionTask) {
  if (this.classification === "AnswerQuestion") {
    return;
  }

  if (this.modificationApplied) {
    return;
  }

  this.reportSmallProgress();

  const language = (await this.document()).languageId || "javascript";

/**
 * Decompose a markdown string into an array of string parts, with
 * comments and code blocks properly formatted based on the document language.
 *
 * @param {string} markdownString The markdown string to decompose.
 * @param {string} languageId The language ID of the document.
 * @returns {string[]} An array of string parts, formatted as comments and code blocks.
 */
function decomposeMarkdownString(markdownString: string, languageId: string): string[] {
  const decomposedStringParts: string[] = [];
  const lines = markdownString.split('\n');
  let inCodeBlock = false;
  let codeLanguage = '';
  let commentLines = []; // Added new variable to store lines that will be in the comment block
  
  lines.forEach(line => {
    if (line.startsWith("\`\`\`")) {
      // Switch between code block and comment states.
      inCodeBlock = !inCodeBlock;
      
      if (!inCodeBlock) { // Added condition to handle the lines in the comment block once we exit the code block
        const languageSpecificComment = getCommentForLanguage(languageId, commentLines.join('\n'));
        decomposedStringParts.push(languageSpecificComment);
        commentLines = []; // Reset the commentLines array for further use
      }
      
      // Update codeLanguage when entering a code block.
      if (inCodeBlock) {
        codeLanguage = line.slice(3);
      }
    } else if (inCodeBlock && codeLanguage === languageId) {
      // Add line as is when inside a code block with matching language.
      decomposedStringParts.push(line);
    } else {
      // Add line to commentLines when outside of a compatible code block.
      commentLines.push(line);
    }
  });

  // Handle remaining lines in the comment block after the loop has finished
  if (commentLines.length > 0) {
    const languageSpecificComment = getCommentForLanguage(languageId, commentLines.join('\n'));
    decomposedStringParts.push(languageSpecificComment);
  }

  return decomposedString
}

const decomposedString = decomposeMarkdownString(
  \`
Task: \${this.userQuery}

\${this.modificationDescription}
\`.trim(),
  language
).join('\n');

  this.appendToLog( \`\nPLAIN COMMENT FALLBACK\n\`);

  await applyWorkspaceEdit(async (edit) => {
    edit.insert(
      vscode.Uri.parse(this.documentURI),
      new vscode.Position(0, 0),
      decomposedString + "\n"
    );
  });

  this.modificationApplied = true;
}

    `;

    const result = fuzzyReplaceText({currentCode, replaceText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  
});
