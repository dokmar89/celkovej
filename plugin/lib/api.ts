import { db } from './firebase';
import { doc, getDoc, addDoc, collection, Timestamp } from 'firebase/firestore';

export interface VerificationResult {
  success: boolean;
  method: string;
  timestamp: number;
  userId?: string;
  error?: string;
}

export const verificationApi = {
  async getEshopConfig(eshopId: string) {
    try {
      const docRef = doc(db, 'eshops', eshopId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      throw new Error('E-shop configuration not found');
    } catch (error) {
      console.error('Error fetching e-shop config:', error);
      throw error;
    }
  },

  async saveVerificationResult(eshopId: string, result: VerificationResult) {
    try {
      const verificationsCollection = collection(db, 'verifications');
      await addDoc(verificationsCollection, {
        ...result,
        eshopId,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error saving verification result:', error);
      throw error;
    }
  },

  async validateApiKey(apiKey: string) {
    try {
      const docRef = doc(db, 'eshops', apiKey); // Assuming apiKey is the eshopId
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error validating API key:', error);
      throw error;
    }
  }
};