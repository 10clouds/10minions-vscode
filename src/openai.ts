import { encode as encodeGPT35 } from "gpt-tokenizer/cjs/model/gpt-3.5-turbo";
import { encode as encodeGPT4 } from "gpt-tokenizer/cjs/model/gpt-4";
import { Schema } from "jsonschema";
import fetch, { Response } from "node-fetch";
import { AnalyticsManager } from "./AnalyticsManager";
import { DEBUG_RESPONSES } from "./const";
import { CANCELED_STAGE_NAME } from "./ui/MinionTaskUIInfo";
import AsyncLock = require("async-lock");

export type GptMode = "FAST" | "QUALITY";
export type AVAILABLE_MODELS = "gpt-4-0613" | "gpt-3.5-turbo-0613" | "gpt-3.5-turbo-16k-0613"; // | "gpt-4-32k-0613"
export type OutputType = "string" | FunctionDef;
export type FunctionParams = { type: "object", properties: {[key: string]: Schema}, required: string[] };

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
  "gpt-4-0613": { maxTokens: 8192, encode: encodeGPT4, inputCostPer1K: 0.03, outputCostPer1K: 0.06 },
  //"gpt-4-32k-0613": { maxTokens: 32768, encode: encodeGPT4, inputCostPer1K: 0.06, outputCostPer1K: 0.12 },
  "gpt-3.5-turbo-0613": { maxTokens: 4096, encode: encodeGPT35, inputCostPer1K: 0.0015, outputCostPer1K: 0.002 },
  "gpt-3.5-turbo-16k-0613": { maxTokens: 16384, encode: encodeGPT35, inputCostPer1K: 0.003, outputCostPer1K: 0.004 },
};

let openAILock = new AsyncLock();
let openAIApiKey: string | undefined;

export function setOpenAIApiKey(apiKey: string) {
  openAIApiKey = apiKey;
}

function extractParsedLines(chunkBuffer: string): [any[], string] {
  let parsedLines: any[] = [];

  while (chunkBuffer.includes("\n")) {

    if (chunkBuffer.startsWith("\n")) {
      chunkBuffer = chunkBuffer.slice(1);
      continue;
    }
    
    if (chunkBuffer.startsWith("data: ")) {
      let [line, ...rest] = chunkBuffer.split("\n");
      chunkBuffer = rest.join("\n");

      if (DEBUG_RESPONSES) {
        console.log(line);
      }

      if (line === "data: [DONE]") continue;

      let parsedLine = line.replace(/^data: /, "").trim();
      if (parsedLine !== "") {
        try {
          parsedLines.push(JSON.parse(parsedLine));
        } catch (e) {
          console.error(`Error parsing chunk: ${line}`);
          throw e;
        }
      }
    } else {
      let errorObject = JSON.parse(chunkBuffer);

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
  const decoder = new TextDecoder("utf-8");
  let fullContent = "";
  let chunkBuffer = "";

  return await new Promise<string>((resolve, reject) => {
    stream.on("data", async (value) => {
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

        const tokens = parsedLines
          .map((l) => l.choices[0].delta.content || l.choices[0].delta.function_call?.arguments || "")
          .filter((c) => c)
          .join("");

        await openAILock.acquire("openAI", async () => {
          await onChunk(tokens);
        });

        fullContent += tokens;
      } catch (e) {
        console.error("Error processing response stream: ", e);
        reject(e);
      }
    });

    stream.on("end", () => {
      if (isCancelled() || controller.signal.aborted) {
        stream.removeAllListeners();
        reject(CANCELED_STAGE_NAME);
        return;
      }
      resolve(fullContent);
    });

    stream.on("error", (err) => {
      console.error("Error: ", err);
      reject(err);
    });
  });
}

/** 
 * Function to check the availability of all models in OpenAI. 
 */
export async function getMissingOpenAIModels(): Promise<AVAILABLE_MODELS[]> {
  let missingModels: AVAILABLE_MODELS[] = Object.keys(MODEL_DATA) as AVAILABLE_MODELS[];
  
  try {
    let response = await fetch("https://api.openai.com/v1/models", {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIApiKey}`
      }
    });

    const responseData = await response.json() as any;

    if(!responseData || !responseData.data){
      console.error("No data received from OpenAI models API.");
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
  const model = mode === "FAST" ? "gpt-3.5-turbo-16k-0613" : "gpt-4-0613";
  return MODEL_DATA[model].encode(text).length;
}

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
  let model: AVAILABLE_MODELS = "gpt-4-0613";

  if (mode === "FAST") {
    model = "gpt-3.5-turbo-16k-0613";

    let usedTokens = MODEL_DATA[model].encode(fullPrompt).length + maxTokens;

    if (usedTokens < MODEL_DATA["gpt-3.5-turbo-0613"].maxTokens) {
      model = "gpt-3.5-turbo-0613";
    }
  }

  ensureICanRunThis({ prompt: fullPrompt, mode, maxTokens });

  const signal = controller.signal;

  if (!openAIApiKey) {
    throw new Error("OpenAI API key not found. Please set it in the settings.");
  }

  console.log("Querying OpenAI");

  let requestData = {
    model,
    messages: [
      {
        role: "user",
        content: fullPrompt,
      },
    ],
    max_tokens: maxTokens,
    temperature,
    stream: true,
    ...outputType === "string" ? {} : {function_call: { name: outputType.name }, functions: [outputType]},
  };
  
  if (DEBUG_RESPONSES) {
    console.log(requestData);
  }
  

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIApiKey}`,
        },
        body: JSON.stringify(requestData),
        signal,
      });

      const result = await processOpenAIResponseStream({ response, onChunk, isCancelled, controller });

      AnalyticsManager.instance.reportOpenAICall(requestData, result);

      const inputTokens = countTokens(JSON.stringify(requestData.messages), mode) + (outputType === "string" ? 0 : countTokens(JSON.stringify(requestData.functions), mode));
      const outputTokens = requestData.max_tokens; //TODO: Is the actuall dolar cost on the OpenAI side is based max_tokens or actual tokens returned?
      const inputCost = (inputTokens / 1000) * MODEL_DATA[model].inputCostPer1K;
      const outputCost = (outputTokens / 1000) * MODEL_DATA[model].outputCostPer1K;
      const totalCost = inputCost + outputCost;
      
      return {
        result: result,
        cost: totalCost, 
      };
    } catch (error) {
      console.error(`Error on attempt ${attempt}: ${error}`);

      AnalyticsManager.instance.reportOpenAICall(requestData, { error: String(error) });

      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error("Assertion: Should never get here");
}

/**
 * 
 */
export function ensureICanRunThis({ prompt, maxTokens, mode }: { prompt: string; maxTokens: number; mode: GptMode }) {
  const model = mode === "FAST" ? "gpt-3.5-turbo-16k-0613" : "gpt-4-0613";
  let usedTokens = MODEL_DATA[model].encode(prompt).length + maxTokens;

  if (usedTokens > MODEL_DATA[model].maxTokens) {
    console.error(`Not enough tokens to perform the modification. absolute minimum: ${usedTokens} available: ${MODEL_DATA[model].maxTokens}`);
    throw new Error(`Combination of file size, selection, and your command is too big for us to handle.`);
  }
}

/**
 * Checks if the given prompt can fit within a specified range of token lengths
 * for the specified AI model.
 *
 * @param prompt The input prompt for the AI model.
 * @param minTokens The minimum number of tokens that the prompt should fit within.
 * @param maxTokens The maximum number of tokens that the prompt should fit within.
 * @param model The AI model to be used.
 * @returns The number of used tokens if the prompt can fit within the specified range, false otherwise.
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

  const model = mode === "FAST" ? "gpt-3.5-turbo-16k-0613" : "gpt-4-0613";
  const usedTokens = MODEL_DATA[model].encode(prompt).length + EXTRA_BUFFER_FOR_ENCODING_OVERHEAD;
  const availableTokens = MODEL_DATA[model].maxTokens - usedTokens;

  if (availableTokens < minTokens) {
    throw new Error(`Not enough tokens to perform the modification. absolute minimum: ${minTokens} available: ${availableTokens}`);
  }

  return Math.min(availableTokens, preferedTokens);
}