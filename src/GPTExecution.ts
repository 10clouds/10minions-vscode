import * as path from "path";
import * as vscode from "vscode";
import { FINISHED_STAGE_NAME } from "./ui/ExecutionInfo";
import { TASK_CLASSIFICATION_NAME } from "./stages/2_stageClassifyTask";
import { stageStarting } from "./stages/1_stageStarting";
import { stageClassifyTask } from "./stages/2_stageClassifyTask";
import { stageCreateModification } from "./stages/3_stageCreateModification";
import { stageCreateModificationProcedure } from "./stages/4_stageCreateModificationProcedure";
import { stageFallingBackToComment } from "./stages/6_stageFallingBackToComment";
import { stageFinishing } from "./stages/7_stageFinishing";
import { stageApplyModificationProcedure } from "./stages/5_stageApplyModificationProcedure";
import { appendToFile } from "./utils/appendToFile";

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
  currentStageIndex: number = 0;

  // Add a new section for tracking variables between stages
  startTime: number = 0;
  modificationDescription: string = "";
  modificationProcedure: string = "";
  modificationApplied: boolean = false;
  stopped: boolean = false;
  progress: number = 0;
  executionStage: string = "Starting ...";
  classification: TASK_CLASSIFICATION_NAME = "AnswerQuestion";

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
        execution: stageStarting.bind(this),
      },
      {
        name: "Understanding ...",
        weight: 50,
        execution: stageClassifyTask.bind(this),
      },
      {
        name: "Conceptualising ...",
        weight: 100,
        execution: stageCreateModification.bind(this),
      },
      {
        name: "Preparing Changes ...",
        weight: 80,
        execution: stageCreateModificationProcedure.bind(this),
      },
      {
        name: "Applying Changes ...",
        weight: 20,
        execution: stageApplyModificationProcedure.bind(this),
      },
      {
        name: "Readjusting ...",
        weight: 10,
        execution: stageFallingBackToComment.bind(this),
      },
      {
        name: "Finishing ...",
        weight: 10,
        execution: stageFinishing.bind(this),
      },
    ];

    this.TOTAL_WEIGHTS = this.STAGES.reduce((acc, stage) => {
      return acc + stage.weight;
    }, 0);
  }

  public async document() {
    let document = await vscode.workspace.openTextDocument(vscode.Uri.parse(this.documentURI));
    return document;
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
    this.startTime = Date.now(); // Initialize startTime
    return new Promise<void>(async (resolve, reject) => {
      this.resolveProgress = resolve;
      this.rejectProgress = reject;
      this.currentStageIndex = 0;

      try {
        while (this.currentStageIndex < this.STAGES.length && !this.stopped) {
          this.executionStage = this.STAGES[this.currentStageIndex].name;

          await this.STAGES[this.currentStageIndex].execution();

          if (this.stopped) {
            break;
          }

          const weigtsNextStepTotal = this.STAGES.reduce((acc, stage, index) => {
            if (index > this.currentStageIndex) {
              return acc;
            }
            return acc + stage.weight;
          }, 0);

          this.progress = weigtsNextStepTotal / this.TOTAL_WEIGHTS;
          this.onChanged(false);
          this.currentStageIndex++;
        }

        console.log("Finished");
      } catch (error) {
        if (error !== "Canceled by user") {
          vscode.window.showErrorMessage(`Error in execution: ${error}`);
          console.log("Error in execution", error);
        }
        
        this.stopExecution(String(error));
      } finally {
        const executionTime = Date.now() - this.startTime;

        // Convert the execution time to a human-readable format
        const executionTimeSec = executionTime / 1000;
        const hours = Math.floor(executionTimeSec / 3600);
        const remainingSecAfterHours = executionTimeSec % 3600;
        const minutes = Math.floor(remainingSecAfterHours / 60);
        const remainingSecAfterMinutes = remainingSecAfterHours % 60;
        // Display hours segment only if hours are greater than 0
        const hoursSegment = hours > 0 ? `${hours}h ` : "";

        // Display minutes segment only if minutes are greater than 0
        const minutesSegment = minutes > 0 ? `${minutes}m ` : "";

        // Display seconds segment, no need for a condition since seconds will always be displayed
        const secondsSegment = `${remainingSecAfterMinutes.toFixed(2)}s`;

        // Combine all segments to create the humanReadableExecutionTime
        const humanReadableExecutionTime = `${hoursSegment}${minutesSegment}${secondsSegment}`;

        await appendToFile(
          this.workingDocumentURI,
          `${this.executionStage} (Execution Time: ${humanReadableExecutionTime})\n\n`
        );
        this.progress = 1;
      }
    });
  }

  reportSmallProgress(fractionOfBigTask: number = 0.005) {
    const weigtsNextStepTotal = this.STAGES.reduce((acc, stage, index) => {
      if (index > this.currentStageIndex) {
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
