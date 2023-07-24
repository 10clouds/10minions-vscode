import { MODEL_DATA } from '../const';
import { AVAILABLE_MODELS, FunctionDef, GptMode, OutputType } from '../types';
import { countTokens } from './countTokens';

interface GPTExecuteRequestData {
  function_call?:
    | {
        name: string;
      }
    | undefined;
  functions?: FunctionDef[] | undefined;
  model: AVAILABLE_MODELS;
  messages: {
    role: string;
    content: string;
  }[];
  max_tokens: number;
  temperature: number;
  stream: boolean;
}

export const calculateCosts = (
  model: AVAILABLE_MODELS,
  outputType: OutputType,
  requestData: GPTExecuteRequestData,
  result: string,
  mode: GptMode,
) => {
  const functionsTokens =
    outputType === 'string'
      ? 0
      : countTokens(JSON.stringify(requestData.functions), mode);
  const inputTokens =
    countTokens(JSON.stringify(requestData.messages), mode) + functionsTokens;

  const outputTokens = countTokens(result, mode);

  const inputCost = (inputTokens / 1000) * MODEL_DATA[model].inputCostPer1K;
  const outputCost = (outputTokens / 1000) * MODEL_DATA[model].outputCostPer1K;
  const totalCost = inputCost + outputCost;

  return totalCost;
};
