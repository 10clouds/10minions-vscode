import * as admin from 'firebase-admin';
import { getAnalyticsManager } from './AnalyticsManager';
import { setOpenAICacheManager } from './OpenAICacheManager';

export class ConsumingOpenAICacheManager {
  private firestore: admin.firestore.Firestore | undefined;
  private cache: Record<string, string[]> = {};

  constructor(serviceAccount?: admin.ServiceAccount) {
    if (serviceAccount) {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
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

    //if cache was not initialized yet, initialize it
    if (!this.cache[requestDataHash]) {
      const snapshot = await this.firestore
        .collection('openAICalls')
        .where('requestDataHash', '==', requestDataHash)
        .get();

      this.cache[requestDataHash] = [];

      snapshot.forEach((doc) => {
        if (typeof doc.data().responseData === 'string') {
          this.cache[requestDataHash].push(doc.data().responseData as string);
        }
      });
    }

    //consume the cache or return undefined
    if (this.cache[requestDataHash] && this.cache[requestDataHash].length > 0) {
      return this.cache[requestDataHash].shift();
    }

    console.log('No cached result for ', requestDataHash);
  }
}
