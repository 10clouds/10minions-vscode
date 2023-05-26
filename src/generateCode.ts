import { Response } from "node-fetch";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { encode } from "gpt-tokenizer";

export type ContextData = {
  fileName: string;
  fullFileContent: string;
  selectedText: string;
};


const DEFAULT_PROMPTS = [
  {
    label: "Refactor",
    value: ``,
  },
  {
    label: "Fix",
    value: `You are an expert senior coder with IQ of 200, you are about to get a request from a simpleton layman. Figure out what is his intention and creativelly and proactivelly propose a solution to fix the CODE: 

`,
  },
  // Add more predefined prompts here
];

export async function translateUserQuery(userQuery: string, context: ContextData, onChunk: (chunk: string) => void): Promise<{ prompt: string }> {
  const userQueryToActualCodePrompt = `
Translate the given user query to a prompt for an LLM. The LLM will then generate a code based on the prompt. Rewrite the user query, to expand on it given the examples below. In other words, detect the intention of the user ba and translate it according to examples. Try to stick to specific example text as much as possible.

Example 1:
User Intent: "Refactor code to improve readability and maintainability, without altering the output or side effects." (default intent if user does not provide anything).
Prompt: "You are an expert senior coder with an IQ of 200. Critically analyze the provided code and propose a refactoring plan focusing on improving readability and maintainability. Your revised code should remain functional with no change in output or side effects. Suggest renaming functions, creating subroutines, or modifying types as needed, to achieve the aim of simplicity and readability. Ensure your code and any documentation meet the quality standards of a top open source project."

Example 2:
User Intent: "Fix the provided code, incorporating specific adjustments to improve its functionality."
Prompt: "As a highly experienced senior coder, you have received a code improvement request. Interpret the user's intentions and diligently propose a fix for the code, incorporating the specific adjustments requested by the user. Note that the user request is: <user's specific adjustment details>"

Example 3:
User Intent: "Improve the efficiency of the code, ensuring there's no change in its overall functionality."
Prompt: "As an expert senior coder, critically review the given code and propose changes that focus on optimizing its efficiency without altering the overall functionality. The revised code should remain easy to read, maintain, and suitable for production use. Apply techniques such as parallelization, function renaming, or subroutines creation if needed, and ensure the code quality and documentation meet the quality standards of top open source projects."

Example 4:
User Intent: "Identify and fix any bugs or issues in the provided code."
Prompt: "As an expert senior coder, you've been tasked with debugging a code. Thoroughly examine the provided code, identify any bugs or issues, and proactively propose and implement solutions to rectify them. Address the specific issues or bugs the user pointed out: <specific issues or bugs details>"

Example 5:
User Intent: "Streamline the code to enhance its readability and simplicity."
Prompt: "You are an expert senior coder with an IQ of 200. Analyze the given code and propose changes aimed at simplifying it and improving its readability, all while preserving its original functionality and side effects. Consider renaming functions, splitting and joining functions, or introducing or removing types as necessary. Ensure your code and any accompanying documentation align with the quality standards of top open source projects."

Example 6:
User Intent: "Expand the code by integrating additional features as specified."
Prompt: "As an expert senior coder, you've been asked to enhance a piece of code by adding new features. Understand the user's intent and creatively propose a way to implement the specified new features into the existing code. The additional features the user wishes to incorporate are: <details of additional features>."

=== User query ===
${userQuery}

=== CODE ===
${context.selectedText.length > 0 ? context.selectedText : context.fullFileContent}
`.trim();

  const response = await queryOpenAI(userQueryToActualCodePrompt);

  return { prompt: await processOpenAIResponseStream(response, onChunk) };
}

export async function createFixedCodeUsingPrompt(prompt: string, context: ContextData, onChunk: (chunk: string) => void) {
  const fullPrompt = await createPromptWithContext(prompt, context);
  const response = await queryOpenAI(fullPrompt);

  return await processOpenAIResponseStream(response, onChunk);
}

export function extractParsedLines(chunk: string) {
  const lines = chunk.split("\n");
  return lines
    .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
    .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
    .map((line) => JSON.parse(line));
}

export async function createPromptWithContext(prompt: string, context: ContextData) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return "";
  }

  let showSelectedText = context.selectedText.length > 0 && context.selectedText !== context.fullFileContent;

  //TODO: if file + selection is too long, we should not include file content

  let contextSections = `
===== CODE ====
${context.selectedText}

===== CONTEXT OF A FILE THE CODE IS IN (${context.fileName}) ====
${context.fullFileContent}
`.trim();

  if (!showSelectedText) {
    contextSections = `
===== CODE ====
${context.fullFileContent}
`.trim();
  }

  let promptWithContext = `${prompt}\n\n${contextSections}`;

  return promptWithContext;
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
