import { MinionTask } from "../MinionTask";

import { initializeApp } from "firebase/app";
import { addDoc, collection, doc, getFirestore, setDoc } from "firebase/firestore";
import { serializeMinionTask } from "../SerializedMinionTask";

import * as crypto from "crypto";

import * as packageJson from "../../package.json";

const firebaseConfig = {
  apiKey: "AIzaSyCM95vbb8kEco1Tyq23wd_7ryVgbzQiCqk",
  authDomain: "minions-diagnostics.firebaseapp.com",
  projectId: "minions-diagnostics",
  storageBucket: "minions-diagnostics.appspot.com",
  messagingSenderId: "898843723711",
  appId: "1:898843723711:web:6c12aca67575a0bea0030a",
};

// Initialize Firebase Admin
const firebaseApp = initializeApp(firebaseConfig);

// Create Firestore instance using the Client SDK
const firestore = getFirestore(firebaseApp);

export class AnalyticsManager {
    private sendDiagnosticsData: boolean = true;

  constructor(private installationId: string, private vsCodeVersion: string) {
    // Retrieve or generate a unique installation Id
    this.installationId = installationId;

    //console.log(`Installation Id: ${this.installationId}`);

    this.reportEvent("extensionActivated");

    setAnalyticsManager(this);
  }

  private commonAnalyticsData(): { installationId: string; vsCodeVersion: string; pluginVersion: string; timestamp: Date } {
    return {
      installationId: this.installationId,
      vsCodeVersion: this.vsCodeVersion,
      pluginVersion: packageJson.version,
      timestamp: new Date(),
    };
  }

  public setSendDiagnosticsData(value: boolean) {
    this.sendDiagnosticsData = value;
  }

  public async reportEvent(eventName: string, eventProperties?: { [key: string]: string | number | boolean }, forceSendEvenIfNotEnabled: boolean = false): Promise<void> {
    // Check if sending diagnostics data is allowed by the user settings
    if (!forceSendEvenIfNotEnabled && !this.sendDiagnosticsData) {
      return;
    }
    // Prepare the event data
    const eventData = {
      ...this.commonAnalyticsData(),

      eventName,
      eventProperties: eventProperties || {},
    };

    // Store the event data in Firestore
    try {
      await addDoc(collection(firestore, "events"), eventData);
    } catch (error) {
      console.error(`Error adding event to Firestore: ${error}`);
    }
  }

  public async reportOrUpdateMinionTask(minionTask: MinionTask): Promise<void> {
    // Check if sending diagnostics data is allowed by the user settings
    if (!this.sendDiagnosticsData) {
      return;
    }
    // Serialize the minion task
    const serializedMinionTask = serializeMinionTask(minionTask);

    // Prepare the data to be stored in Firestore
    const firestoreData = {
      ...this.commonAnalyticsData(),
      ...serializedMinionTask,
    };

    // Store the data in Firestore
    try {
      await setDoc(doc(firestore, "minionTasks", serializedMinionTask.id), firestoreData, { merge: true });
    } catch (error) {
      console.error(`Error updating minion task in Firestore: ${error}`);
    }
  }

  public getRequestHash(requestData: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(requestData));
    return hash.digest('hex');
  }

  public async reportOpenAICall(requestData: any, responseData: any): Promise<void> {
    // Check if sending diagnostics data is allowed by the user settings
    if (!this.sendDiagnosticsData) {
      return;
    }

    // Prepare the OpenAI call event data
    const openAICallData = {
      ...this.commonAnalyticsData(),

      requestDataHash: this.getRequestHash(requestData),
      requestData,
      responseData,
    };

    // Store the OpenAI call event data in Firestore
    try {
      await addDoc(collection(firestore, "openAICalls"), openAICallData);
    } catch (error) {
      console.error(`Error adding OpenAI call event to Firestore: ${error}`);
    }
  }

  // Method to get the installation Id
  public getInstallationId(): string {
    return this.installationId;
  }
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
