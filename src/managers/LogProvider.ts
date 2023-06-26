
export interface LogProvider {
  reportChange(uri: string): void;
}

let globalLogProvider: LogProvider | undefined = undefined;

export function setLogProvider(logProvider: LogProvider | undefined) {
  if (logProvider === undefined) {
    globalLogProvider = undefined;
    return;
  }

  if (globalLogProvider) {
    throw new Error(`LogProvider is already set.`);
  }
  globalLogProvider = logProvider;
}

export function getLogProvider(): LogProvider {
  if (!globalLogProvider) {
    throw new Error(`LogProvider is not set.`);
  }
  return globalLogProvider;
}