// client/webhook.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Handle webhook
exports.handlewebhook = functions.https.onRequest(async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type || !data) {
      return res.status(400).json(formatErrorResponse('Webhook type and data are required', 400));
    }

    const webhook = {
      type,
      data,
      processedAt: admin.firestore.Timestamp.now(),
      status: 'processed'
    };

    await db.collection('webhooks').add(webhook);
    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json(formatErrorResponse('Error processing webhook', 500, error.message));
  }
});