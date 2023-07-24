import { MODEL_DATA } from '../const';
import { GptMode } from '../types';
import { getModel } from './getModel';

export function countTokens(text: string, mode: GptMode) {
  const model = getModel(mode);

  return MODEL_DATA[model].encode(text).length;
}
