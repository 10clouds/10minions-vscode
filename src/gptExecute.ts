import { AnalyticsManager } from "./AnalyticsManager";
import { AVAILABLE_MODELS, queryOpenAI, processOpenAIResponseStream, MODEL_DATA, canIRunThis } from "./openai";

export async function gptExecute({
  fullPrompt, onChunk = async (chunk: string) => { }, isCancelled = () => false, maxTokens = 2000, model = "gpt-4", temperature = 1, controller = new AbortController(),
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


  // Step 1: Add a loop that iterates up to 3 times.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await queryOpenAI({ fullPrompt, maxTokens, model, temperature, controller });
      const result = await processOpenAIResponseStream({ response, onChunk, isCancelled, controller });

      reportOpenAICallToAnalytics({ result });

      // Step 3: On successful run, break the loop early and return the result.
      return result;
    } catch (error) {
      // Step 2: Add error handling for exceptions.
      // Step 4: Log the error and retry the process for up to 2 more times.
      console.error(`Error on attempt ${attempt}: ${error}`);

      reportOpenAICallToAnalytics({ error: String(error) });

      // Step 5: On the 3rd error, give up and re-throw the error.
      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error("Assertion: Should never get here");
}
