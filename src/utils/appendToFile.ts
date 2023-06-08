import { promises as fs } from "fs";
import * as vscode from "vscode";

/**
 * Appends the given content to the specified file asynchronously.
 * 
 * @export
 * @param {string} uri - The URI representing the file's path.
 * @param {string} content - The content to append to the file.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
export async function appendToFileSync(uri: string, content: string) {
  const filePath = vscode.Uri.parse(uri).fsPath;
  
  try {
    await fs.appendFile(filePath, content);
  } catch (err) {
    console.error("An error occurred while appending to the file:", err);
  }
}
