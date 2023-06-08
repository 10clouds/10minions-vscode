import fetch, { Response } from "node-fetch";
import * as vscode from "vscode";
import AsyncLock = require("async-lock");
import { CANCELED_STAGE_NAME } from "./ui/ExecutionInfo";

type AVAILABLE_MODELS = "gpt-4" | "gpt-3.5-turbo";

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
    throw e;
  }
}



/* The queryOpenAI function takes a fullPrompt and other optional parameters to
 * send a request to OpenAI's API. It returns a response object. */
async function queryOpenAI({
  fullPrompt,
  controller,
  maxTokens = 2000,
  model = "gpt-4",
  temperature = 1,
}: {
  fullPrompt: string;
  maxTokens?: number;
  model?: AVAILABLE_MODELS;
  temperature?: number;
  controller: AbortController;
}) {
  const signal = controller.signal;

  let apiKey = vscode.workspace.getConfiguration("10minions").get("apiKey")

  if (!apiKey) {
    throw new Error("OpenAI API key not found. Please set it in the settings.");
  }

  console.log("Querying OpenAI");
  fullPrompt.split("\n").forEach((line) => console.log(`> ${line}`));

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
async function processOpenAIResponseStream({
  response,
  onChunk,
  isCancelled,
}: {
  response: Response;
  onChunk: (chunk: string) => Promise<void>;
  isCancelled: () => boolean;
}) {
  const stream = response.body!;
  const decoder = new TextDecoder("utf-8");
  let fullContent = "";

  return await new Promise<string>((resolve, reject) => {
    stream.on("data", async (value) => {
      try {
        if (isCancelled()) {
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
      if (isCancelled()) {
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

/* The gptExecute function is the main exported function, which combines all the
 * other functions to send a GPT-4 query and receive and process the response. */
export async function gptExecute({
  fullPrompt,
  onChunk = async (chunk: string) => {},
  isCancelled = () => false,
  maxTokens = 2000,
  model = "gpt-4",
  temperature,
  controller = new AbortController(),
}: {
  fullPrompt: string;
  onChunk?: (chunk: string) => Promise<void>;
  isCancelled?: () => boolean;
  maxTokens?: number;
  model?: AVAILABLE_MODELS;
  temperature?: number;
  controller?: AbortController;
}) {
  // Step 1: Add a loop that iterates up to 3 times.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await queryOpenAI({fullPrompt, maxTokens, model, temperature, controller});
      const result = await processOpenAIResponseStream({ response, onChunk, isCancelled });

      // Step 3: On successful run, break the loop early and return the result.
      return result;
    } catch (error) {
      // Step 2: Add error handling for exceptions.
      // Step 4: Log the error and retry the process for up to 2 more times.
      console.error(`Error on attempt ${attempt}: ${error}`);

      // Step 5: On the 3rd error, give up and re-throw the error.
      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error("Assertion: Should never get here");
}
