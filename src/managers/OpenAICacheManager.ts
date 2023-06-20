import * as admin from 'firebase-admin';
import { getAnalyticsManager } from './AnalyticsManager';

export class OpenAICacheManager {
  private firestore: admin.firestore.Firestore | undefined;

  constructor(serviceAccount?: admin.ServiceAccount) {
    if (serviceAccount) {

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.firestore = admin.firestore();
    } else {
      this.firestore = undefined;
    }

    setOpenAICacheManager(this);
  }

  public async getCachedResult(requestData: object): Promise<any | undefined> {
    if (!this.firestore) {
      return undefined;
    }

    const requestDataHash = getAnalyticsManager().getRequestHash(requestData);

    const snapshot = await this.firestore.collection('openAICalls').where('requestDataHash', '==', requestDataHash).get();

    if (snapshot.empty) {
      return undefined;
    }

    let data: string[] = [];

    snapshot.forEach((doc) => {
      console.log(doc.id, '=>', doc.data());
      if (typeof doc.data().responseData === "string") {
        data.push(doc.data().responseData as string);
      }
    });

    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex];
  }
}

let globalManager: OpenAICacheManager;

export function setOpenAICacheManager(manager: OpenAICacheManager) {
  if (globalManager) {
    throw new Error(`OpenAICacheManager is already set.`);
  }
  globalManager = manager;
}

export function getOpenAICacheManager(): OpenAICacheManager {
  return globalManager;
}
