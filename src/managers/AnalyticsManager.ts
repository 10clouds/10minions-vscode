import { MinionTask } from "../MinionTask";

// Defining the shape of event properties
export interface AnalyticsEventProperties {
  [key: string]: string | number | boolean;
}

// Defining the shape of a VSCodeAnalyticsManager class
export interface AnalyticsManager {
  reportEvent(eventName: string, eventProperties?: AnalyticsEventProperties, forceSendEvenIfNotEnabled?: boolean): Promise<void>;
  reportOrUpdateMinionTask(minionTask: MinionTask): Promise<void>;
  reportOpenAICall(requestData: any, responseData: any): Promise<void>;
  getInstallationId(): string;
}

let globalManager: AnalyticsManager;

export function setAnalyticsManager(manager: AnalyticsManager) {
  if (globalManager) {
    throw new Error(`AnalyticsManager is already set.`);
  }
  globalManager = manager;
}

export function getAnalyticsManager(): AnalyticsManager {
  return globalManager;
}
