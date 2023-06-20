export interface OriginalContentProvider {
  reportChange(uri: string): void;
}

let globalOriginalContentProvider: OriginalContentProvider | undefined = undefined;

export function setOriginalContentProvider(originalContentProvider: OriginalContentProvider) {
  if (globalOriginalContentProvider) {
    throw new Error(`OriginalContentProvider is already set.`);
  }
  globalOriginalContentProvider = originalContentProvider;
}

export function getOriginalContentProvider(): OriginalContentProvider {
  if (!globalOriginalContentProvider) {
    throw new Error(`OriginalContentProvider is not set.`);
  }
  return globalOriginalContentProvider;
}