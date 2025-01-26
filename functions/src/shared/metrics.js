// shared/metrics.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { formatSuccessResponse, formatErrorResponse } = require('./responses');

const db = admin.firestore();

// Monitoring metrics
const METRICS = {
    VERIFICATION_DURATION: 'verification.duration',
    VERIFICATION_SUCCESS_RATE: 'verification.success_rate',
    API_LATENCY: 'api.latency',
    WEBHOOK_DELIVERY_TIME: 'webhook.delivery_time',
    QUEUE_SIZE: 'queue.size',
    ERROR_RATE: 'error.rate'
};

// Record a metric
exports.recordMetric = functions.https.onCall(async (data, context) => {
    try {
        const { name, value, unit, tags = {} } = data;

        if (!name || value === undefined || !unit) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }

        const metric = {
            name,
            value,
            unit,
            tags,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('metrics').add(metric);
        return formatSuccessResponse(null, 'Metric recorded successfully');
    } catch (error) {
        console.error('Error recording metric:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});