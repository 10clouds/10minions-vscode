import { encode } from "gpt-tokenizer";
import fetch, { Response } from "node-fetch";
import * as vscode from "vscode";
import AsyncLock = require("async-lock");

let openAILock = new AsyncLock();

function extractParsedLines(chunk: string) {
  const lines = chunk.split("\n");
  try {
    return lines
      .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
      .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
      .map((line) => JSON.parse(line));
  } catch (e) {
    console.error(`Error parsing chunk: ${chunk}`);
    console.error(e);
    console.error(chunk);
    throw e;
  }
}

async function queryOpenAI(fullPrompt: string, maxTokens = 2000, model = "gpt-4", temperature = 1) {
  const API_URL = "https://api.openai.com/v1/chat/completions";

  const controller = new AbortController();
  const signal = controller.signal;

  console.log("Querying OpenAI");
  fullPrompt.split("\n").forEach((line) => console.log(`> ${line}`));

  return await fetch(API_URL, {
    method: "POST",
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Content-Type": "application/json",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: `Bearer ${vscode.workspace
        .getConfiguration("codemind")
        .get("apiKey")}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: fullPrompt,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
    signal,
  });
}

async function processOpenAIResponseStream({
  response,
  onChunk,
  isCancelled,
} : {
  response: Response,
  onChunk: (chunk: string) => Promise<void>,
  isCancelled: () => boolean
}) {
  const stream = response.body!;
  const decoder = new TextDecoder("utf-8");
  let fullContent = "";

  return await new Promise<string>((resolve, reject) => {
    stream.on("data", async (value) => {
      if (isCancelled()) {
        stream.removeAllListeners();
        reject();
        return;
      }
      const chunk = decoder.decode(value);

      const parsedLines = extractParsedLines(chunk);
      const tokens = parsedLines
        .map((l) => l.choices[0].delta.content)
        .filter((c) => c)
        .join("");

      await openAILock.acquire("openAI", async () => {
        await onChunk(tokens);
      });

      fullContent += tokens;
    });

    stream.on("end", () => {
      if (isCancelled()) {
        stream.removeAllListeners();
        reject();
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

export async function gptExecute({
  fullPrompt,
  onChunk,
  isCancelled = () => false,
  maxTokens = 2000,
  model = "gpt-4",
  temperature,
} : {
  fullPrompt: string,
  onChunk: (chunk: string) => Promise<void>,
  isCancelled?: () => boolean,
  maxTokens?: number,
  model?: string,
  temperature?: number
}) {
  const response = await queryOpenAI(fullPrompt, maxTokens, model, temperature);
  return processOpenAIResponseStream({response, onChunk, isCancelled});
}
