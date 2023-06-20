export interface CommandHistoryManager {
  cancelSuggestion(): void;
  updateCommandHistory(prompt: string): Promise<void>;
  getCommandSuggestionGPT(input: string, code: string, languageId: string): void;
}

let globalManager: CommandHistoryManager;

export function setCommandHistoryManager(manager: CommandHistoryManager) {
  if (globalManager) {
    throw new Error(`CommandHistoryManager is already set.`);
  }
  globalManager = manager;
}

export function getCommandHistoryManager(): CommandHistoryManager {
  return globalManager;
}
