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
  readonly onChanged: (important: boolean) => void;
  readonly STAGES: any[];
  readonly TOTAL_WEIGHTS: number;

  rejectProgress?: (error: string) => void;
  resolveProgress?: () => void;

  // Add a new section for tracking variables between stages
  startTime: number = 0;
  modification: string = "";
  diffApplied: boolean = false;
  stopped: boolean = false;
  progress: number = 0;
  executionStage: string = "Starting ...";

  constructor({
    id,
    documentURI,
    workingDocumentURI,
    userQuery,
    selection,
    selectedText,
    onStopped = () => {},
    onChanged = (important: boolean) => {},
  }: {
    id: string;
    documentURI: string;
    workingDocumentURI: string;
    userQuery: string;
    selection: vscode.Selection;
    selectedText: string;
    onStopped?: () => void;
    onChanged?: (important: boolean) => void;
  }) {
    this.id = id;
    this.fullContent = "";
    this.documentURI = documentURI;
    this.workingDocumentURI = workingDocumentURI;
    this.userQuery = userQuery;
    this.selection = selection;
    this.selectedText = selectedText;
    this.onStopped = onStopped;
    this.onChanged = onChanged;

    this.STAGES = [
      {
        name: "Starting ...",
        weight: 10,
        execution: this.startingStage.bind(this),
      },
      {
        name: "Planning ...",
        weight: 100,
        execution: this.planningStage.bind(this),
      },
      {
        name: "Consolidating result ...",
        weight: 100,
        execution: this.consolidatingResultStage.bind(this),
      },
      {
        name: "Falling back to comment ...",
        weight: 10,
        execution: this.fallingBackToCommentStage.bind(this),
      },
      {
        name: "Finishing ...",
        weight: 10,
        execution: this.finishingStage.bind(this),
      },
    ];

    this.TOTAL_WEIGHTS = this.STAGES.reduce((acc, stage) => {
      return acc + stage.weight;
    }, 0);
  }

  public stopExecution(error?: string) {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    this.executionStage = error ? error : FINISHED_STAGE_NAME;

    if (this.rejectProgress && error) this.rejectProgress(error);
    else if (this.resolveProgress) this.resolveProgress();

    this.rejectProgress = undefined;
    this.resolveProgress = undefined;

    //delete tmp file
    //vscode.workspace.fs.delete(refDocument.uri);
    this.onStopped();
    this.onChanged(true);
  }

  public async run() {
    return new Promise<void>(async (resolve, reject) => {
      this.resolveProgress = resolve;
      this.rejectProgress = reject;

      for (
        let currentStageIndex = 0;
        currentStageIndex < this.STAGES.length;
        currentStageIndex++
      ) {
        this.executionStage = this.STAGES[currentStageIndex].name;

        await this.STAGES[currentStageIndex].execution();

        const weigtsNextStepTotal = this.STAGES.reduce((acc, stage, index) => {
          if (index > currentStageIndex) {
            return acc;
          }
          return acc + stage.weight;
        }, 0);

        this.progress = weigtsNextStepTotal / this.TOTAL_WEIGHTS;
        this.onChanged(false);
      }
      console.log("Finished");
    });
  }

  private async startingStage() {
    this.startTime = Date.now(); // Assign startTime
    this.diffApplied = false;
    this.modification = "";
    this.stopped = false;
    this.progress = 0;
    this.executionStage = "Starting ...";

    let document = await vscode.workspace.openTextDocument(
      vscode.Uri.parse(this.documentURI)
    );

    this.fullContent = document.getText();

    clearFile(this.workingDocumentURI);

    this.reportSmallProgress(0);
    await appendToFile(
      this.workingDocumentURI,
      "File: " + this.baseName + "\n\n"
    );

    this.reportSmallProgress(0);
    await appendToFile(
      this.workingDocumentURI,
      "User: " + this.userQuery + "\n\n"
    );
  }

  private async planningStage() {
    this.modification = await planAndWrite(
      this.userQuery,
      this.selection.start,
      this.selectedText,
      this.fullContent,
      async (chunk: string) => {
        this.reportSmallProgress(1);
        await appendToFile(this.workingDocumentURI, chunk);
      },
      () => {
        return this.stopped;
      }
    );

    this.reportSmallProgress(1);
    await appendToFile(this.workingDocumentURI, "\n\n");
  }

  private async document() {
    let document = await vscode.workspace.openTextDocument(
      vscode.Uri.parse(this.documentURI)
    );
    return document;
  }

  private async consolidatingResultStage() {
    if (this.diffApplied) {
      // Update the reference
      return;
    }

    try {
      this.reportSmallProgress(2);
      await appendToFile(
        this.workingDocumentURI,
        `\nGENERATING CONSOLIDATION\n\n`
      );

      let consolidated = await createConsolidated(
        this.fullContent,
        this.modification,
        async (chunk: string) => {
          this.reportSmallProgress(2);
          await appendToFile(this.workingDocumentURI, chunk);
        }
      );

      let document = await this.document();
      this.fullContent = document.getText();

      let modifiedContent = applyConsolidated(this.fullContent, consolidated);

      modifiedContent =
        modifiedContent +
        "\n\n" +
        prepareModificationInfo(this.userQuery, this.startTime);

      await applyWorkspaceEdit(async (edit) => {
        edit.replace(
          document.uri,
          new vscode.Range(
            new vscode.Position(0, 0),
            document.positionAt(document.getText().length - 1)
          ),
          modifiedContent
        );
      });

      this.diffApplied = true;

      this.reportSmallProgress(2);
      await appendToFile(
        this.workingDocumentURI,
        `\n\nCONSOLIDATION SUCCESFULY APPLIED\n\n`
      );
    } catch (error) {
      this.reportSmallProgress(2);
      await appendToFile(
        this.workingDocumentURI,
        `\n\nError in applying consolidation: ${error}\n`
      );
    }
  }

  private async fallingBackToCommentStage() {
    if (this.diffApplied) {
      // Update the reference
      return;
    }

    this.reportSmallProgress(3);
    await appendToFile(this.workingDocumentURI, `\nPLAIN COMMENT FALLBACK\n`);

    let document = await this.document();

    await applyWorkspaceEdit(async (edit) => {
      /*edit.insert(
        vscode.Uri.parse(this.documentURI),
        new vscode.Position(
          document.lineCount - 1,
          document.lineAt(document.lineCount - 1).text.length
        ),
        `\n\n${prepareModificationInfo(this.userQuery, this.startTime)}`
      );*/

      edit.insert(
        vscode.Uri.parse(this.documentURI),
        new vscode.Position(0, 0),
        `/*\n10Clouds CodeMind: I was unable to modify the code myself, but you can do it yourself based on my remarks below:\n\n${this.modification.replace(
          /\*\//g,
          "*\\/"
        )}\n*\/\n\n`
      );
    });

    this.diffApplied = true;
  }

  private async finishingStage() {
    vscode.window.showInformationMessage(
      `Finished processing ${this.baseName}`
    );

    this.stopExecution();

    playNotificationSound();
  }

  reportSmallProgress(
    currentStageIndex: number,
    fractionOfBigTask: number = 0.005
  ) {
    const weigtsNextStepTotal = this.STAGES.reduce((acc, stage, index) => {
      if (index > currentStageIndex) {
        return acc;
      }
      return acc + stage.weight;
    }, 0);

    const remainingProgress = (1.0 * weigtsNextStepTotal) / this.TOTAL_WEIGHTS;
    const currentProgress = this.progress;

    const totalPending = remainingProgress - currentProgress;
    let increment = totalPending * fractionOfBigTask;
    this.progress = this.progress + increment;
    this.onChanged(false);
  }

  get baseName() {
    return path.basename(vscode.Uri.parse(this.documentURI).fsPath);
  }
}
