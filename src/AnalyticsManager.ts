import * as crypto from "crypto";
import * as vscode from "vscode";
import { workspace } from "vscode";
import { MinionTask } from "./MinionTask";

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, setDoc, doc } from "firebase/firestore";

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

// package.json is exposed through webpack
declare const NPM_PACKAGE: any;

export class AnalyticsManager {
  public static instance: AnalyticsManager;
  private installationId: string;

  constructor(context: vscode.ExtensionContext) {
    // Retrieve or generate a unique installation Id
    this.installationId = context.globalState.get<string>("10minions.installationId") || "";
    if (!this.installationId) {
      this.installationId = crypto.randomUUID();
      context.globalState.update("10minions.installationId", this.installationId);
    }

    console.log(`Installation Id: ${this.installationId}`);

    this.reportEvent("extensionActivated");

    if (AnalyticsManager.instance) {
      throw new Error("AnalyticsManager already instantiated");
    }

    AnalyticsManager.instance = this;
  }

  private commonAnalyticsData(): { installationId: string; vsCodeVersion: string; pluginVersion: string; timestamp: Date } {
    return {
      installationId: this.installationId,
      vsCodeVersion: vscode.version,
      pluginVersion: NPM_PACKAGE.version,
      timestamp: new Date(),
    };
  }

  public async reportEvent(eventName: string, eventProperties?: { [key: string]: string | number | boolean }, forceSendEvenIfNotEnabled: boolean = false): Promise<void> {
    // Check if sending diagnostics data is allowed by the user settings
    if (!forceSendEvenIfNotEnabled && !workspace.getConfiguration().get<boolean>("10minions.sendDiagnosticsData")) {
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
    if (!workspace.getConfiguration().get<boolean>("10minions.sendDiagnosticsData")) {
      return;
    }
    // Serialize the minion task
    const serializedMinionTask = minionTask.serialize();


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

  public async reportOpenAICall(requestData: any, responseData: any): Promise<void> {
    // Check if sending diagnostics data is allowed by the user settings
    if (!workspace.getConfiguration().get<boolean>("10minions.sendDiagnosticsData")) {
      return;
    }
    // Prepare the OpenAI call event data
    const openAICallData = {
      ...this.commonAnalyticsData(),

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
