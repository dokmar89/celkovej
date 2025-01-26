// client/verification.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Get verification history
exports.getVerificationHistory = createSecureEndpoint(async (req, res) => {
  try {
    const { eshopId } = req.body;
    if (!eshopId) {
      return res.status(400).json(formatErrorResponse('Eshop ID is required', 400));
    }

    const snapshot = await db.collection('verifications')
      .where('eshopId', '==', eshopId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return history;
  } catch (error) {
    console.error('Error getting verification history:', error);
    res.status(500).json(formatErrorResponse('Error getting verification history', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Get method ratio
exports.getMethodRatio = createSecureEndpoint(async (req, res) => {
  try {
    const { eshopId } = req.body;
    if (!eshopId) {
      return res.status(400).json(formatErrorResponse('Eshop ID is required', 400));
    }

    const snapshot = await db.collection('verifications')
      .where('eshopId', '==', eshopId)
      .get();

    const methods = {
      bankId: 0,
      mojeId: 0,
      faceScan: 0
    };

    snapshot.docs.forEach(doc => {
      const method = doc.data().method;
      if (method in methods) {
        methods[method]++;
      }
    });

    return methods;
  } catch (error) {
    console.error('Error getting method ratio:', error);
    res.status(500).json(formatErrorResponse('Error getting method ratio', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Get success ratio
exports.getSuccessRatio = createSecureEndpoint(async (req, res) => {
  try {
    const { eshopId } = req.body;
    if (!eshopId) {
      return res.status(400).json(formatErrorResponse('Eshop ID is required', 400));
    }

    const snapshot = await db.collection('verifications')
      .where('eshopId', '==', eshopId)
      .get();

    let success = 0;
    let failed = 0;

    snapshot.docs.forEach(doc => {
      if (doc.data().status === 'success') {
        success++;
      } else {
        failed++;
      }
    });

    return { success, failed };
  } catch (error) {
    console.error('Error getting success ratio:', error);
    res.status(500).json(formatErrorResponse('Error getting success ratio', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Get overview data
exports.getOverviewData = createSecureEndpoint(async (req, res) => {
  try {
    const { eshopId } = req.body;
    if (!eshopId) {
      return res.status(400).json(formatErrorResponse('Eshop ID is required', 400));
    }

    const snapshot = await db.collection('verifications')
      .where('eshopId', '==', eshopId)
      .get();

    let totalVerifications = snapshot.size;
    let successCount = 0;
    let totalTime = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'success') {
        successCount++;
      }
      if (data.duration) {
        totalTime += data.duration;
      }
    });

    const successRate = totalVerifications > 0 ? (successCount / totalVerifications) * 100 : 0;
    const averageTime = totalVerifications > 0 ? totalTime / totalVerifications : 0;

    return {
      totalVerifications,
      successRate,
      averageTime
    };
  } catch (error) {
    console.error('Error getting overview data:', error);
    res.status(500).json(formatErrorResponse('Error getting overview data', 500, error.message));
  }
}, ['eshop_owner', 'admin']);