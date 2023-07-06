export interface OpenAICacheManager {
  getCachedResult(requestData: object): Promise<string | undefined>;
}

let globalManager: OpenAICacheManager | undefined = undefined;

export function setOpenAICacheManager(manager: OpenAICacheManager | undefined) {
  if (manager === undefined) {
    globalManager = undefined;
    return;
  }

  if (globalManager) {
    throw new Error(`OpenAICacheManager is already set.`);
  }

  globalManager = manager;
}

export function getOpenAICacheManager(): OpenAICacheManager {
  if (!globalManager) {
    throw new Error(`OpenAICacheManager is not set.`);
  }
  return globalManager;
}
