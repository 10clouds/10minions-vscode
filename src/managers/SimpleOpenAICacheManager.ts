import * as admin from 'firebase-admin';
import { getAnalyticsManager } from './AnalyticsManager';
import { setOpenAICacheManager } from './OpenAICacheManager';

export class SimpleOpenAICacheManager {
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
  }

  public async getCachedResult(
    requestData: object,
  ): Promise<string | undefined> {
    if (!this.firestore) {
      return undefined;
    }

    const requestDataHash = getAnalyticsManager().getRequestHash(requestData);

    const snapshot = await this.firestore
      .collection('openAICalls')
      .where('requestDataHash', '==', requestDataHash)
      .get();

    if (snapshot.empty) {
      return undefined;
    }

    const data: string[] = [];

    snapshot.forEach((doc) => {
      if (typeof doc.data().responseData === 'string') {
        data.push(doc.data().responseData as string);
      }
    });

    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex];
  }
}
