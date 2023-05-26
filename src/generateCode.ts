import { Response } from "node-fetch";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { extractParsedLines, updateNewDocument } from "./extension";


function handleError(error: Error, signal: AbortSignal) {
  if (signal.aborted) {
    console.log("Request aborted.");
  } else {
    console.error("Error:", error);
    console.log("Error occurred while generating.");
  }
}

export async function generateCode(
  fullPrompt: string,
  newDocument: vscode.TextDocument
) {
  const API_URL = "https://api.openai.com/v1/chat/completions";

  const controller = new AbortController();
  const signal = controller.signal;

  try {
    const response = await fetchResponse(API_URL, fullPrompt, signal);

    await processResponseStream(response, newDocument);
  } catch (error) {
    handleError(error as Error, signal);
  } finally {
    controller.abort();
  }

  console.log("Finished");
}

export async function fetchResponse(
  apiUrl: string,
  fullPrompt: string,
  signal: AbortSignal
) {
  const config = vscode.workspace.getConfiguration("codemind");

  return await fetch(apiUrl, {
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
      model: config.get("codemind.model") || "gpt-4",
      messages: [
        {
          role: "user",
          content: fullPrompt,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      max_tokens: config.get("codemind.maxTokens"),
      stream: true,
    }),
    signal,
  });
}

export async function processResponseStream(
  response: Response,
  newDocument: vscode.TextDocument
) {
  const stream = response.body!;
  const decoder = new TextDecoder("utf-8");

  return await new Promise<void>((resolve, reject) => {
    stream.on("data", async (value) => {
      const chunk = decoder.decode(value);

      const parsedLines = extractParsedLines(chunk);
      const goodContent = parsedLines
        .map((l) => l.choices[0].delta.content)
        .filter((c) => c)
        .join("");

      await updateNewDocument(newDocument, goodContent);
    });

    stream.on("end", () => {
      console.log("end");
      resolve();
    });

    stream.on("error", (err) => {
      console.error("Error: ", err);
      reject(err);
    });
  });
}
