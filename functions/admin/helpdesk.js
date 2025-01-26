// admin/helpdesk.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Get helpdesk tickets
exports.getHelpdeskTickets = createSecureEndpoint(async (req, res) => {
  try {
    const ticketsSnapshot = await db.collection('helpdesk').get();
    const tickets = ticketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return tickets;
  } catch (error) {
    console.error('Error getting helpdesk tickets:', error);
    res.status(500).json(formatErrorResponse('Error getting helpdesk tickets', 500, error.message));
  }
}, ['admin']);

// Create a new helpdesk ticket
exports.createHelpdeskTicket = createSecureEndpoint(async (req, res) => {
  try {
    const { subject, description, companyId, userId } = req.body;
    if (!subject || !description || !companyId || !userId) {
      return res.status(400).json(formatErrorResponse('Subject, description, company ID, and user ID are required', 400));
    }

    const newTicket = {
      subject,
      description,
      companyId,
      userId,
      status: 'open',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('helpdesk').add(newTicket);
    return { id: docRef.id, ...newTicket };
  } catch (error) {
    console.error('Error creating helpdesk ticket:', error);
    res.status(500).json(formatErrorResponse('Error creating helpdesk ticket', 500, error.message));
  }
}, ['admin']);

// Update a helpdesk ticket
exports.updateHelpdeskTicket = createSecureEndpoint(async (req, res) => {
  try {
    const { ticketId, ...updates } = req.body;
    if (!ticketId) {
      return res.status(400).json(formatErrorResponse('Ticket ID is required', 400));
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('helpdesk').doc(ticketId).update(updates);
    return { message: 'Ticket updated successfully' };
  } catch (error) {
    console.error('Error updating helpdesk ticket:', error);
    res.status(500).json(formatErrorResponse('Error updating helpdesk ticket', 500, error.message));
  }
}, ['admin']);

// Delete a helpdesk ticket
exports.deleteHelpdeskTicket = createSecureEndpoint(async (req, res) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) {
      return res.status(400).json(formatErrorResponse('Ticket ID is required', 400));
    }

    await db.collection('helpdesk').doc(ticketId).delete();
    return { message: 'Ticket deleted successfully' };
  } catch (error) {
    console.error('Error deleting helpdesk ticket:', error);
    res.status(500).json(formatErrorResponse('Error deleting helpdesk ticket', 500, error.message));
  }
}, ['admin']);