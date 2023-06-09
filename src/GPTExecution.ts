import { randomUUID } from "crypto";
import * as path from "path";
import * as vscode from "vscode";
import { STAGES, TOTAL_WEIGHTS as STAGES_TOTAL_WEIGHTS } from "./stages/config";
import { CANCELED_STAGE_NAME, FINISHED_STAGE_NAME, TASK_CLASSIFICATION_NAME } from "./ui/ExecutionInfo";
import { appendToFile } from "./utils/appendToFile";
import { calculateAndFormatExecutionTime } from "./utils/calculateAndFormatExecutionTime";
import { createWorkingdocument } from "./utils/createWorkingdocument";
import { gptExecute } from "./openai";

export type SerializedGPTExecution = {
  id: string;
  minionIndex: number;
  documentURI: string;
  workingDocumentURI: string;
  userQuery: string;
  selection: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
  selectedText: string;
  fullContent: string;
  startTime: number;
  shortName: string;
  modificationDescription: string;
  modificationProcedure: string;
  modificationApplied: boolean;
  executionStage: string;
  classification?: TASK_CLASSIFICATION_NAME;
};

export class GPTExecution {
  serialize(): SerializedGPTExecution {
    return {
      id: this.id,
      minionIndex: this.minionIndex,
      documentURI: this.documentURI,
      workingDocumentURI: this.workingDocumentURI,
      userQuery: this.userQuery,
      selection: {
        startLine: this.selection.start.line,
        startCharacter: this.selection.start.character,
        endLine: this.selection.end.line,
        endCharacter: this.selection.end.character,
      },
      selectedText: this.selectedText,
      fullContent: this.fullContent,
      startTime: this.startTime,
      shortName: this.shortName,
      modificationDescription: this.modificationDescription,
      modificationProcedure: this.modificationProcedure,
      modificationApplied: this.modificationApplied,
      executionStage: this.executionStage,
      classification: this.classification,
    };
  }

  static deserialize(data: SerializedGPTExecution): GPTExecution {
    return new GPTExecution({
      id: data.id,
      minionIndex: data.minionIndex || 0,
      documentURI: data.documentURI,
      workingDocumentURI: data.workingDocumentURI,
      userQuery: data.userQuery,
      selection: new vscode.Selection(
        new vscode.Position(data.selection.startLine, data.selection.startCharacter),
        new vscode.Position(data.selection.endLine, data.selection.endCharacter)
      ),
      selectedText: data.selectedText,
      fullContent: data.fullContent,
      startTime: data.startTime,
      shortName: data.shortName,
      modificationDescription: data.modificationDescription,
      modificationProcedure: data.modificationProcedure,
      modificationApplied: data.modificationApplied,
      executionStage: data.executionStage,
      classification: data.classification,
      onChanged: async (important: boolean) => {},
    });
  }

  readonly userQuery: string;
  readonly id: string;
  readonly minionIndex: number;

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
  shortName: string;
  fullContent: string;
  currentStageIndex: number = 0;
  startTime: number;
  modificationDescription: string;
  modificationProcedure: string;
  modificationApplied: boolean;
  stopped: boolean = true;
  progress: number = 1;
  executionStage: string;
  classification?: TASK_CLASSIFICATION_NAME;
  waiting: boolean = false;

  constructor({
    id,
    minionIndex,
    documentURI,
    workingDocumentURI,
    userQuery,
    selection,
    selectedText,
    fullContent,
    startTime,
    onChanged = async (important: boolean) => {},
    shortName = "",
    modificationDescription = "",
    modificationProcedure = "",
    modificationApplied = false,
    executionStage = "",
    classification = undefined,
  }: {
    id: string;
    minionIndex: number;
    documentURI: string;
    workingDocumentURI: string;
    userQuery: string;
    selection: vscode.Selection;
    selectedText: string;
    fullContent: string;
    startTime: number;
    onChanged?: (important: boolean) => Promise<void>;
    shortName?: string;
    modificationDescription?: string;
    modificationProcedure?: string;
    modificationApplied?: boolean;
    executionStage?: string;
    classification?: TASK_CLASSIFICATION_NAME;
  }) {
    this.id = id;
    this.minionIndex = minionIndex;
    this.documentURI = documentURI;
    this.workingDocumentURI = workingDocumentURI;
    this.userQuery = userQuery;
    this.selection = selection;
    this.selectedText = selectedText;
    this.fullContent = fullContent;
    this.startTime = startTime;
    this.onChanged = onChanged;
    this.shortName = shortName;
    this.modificationDescription = modificationDescription;
    this.modificationProcedure = modificationProcedure;
    this.modificationApplied = modificationApplied;
    this.executionStage = executionStage;
    this.classification = classification;
  }

  static async create({
    userQuery,
    document,
    selection,
    selectedText,
    minionIndex,
    onChanged,
  }: {
    userQuery: string;
    document: vscode.TextDocument;
    selection: vscode.Selection;
    selectedText: string;
    minionIndex: number;
    onChanged: (important: boolean) => Promise<void>;
  }): Promise<GPTExecution> {
    const executionId = randomUUID();
    const workingDocument = await createWorkingdocument(executionId);

    const execution = new GPTExecution({
      id: executionId,
      minionIndex,
      documentURI: document.uri.toString(),
      workingDocumentURI: workingDocument.uri.toString(),
      userQuery,
      selection,
      selectedText,
      fullContent: await document.getText(),
      startTime: Date.now(),
      onChanged,
    });

    execution.stopped = false;
    execution.progress = 1;

    return execution;
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
      if (this.stopped) {
        return;
      }

      this.resolveProgress = resolve;
      this.rejectProgress = reject;
      this.currentStageIndex = 0;

      this.setShortName();

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
        if (error !== CANCELED_STAGE_NAME) {
          vscode.window.showErrorMessage(`Error in execution: ${error}`);
          console.error("Error in execution", error);
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

  private async setShortName() {
    this.shortName = "...";
    let context = this.selectedText
      ? `
==== WHAT USER SELECTED ====
${this.selectedText}
      `.trim()
      : `
==== WHAT IS THE NAME OF THE FILE ====
${this.baseName}    
      `.trim();

    await gptExecute({
      maxTokens: 20,
      fullPrompt: `
      Create a very short summary of a task. Maximum of 20 characters. You MUST not exceed this number. Try to combine info both from what user said and what user selected / file name. If a selected identifier is too long or file name is too long, just use some keywords from it.

      ==== WHAT USER SAID ====
      ${this.userQuery}

      ${context}
      
      `.trim(),
    }).then((res) => {
      this.shortName = res || this.baseName;
      this.onChanged(true);
    });
  }

  get baseName() {
    return path.basename(vscode.Uri.parse(this.documentURI).fsPath);
  }
}
