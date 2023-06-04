import fetch, { Response } from "node-fetch";
import * as vscode from "vscode";
import AsyncLock = require("async-lock");

let openAILock = new AsyncLock();

/* The extractParsedLines function takes a chunk string as input and returns
 * an array of parsed JSON objects. */
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

/* The queryOpenAI function takes a fullPrompt and other optional parameters to
 * send a request to OpenAI's API. It returns a response object. */
async function queryOpenAI(fullPrompt: string, maxTokens = 2000, model = "gpt-4", temperature = 1) {
  const controller = new AbortController();
  const signal = controller.signal;

  console.log("Querying OpenAI");
  fullPrompt.split("\n").forEach((line) => console.log(`> ${line}`));

  return await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${vscode.workspace
        .getConfiguration("codecook")
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
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
    signal,
  });
}

/* The processOpenAIResponseStream function processes the response from the
 * API and extracts tokens from the response stream. */
async function processOpenAIResponseStream({
  response,
  onChunk,
  isCancelled,
}: {
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

/* The gptExecute function is the main exported function, which combines all the
 * other functions to send a GPT-4 query and receive and process the response. */
export async function gptExecute({
  fullPrompt,
  onChunk,
  isCancelled = () => false,
  maxTokens = 2000,
  model = "gpt-4",
  temperature,
}: {
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
