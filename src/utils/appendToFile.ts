import { promises as fs } from "fs";
import * as vscode from "vscode";

export async function appendToFile(uri: string, content: string) {
  const filePath = vscode.Uri.parse(uri).fsPath;

  try {
    await fs.appendFile(filePath, content);
  } catch (err) {
    console.error("An error occurred while appending to the file:", err);
  }
}
