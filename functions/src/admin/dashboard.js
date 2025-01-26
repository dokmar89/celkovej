// admin/dashboard.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

// Helper function to get company statistics
const getCompanyStats = async (companyId, db) => { // Přidáme db jako parametr
    const today = new Date();
    const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));

    const verifications = await db.collection('verifications') // Použijeme parametr db
        .where('companyId', '==', companyId)
        .where('timestamp', '>=', thirtyDaysAgo)
        .get();

    const stats = {
        totalVerifications: verifications.size,
        successfulVerifications: 0,
        failedVerifications: 0,
        pendingVerifications: 0
    };

    verifications.forEach(doc => {
        const data = doc.data();
        if (data.status === 'success') stats.successfulVerifications++;
        else if (data.status === 'failed') stats.failedVerifications++;
        else stats.pendingVerifications++;
    });

    return stats;
};

// Dashboard data endpoint
exports.getDashboardData = createSecureEndpoint(async (req, res) => {
    const db = admin.firestore(); // Inicializace Firestore uvnitř funkce
    const { companyId } = req.body;
    if (!companyId) {
        return res.status(400).json(formatErrorResponse('Company ID is required', 400));
    }

    // Get company data
    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
        return res.status(404).json(formatErrorResponse('Company not found', 404));
    }

    // Get company statistics
    const stats = await getCompanyStats(companyId, db); // Předáme db do funkce

    return {
        company: companyDoc.data(),
        stats
    };
}, ['admin']);