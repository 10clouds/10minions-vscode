import { encode as encodeGPT35 } from 'gpt-tokenizer/cjs/model/gpt-3.5-turbo';
import { encode as encodeGPT4 } from 'gpt-tokenizer/cjs/model/gpt-4';
import { Schema } from 'jsonschema';
import fetch, { Response } from 'node-fetch';
import { DEBUG_RESPONSES } from './const';
import { getAnalyticsManager } from './managers/AnalyticsManager';
import { CANCELED_STAGE_NAME } from './ui/MinionTaskUIInfo';
import AsyncLock from 'async-lock';
import { getOpenAICacheManager } from './managers/OpenAICacheManager';

export type GptMode = 'FAST' | 'QUALITY';
export type AVAILABLE_MODELS =
  | 'gpt-4-0613'
  | 'gpt-3.5-turbo-0613'
  | 'gpt-3.5-turbo-16k-0613'; // | "gpt-4-32k-0613"
export type OutputType = 'string' | FunctionDef;
export type FunctionParams = {
  type: 'object';
  properties: { [key: string]: Schema };
  required: string[];
};

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

export type FunctionDef = {
  name: string;
  description: string;
  parameters: FunctionParams;
};

export type ModelData = {
  [key in AVAILABLE_MODELS]: {
    maxTokens: number;
    encode: typeof encodeGPT4;
    inputCostPer1K: number;
    outputCostPer1K: number;
  };
};

export const MODEL_DATA: ModelData = {
  'gpt-4-0613': {
    maxTokens: 8192,
    encode: encodeGPT4,
    inputCostPer1K: 0.03,
    outputCostPer1K: 0.06,
  },
  //"gpt-4-32k-0613": { maxTokens: 32768, encode: encodeGPT4, inputCostPer1K: 0.06, outputCostPer1K: 0.12 },
  'gpt-3.5-turbo-0613': {
    maxTokens: 4096,
    encode: encodeGPT35,
    inputCostPer1K: 0.0015,
    outputCostPer1K: 0.002,
  },
  'gpt-3.5-turbo-16k-0613': {
    maxTokens: 16384,
    encode: encodeGPT35,
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.004,
  },
};

const openAILock = new AsyncLock();
let openAIApiKey: string | undefined;

export function setOpenAIApiKey(apiKey: string) {
  openAIApiKey = apiKey;
}

function extractParsedLines(chunkBuffer: string): [any[], string] {
  const parsedLines: any[] = [];

  while (chunkBuffer.includes('\n')) {
    if (chunkBuffer.startsWith('\n')) {
      chunkBuffer = chunkBuffer.slice(1);
      continue;
    }

    if (chunkBuffer.startsWith('data: ')) {
      const [line, ...rest] = chunkBuffer.split('\n');
      chunkBuffer = rest.join('\n');

      if (DEBUG_RESPONSES) {
        console.log(line);
      }

      if (line === 'data: [DONE]') continue;

      const parsedLine = line.replace(/^data: /, '').trim();
      if (parsedLine !== '') {
        try {
          parsedLines.push(JSON.parse(parsedLine));
        } catch (e) {
          console.error(`Error parsing chunk: ${line}`);
          throw e;
        }
      }
    } else {
      const errorObject = JSON.parse(chunkBuffer);

      if (errorObject.error) {
        throw new Error(JSON.stringify(errorObject));
      } else {
        throw new Error(`Unexpected JSON object: ${chunkBuffer}`);
      }
    }
  }

  return [parsedLines, chunkBuffer];
}

/* The processOpenAIResponseStream function processes the response from the
 * API and extracts tokens from the response stream. */
async function processOpenAIResponseStream({
  response,
  onChunk,
  isCancelled,
  controller,
}: {
  response: Response;
  onChunk: (chunk: string) => Promise<void>;
  isCancelled: () => boolean;
  controller: AbortController;
}) {
  const stream = response.body!;
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';
  let chunkBuffer = '';

  return await new Promise<string>((resolve, reject) => {
    stream.on('data', async (value) => {
      try {
        if (isCancelled() || controller.signal.aborted) {
          stream.removeAllListeners();
          reject(CANCELED_STAGE_NAME);
          return;
        }
        const chunk = decoder.decode(value);
        chunkBuffer += chunk;

        const [parsedLines, newChunkBuffer] = extractParsedLines(chunkBuffer);

        chunkBuffer = newChunkBuffer;

        for (const parsedLine of parsedLines) {
          if (parsedLine.error) {
            throw new Error(parsedLine.error.message);
          }
        }

        const tokens = parsedLines
          .map(
            (l) =>
              l.choices[0].delta.content ||
              l.choices[0].delta.function_call?.arguments ||
              '',
          )
          .filter((c) => c)
          .join('');

        await openAILock.acquire('openAI', async () => {
          await onChunk(tokens);
        });

        fullContent += tokens;
      } catch (e) {
        console.error('Error processing response stream: ', e, value);
        reject(e);
      }
    });

    stream.on('end', () => {
      if (isCancelled() || controller.signal.aborted) {
        stream.removeAllListeners();
        reject(CANCELED_STAGE_NAME);
        return;
      }
      resolve(fullContent);
    });

    stream.on('error', (err) => {
      console.error('Error: ', err);
      reject(err);
    });
  });
}

/**
 * Function to check the availability of all models in OpenAI.
 */
export async function getMissingOpenAIModels(): Promise<AVAILABLE_MODELS[]> {
  const missingModels: AVAILABLE_MODELS[] = Object.keys(
    MODEL_DATA,
  ) as AVAILABLE_MODELS[];

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIApiKey}`,
      },
    });

    const responseData = (await response.json()) as any;

    if (!responseData || !responseData.data) {
      console.error('No data received from OpenAI models API.');
      return missingModels;
    }

    const availableModels = responseData.data.map((model: any) => model.id);

    return missingModels.filter((model) => !availableModels.includes(model));
  } catch (error) {
    console.error(`Error occurred while checking models: ${error}`);
    return missingModels;
  }
}

/**
 *
 */
export function countTokens(text: string, mode: GptMode) {
  const model = mode === 'FAST' ? 'gpt-3.5-turbo-16k-0613' : 'gpt-4-0613';
  return MODEL_DATA[model].encode(text).length;
}

const calculateCosts = (
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

/**
 *
 */
export async function gptExecute({
  fullPrompt,
  onChunk = async (chunk: string) => {},
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

  //console.log("Querying OpenAI");

  const requestData: GPTExecuteRequestData = {
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

/**
 * Custom error class for token errors.
 */
class TokenError extends Error {
  constructor(message?: string) {
    super(message);

    // Ensuring Error is properly extended
    Object.setPrototypeOf(this, TokenError.prototype);
    this.name = this.constructor.name;

    // Capturing stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Checks if the prompt can be handled by the model
 */
export function ensureICanRunThis({
  prompt,
  maxTokens,
  mode,
}: {
  prompt: string;
  maxTokens: number;
  mode: GptMode;
}) {
  const model = mode === 'FAST' ? 'gpt-3.5-turbo-16k-0613' : 'gpt-4-0613';
  const usedTokens = MODEL_DATA[model].encode(prompt).length + maxTokens;

  if (usedTokens > MODEL_DATA[model].maxTokens) {
    console.error(
      `Not enough tokens to perform the modification. absolute minimum: ${usedTokens} available: ${MODEL_DATA[model].maxTokens}`,
    );
    throw new TokenError(
      `Combination of file size, selection, and your command is too big for us to handle.`,
    );
  }
}

/**
 * Checks if the given prompt can fit within a specified range of token lengths
 * for the specified AI model.
 */
export function ensureIRunThisInRange({
  prompt,
  minTokens,
  preferedTokens,
  mode,
}: {
  prompt: string;
  minTokens: number;
  preferedTokens: number;
  mode: GptMode;
}): number {
  const EXTRA_BUFFER_FOR_ENCODING_OVERHEAD = 50;

  minTokens = Math.ceil(minTokens);
  preferedTokens = Math.ceil(preferedTokens);

  const model = mode === 'FAST' ? 'gpt-3.5-turbo-16k-0613' : 'gpt-4-0613';
  const usedTokens =
    MODEL_DATA[model].encode(prompt).length +
    EXTRA_BUFFER_FOR_ENCODING_OVERHEAD;
  const availableTokens = MODEL_DATA[model].maxTokens - usedTokens;

  if (availableTokens < minTokens) {
    console.error(
      `Not enough tokens to perform the modification. absolute minimum: ${minTokens} available: ${availableTokens}`,
    );
    throw new TokenError(
      `Combination of file size, selection, and your command is too big for us to handle.`,
    );
  }

  return Math.min(availableTokens, preferedTokens);
}
