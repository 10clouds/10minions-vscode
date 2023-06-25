export interface CommandHistoryManager {
  updateCommandHistory(prompt: string): Promise<void>;
  sendCommandSuggestions(input: string): void;
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
