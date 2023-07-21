import { GptMode } from '../types';

export function getModel(mode: GptMode) {
  return mode === 'FAST' ? 'gpt-3.5-turbo-16k-0613' : 'gpt-4-0613';
}
