// client/user.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Get user data
exports.getUserData = createSecureEndpoint(async (req, res) => {
  try {
    const { uid } = req.user;

    const userRecord = await admin.auth().getUser(uid);
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json(formatErrorResponse('User not found', 404));
    }

    return {
      ...userRecord.toJSON(),
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json(formatErrorResponse('Error getting user data', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Update user profile
exports.updateUserProfile = createSecureEndpoint(async (req, res) => {
  try {
    const { uid } = req.user;
    const { userData } = req.body;

    if (!userData) {
      return res.status(400).json(formatErrorResponse('User data is required', 400));
    }

    await admin.auth().updateUser(uid, userData);
    await db.collection('users').doc(uid).set(userData, { merge: true });

    return { message: 'Profile updated successfully' };
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json(formatErrorResponse('Error updating user profile', 500, error.message));
  }
}, ['eshop_owner', 'admin']);