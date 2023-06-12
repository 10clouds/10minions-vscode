import fetch, { Response } from "node-fetch";
import * as vscode from "vscode";
import AsyncLock = require("async-lock");
import { CANCELED_STAGE_NAME } from "./ui/MinionTaskUIInfo";

export type AVAILABLE_MODELS = "gpt-4" | "gpt-3.5-turbo";

let openAILock = new AsyncLock();

/* The extractParsedLines function takes a chunk string as input and returns
 * an array of parsed JSON objects. */
function extractParsedLines(chunk: string) {
  // Check if the entire chunk is a JSON object containing an "error" field
  let jsonObject;
  
  try {
    jsonObject = JSON.parse(chunk);
  } catch (e) {
    // Not a JSON object, continue processing as before
  }

  if (jsonObject) {
    // If the chunk is in the new format, return the error object directly
    if (jsonObject.error) {
      throw new Error(jsonObject.error.message);
    } else {
      throw new Error(`Unexpected JSON object: ${chunk}`);
    }
  }

  // Original processing
  const lines = chunk.split("\n");
  try {
    return lines
      .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
      .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
      .map((line) => JSON.parse(line));
  } catch (e) {
    console.error(`Error parsing chunk: ${chunk}`);
    console.error(e);
    throw e;
  }
}

/* The queryOpenAI function takes a fullPrompt and other optional parameters to
 * send a request to OpenAI's API. It returns a response object. */
export async function queryOpenAI({
  fullPrompt,
  controller,
  maxTokens = 2000,
  model = "gpt-4",
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

  return await new Promise<string>((resolve, reject) => {
    stream.on("data", async (value) => {
      try {
        if (isCancelled() || controller.signal.aborted) {
          stream.removeAllListeners();
          reject(CANCELED_STAGE_NAME);
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



