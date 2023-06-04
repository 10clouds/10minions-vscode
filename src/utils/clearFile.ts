import { promises as fs } from "fs";
import * as vscode from "vscode";

export async function clearFile(uri: string, content: string = "") {
  const filePath = vscode.Uri.parse(uri).fsPath;

  try {
    await fs.writeFile(filePath, content);
  } catch (err) {
    console.error("An error occurred while writing to the file:", err);
  }
}
