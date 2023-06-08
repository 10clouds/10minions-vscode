import { randomUUID } from "crypto";
import * as path from "path";
import * as vscode from "vscode";
import { STAGES, TOTAL_WEIGHTS as STAGES_TOTAL_WEIGHTS } from "./stages/config";
import { FINISHED_STAGE_NAME, TASK_CLASSIFICATION_NAME } from "./ui/ExecutionInfo";
import { appendToFile } from "./utils/appendToFile";
import { calculateAndFormatExecutionTime } from "./utils/calculateAndFormatExecutionTime";
import { createWorkingdocument } from "./utils/createWorkingdocument";

export class GPTExecution {
  readonly userQuery: string;
  readonly id: string;

  readonly documentURI: string;
  readonly workingDocumentURI: string;
  readonly selection: vscode.Selection;
  readonly selectedText: string;
  readonly onChanged: (important: boolean) => Promise<void>;

  rejectProgress?: (error: string) => void;
  resolveProgress?: () => void;

  //
  // tracking variables between stages
  //
  fullContent: string = "";
  currentStageIndex: number = 0;
  startTime: number = 0;
  modificationDescription: string = "";
  modificationProcedure: string = "";
  modificationApplied: boolean = false;
  stopped: boolean = false;
  progress: number = 0;
  executionStage: string = "";
  classification?: TASK_CLASSIFICATION_NAME;
  waiting: boolean = false;

  constructor({
    id,
    documentURI,
    workingDocumentURI,
    userQuery,
    selection,
    selectedText,
    fullContent,
    startTime,
    onChanged = async (important: boolean) => {},
  }: {
    id: string;
    documentURI: string;
    workingDocumentURI: string;
    userQuery: string;
    selection: vscode.Selection;
    selectedText: string;
    fullContent: string;
    startTime: number;
    onChanged?: (important: boolean) => Promise<void>;
  }) {
    this.id = id;
    this.documentURI = documentURI;
    this.workingDocumentURI = workingDocumentURI;
    this.userQuery = userQuery;
    this.selection = selection;
    this.selectedText = selectedText;
    this.fullContent = fullContent;
    this.startTime = startTime;
    this.onChanged = onChanged;
  }

  static async create({
    userQuery,
    document,
    selection,
    selectedText,
    onChanged,
  }: {
    userQuery: string;
    document: vscode.TextDocument;
    selection: vscode.Selection;
    selectedText: string;
    onChanged: (important: boolean) => Promise<void>;
  }): Promise<GPTExecution> {
    const executionId = randomUUID();
    const workingDocument = await createWorkingdocument(executionId);

    return new GPTExecution({
      id: executionId,
      documentURI: document.uri.toString(),
      workingDocumentURI: workingDocument.uri.toString(),
      userQuery,
      selection,
      selectedText,
      fullContent: await document.getText(),
      startTime: Date.now(),
      onChanged,
    });
  }

  public async document() {
    let document = await vscode.workspace.openTextDocument(vscode.Uri.parse(this.documentURI));
    return document;
  }

  public async stopExecution(error?: string, important: boolean = true) {
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
    await this.onChanged(important);
  }

  public reportSmallProgress(fractionOfBigTask: number = 0.005) {
    const weigtsNextStepTotal = STAGES.reduce((acc, stage, index) => {
      if (index > this.currentStageIndex) {
        return acc;
      }
      return acc + stage.weight;
    }, 0);

    const remainingProgress = (1.0 * weigtsNextStepTotal) / STAGES_TOTAL_WEIGHTS;
    const currentProgress = this.progress;

    const totalPending = remainingProgress - currentProgress;
    let increment = totalPending * fractionOfBigTask;
    this.progress = this.progress + increment;
    this.onChanged(false);
  }

  public async run() {
    return new Promise<void>(async (resolve, reject) => {
      this.resolveProgress = resolve;
      this.rejectProgress = reject;
      this.currentStageIndex = 0;

      try {
        while (this.currentStageIndex < STAGES.length && !this.stopped) {
          this.executionStage = STAGES[this.currentStageIndex].name;

          appendToFile(
            this.workingDocumentURI,
            [
              `////////////////////////////////////////////////////////////////////////////////`,
              `// Stage ${this.currentStageIndex + 1}: ${this.executionStage}`,
              `////////////////////////////////////////////////////////////////////////////////`,
            ].join("\n") + "\n\n"
          );

          await STAGES[this.currentStageIndex].execution.apply(this);

          if (this.stopped) {
            break;
          }

          const weigtsNextStepTotal = STAGES.reduce((acc, stage, index) => {
            if (index > this.currentStageIndex) {
              return acc;
            }
            return acc + stage.weight;
          }, 0);

          this.progress = weigtsNextStepTotal / STAGES_TOTAL_WEIGHTS;
          this.onChanged(false);
          this.currentStageIndex++;
        }
      } catch (error) {
        if (error !== "Canceled by user") {
          vscode.window.showErrorMessage(`Error in execution: ${error}`);
          console.log("Error in execution", error);
        }

        this.stopExecution(String(error));
      } finally {
        const executionTime = Date.now() - this.startTime;
        const formattedExecutionTime = calculateAndFormatExecutionTime(executionTime);

        await appendToFile(this.workingDocumentURI, `${this.executionStage} (Execution Time: ${formattedExecutionTime})\n\n`);
        this.progress = 1;
      }
    });
  }

  get baseName() {
    return path.basename(vscode.Uri.parse(this.documentURI).fsPath);
  }
}
