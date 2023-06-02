import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export async function createWorkingdocument(fileName: string) {
  let tmpFileName = path.join(os.tmpdir(), "🧠 " + path.basename(fileName, path.extname(fileName)))  + ".log";

  vscode.window.setStatusBarMessage("CodeMind is working...", 1000);

  const uri = vscode.Uri.file(tmpFileName);

  // Convert the document content to a Buffer
  const contentBuffer = Buffer.from("", "utf8");

  // Write the content buffer to the target file
  await vscode.workspace.fs.writeFile(uri, contentBuffer);

  let workingDocument = await vscode.workspace.openTextDocument(uri);

  return workingDocument;
}
