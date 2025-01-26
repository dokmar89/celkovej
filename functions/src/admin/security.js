// admin/security.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Get security settings
exports.getSecuritySettings = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json(formatErrorResponse('Company ID is required', 400));
    }

    const settingsDoc = await db.collection('security_settings').doc(companyId).get();
    if (!settingsDoc.exists) {
      return res.status(404).json(formatErrorResponse('Security settings not found', 404));
    }

    return settingsDoc.data();
  } catch (error) {
    console.error('Error getting security settings:', error);
    res.status(500).json(formatErrorResponse('Error getting security settings', 500, error.message));
  }
}, ['admin']);

// Update security settings
exports.updateSecuritySettings = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId, settings } = req.body;
    if (!companyId || !settings) {
      return res.status(400).json(formatErrorResponse('Company ID and settings are required', 400));
    }

    await db.collection('security_settings').doc(companyId).set(settings, { merge: true });
    return { message: 'Security settings updated successfully' };
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json(formatErrorResponse('Error updating security settings', 500, error.message));
  }
}, ['admin']);