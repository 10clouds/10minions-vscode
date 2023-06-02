import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export async function createWorkingdocument(id: string) {
  //sanitize id for file name
  let sanitizedId = id.replace(/[^a-z0-9]/gi, "_").toLowerCase();

  let tmpFileName = path.join(os.tmpdir(), "🧠 " + sanitizedId  + ".log");

  vscode.window.setStatusBarMessage("CodeMind is working...", 1000);

  const uri = vscode.Uri.file(tmpFileName);

  // Convert the document content to a Buffer
  const contentBuffer = Buffer.from("", "utf8");

  // Write the content buffer to the target file
  await vscode.workspace.fs.writeFile(uri, contentBuffer);

  let workingDocument = await vscode.workspace.openTextDocument(uri);

  return workingDocument;
}
