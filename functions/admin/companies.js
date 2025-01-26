// admin/companies.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');

const db = admin.firestore();

// Get all companies
exports.getAllCompanies = createSecureEndpoint(async (req, res) => {
  try {
    const snapshot = await db.collection('companies').get();
    const companies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return companies;
  } catch (error) {
    console.error('Error getting all companies:', error);
    res.status(500).json(formatErrorResponse('Error getting all companies', 500, error.message));
  }
}, ['admin']);

// Get company by ID
exports.getCompanyById = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!companyId) {
      return res.status(400).json(formatErrorResponse('Company ID is required', 400));
    }

    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json(formatErrorResponse('Company not found', 404));
    }

    return { id: companyDoc.id, ...companyDoc.data() };
  } catch (error) {
    console.error('Error getting company by ID:', error);
    res.status(500).json(formatErrorResponse('Error getting company by ID', 500, error.message));
  }
}, ['admin']);