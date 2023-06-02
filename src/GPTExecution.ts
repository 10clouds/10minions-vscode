import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  editDocument
} from "./AICursor";
import { convertToDiff } from "./convertToDiff";
import { planAndWrite } from "./planAndWrite";
import { prepareModificationInfo } from "./prepareModificationInfo";
import { getRandomProgressMessage } from "./progress";
import { applyDiffToContent } from "./replaceContent";

async function appendToFile(uri: string, content: string) {
  const filePath = vscode.Uri.parse(uri).fsPath;

  try {
    await fs.appendFile(filePath, content);
  } catch (err) {
    console.error('An error occurred while appending to the file:', err);
  }
}

export class GPTExecution {
  readonly fullContent: string;
  readonly documentURI: string;
  readonly workingDocumentURI: string;
  readonly userQuery: string;
  readonly id: string;
  readonly selection: vscode.Selection;
  readonly selectedText: string;
  readonly onStopped: () => void;
  readonly onChanged: () => void;

  stopped: boolean = false;
  unlockDocument?: () => void;
  gptProcedureSubscriptions: vscode.Disposable[] = [];
  rejectProgress?: (error: string) => void;
  resolveProgress?: () => void;
  progress: number;
  executionStage: string;
  
  constructor({
    fullContent,
    documentURI,
    workingDocumentURI,
    userQuery,
    selection,
    selectedText,
    onStopped = () => {},
    onChanged = () => {},
  }: {
    fullContent: string;
    documentURI: string,
    workingDocumentURI: string,
    userQuery: string,
    selection: vscode.Selection,
    selectedText: string,
    onStopped?: () => void,
    onChanged?: () => void,
  }) {
    this.fullContent = fullContent;
    this.documentURI = documentURI;
    this.workingDocumentURI = workingDocumentURI;
    this.userQuery = userQuery;
    this.id = randomUUID();
    this.selection = selection;
    this.selectedText = selectedText;
    this.onStopped = onStopped;
    this.onChanged = onChanged;
    this.progress = 0;
    this.executionStage = "Starting ...";
  }

  public stopExecution(error?: string) {
    if (this.stopped) {
      return;
    }

    this.stopped = true;

    this.gptProcedureSubscriptions.forEach((subscription) => {
      subscription.dispose();
    });

    this.gptProcedureSubscriptions = [];

    if (this.unlockDocument) this.unlockDocument();

    this.unlockDocument = undefined;

    if (this.rejectProgress && error) this.rejectProgress(error);
    else if (this.resolveProgress) this.resolveProgress();

    this.rejectProgress = undefined;
    this.resolveProgress = undefined;

    //delete tmp file
    //vscode.workspace.fs.delete(refDocument.uri);
    this.onStopped();
    this.onChanged();
  }

  public async run() {
    return new Promise<void>(async (resolve, reject) => {
      this.resolveProgress = resolve;
      this.rejectProgress = reject;

      let startTime = Date.now();


      const TOTAL_BIG_TASKS = 3;
      const TOTAL_PROGRESS_FOR_BIG = 95 / TOTAL_BIG_TASKS;
      let currentProgressInBigTask = 0;


      /*let progressMessage = getRandomProgressMessage();
 
          progress.report({
            message: progressMessage,
            increment: 0,
          });*/
      const reportSmallProgress = () => {
        const totalPending = TOTAL_PROGRESS_FOR_BIG - currentProgressInBigTask;
        let increment = totalPending * 0.01;
        this.progress = this.progress + increment / 100;

        currentProgressInBigTask += increment;
        this.onChanged();
      };

      const reportBigTaskFinished = () => {
        this.executionStage = getRandomProgressMessage();
        this.progress = this.progress + (TOTAL_PROGRESS_FOR_BIG - currentProgressInBigTask)  / 100;
        currentProgressInBigTask = 0;
        this.onChanged();
      };

      reportSmallProgress();

      reportSmallProgress();

      appendToFile(this.workingDocumentURI, "User: " + this.userQuery + "\n\n");

      let modification = await planAndWrite(
        this.userQuery,
        this.selection.start,
        this.selectedText,
        this.fullContent,
        async (chunk: string) => {
          reportSmallProgress();

          //escape */ in chunk
          chunk = chunk.replace(/\*\//g, "*\\/");

          appendToFile(this.workingDocumentURI, chunk);
        },
        () => {
          return this.stopped;
        }
      );

      reportBigTaskFinished();

      appendToFile(this.workingDocumentURI, "\n\n");

      const maxAttempts = 1;
      for (let retryAttempt = 1; retryAttempt <= maxAttempts; retryAttempt++) {
        try {

          appendToFile(this.workingDocumentURI, `\n\nGENERATING DIFF (ATTEMPT #${retryAttempt})\n\n`);

          let diff = await convertToDiff(
            this.fullContent,
            modification,
            async (chunk: string) => {
              reportSmallProgress();

              appendToFile(this.workingDocumentURI, chunk);
            }
          );

          let modifiedContent = await applyDiffToContent(
            this.fullContent,
            diff || "???"
          );

          modifiedContent =
            modifiedContent +
            "\n\n" +
            prepareModificationInfo(this.userQuery, startTime);

          await editDocument(async (edit) => {
            let document = await vscode.workspace.openTextDocument(vscode.Uri.parse(this.documentURI));

            edit.replace(
              document.uri,
              new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length - 1)),
              modifiedContent
            );
          });
        } catch (error) {
          // Log the error
          console.error(`Error in retry attempt #${retryAttempt}:`, error);

          // If we reached the maximum number of retries, fall back to comment with modification
          if (retryAttempt === maxAttempts) {
            appendToFile(this.workingDocumentURI, `\nPLAIN COMMENT FALLBACK\n`);

            let document = await vscode.workspace.openTextDocument(vscode.Uri.parse(this.documentURI));

            await editDocument(async (edit) => {
              edit.insert(
                vscode.Uri.parse(this.documentURI),
                new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length),
                `\n\n${prepareModificationInfo(this.userQuery, startTime)}`
              );

              edit.insert(
                vscode.Uri.parse(this.documentURI),
                new vscode.Position(0, 0),
                `/*\n${modification}\n*\/\n\n`
              );
            });
          }
        }
      }

      reportBigTaskFinished();

      vscode.window.showInformationMessage(
        `Finished processing ${this.baseName}`
      );

      //closeAllTmpEditorsFor(workingDocument);
      this.stopExecution();
    });
  }

  get baseName() {
    return path.basename(vscode.Uri.parse(this.documentURI).fsPath);
  }
}
