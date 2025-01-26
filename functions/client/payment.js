// client/payment.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Get wallet balance
exports.getWalletBalance = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json(formatErrorResponse('Company ID is required', 400));
    }

    const walletDoc = await db.collection('wallets').doc(companyId).get();
    if (!walletDoc.exists) {
      return res.status(404).json(formatErrorResponse('Wallet not found', 404));
    }

    return { balance: walletDoc.data().balance };
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    res.status(500).json(formatErrorResponse('Error getting wallet balance', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Process payment
exports.processPayment = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId, amount, currency, method } = req.body;
    if (!companyId || !amount || !currency || !method) {
      return res.status(400).json(formatErrorResponse('All payment details are required', 400));
    }

    // Process payment logic here (e.g., using Stripe)
    // ...

    const transaction = {
      companyId,
      amount,
      currency,
      method,
      status: 'completed',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('transactions').add(transaction);
    return { transactionId: docRef.id, ...transaction };
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json(formatErrorResponse('Error processing payment', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Generate invoice
exports.generateInvoice = createSecureEndpoint(async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json(formatErrorResponse('Transaction ID is required', 400));
    }

    const transactionDoc = await db.collection('transactions').doc(transactionId).get();
    if (!transactionDoc.exists) {
      return res.status(404).json(formatErrorResponse('Transaction not found', 404));
    }

    // Generate invoice logic here
    // ...

    const invoiceData = {
      transactionId,
      invoiceNumber: `INV-${Date.now()}`,
      ...transactionDoc.data(),
      generatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('invoices').add(invoiceData);
    return { invoiceId: docRef.id, ...invoiceData };
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json(formatErrorResponse('Error generating invoice', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Get transaction history
exports.getTransactionHistory = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json(formatErrorResponse('Company ID is required', 400));
    }

    const snapshot = await db.collection('transactions')
      .where('companyId', '==', companyId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return history;
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json(formatErrorResponse('Error getting transaction history', 500, error.message));
  }
}, ['eshop_owner', 'admin']);