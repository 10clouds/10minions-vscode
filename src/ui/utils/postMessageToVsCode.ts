import { MessageToVSCode } from '10minions-engine/dist/src/managers/Messages';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

export function postMessageToVsCode(message: MessageToVSCode) {
  vscode.postMessage(message);
}
