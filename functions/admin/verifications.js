// admin/verifications.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Get verifications
exports.getVerifications = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json(formatErrorResponse('Company ID is required', 400));
    }

    const verificationsSnapshot = await db.collection('verifications')
      .where('companyId', '==', companyId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    const verifications = verificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return verifications;
  } catch (error) {
    console.error('Error getting verifications:', error);
    res.status(500).json(formatErrorResponse('Error getting verifications', 500, error.message));
  }
}, ['admin']);

// Create a new verification
exports.createVerification = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId, eshopId, userId, method, result, details } = req.body;
    if (!companyId || !eshopId || !userId || !method) {
      return res.status(400).json(formatErrorResponse('Company ID, eshop ID, user ID, and method are required', 400));
    }

    const newVerification = {
      companyId,
      eshopId,
      userId,
      method,
      result,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('verifications').add(newVerification);
    return { id: docRef.id, ...newVerification };
  } catch (error) {
    console.error('Error creating verification:', error);
    res.status(500).json(formatErrorResponse('Error creating verification', 500, error.message));
  }
}, ['admin']);