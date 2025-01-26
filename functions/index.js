// index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { v4: uuidv4 } = require('uuid');

admin.initializeApp();

const { authenticateRequest } = require('./middleware');
const { getDashboardData: getAdminDashboardData } = require('./admin/dashboard');
const { getAllCompanies, getCompanyById } = require('./admin/companies');
const { getFinanceData } = require('./admin/finance');
const { getHelpdeskTickets, createHelpdeskTicket, updateHelpdeskTicket, deleteHelpdeskTicket } = require('./admin/helpdesk');
const { adminLogin } = require('./admin/login');
const { getSecuritySettings, updateSecuritySettings } = require('./admin/security');
const { getVerifications, createVerification } = require('./admin/verifications');
const { userLogin, getUserData, updateUserProfile } = require('./client/user');
const { addEshop, getEshops, updateEshopCustomization, getEshopIntegrationCode, testEshopIntegration, getEshopAnalytics, updateEshopSettings } = require('./client/eshop');
const { getVerificationHistory, getMethodRatio, getSuccessRatio, getOverviewData } = require('./client/verification');
const { getWalletBalance, processPayment, generateInvoice, getTransactionHistory } = require('./client/payment');
const { createSupportTicket: createClientSupportTicket, getSupportTickets: getClientSupportTickets } = require('./client/support');
const { handleWebhook } = require('./client/webhook');
const { processQueue } = require('./shared/queue');
const { recordMetric } = require('./shared/metrics');
const { getSecurityEvents } = require('./admin/security');
const { getVerificationData } = require('./admin/verifications');
const { formatSuccessResponse, formatErrorResponse } = require('./shared/responses');
const bcrypt = require('bcrypt');


// Firestore references
const db = admin.firestore();

// ============= ADMIN FUNCTIONS =============

exports.adminLogin = adminLogin;
exports.getDashboardData = getAdminDashboardData;
exports.getAllCompanies = getAllCompanies;
exports.getCompanyById = getCompanyById;
exports.getFinanceData = getFinanceData;
exports.getHelpdeskTickets = getHelpdeskTickets;
exports.createHelpdeskTicket = createHelpdeskTicket;
exports.updateHelpdeskTicket = updateHelpdeskTicket;
exports.deleteHelpdeskTicket = deleteHelpdeskTicket;
exports.getSecuritySettings = getSecuritySettings;
exports.updateSecuritySettings = updateSecuritySettings;
exports.getVerifications = getVerifications;
exports.createVerification = createVerification;
exports.getSecurityEvents = getSecurityEvents; // Export funkce getSecurityEvents
exports.getVerificationData = getVerificationData; // Export funkce getVerificationData

// ============= CLIENT FUNCTIONS =============

exports.userLogin = userLogin;
exports.getUserData = getUserData;
exports.updateUserProfile = updateUserProfile;
exports.addEshop = addEshop;
exports.getEshops = getEshops;
exports.updateEshopCustomization = updateEshopCustomization;
exports.getVerificationHistory = getVerificationHistory;
exports.getWalletBalance = getWalletBalance;
exports.processPayment = processPayment;
exports.generateInvoice = generateInvoice;
exports.getMethodRatio = getMethodRatio;
exports.getSuccessRatio = getSuccessRatio;
exports.getOverviewData = getOverviewData;
exports.getTransactionHistory = getTransactionHistory;
exports.createSupportTicket = createClientSupportTicket;
exports.getSupportTickets = getClientSupportTickets;
exports.handleWebhook = handleWebhook;
exports.getEshopIntegrationCode = getEshopIntegrationCode;
exports.testEshopIntegration = testEshopIntegration;
exports.getEshopAnalytics = getEshopAnalytics;
exports.updateEshopSettings = updateEshopSettings;

// ============= SHARED FUNCTIONS =============

exports.processQueue = processQueue;
exports.recordMetric = recordMetric;

// ============= REGISTRATION MANAGEMENT =============

exports.submitRegistrationRequest = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const {
                companyName,
                businessId,
                contactPerson,
                email,
                phone,
                address,
                planType,
                expectedVolume
            } = req.body;

            // Validate required fields
            if (!companyName || !businessId || !contactPerson || !email) {
                return res.status(400).json(formatErrorResponse('Missing required fields', 400));
            }

            const registrationRequest = {
                companyName,
                businessId,
                contactPerson,
                email,
                phone,
                address,
                planType,
                expectedVolume,
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('registration_requests').add(registrationRequest);

            // Send notification to admin
            await addToQueue('notification', {
                type: 'new_registration',
                registrationId: docRef.id,
                companyName
            });

            res.status(200).json(formatSuccessResponse({ requestId: docRef.id, status: 'pending' }));
        } catch (error) {
            console.error('Error submitting registration request:', error);
            res.status(500).json(formatErrorResponse('Error submitting registration request', 500, error.message));
        }
    });
});

exports.approveRegistrationRequest = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { requestId, adminId, customPricing } = req.body;

            if (!requestId || !adminId) {
                return res.status(400).json(formatErrorResponse('Request ID and admin ID are required', 400));
            }

            // Get registration request
            const requestDoc = await db.collection('registration_requests').doc(requestId).get();
            if (!requestDoc.exists) {
                return res.status(404).json(formatErrorResponse('Registration request not found', 404));
            }

            const requestData = requestDoc.data();
            if (requestData.status !== 'pending') {
                return res.status(400).json(formatErrorResponse('Request is not in pending state', 400));
            }

            // Create new company
            const companyData = {
                name: requestData.companyName,
                businessId: requestData.businessId,
                contactPerson: requestData.contactPerson,
                email: requestData.email,
                phone: requestData.phone,
                address: requestData.address,
                planType: requestData.planType,
                expectedVolume: requestData.expectedVolume,
                pricing: customPricing || {},
                status: 'active',
                approvedBy: adminId,
                approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const companyRef = await db.collection('companies').add(companyData);

            // Create initial wallet
            await db.collection('wallets').doc(companyRef.id).set({
                balance: 0,
                currency: 'CZK',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update registration request status
            await db.collection('registration_requests').doc(requestId).update({
                status: 'approved',
                approvedBy: adminId,
                approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                companyId: companyRef.id
            });

            // Send welcome email
            await addToQueue('notification', {
                type: 'registration_approved',
                companyId: companyRef.id,
                email: requestData.email,
                companyName: requestData.companyName
            });

            res.status(200).json(formatSuccessResponse({ companyId: companyRef.id, status: 'approved' }));
        } catch (error) {
            console.error('Error approving registration:', error);
            res.status(500).json(formatErrorResponse('Error approving registration', 500, error.message));
        }
    });
});

exports.rejectRegistrationRequest = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { requestId, adminId, reason } = req.body;

            if (!requestId || !adminId || !reason) {
                return res.status(400).json(formatErrorResponse('Request ID, admin ID and reason are required', 400));
            }

            const requestDoc = await db.collection('registration_requests').doc(requestId).get();
            if (!requestDoc.exists) {
                return res.status(404).json(formatErrorResponse('Registration request not found', 404));
            }

            const requestData = requestDoc.data();
            if (requestData.status !== 'pending') {
                return res.status(400).json(formatErrorResponse('Request is not in pending state', 400));
            }

            // Update registration request status
            await db.collection('registration_requests').doc(requestId).update({
                status: 'rejected',
                rejectedBy: adminId,
                rejectionReason: reason,
                rejectedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Send rejection notification
            await addToQueue('notification', {
                type: 'registration_rejected',
                email: requestData.email,
                companyName: requestData.companyName,
                reason
            });

            res.status(200).json(formatSuccessResponse({ requestId, status: 'rejected' }));
        } catch (error) {
            console.error('Error rejecting registration:', error);
            res.status(500).json(formatErrorResponse('Error rejecting registration', 500, error.message));
        }
    });
});

exports.getRegistrationRequests = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { status } = req.query;
            let query = db.collection('registration_requests');

            if (status) {
                query = query.where('status', '==', status);
            }

            const snapshot = await query
                .orderBy('createdAt', 'desc')
                .get();

            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json(formatSuccessResponse(requests));
        } catch (error) {
            console.error('Error getting registration requests:', error);
            res.status(500).json(formatErrorResponse('Error getting registration requests', 500, error.message));
        }
    });
});

// ============= USER MANAGEMENT =============

exports.createUser = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { email, password, role, companyId, firstName, lastName } = req.body;

            if (!email || !password || !role || !companyId) {
                return res.status(400).json(formatErrorResponse('Missing required fields', 400));
            }

            // Hash the password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Create Firebase Auth user
            const userRecord = await admin.auth().createUser({
                email,
                password: hashedPassword, // Store the hashed password
                displayName: `${firstName} ${lastName}`.trim()
            });

            // Create user profile in Firestore
            const userData = {
                uid: userRecord.uid,
                email,
                role,
                companyId,
                firstName,
                lastName,
                status: 'active',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(userRecord.uid).set(userData);

            // Set custom claims for role
            await admin.auth().setCustomUserClaims(userRecord.uid, { role, companyId });

            res.status(200).json(formatSuccessResponse({ uid: userRecord.uid, ...userData }));
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json(formatErrorResponse('Error creating user', 500, error.message));
        }
    });
});

exports.deleteUser = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { uid, adminId } = req.body;

            if (!uid || !adminId) {
                return res.status(400).json(formatErrorResponse('User ID and admin ID are required', 400));
            }

            // Delete from Firebase Auth
            await admin.auth().deleteUser(uid);

            // Update user document
            await db.collection('users').doc(uid).update({
                status: 'deleted',
                deletedBy: adminId,
                deletedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.status(200).json(formatSuccessResponse(null, 'User deleted successfully'));
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json(formatErrorResponse('Error deleting user', 500, error.message));
        }
    });
});

exports.updateUserRole = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { uid, newRole, adminId } = req.body;

            if (!uid || !newRole || !adminId) {
                return res.status(400).json(formatErrorResponse('User ID, new role and admin ID are required', 400));
            }

            // Update custom claims
            const userRecord = await admin.auth().getUser(uid);
            const currentClaims = userRecord.customClaims || {};
            await admin.auth().setCustomUserClaims(uid, { ...currentClaims, role: newRole });

            // Update user document
            await db.collection('users').doc(uid).update({
                role: newRole,
                updatedBy: adminId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.status(200).json(formatSuccessResponse(null, 'User role updated successfully'));
        } catch (error) {
            console.error('Error updating user role:', error);
            res.status(500).json(formatErrorResponse('Error updating user role', 500, error.message));
        }
    });
});

exports.getUsersList = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, role, status } = req.query;
            let query = db.collection('users');

            if (companyId) {
                query = query.where('companyId', '==', companyId);
            }
            if (role) {
                query = query.where('role', '==', role);
            }
            if (status) {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.get();
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json(formatSuccessResponse(users));
        } catch (error) {
            console.error('Error getting users list:', error);
            res.status(500).json(formatErrorResponse('Error getting users list', 500, error.message));
        }
    });
});

exports.resetPassword = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json(formatErrorResponse('Email is required', 400));
            }

            await admin.auth().generatePasswordResetLink(email);
            res.status(200).json(formatSuccessResponse(null, 'Password reset email sent'));
        } catch (error) {
            console.error('Error resetting password:', error);
            res.status(500).json(formatErrorResponse('Error resetting password', 500, error.message));
        }
    });
});

// ============= API KEY MANAGEMENT =============

exports.generateApiKey = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, name, permissions } = req.body;

            if (!companyId || !name) {
                return res.status(400).json(formatErrorResponse('Company ID and key name are required', 400));
            }

            const apiKey = uuidv4();
            const saltRounds = 10;
            const hashedKey = await bcrypt.hash(apiKey, saltRounds);

            const keyData = {
                companyId,
                name,
                permissions: permissions || ['verify'],
                key: hashedKey,
                status: 'active',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUsed: null
            };

            await db.collection('api_keys').doc(apiKey).set(keyData);

            res.status(200).json(formatSuccessResponse({ apiKey, ...keyData }));
        } catch (error) {
            console.error('Error generating API key:', error);
            res.status(500).json(formatErrorResponse('Error generating API key', 500, error.message));
        }
    });
});

exports.revokeApiKey = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { apiKey, reason } = req.body;

            if (!apiKey) {
                return res.status(400).json(formatErrorResponse('API key is required', 400));
            }

            await db.collection('api_keys').doc(apiKey).update({
                status: 'revoked',
                revokedAt: admin.firestore.FieldValue.serverTimestamp(),
                revocationReason: reason || 'Manual revocation'
            });

            res.status(200).json(formatSuccessResponse(null, 'API key revoked successfully'));
        } catch (error) {
            console.error('Error revoking API key:', error);
            res.status(500).json(formatErrorResponse('Error revoking API key', 500, error.message));
        }
    });
});

exports.listApiKeys = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, status } = req.query;
            let query = db.collection('api_keys');

            if (companyId) {
                query = query.where('companyId', '==', companyId);
            }
            if (status) {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.get();
            const keys = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json(formatSuccessResponse(keys));
        } catch (error) {
            console.error('Error listing API keys:', error);
            res.status(500).json(formatErrorResponse('Error listing API keys', 500, error.message));
        }
    });
});

exports.validateApiKey = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { apiKey } = req.body;

            if (!apiKey) {
                return res.status(400).json(formatErrorResponse('API key is required', 400));
            }

            const keyDoc = await db.collection('api_keys').where('key', '==', apiKey).get();

            if (keyDoc.empty) {
                return res.status(401).json(formatErrorResponse('Invalid API key', 401));
            }

            const keyData = keyDoc.docs[0].data();
            if (keyData.status !== 'active') {
                return res.status(401).json(formatErrorResponse('API key is not active', 401));
            }

            // Update last used timestamp
            await keyDoc.docs[0].ref.update({
                lastUsed: admin.firestore.FieldValue.serverTimestamp()
            });

            res.status(200).json(formatSuccessResponse({ valid: true, permissions: keyData.permissions }));
        } catch (error) {
            console.error('Error validating API key:', error);
            res.status(500).json(formatErrorResponse('Error validating API key', 500, error.message));
        }
    });
});

// ============= PAYMENT AND BILLING =============

exports.updatePricing = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, pricing, adminId } = req.body;

            if (!companyId || !pricing || !adminId) {
                return res.status(400).json(formatErrorResponse('Company ID, pricing details and admin ID are required', 400));
            }

            await db.collection('companies').doc(companyId).update({
                pricing,
                pricingUpdatedBy: adminId,
                pricingUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Log pricing change
            await db.collection('pricing_history').add({
                companyId,
                oldPricing: (await db.collection('companies').doc(companyId).get()).data().pricing,
                newPricing: pricing,
                updatedBy: adminId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.status(200).json(formatSuccessResponse(null, 'Pricing updated successfully'));
        } catch (error) {
            console.error('Error updating pricing:', error);
            res.status(500).json(formatErrorResponse('Error updating pricing', 500, error.message));
        }
    });
});

exports.createSubscription = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, plan, paymentMethod } = req.body;

            if (!companyId || !plan || !paymentMethod) {
                return res.status(400).json(formatErrorResponse('Company ID, plan and payment method are required', 400));
            }

            const subscription = {
                companyId,
                plan,
                paymentMethod,
                status: 'active',
                startDate: admin.firestore.FieldValue.serverTimestamp(),
                nextBillingDate: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('subscriptions').add(subscription);

            res.status(200).json(formatSuccessResponse({ subscriptionId: docRef.id, ...subscription }));
        } catch (error) {
            console.error('Error creating subscription:', error);
            res.status(500).json(formatErrorResponse('Error creating subscription', 500, error.message));
        }
    });
});

exports.cancelSubscription = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { subscriptionId, reason } = req.body;

            if (!subscriptionId) {
                return res.status(400).json(formatErrorResponse('Subscription ID is required', 400));
            }

            await db.collection('subscriptions').doc(subscriptionId).update({
                status: 'cancelled',
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                cancellationReason: reason || 'User requested cancellation'
            });

            res.status(200).json(formatSuccessResponse(null, 'Subscription cancelled successfully'));
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            res.status(500).json(formatErrorResponse('Error cancelling subscription', 500, error.message));
        }
    });
});

exports.updatePaymentMethod = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, paymentMethod } = req.body;

            if (!companyId || !paymentMethod) {
                return res.status(400).json(formatErrorResponse('Company ID and payment method are required', 400));
            }

            await db.collection('companies').doc(companyId).update({
                paymentMethod,
                paymentMethodUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.status(200).json(formatSuccessResponse(null, 'Payment method updated successfully'));
        } catch (error) {
            console.error('Error updating payment method:', error);
            res.status(500).json(formatErrorResponse('Error updating payment method', 500, error.message));
        }
    });
});

exports.getInvoicesList = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, status, startDate, endDate } = req.query;
            let query = db.collection('invoices');

            if (companyId) {
                query = query.where('companyId', '==', companyId);
            }
            if (status) {
                query = query.where('status', '==', status);
            }
            if (startDate) {
                query = query.where('createdAt', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('createdAt', '<=', new Date(endDate));
            }

            const snapshot = await query
                .orderBy('createdAt', 'desc')
                .get();

            const invoices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json(formatSuccessResponse(invoices));
        } catch (error) {
            console.error('Error getting invoices list:', error);
            res.status(500).json(formatErrorResponse('Error getting invoices list', 500, error.message));
        }
    });
});

// ============= ESHOP SETTINGS =============

exports.updateEshopSettings = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { eshopId, settings } = req.body;

            if (!eshopId || !settings) {
                return res.status(400).json(formatErrorResponse('Eshop ID and settings are required', 400));
            }

            await db.collection('eshops').doc(eshopId).update({
                settings,
                settingsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.status(200).json(formatSuccessResponse(null, 'Eshop settings updated successfully'));
        } catch (error) {
            console.error('Error updating eshop settings:', error);
            res.status(500).json(formatErrorResponse('Error updating eshop settings', 500, error.message));
        }
    });
});

exports.getEshopIntegrationCode = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
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

            res.status(200).json(formatSuccessResponse({ integrationCode }));
        } catch (error) {
            console.error('Error getting integration code:', error);
            res.status(500).json(formatErrorResponse('Error getting integration code', 500, error.message));
        }
    });
});

exports.testEshopIntegration = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
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

            res.status(200).json(formatSuccessResponse(testResults));
        } catch (error) {
            console.error('Error testing integration:', error);
            res.status(500).json(formatErrorResponse('Error testing integration', 500, error.message));
        }
    });
});

exports.getEshopAnalytics = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
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

            res.status(200).json(formatSuccessResponse(analytics));
        } catch (error) {
            console.error('Error getting eshop analytics:', error);
            res.status(500).json(formatErrorResponse('Error getting eshop analytics', 500, error.message));
        }
    });
});

// ============= NOTIFICATION MANAGEMENT =============

exports.updateNotificationSettings = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, settings } = req.body;

            if (!companyId || !settings) {
                return res.status(400).json(formatErrorResponse('Company ID and settings are required', 400));
            }

            await db.collection('notification_settings').doc(companyId).set(settings, { merge: true });

            res.status(200).json(formatSuccessResponse(null, 'Notification settings updated successfully'));
        } catch (error) {
            console.error('Error updating notification settings:', error);
            res.status(500).json(formatErrorResponse('Error updating notification settings', 500, error.message));
        }
    });
});

exports.getNotificationHistory = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, type, status } = req.query;
            let query = db.collection('notifications');

            if (companyId) {
                query = query.where('companyId', '==', companyId);
            }
            if (type) {
                query = query.where('type', '==', type);
            }
            if (status) {
                query = query.where('status', '==', status);
            }

            const snapshot = await query
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json(formatSuccessResponse(notifications));
        } catch (error) {
            console.error('Error getting notification history:', error);
            res.status(500).json(formatErrorResponse('Error getting notification history', 500, error.message));
        }
    });
});

exports.sendTestNotification = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, type } = req.body;

            if (!companyId || !type) {
                return res.status(400).json(formatErrorResponse('Company ID and notification type are required', 400));
            }

            const testNotification = {
                companyId,
                type,
                title: 'Test Notification',
                message: 'This is a test notification',
                status: 'sent',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('notifications').add(testNotification);

            res.status(200).json(formatSuccessResponse(null, 'Test notification sent successfully'));
        } catch (error) {
            console.error('Error sending test notification:', error);
            res.status(500).json(formatErrorResponse('Error sending test notification', 500, error.message));
        }
    });
});

// ============= AUDIT AND SECURITY =============

exports.getAuditLog = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, action, startDate, endDate } = req.query;
            let query = db.collection('audit_logs');

            if (companyId) {
                query = query.where('companyId', '==', companyId);
            }
            if (action) {
                query = query.where('action', '==', action);
            }
            if (startDate) {
                query = query.where('timestamp', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('timestamp', '<=', new Date(endDate));
            }

            const snapshot = await query
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json(formatSuccessResponse(logs));
        } catch (error) {
            console.error('Error getting audit log:', error);
            res.status(500).json(formatErrorResponse('Error getting audit log', 500, error.message));
        }
    });
});

exports.getLoginHistory = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { userId, startDate, endDate } = req.query;
            let query = db.collection('login_history');

            if (userId) {
                query = query.where('userId', '==', userId);
            }
            if (startDate) {
                query = query.where('timestamp', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('timestamp', '<=', new Date(endDate));
            }

            const snapshot = await query
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            const history = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json(formatSuccessResponse(history));
        } catch (error) {
            console.error('Error getting login history:', error);
            res.status(500).json(formatErrorResponse('Error getting login history', 500, error.message));
        }
    });
});

exports.updateSecuritySettings = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, settings } = req.body;

            if (!companyId || !settings) {
                return res.status(400).json(formatErrorResponse('Company ID and security settings are required', 400));
            }

            await db.collection('security_settings').doc(companyId).set(settings, { merge: true });

            res.status(200).json(formatSuccessResponse(null, 'Security settings updated successfully'));
        } catch (error) {
            console.error('Error updating security settings:', error);
            res.status(500).json(formatErrorResponse('Error updating security settings', 500, error.message));
        }
    });
});

exports.getSystemStatus = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const services = ['verification', 'webhook', 'notification', 'database'];
            const status = {};

            for (const service of services) {
                const healthCheck = await db.collection('health_checks')
                    .where('service', '==', service)
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();

                status[service] = healthCheck.empty ? 'unknown' : healthCheck.docs[0].data().status;
            }

            res.status(200).json(formatSuccessResponse(status));
        } catch (error) {
            console.error('Error getting system status:', error);
            res.status(500).json(formatErrorResponse('Error getting system status', 500, error.message));
        }
    });
});

// ============= REPORTS AND STATISTICS =============

exports.generateCustomReport = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, reportType, startDate, endDate, filters } = req.body;

            if (!companyId || !reportType) {
                return res.status(400).json(formatErrorResponse('Company ID and report type are required', 400));
            }

            let data;
            switch (reportType) {
                case 'verification':
                    data = await generateVerificationReport(companyId, startDate, endDate, filters);
                    break;
                case 'financial':
                    data = await generateFinancialReport(companyId, startDate, endDate, filters);
                    break;
                case 'usage':
                    data = await generateUsageReport(companyId, startDate, endDate, filters);
                    break;
                default:
                    return res.status(400).json(formatErrorResponse('Invalid report type', 400));
            }

            const report = {
                companyId,
                reportType,
                startDate,
                endDate,
                filters,
                data,
                generatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('reports').add(report);

            res.status(200).json(formatSuccessResponse({ reportId: docRef.id, ...report }));
        } catch (error) {
            console.error('Error generating custom report:', error);
            res.status(500).json(formatErrorResponse('Error generating custom report', 500, error.message));
        }
    });
});

exports.exportData = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, dataType, format, startDate, endDate } = req.body;

            if (!companyId || !dataType || !format) {
                return res.status(400).json(formatErrorResponse('Company ID, data type and format are required', 400));
            }

            let data;
            switch (dataType) {
                case 'verifications':
                    data = await getVerificationDataForExport(companyId, startDate, endDate);
                    break;
                case 'transactions':
                    data = await getTransactionDataForExport(companyId, startDate, endDate);
                    break;
                default:
                    return res.status(400).json(formatErrorResponse('Invalid data type', 400));
            }

            let formattedData;
            switch (format) {
                case 'csv':
                    formattedData = convertToCSV(data);
                    break;
                case 'json':
                    formattedData = JSON.stringify(data);
                    break;
                default:
                    return res.status(400).json(formatErrorResponse('Invalid format', 400));
            }

            const exportRecord = {
                companyId,
                dataType,
                format,
                startDate,
                endDate,
                exportedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('data_exports').add(exportRecord);

            res.status(200).json(formatSuccessResponse({ exportedData: formattedData, metadata: exportRecord }));
        } catch (error) {
            console.error('Error exporting data:', error);
            res.status(500).json(formatErrorResponse('Error exporting data', 500, error.message));
        }
    });
});

exports.getSystemMetrics = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { startDate, endDate } = req.query;
            let query = db.collection('system_metrics');

            if (startDate) {
                query = query.where('timestamp', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('timestamp', '<=', new Date(endDate));
            }

            const snapshot = await query
                .orderBy('timestamp', 'desc')
                .get();

            const metrics = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json(formatSuccessResponse(metrics));
        } catch (error) {
            console.error('Error getting system metrics:', error);
            res.status(500).json(formatErrorResponse('Error getting system metrics', 500, error.message));
        }
    });
});

exports.getDailyStats = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { companyId, date } = req.query;

            if (!companyId) {
                return res.status(400).json(formatErrorResponse('Company ID is required', 400));
            }

            const startOfDay = new Date(date || Date.now());
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(startOfDay);
            endOfDay.setDate(endOfDay.getDate() + 1);

            const [verifications, transactions] = await Promise.all([
                db.collection('verifications')
                    .where('companyId', '==', companyId)
                    .where('timestamp', '>=', startOfDay)
                    .where('timestamp', '<', endOfDay)
                    .get(),
                db.collection('transactions')
                    .where('companyId', '==', companyId)
                    .where('timestamp', '>=', startOfDay)
                    .where('timestamp', '<', endOfDay)
                    .get()
            ]);

            const stats = {
                date: startOfDay.toISOString(),
                verifications: verifications.size,
                transactions: transactions.size,
                revenue: 0,
                successRate: 0
            };

            let successfulVerifications = 0;
            verifications.docs.forEach(doc => {
                if (doc.data().status === 'success') {
                    successfulVerifications++;
                }
            });

            transactions.docs.forEach(doc => {
                stats.revenue += doc.data().amount || 0;
            });

            stats.successRate = (successfulVerifications / verifications.size) * 100;

            res.status(200).json(formatSuccessResponse(stats));
        } catch (error) {
            console.error('Error getting daily stats:', error);
            res.status(500).json(formatErrorResponse('Error getting daily stats', 500, error.message));
        }
    });
});

// Helper functions for reports
async function generateVerificationReport(companyId, startDate, endDate, filters) {
    let query = db.collection('verifications')
        .where('companyId', '==', companyId);

    if (startDate) {
        query = query.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
        query = query.where('timestamp', '<=', new Date(endDate));
    }

    // Apply filters
    if (filters) {
        if (filters.status) {
            query = query.where('status', '==', filters.status);
        }
        if (filters.method) {
            query = query.where('method', '==', filters.method);
        }
        // Add more filters as needed
    }

    const snapshot = await query.get();

    const reportData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return reportData;
}

async function generateFinancialReport(companyId, startDate, endDate, filters) {
    let query = db.collection('transactions')
        .where('companyId', '==', companyId);

    if (startDate) {
        query = query.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
        query = query.where('timestamp', '<=', new Date(endDate));
    }

    // Apply filters
    if (filters) {
        if (filters.type) {
            query = query.where('type', '==', filters.type);
        }
        // Add more filters as needed
    }

    const snapshot = await query.get();

    const reportData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return reportData;
}

async function generateUsageReport(companyId, startDate, endDate, filters) {
    // Example: Generate a report on API usage
    let query = db.collection('api_usage')
        .where('companyId', '==', companyId);

    if (startDate) {
        query = query.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
        query = query.where('timestamp', '<=', new Date(endDate));
    }

    // Apply filters
    if (filters) {
        if (filters.endpoint) {
            query = query.where('endpoint', '==', filters.endpoint);
        }
        // Add more filters as needed
    }

    const snapshot = await query.get();

    const reportData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return reportData;
}

async function getVerificationDataForExport(companyId, startDate, endDate) {
    let query = db.collection('verifications')
        .where('companyId', '==', companyId);

    if (startDate) {
        query = query.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
        query = query.where('timestamp', '<=', new Date(endDate));
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function getTransactionDataForExport(companyId, startDate, endDate) {
    let query = db.collection('transactions')
        .where('companyId', '==', companyId);

    if (startDate) {
        query = query.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
        query = query.where('timestamp', '<=', new Date(endDate));
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

function convertToCSV(data) {
    if (!data || data.length === 0) {
        return '';
    }

    const csvRows = [];
    const headers = Object.keys(data[0]);
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}
