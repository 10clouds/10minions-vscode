import { randomUUID } from 'crypto';
import * as path from 'path';
import { getLogProvider } from './managers/LogProvider';
import { getOriginalContentProvider } from './managers/OriginalContentProvider';
import { gptExecute } from './openai';
import { PRE_STAGES, Stage, TASK_STRATEGY_ID } from './strategies/strategies';
import {
  APPLIED_STAGE_NAME,
  APPLYING_STAGE_NAME,
  CANCELED_STAGE_NAME,
  FINISHED_STAGE_NAME,
} from './ui/MinionTaskUIInfo';
import { calculateAndFormatExecutionTime } from './utils/calculateAndFormatExecutionTime';
import {
  EditorDocument,
  EditorRange,
  EditorUri,
  getEditorManager,
} from './managers/EditorManager';

export class MinionTask {
  readonly userQuery: string;
  readonly id: string;
  readonly minionIndex: number;

  readonly documentURI: EditorUri;
  readonly selection: EditorRange;
  readonly selectedText: string;
  readonly onChanged: (important: boolean) => Promise<void>;

  rejectProgress?: (error: string) => void;
  resolveProgress?: () => void;

  private _originalContent: string;

  get isError(): boolean {
    if (!this.stopped) {
      return false;
    }

    if (this.executionStage === FINISHED_STAGE_NAME) {
      return false;
    }

    if (this.executionStage === CANCELED_STAGE_NAME) {
      return false;
    }

    if (this.executionStage === APPLYING_STAGE_NAME) {
      return false;
    }

    if (this.executionStage === APPLIED_STAGE_NAME) {
      return false;
    }

    return true;
  }

  get originalContent(): string {
    return this._originalContent;
  }

  set originalContent(value: string) {
    this._originalContent = value;
    getOriginalContentProvider().reportChange(this.originalContentURI);
  }

  //
  // tracking variables between stages
  //
  shortName: string;

  contentAfterApply: string;
  contentWhenDismissed: string;
  currentStageIndex = 0;
  startTime: number;
  modificationDescription: string;
  modificationProcedure: string;
  stopped = true;
  progress = 1;
  executionStage: string;
  strategy?: TASK_STRATEGY_ID;
  inlineMessage: string;
  logContent = '';
  stages: Stage[] = PRE_STAGES;
  totalCost: number;

  constructor({
    id,
    minionIndex,
    documentURI,
    userQuery,
    selection,
    selectedText,
    originalContent,
    finalContent = '',
    contentWhenDismissed = '',
    startTime,
    onChanged = async (important: boolean) => {
      throw new Error('Should be implemented');
    },
    shortName = '',
    modificationDescription = '',
    modificationProcedure = '',
    inlineMessage = '',
    executionStage = '',
    strategy = undefined,
    logContent = '',
    totalCost = 0,
  }: {
    id: string;
    minionIndex: number;
    documentURI: EditorUri;
    userQuery: string;
    selection: EditorRange;
    selectedText: string;
    originalContent: string;
    finalContent?: string;
    contentWhenDismissed?: string;
    startTime: number;
    onChanged?: (important: boolean) => Promise<void>;
    shortName?: string;
    modificationDescription?: string;
    modificationProcedure?: string;
    executionStage?: string;
    inlineMessage?: string;
    strategy?: TASK_STRATEGY_ID;
    logContent?: string;
    totalCost?: number;
  }) {
    this.id = id;
    this.minionIndex = minionIndex;
    this.documentURI = documentURI;
    this.userQuery = userQuery;
    this.selection = selection;
    this.selectedText = selectedText;
    this._originalContent = originalContent;
    this.contentAfterApply = finalContent;
    this.contentWhenDismissed = contentWhenDismissed;
    this.startTime = startTime;
    this.onChanged = onChanged;
    this.shortName = shortName;
    this.modificationDescription = modificationDescription;
    this.modificationProcedure = modificationProcedure;
    this.inlineMessage = inlineMessage;
    this.executionStage = executionStage;
    this.strategy = strategy;
    this.logContent = logContent;
    this.totalCost = totalCost;
  }

  get logURI() {
    return `10minions-log:minionTaskId/${this.id}/${(
      '[' +
      this.shortName +
      '].md'
    ).replace(/ /g, '%20')}`;
  }

  get originalContentURI() {
    return `10minions-originalContent:minionTaskId/${this.id}/${(
      this.shortName + '.txt'
    ).replace(/ /g, '%20')}`;
  }

  appendToLog(content: string): void {
    this.logContent += content;

    getLogProvider().reportChange(this.logURI);
  }

  appendSectionToLog(section: string): void {
    this.appendToLog(
      [
        `////////////////////////////////////////////////////////////////////////////////`,
        `// ${section}`,
        `////////////////////////////////////////////////////////////////////////////////`,
      ].join('\n') + '\n\n',
    );
  }

  clearLog() {
    this.logContent = '';
    getLogProvider().reportChange(this.logURI);
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
    document: EditorDocument;
    selection: EditorRange;
    selectedText: string;
    minionIndex: number;
    onChanged: (important: boolean) => Promise<void>;
  }): Promise<MinionTask> {
    const minionTaskId = randomUUID();

    const execution = new MinionTask({
      id: minionTaskId,
      minionIndex,
      documentURI: document.uri,
      userQuery,
      selection,
      selectedText,
      originalContent: await document.getText(),
      startTime: Date.now(),
      onChanged,
    });

    execution.stopped = false;
    execution.progress = 1;

    return execution;
  }

  public async document() {
    const document = await getEditorManager().openTextDocument(
      this.documentURI,
    );
    return document;
  }

  public async stopExecution(error?: string, important = true) {
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

  private calculateTotalWeights(): number {
    return this.stages.reduce((total, stage) => total + stage.weight, 0);
  }

  public reportSmallProgress(fractionOfBigTask = 0.005) {
    const weigtsNextStepTotal = this.stages.reduce((acc, stage, index) => {
      if (index > this.currentStageIndex) {
        return acc;
      }
      return acc + stage.weight;
    }, 0);

    const remainingProgress =
      (1.0 * weigtsNextStepTotal) / this.calculateTotalWeights();
    const currentProgress = this.progress;

    const totalPending = remainingProgress - currentProgress;
    const increment = totalPending * fractionOfBigTask;
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
        while (this.currentStageIndex < this.stages.length && !this.stopped) {
          this.executionStage = this.stages[this.currentStageIndex].name;

          await this.stages[this.currentStageIndex].execution.apply(this);

          if (this.stopped) {
            break;
          }

          const weigtsNextStepTotal = this.stages.reduce(
            (acc, stage, index) => {
              if (index > this.currentStageIndex) {
                return acc;
              }
              return acc + stage.weight;
            },
            0,
          );

          this.progress = weigtsNextStepTotal / this.calculateTotalWeights();
          this.onChanged(false);
          this.currentStageIndex++;
        }
      } catch (error) {
        if (error !== CANCELED_STAGE_NAME) {
          getEditorManager().showErrorMessage(`Error in execution: ${error}`);
          console.error('Error in execution', error);
        }

        this.stopExecution(
          error instanceof Error ? `Error: ${error.message}` : String(error),
        );
      } finally {
        const executionTime = Date.now() - this.startTime;
        const formattedExecutionTime =
          calculateAndFormatExecutionTime(executionTime);

        this.appendToLog(
          `${this.executionStage} (Execution Time: ${formattedExecutionTime})\n\n`,
        );

        this.progress = 1;
      }
    });
  }

  private async setShortName() {
    this.shortName = '...';
    const context = this.selectedText
      ? `
==== WHAT USER SELECTED ====
${this.selectedText}
      `.trim()
      : `
==== WHAT IS THE NAME OF THE FILE ====
${this.baseName}    
      `.trim();

    await gptExecute({
      mode: 'FAST',
      maxTokens: 20,
      fullPrompt: `
User just created a task, he said what the task is, but also selected the code and file this task refers to.
Create a very short summary of what the task is in it's essence.
Maximum of 20 characters. You MUST not exceed this number.
Try to combine info from what user said and what user selected and file name.
If a selected identifier is too long or file name is too long, just use some keywords from it.
You can abbreviate words if needed.

==== WHAT USER SAID ====
${this.userQuery}

${context}
      
      `.trim(),
      outputType: 'string',
    }).then(({ result, cost }) => {
      this.shortName = result || this.baseName;
      this.totalCost += cost;
      this.onChanged(true);
    });
  }

  get baseName() {
    return path.basename(this.documentURI.fsPath);
  }
}
