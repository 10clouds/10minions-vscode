import { Schema } from 'jsonschema';
import { encode as encodeGPT4 } from 'gpt-tokenizer/cjs/model/gpt-4';

export type GptMode = 'FAST' | 'QUALITY';
export type AVAILABLE_MODELS =
  | 'gpt-4-0613'
  | 'gpt-3.5-turbo-0613'
  | 'gpt-3.5-turbo-16k-0613'; // | "gpt-4-32k-0613"
export type OutputType = 'string' | FunctionDef;
export type FunctionParams = {
  type: 'object';
  properties: { [key: string]: Schema };
  required: string[];
};

export type FunctionDef = {
  name: string;
  description: string;
  parameters: FunctionParams;
};

export type ModelData = {
  [key in AVAILABLE_MODELS]: {
    maxTokens: number;
    encode: typeof encodeGPT4;
    inputCostPer1K: number;
    outputCostPer1K: number;
  };
};

export interface ModelsResponseData {
  objest: string;
  data: {
    id: string;
    object: string;
    created: Date | number;
    owned_by: string;
    root: string;
    permissions: {
      allow_create_engine: boolean;
      allow_fine_tuning: boolean;
      allow_logprobs: boolean;
      allow_sampling: boolean;
      allow_search_indices: boolean;
      allow_view: boolean;
      created: Date | number;
      group: string;
      id: string;
      is_blocking: boolean;
      object: string;
      organization: string;
    }[];
  }[];
}

export interface ParsedLine {
  id: string;
  object: string;
  created: Date | number;
  model: string;
  choices: {
    index: number;
    delta: {
      role: string;
      content: string | null;
      function_call: {
        name: string;
        arguments: string;
      };
      finish_reason: string | null;
    };
  }[];
  error: {
    message: string;
  };
}
