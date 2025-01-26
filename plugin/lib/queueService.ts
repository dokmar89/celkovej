import { db } from './firebase';
import { collection, addDoc, updateDoc, doc, getDoc, query, where, getDocs, Timestamp, DocumentReference, deleteDoc } from 'firebase/firestore';
import { createLogger } from 'logger'; // Importuj createLogger

const logger = createLogger(); // Vytvoř instanci loggeru

interface QueueItem {
  id?: string;
  type: 'webhook' | 'verification' | 'notification';
  payload: any;
  attempts: number;
  maxAttempts: number;
  nextAttempt: Date;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class QueueService {
  private readonly COLLECTION = 'queue';
  private readonly MAX_ATTEMPTS = 5;
  private readonly RETRY_DELAYS = [
    1 * 60 * 1000,    // 1 minute
    5 * 60 * 1000,    // 5 minutes
    15 * 60 * 1000,   // 15 minutes
    30 * 60 * 1000,   // 30 minutes
    60 * 60 * 1000    // 1 hour
  ];

  async enqueue(
    type: QueueItem['type'],
    payload: any,
    maxAttempts: number = this.MAX_ATTEMPTS
  ): Promise<string> {
    const item: Omit<QueueItem, 'id'> = {
      type,
      payload,
      attempts: 0,
      maxAttempts,
      nextAttempt: new Date(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const docRef = await addDoc(collection(db, this.COLLECTION), {
        ...item,
        nextAttempt: Timestamp.fromDate(item.nextAttempt),
        createdAt: Timestamp.fromDate(item.createdAt),
        updatedAt: Timestamp.fromDate(item.updatedAt)
      });

      logger.info('Enqueued item', { type, id: docRef.id });
      return docRef.id;
    } catch (error) {
      logger.error('Failed to enqueue item', error);
      throw error;
    }
  }

  async processItem(id: string, processor: (payload: any) => Promise<void>): Promise<boolean> {
    const docRef = doc(db, this.COLLECTION, id);

    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        logger.warn('Queue item not found', { id });
        return false;
      }

      const item = docSnap.data() as QueueItem;
      if (item.status !== 'pending') {
        logger.warn('Queue item not in pending status', { id, status: item.status });
        return false;
      }

      // Mark as processing
      await updateDoc(docRef, {
        status: 'processing',
        updatedAt: Timestamp.fromDate(new Date())
      });

      // Process the item
      await processor(item.payload);

      // Mark as completed
      await updateDoc(docRef, {
        status: 'completed',
        updatedAt: Timestamp.fromDate(new Date())
      });

      logger.info('Successfully processed queue item', { id });
      return true;
    } catch (error) {
      const item = (await getDoc(docRef)).data() as QueueItem;
      const attempts = (item?.attempts || 0) + 1;
      const failed = attempts >= (item?.maxAttempts || this.MAX_ATTEMPTS);

      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      await updateDoc(docRef, {
        status: failed ? 'failed' : 'pending',
        attempts,
        error: errorMessage,
        nextAttempt: Timestamp.fromDate(
          new Date(Date.now() + (this.RETRY_DELAYS[attempts - 1] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1]))
        ),
        updatedAt: Timestamp.fromDate(new Date())
      });

      logger.error('Failed to process queue item', {
        id,
        attempts,
        failed,
        error
      });

      return false;
    }
  }

  async getPendingItems(): Promise<QueueItem[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION),
        where('status', '==', 'pending'),
        where('nextAttempt', '<=', Timestamp.fromDate(new Date()))
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QueueItem[];
    } catch (error) {
      logger.error('Failed to get pending items', error);
      return [];
    }
  }

  async cleanupOldItems(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const q = query(
        collection(db, this.COLLECTION),
        where('status', 'in', ['completed', 'failed']),
        where('updatedAt', '<=', Timestamp.fromDate(cutoffDate))
      );

      const querySnapshot = await getDocs(q);
      const batch: DocumentReference[] = []; // Explicitně definovaný typ

      querySnapshot.forEach(doc => {
        batch.push(doc.ref);
      });

      // Delete in batches of 500 (Firestore limit)
      for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        await Promise.all(chunk.map(ref => deleteDoc(ref)));
      }

      logger.info('Cleaned up old queue items', {
        itemsDeleted: batch.length,
        olderThan: cutoffDate
      });
    } catch (error) {
      logger.error('Failed to cleanup old items', error);
      throw error;
    }
  }
}