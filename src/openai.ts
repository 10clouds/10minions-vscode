import fetch from 'node-fetch';
import { DEBUG_RESPONSES, MODEL_DATA } from './const';
import { getAnalyticsManager } from './managers/AnalyticsManager';
import { getOpenAICacheManager } from './managers/OpenAICacheManager';
import { AVAILABLE_MODELS, GptMode, OutputType } from './types';
import { ensureICanRunThis } from './utils/ensureIcanRunThis';
import { processOpenAIResponseStream } from './utils/processOpenAIResponseStream';
import { calculateCosts } from './utils/calculateCosts';

let openAIApiKey: string | undefined;

export function setOpenAIApiKey(apiKey: string) {
  openAIApiKey = apiKey;
}

export async function gptExecute({
  fullPrompt,
  onChunk = async () => {},
  isCancelled = () => false,
  maxTokens = 2000,
  mode,
  temperature = 1,
  controller = new AbortController(),
  outputType,
}: {
  fullPrompt: string;
  onChunk?: (chunk: string) => Promise<void>;
  isCancelled?: () => boolean;
  maxTokens?: number;
  mode: GptMode;
  temperature?: number;
  controller?: AbortController;
  outputType: OutputType;
}) {
  let model: AVAILABLE_MODELS = 'gpt-4-0613';

  if (mode === 'FAST') {
    model = 'gpt-3.5-turbo-16k-0613';

    const usedTokens = MODEL_DATA[model].encode(fullPrompt).length + maxTokens;

    if (usedTokens < MODEL_DATA['gpt-3.5-turbo-0613'].maxTokens) {
      model = 'gpt-3.5-turbo-0613';
    }
  }

  ensureICanRunThis({ prompt: fullPrompt, mode, maxTokens });

  const signal = controller.signal;

  if (!openAIApiKey) {
    throw new Error('OpenAI API key not found. Please set it in the settings.');
  }

  const requestData = {
    model,
    messages: [
      {
        role: 'user',
        content: fullPrompt,
      },
    ],
    max_tokens: maxTokens,
    temperature,
    stream: true,
    ...(outputType === 'string'
      ? {}
      : { function_call: { name: outputType.name }, functions: [outputType] }),
  };

  if (DEBUG_RESPONSES) {
    console.log(requestData);
  }

  const cachedResult = await getOpenAICacheManager().getCachedResult(
    requestData,
  );

  if (cachedResult && typeof cachedResult === 'string') {
    await onChunk(cachedResult);
    return {
      result: cachedResult,
      cost: 0,
    };
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAIApiKey}`,
          },
          body: JSON.stringify(requestData),
          signal,
        },
      );

      const result = await processOpenAIResponseStream({
        response,
        onChunk,
        isCancelled,
        controller,
      });

      getAnalyticsManager().reportOpenAICall(requestData, result);
      const cost = calculateCosts(model, outputType, requestData, result, mode);

      return {
        result,
        cost,
      };
    } catch (error) {
      console.error(`Error on attempt ${attempt}: ${error}`);

      getAnalyticsManager().reportOpenAICall(requestData, {
        error: String(error),
      });

      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error('Assertion: Should never get here');
}
