import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export async function createWorkingdocument(id: string) {
  let sanitizedId = id.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  let tmpFileName = path.join(os.tmpdir(), "👨‍🍳 " + sanitizedId + ".log");

  vscode.window.setStatusBarMessage("CodeCook is working...", 1000);

  const uri = vscode.Uri.file(tmpFileName);

  await vscode.workspace.fs.writeFile(uri, Buffer.from("", "utf8"));

  let workingDocument = await vscode.workspace.openTextDocument(uri);

  return workingDocument;
}
