import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { convertToDiff } from "./convertToDiff";
import { planAndWrite } from "./planAndWrite";
import { prepareModificationInfo } from "./prepareModificationInfo";
import { getRandomProgressMessage } from "./progress";
import { applyDiffToContent } from "./replaceContent";
import { applyWorkspaceEdit } from "./applyWorkspaceEdit";

async function appendToFile(uri: string, content: string) {
  const filePath = vscode.Uri.parse(uri).fsPath;

  try {
    await fs.appendFile(filePath, content);
  } catch (err) {
    console.error("An error occurred while appending to the file:", err);
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
    id,
    fullContent,
    documentURI,
    workingDocumentURI,
    userQuery,
    selection,
    selectedText,
    onStopped = () => {},
    onChanged = () => {},
  }: {
    id: string;
    fullContent: string;
    documentURI: string;
    workingDocumentURI: string;
    userQuery: string;
    selection: vscode.Selection;
    selectedText: string;
    onStopped?: () => void;
    onChanged?: () => void;
  }) {
    this.id = id;
    this.fullContent = fullContent;
    this.documentURI = documentURI;
    this.workingDocumentURI = workingDocumentURI;
    this.userQuery = userQuery;
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
    this.executionStage = error? error : "Finished";

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

      let currentStageIndex = 0;
      let modification = "";
      let diffApplied = false;


      const tryToApplyDiff = async (retryAttempt: number) => {
        if (diffApplied) {
          return;
        }

        try {
          await appendToFile(
            this.workingDocumentURI,
            `\nGENERATING DIFF (ATTEMPT #${retryAttempt})\n\n`
          );

          let diff = await convertToDiff(
            this.fullContent,
            modification,
            async (chunk: string) => {
              reportSmallProgress();

              await appendToFile(this.workingDocumentURI, chunk);
            }
          );

          let document = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(this.documentURI)
          );
          let currentContent = document.getText();//.replace(/\n{2,}/g, '\n\n'); //Remove extra empty lines, this really helps with the AI

          let modifiedContent = await applyDiffToContent(
            currentContent,
            diff || "???"
          );

          modifiedContent =
            modifiedContent +
            "\n\n" +
            prepareModificationInfo(this.userQuery, startTime);

          await applyWorkspaceEdit(async (edit) => {
            let document = await vscode.workspace.openTextDocument(
              vscode.Uri.parse(this.documentURI)
            );

            edit.replace(
              document.uri,
              new vscode.Range(
                new vscode.Position(0, 0),
                document.positionAt(document.getText().length - 1)
              ),
              modifiedContent
            );
          });

          diffApplied = true;

          await appendToFile(
            this.workingDocumentURI,
            `\nDIFF SUCCESFULY APPLIED\n\n`
          );
        } catch (error) {
          appendToFile(
            this.workingDocumentURI,
            `\n\nError in applying diff: ${error}\n`
          );
        }
      };

      const STAGES = [
        {
          name: "Starting ...",
          weight: 10,
          execution: async () => {
            reportSmallProgress();

            appendToFile(
              this.workingDocumentURI,
              "File: " + this.baseName + "\n\n"
            );

            appendToFile(
              this.workingDocumentURI,
              "User: " + this.userQuery + "\n\n"
            );

          },
        },
        {
          name: "Planning ...",
          weight: 100,
          execution: async () => {
            modification = await planAndWrite(
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

            reportSmallProgress();
            appendToFile(this.workingDocumentURI, "\n\n");
          },
        },
        {
          name: "Applying (1st attempt) ...", 
          weight: 33,
          execution: async () => {
            await tryToApplyDiff(1);
          }
        },
        {
          name: "Applying (2nd attempt) ...", 
          weight: 33,
          execution: async () => {
            await tryToApplyDiff(2);
          }
        },
        {
          name: "Falling back to comment ...", 
          weight: 10,
          execution: async () => {
            if (diffApplied) {
              return;
            }

            appendToFile(
              this.workingDocumentURI,
              `\nPLAIN COMMENT FALLBACK\n`
            );

            let document = await vscode.workspace.openTextDocument(
              vscode.Uri.parse(this.documentURI)
            );

            await applyWorkspaceEdit(async (edit) => {
              edit.insert(
                vscode.Uri.parse(this.documentURI),
                new vscode.Position(
                  document.lineCount - 1,
                  document.lineAt(document.lineCount - 1).text.length
                ),
                `\n\n${prepareModificationInfo(
                  this.userQuery,
                  startTime
                )}`
              );

              edit.insert(
                vscode.Uri.parse(this.documentURI),
                new vscode.Position(0, 0),
                `/*\n10Clouds CodeMind: I was unable to modify the code myself, but you can do it yourself based on my remarks below:\n\n${modification}\n*\/\n\n`
              );
            });

            diffApplied = true;
          }
        },
        {
          name: "Finishing ...",
          weight: 10,
          execution: async () => {
            vscode.window.showInformationMessage(
              `Finished processing ${this.baseName}`
            );

            this.stopExecution();
          },
        },
      ];

      const TOTAL_WEIGHTS = STAGES.reduce((acc, stage) => {
        return acc + stage.weight;
      }, 0);
      
      const reportSmallProgress = (fractionOfBigTask: number = 0.005) => {
        const weigtsNextStepTotal = STAGES.reduce((acc, stage, index) => {
          if (index > currentStageIndex) {
            return acc;
          }
          return acc + stage.weight;
        }, 0);
        
        const remainingProgress = 1.0 * weigtsNextStepTotal / TOTAL_WEIGHTS;
        const currentProgress = this.progress;

        const totalPending = remainingProgress - currentProgress;
        let increment = totalPending * fractionOfBigTask;
        this.progress = this.progress + increment;
        this.onChanged();
      };

      while (currentStageIndex < STAGES.length) {
        this.executionStage = STAGES[currentStageIndex].name; // getRandomProgressMessage();

        await STAGES[currentStageIndex].execution();


        const weigtsNextStepTotal = STAGES.reduce((acc, stage, index) => {
          if (index > currentStageIndex) {
            return acc;
          }
          return acc + stage.weight;
        }, 0);

        this.progress = weigtsNextStepTotal / TOTAL_WEIGHTS;
        this.onChanged();
        currentStageIndex++;
      }
    });
  }

  get baseName() {
    return path.basename(vscode.Uri.parse(this.documentURI).fsPath);
  }
}
