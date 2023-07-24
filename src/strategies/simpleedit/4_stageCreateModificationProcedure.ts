import { MinionTask } from '../../MinionTask';
import { DEBUG_RESPONSES } from '../../const';
import { createModificationProcedure } from '../utils/createModificationProcedure';

export async function stageCreateModificationProcedure(this: MinionTask) {
  if (this.strategy === undefined) {
    throw new Error('Classification is undefined');
  }

  if (this.strategy === 'AnswerQuestion') {
    return;
  }

  this.reportSmallProgress();

  try {
    const { result, cost } = await createModificationProcedure(
      this.originalContent,
      this.modificationDescription,
      async (chunk: string) => {
        this.reportSmallProgress();
        if (DEBUG_RESPONSES) {
          this.appendToLog(chunk);
        } else {
          this.appendToLog('.');
        }
      },
      () => {
        return this.stopped;
      },
      this.baseName,
    );
    this.modificationProcedure = result;
    this.totalCost += cost;
  } catch (error) {
    this.appendToLog(
      `Error while creating modification procedure:\n\n ${error}\n\n`,
    );
    this.stopExecution((error as Error).message as string);
  }

  this.appendToLog('\n\n');
}
