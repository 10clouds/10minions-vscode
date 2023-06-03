import { promises as fs } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { applyWorkspaceEdit } from "./applyWorkspaceEdit";
import { planAndWrite } from "./planAndWrite";
import { prepareModificationInfo } from "./prepareModificationInfo";
import { FINISHED_STAGE_NAME } from "./ExecutionInfo";
import { playNotificationSound } from "./playSound";
import { applyConsolidated, createConsolidated } from "./createConsilidated";

async function clearFile(uri: string, content: string = "") {
  const filePath = vscode.Uri.parse(uri).fsPath;

  try {
    await fs.writeFile(filePath, content); 
  } catch (err) {
    console.error("An error occurred while writing to the file:", err);
  }
}

async function appendToFile(uri: string, content: string) {
  const filePath = vscode.Uri.parse(uri).fsPath;

  try {
    await fs.appendFile(filePath, content);
  } catch (err) {
    console.error("An error occurred while appending to the file:", err);
  }
}

export class GPTExecution {
  fullContent: string;
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
    this.executionStage = error ? error : FINISHED_STAGE_NAME;

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

      let document = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(this.documentURI)
      );

      clearFile(this.workingDocumentURI);

      this.fullContent = document.getText();//.replace(/\n{2,}/g, '\n\n'); //Remove extra empty lines, this really helps with the AI

      const STAGES = [
        {
          name: "Starting ...",
          weight: 10,
          execution: async () => {
            reportSmallProgress();

            await appendToFile(
              this.workingDocumentURI,
              "File: " + this.baseName + "\n\n"
            );

            await appendToFile(
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

                await appendToFile(this.workingDocumentURI, chunk);                
              },
              () => {
                return this.stopped;
              }
            );

            reportSmallProgress();
            await appendToFile(this.workingDocumentURI, "\n\n");
          },
        },
        {
          name: "Consolidating result ...", 
          weight: 33,
          execution: async () => {
            if (diffApplied) {
              return;
            }
      
            try {
              await appendToFile(
                this.workingDocumentURI,
                `\nGENERATING CONSOLIDATION\n\n`
              );
    
              let consolidated = await createConsolidated(
                this.fullContent,
                modification,
                async (chunk: string) => {
                  reportSmallProgress();
    
                  await appendToFile(this.workingDocumentURI, chunk);
                }
              );
    
              //Update full content
              this.fullContent = document.getText();//.replace(/\n{2,}/g, '\n\n'); //Remove extra empty lines, this really helps with the AI
    
              let modifiedContent = applyConsolidated(
                this.fullContent,
                consolidated
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
                `\CONSOLIDATION SUCCESFULY APPLIED\n\n`
              );
            } catch (error) {
              await appendToFile(
                this.workingDocumentURI,
                `\n\nError in applying consolidation: ${error}\n`
              );
            }
          }
        },
        {
          name: "Falling back to comment ...", 
          weight: 10,
          execution: async () => {
            if (diffApplied) {
              return;
            }

            await appendToFile(
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
                `/*\n10Clouds CodeMind: I was unable to modify the code myself, but you can do it yourself based on my remarks below:\n\n${modification.replace(/\*\//g, "*\\/")}\n*\/\n\n`
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

            playNotificationSound();
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
      console.log("Finished");
    });
  }

  get baseName() {
    return path.basename(vscode.Uri.parse(this.documentURI).fsPath);
  }
}
