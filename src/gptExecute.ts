import * as vscode from "vscode";
import { AnalyticsManager } from "./AnalyticsManager";
import { AVAILABLE_MODELS, queryOpenAI, processOpenAIResponseStream, MODEL_DATA, canIRunThis } from "./openai";

export async function gptExecute({
  fullPrompt, onChunk = async (chunk: string) => { }, isCancelled = () => false, maxTokens = 2000, model = (vscode.workspace.getConfiguration("10minions").get("model") as AVAILABLE_MODELS), temperature = 1, controller = new AbortController(),
}: {
  fullPrompt: string;
  onChunk?: (chunk: string) => Promise<void>;
  isCancelled?: () => boolean;
  maxTokens?: number;
  model?: AVAILABLE_MODELS;
  temperature?: number;
  controller?: AbortController;
}) {
  let usedTokens = MODEL_DATA[model].encode(fullPrompt).length + maxTokens;
  
  if (canIRunThis({prompt: fullPrompt, model, maxTokens}) === false) {
    throw new Error(`Too many tokens used: ${usedTokens} > ${MODEL_DATA[model].maxTokens}`);
  }

  function reportOpenAICallToAnalytics(resultData: any) {
    AnalyticsManager.instance.reportOpenAICall(
      {
        model,
        messages: [
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      },
      resultData
    );
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await queryOpenAI({ fullPrompt, maxTokens, model, temperature, controller });
      const result = await processOpenAIResponseStream({ response, onChunk, isCancelled, controller });

      reportOpenAICallToAnalytics({ result });

      return result;
    } catch (error) {
      console.error(`Error on attempt ${attempt}: ${error}`);

      reportOpenAICallToAnalytics({ error: String(error) });

      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error("Assertion: Should never get here");
}