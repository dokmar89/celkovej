// client/login.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { formatErrorResponse } = require('../shared/responses');
const bcrypt = require('bcrypt');

const db = admin.firestore();

// User login endpoint
exports.userLogin = functions.https.onRequest(async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json(formatErrorResponse('Email and password are required', 400));
        }

        const userRecord = await admin.auth().getUserByEmail(email);
        const userDoc = await db.collection('users').doc(userRecord.uid).get();

        if (!userDoc.exists) {
            return res.status(401).json(formatErrorResponse('Invalid credentials', 401));
        }

        const userData = userDoc.data();

        // Compare the hashed password
        const validPassword = await bcrypt.compare(password, userRecord.passwordHash);
        if (!validPassword) {
            return res.status(401).json(formatErrorResponse('Invalid credentials', 401));
        }

        // Generate a custom token
        const customToken = await admin.auth().createCustomToken(userRecord.uid, { role: userData.role, companyId: userData.companyId });

        return res.status(200).json({ token: customToken });
    } catch (error) {
        console.error('Error during user login:', error);
        return res.status(500).json(formatErrorResponse('Error during login', 500, error.message));
    }
});