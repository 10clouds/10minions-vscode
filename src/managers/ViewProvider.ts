import * as vscode from "vscode";
import { MessageToVSCode, MessageToWebView } from "../Messages";

export interface ViewProvider extends vscode.WebviewViewProvider {
  postMessageToWebView(message: MessageToWebView): void;
  setBadge(tooltip: string, value: number): void;
  clearAndfocusOnInput(): Promise<void>;
  preFillPrompt(prompt: string): Promise<void>;
  handleWebviewMessage(data: MessageToVSCode): Promise<void>;
}

let globalViewProvider: ViewProvider | undefined = undefined;

export function setViewProvider(viewProvider: ViewProvider) {
  if (globalViewProvider) {
    throw new Error(`ViewProvider is already set.`);
  }
  globalViewProvider = viewProvider;
}

export function getViewProvider(): ViewProvider {
  if (!globalViewProvider) {
    throw new Error(`ViewProvider is not set.`);
  }
  return globalViewProvider;
}