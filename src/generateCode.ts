import { Response } from "node-fetch";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { extractParsedLines } from "./extension";
import { encode } from "gpt-tokenizer";

export async function generateFullPrompt(prompt: string, selectedText: string) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }
  const document = activeEditor.document;
  const content = document.getText();

  let showSelectedText = selectedText.length > 0 && selectedText !== content;

  let contextSections = `
===== CODE ====
${selectedText}

===== CONTEXT OF A FILE THE CODE IS IN (${document.fileName}) ====
${content}
`.trim();

  if (!showSelectedText) {
    contextSections = `
===== CODE ====
${content}
`.trim();
  }

  let finalPrompt = `${prompt}\n\n${contextSections}`;

  console.log("finalPrompt", finalPrompt);
  return finalPrompt;
}

export async function queryOpenAI(fullPrompt: string) {
  const API_URL = "https://api.openai.com/v1/chat/completions";

  const controller = new AbortController();
  const signal = controller.signal;

  let numTokens = encode(fullPrompt).length;
  let model = "gpt-4";
  let maxTokens = 2000;

  if (numTokens < 3000) {
    model = "gpt-3.5-turbo";
    maxTokens = 1000;
  }

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
      stream: true,
    }),
    signal,
  });
}


export async function processOpenAIResponseStream(
  response: Response,
  onChunk: (chunk: string) => void
) {
  const stream = response.body!;
  const decoder = new TextDecoder("utf-8");
  let fullContent = "";

  return await new Promise<string>((resolve, reject) => {
    stream.on("data", async (value) => {
      const chunk = decoder.decode(value);

      const parsedLines = extractParsedLines(chunk);
      const tokens = parsedLines
        .map((l) => l.choices[0].delta.content)
        .filter((c) => c)
        .join("");

      onChunk(tokens);
      fullContent += tokens;
    });

    stream.on("end", () => {
      console.log("end");
      resolve(fullContent);
    });

    stream.on("error", (err) => {
      console.error("Error: ", err);
      reject(err);
    });
  });
}
