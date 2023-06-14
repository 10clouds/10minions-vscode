import fetch, { Response } from "node-fetch";
import * as vscode from "vscode";
import AsyncLock = require("async-lock");
import { CANCELED_STAGE_NAME } from "./ui/MinionTaskUIInfo";

export type AVAILABLE_MODELS = "gpt-4" | "gpt-3.5-turbo" | "gpt-3.5-turbo-16k" | "gpt-4-32k";

import { encode as encodeGPT4 } from "gpt-tokenizer/cjs/model/gpt-4";
import { encode as encodeGPT35 } from "gpt-tokenizer/cjs/model/gpt-3.5-turbo";

type ModelData = {
  [key in AVAILABLE_MODELS]: {
    maxTokens: number;
    encode: typeof encodeGPT4;
  }
};

export const MODEL_DATA: ModelData = {
  'gpt-4': {maxTokens: 8192, encode: encodeGPT4},
  'gpt-4-32k': {maxTokens: 32768, encode: encodeGPT4},
  'gpt-3.5-turbo': {maxTokens: 4096, encode: encodeGPT35},
  'gpt-3.5-turbo-16k': {maxTokens: 16384, encode: encodeGPT35},
};

export function canIRunThis({ prompt, maxTokens = 2000, model = (vscode.workspace.getConfiguration("10minions").get("model") as AVAILABLE_MODELS)}: {
  prompt: string;
  maxTokens?: number;
  model?: AVAILABLE_MODELS;
}) {
  let usedTokens = MODEL_DATA[model].encode(prompt).length + maxTokens;
  return usedTokens <= MODEL_DATA[model].maxTokens;
}

let openAILock = new AsyncLock();

/* The extractParsedLines function takes a chunk string as input and returns
 * an array of parsed JSON objects. */
function extractParsedLines(chunkBuffer: string): [any[], string] {
  let parsedLines: any[] = [];

  while (chunkBuffer.includes("\n")) {
    let [line, ...rest] = chunkBuffer.split("\n");
    chunkBuffer = rest.join("\n");

    if (line === "" || line === "data: [DONE]")
      continue;

    if (line.startsWith("data: ")) {
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
      console.log(line);
      let errorObject = JSON.parse(line);

      if (errorObject.error) {
        throw new Error(errorObject.error.message);
      } else {
        throw new Error(`Unexpected JSON object: ${line}`);
      }
    }
  }

  return [parsedLines, chunkBuffer];
}

/* The queryOpenAI function takes a fullPrompt and other optional parameters to
 * send a request to OpenAI's API. It returns a response object. */
export async function queryOpenAI({
  fullPrompt,
  controller,
  maxTokens = 2000,
  model = (vscode.workspace.getConfiguration("10minions").get("model") as AVAILABLE_MODELS),
  temperature,
}: {
  fullPrompt: string;
  maxTokens: number;
  model: AVAILABLE_MODELS;
  temperature: number;
  controller: AbortController;
}) {
  const signal = controller.signal;

  let apiKey = vscode.workspace.getConfiguration("10minions").get("apiKey");

  if (!apiKey) {
    throw new Error("OpenAI API key not found. Please set it in the settings.");
  }

  console.log("Querying OpenAI");

  return await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
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
    }),
    signal,
  });
}

/* The processOpenAIResponseStream function processes the response from the
 * API and extracts tokens from the response stream. */
export async function processOpenAIResponseStream({
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
          .map((l) => l.choices[0].delta.content)
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





/*
Recently applied task: Take the default from:

"10minions.model": {
          "type": "string",
          "default": "gpt-4",
          "markdownDescription": "Select the available model for 10Minions tasks: `gpt-4`, `gpt-3.5-turbo`, `gpt-3.5-turbo-16k`, or `gpt-4-32k`",
          "order": 3
        }
*/
