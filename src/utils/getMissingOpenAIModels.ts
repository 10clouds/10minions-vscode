import { MODEL_DATA } from '../const';
import { AVAILABLE_MODELS, ModelsResponseData } from '../types';

/**
 * Function to check the availability of all models in OpenAI.
 */
export async function getMissingOpenAIModels(
  openAIApiKey: string,
): Promise<AVAILABLE_MODELS[]> {
  const missingModels: AVAILABLE_MODELS[] = Object.keys(
    MODEL_DATA,
  ) as AVAILABLE_MODELS[];

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIApiKey}`,
      },
    });

    const responseData = (await response.json()) as ModelsResponseData;
    if (!responseData || !responseData.data) {
      console.error('No data received from OpenAI models API.');
      return missingModels;
    }

    const availableModels = responseData.data.map((model) => model.id);

    return missingModels.filter((model) => !availableModels.includes(model));
  } catch (error) {
    console.error(`Error occurred while checking models: ${error}`);
    return missingModels;
  }
}
