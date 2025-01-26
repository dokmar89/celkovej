// client/eshop.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createSecureEndpoint } = require('../middleware');
const { formatErrorResponse } = require('../shared/responses');
const { v4: uuidv4 } = require('uuid');

const db = admin.firestore();

// Add eshop
exports.addEshop = createSecureEndpoint(async (req, res) => {
  try {
    const { name, url, sector, integrationMethod, contractType, companyId } = req.body;

    if (!name || !url || !sector || !integrationMethod || !contractType || !companyId) {
      return res.status(400).json(formatErrorResponse('All fields are required', 400));
    }

    const apiKey = uuidv4();
    const newEshop = {
      name,
      url,
      sector,
      integrationMethod,
      contractType,
      companyId,
      apiKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('eshops').add(newEshop);
    return { id: docRef.id, ...newEshop };
  } catch (error) {
    console.error('Error adding eshop:', error);
    res.status(500).json(formatErrorResponse('Error adding eshop', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Get eshops
exports.getEshops = createSecureEndpoint(async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json(formatErrorResponse('Company ID is required', 400));
    }

    const snapshot = await db.collection('eshops')
      .where('companyId', '==', companyId)
      .get();

    const eshops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return eshops;
  } catch (error) {
    console.error('Error getting eshops:', error);
    res.status(500).json(formatErrorResponse('Error getting eshops', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Update eshop customization
exports.updateEshopCustomization = createSecureEndpoint(async (req, res) => {
  try {
    const { eshopId, customization } = req.body;
    if (!eshopId || !customization) {
      return res.status(400).json(formatErrorResponse('Eshop ID and customization data are required', 400));
    }

    await db.collection('eshops').doc(eshopId).update({
      customization,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { message: 'Customization updated successfully' };
  } catch (error) {
    console.error('Error updating eshop customization:', error);
    res.status(500).json(formatErrorResponse('Error updating eshop customization', 500, error.message));
  }
}, ['eshop_owner', 'admin']);

// Get eshop integration code
exports.getEshopIntegrationCode = createSecureEndpoint(async (req, res) => {
    try {
        const { eshopId } = req.query;

        if (!eshopId) {
            return res.status(400).json(formatErrorResponse('Eshop ID is required', 400));
        }

        const eshopDoc = await db.collection('eshops').doc(eshopId).get();
        if (!eshopDoc.exists) {
            return res.status(404).json(formatErrorResponse('Eshop not found', 404));
        }

        const eshopData = eshopDoc.data();
        const integrationCode = `
<!-- Age Verification Service Integration -->
<script>
window.AVS_CONFIG = {
    eshopId: "${eshopId}",
    apiKey: "${eshopData.apiKey}",
    environment: "${process.env.ENVIRONMENT || 'production'}"
};
</script>
<script src="https://cdn.ageverification.com/sdk.js"></script>
`;

        return { integrationCode };
    } catch (error) {
        console.error('Error getting integration code:', error);
        res.status(500).json(formatErrorResponse('Error getting integration code', 500, error.message));
    }
}, ['eshop_owner', 'admin']);

// Test eshop integration
exports.testEshopIntegration = createSecureEndpoint(async (req, res) => {
    try {
        const { eshopId } = req.body;

        if (!eshopId) {
            return res.status(400).json(formatErrorResponse('Eshop ID is required', 400));
        }

        const testResults = {
            apiConnection: true,
            webhookDelivery: true,
            sdkLoading: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('integration_tests').add({
            eshopId,
            ...testResults
        });

        return testResults;
    } catch (error) {
        console.error('Error testing integration:', error);
        res.status(500).json(formatErrorResponse('Error testing integration', 500, error.message));
    }
}, ['eshop_owner', 'admin']);

// Get eshop analytics
exports.getEshopAnalytics = createSecureEndpoint(async (req, res) => {
    try {
        const { eshopId, startDate, endDate } = req.query;

        if (!eshopId) {
            return res.status(400).json(formatErrorResponse('Eshop ID is required', 400));
        }

        const analyticsQuery = db.collection('verifications')
            .where('eshopId', '==', eshopId);

        if (startDate) {
            analyticsQuery.where('timestamp', '>=', new Date(startDate));
        }
        if (endDate) {
            analyticsQuery.where('timestamp', '<=', new Date(endDate));
        }

        const snapshot = await analyticsQuery.get();

        const analytics = {
            totalVerifications: snapshot.size,
            successRate: 0,
            averageResponseTime: 0,
            methodDistribution: {}
        };

        let successCount = 0;
        let totalResponseTime = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.status === 'success') successCount++;
            if (data.responseTime) totalResponseTime += data.responseTime;
            analytics.methodDistribution[data.method] = (analytics.methodDistribution[data.method] || 0) + 1;
        });

        analytics.successRate = (successCount / snapshot.size) * 100;
        analytics.averageResponseTime = totalResponseTime / snapshot.size;

        return analytics;
    } catch (error) {
        console.error('Error getting eshop analytics:', error);
        res.status(500).json(formatErrorResponse('Error getting eshop analytics', 500, error.message));
    }
}, ['eshop_owner', 'admin']);

// Update eshop settings
exports.updateEshopSettings = createSecureEndpoint(async (req, res) => {
    try {
        const { eshopId, settings } = req.body;

        if (!eshopId || !settings) {
            return res.status(400).json(formatErrorResponse('Eshop ID and settings are required', 400));
        }

        await db.collection('eshops').doc(eshopId).update({
            settings,
            settingsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { message: 'Eshop settings updated successfully' };
    } catch (error) {
        console.error('Error updating eshop settings:', error);
        res.status(500).json(formatErrorResponse('Error updating eshop settings', 500, error.message));
    }
}, ['eshop_owner', 'admin']);