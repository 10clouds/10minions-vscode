import * as vscode from "vscode";
import { MinionTasksManager } from "./MinionTasksManager";
import * as fs from 'fs';
import path from "path";

const settings = `
"10minions.taskCommentKeyword": {
  "type": "string",
  "default": "TODO",
  "markdownDescription": "Specify the comment keyword that Minions will look for to automatically run tasks (leave it empty to disable this functionality)",
  "order": 3
},
"10minions.taskCommentScanPattern": {
  "type": "string",
  "default": "{**/*.js,**/*.ts,**/*.java,**/*.py,**/*.cpp,**/*.c,**/*.cs,**/*.rb,**/*.go,**/*.php,**/*.rs,**/*.kt,**/*.groovy,**/*.swift,**/*.m,**/*.hs,**/*.jl,**/*.r,**/*.pl,**/*.lua,**/*.scala,**/*.clj,**/*.elm,**/*.erl,**/*.purs,**/*.v,**/*.cr,**/*.dart,**/*.h,**/*.hpp,**/*.sh,**/*.bash}",
  "markdownDescription": "Specify the glob pattern that 10minions will use to scan for tasks in files. \n Default includes common programming language files, but not text files.",
  "order": 4
}`;

class TodoCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const todoPattern = /\/\/\s*TODO: (.*)/;
    const todoLocations = [];
    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const lineOfText = document.lineAt(lineNum);
      const match = todoPattern.exec(lineOfText.text);
      const todoMessage = match?.[1] || "";
      if (match) {
        const rangeForSelection = new vscode.Range(new vscode.Position(lineNum, match.index), new vscode.Position(lineNum, match.index + match[0].length));
        const selection = new vscode.Selection(rangeForSelection.start, rangeForSelection.end);
        
        let existing = MinionTasksManager.instance.getExecutionByUserQueryAndDoc(todoMessage, document);
        if (existing) {
          const todoCodeLens = new vscode.CodeLens(rangeForSelection, { command: "10minions.stopTask", title: existing.executionStage, arguments: [existing.id] });

          todoLocations.push(todoCodeLens);
        } else {
          const todoCodeLens = new vscode.CodeLens(rangeForSelection, { command: "10minions.executeTask", title: "Execute task", arguments: [document.uri, selection, todoMessage] });

          todoLocations.push(todoCodeLens);
        }

        
      }
    }
    return todoLocations;
  }

  public resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens {
    // Here simply return the given code lens as this function mainly enhance the code lens (e.g. with real executable commands) and we already injected the command in provideCodeLenses
    return codeLens;
  }
}

//TODO: Add a lot of logging to this class so it's easy to track what is going on.

export class MinionTaskAutoRunner {
  public static instance: MinionTaskAutoRunner;

  private diagnosticsCollection: vscode.DiagnosticCollection;  // define diagnosticsCollection

  /**
   * Scan TypeScript files for TODO comments and output their path, line number, and text.
   */
  scanTODOComments(rootDir: string) {
    const tsFiles = fs.readdirSync(rootDir).filter((file) => path.extname(file) === ".ts");

    tsFiles.forEach((file: string) => {

      const lines = fs.readFileSync(path.join(rootDir, file)).toString().split("\n");

      lines.forEach((line: string, lineNumber: number) => {
        if (line.includes("//TODO:")) {
          const diagnostic = new vscode.Diagnostic(new vscode.Range(lineNumber, 0, lineNumber, 0), line.trim(), vscode.DiagnosticSeverity.Information);

          this.diagnosticsCollection.set(vscode.Uri.file(path.join(rootDir, file)), [diagnostic]); // use this.diagnosticsCollection instead of undefined 'diagnostics'
        }
      });
    });
  }

  constructor(context: vscode.ExtensionContext) {
    this.diagnosticsCollection = vscode.languages.createDiagnosticCollection('todoDiagnostics');  // initialization of diagnosticsCollection

    this.monitorFilesForTasks();

    context.subscriptions.push(
      vscode.commands.registerCommand("10minions.executeTask", async (uri: vscode.Uri, selection: vscode.Selection, todoMessage: string) => {
        //const selectionStart = Math.max(0, lineNumber - 10);
        //const selectionEnd = Math.min(lines.length, lineNumber + 20 + 1);
        //const selection = new vscode.Selection(selectionStart, 0, selectionEnd, 0);
        MinionTasksManager.instance.runMinionOnCurrentSelectionAndEditor(
          todoMessage,
          await vscode.workspace.openTextDocument(uri),
          selection
        );
      })
    );

    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: "file" }, new TodoCodeLensProvider()));

    if (MinionTaskAutoRunner.instance) {
      throw new Error("ExecutionsManager already instantiated");
    }

    MinionTaskAutoRunner.instance = this;
  }

  private monitorFilesForTasks() {
    //TODO: Use the scan pattern to filter out files that we don't want to scan.


    //TOOD: Initially check for tasks in all files, make it slow, and throttled, so we don't kill the entire system.
    //TODO: Any changes to the file should cancel the timeout AND if the minion is working on this, it should cancel the minion as well.
  }

  private checkForTaskComments(document: vscode.TextDocument) {
    const taskCommentKeyword = vscode.workspace.getConfiguration("10minions").get<string>("taskCommentKeyword");

    if (!taskCommentKeyword || !document) {
      return;
    }

    const pattern = new RegExp(`(${taskCommentKeyword}: .*)`, "g");
    const lines = document.getText().split("\n");
  }
}
