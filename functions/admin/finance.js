// admin/finance.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Get finance data
exports.getFinanceData = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json(formatErrorResponse('Company ID is required', 400));
    }

    const transactions = await db.collection('transactions')
      .where('companyId', '==', companyId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const data = transactions.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return data;
  } catch (error) {
    console.error('Error getting finance data:', error);
    res.status(500).json(formatErrorResponse('Error getting finance data', 500, error.message));
  }
}, ['admin']);