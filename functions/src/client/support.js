// client/support.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Create support ticket
exports.createSupportTicket = createSecureEndpoint(async (req, res) => {
  try {
    const { subject, description, priority, userId } = req.body;
    if (!subject || !description || !priority || !userId) {
      return res.status(400).json(formatErrorResponse('All ticket details are required', 400));
    }

    const ticket = {
      subject,
      description,
      priority,
      userId,
      status: 'open',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('support_tickets').add(ticket);
    return { ticketId: docRef.id, ...ticket };
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json(formatErrorResponse('Error creating support ticket', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Get support tickets
exports.getSupportTickets = createSecureEndpoint(async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json(formatErrorResponse('User ID is required', 400));
    }

    const snapshot = await db.collection('support_tickets')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return tickets;
  } catch (error) {
    console.error('Error getting support tickets:', error);
    res.status(500).json(formatErrorResponse('Error getting support tickets', 500, error.message));
  }
}, ['eshop_owner', 'admin']);