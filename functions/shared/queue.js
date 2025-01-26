const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Queue configuration
const QUEUE_CONFIG = {
    MAX_ATTEMPTS: 5,
    RETRY_DELAYS: [
        60 * 1000,     // 1 minute
        5 * 60 * 1000, // 5 minutes
        15 * 60 * 1000,// 15 minutes
        30 * 60 * 1000,// 30 minutes
        60 * 60 * 1000 // 1 hour
    ]
};

async function addToQueue(type, payload, maxAttempts = QUEUE_CONFIG.MAX_ATTEMPTS) {
    const queueItem = {
        type,
        payload,
        attempts: 0,
        maxAttempts,
        nextAttempt: admin.firestore.Timestamp.now(),
        status: 'pending',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    };

    await db.collection('queue').add(queueItem);
}

async function processVerification(payload) {
    console.log('Processing verification:', payload);
    // Add your verification logic here
}

async function processWebhook(payload) {
    console.log('Processing webhook:', payload);
    // Add your webhook processing logic here
}

async function processNotification(payload) {
    console.log('Processing notification:', payload);
    // Add your notification processing logic here
}

async function processQueueItem(item) {
    const { type, payload } = item;

    switch (type) {
        case 'verification':
            await processVerification(payload);
            break;
        case 'webhook':
            await processWebhook(payload);
            break;
        case 'notification':
            await processNotification(payload);
            break;
        default:
            throw new Error(`Unknown queue item type: ${type}`);
    }

    // Mark as completed
    await db.collection('queue').doc(item.id).update({
        status: 'completed',
        updatedAt: admin.firestore.Timestamp.now()
    });
}

async function handleQueueItemError(item, error) {
    const nextAttempt = calculateNextAttempt(item.attempts);
    const update = {
        attempts: admin.firestore.FieldValue.increment(1),
        error: error.message,
        updatedAt: admin.firestore.Timestamp.now()
    };

    if (item.attempts >= item.maxAttempts) {
        update.status = 'failed';
    } else {
        update.nextAttempt = nextAttempt;
    }

    await db.collection('queue').doc(item.id).update(update);
}

function calculateNextAttempt(attempts) {
    const delay = QUEUE_CONFIG.RETRY_DELAYS[Math.min(attempts, QUEUE_CONFIG.RETRY_DELAYS.length - 1)];
    return admin.firestore.Timestamp.fromMillis(Date.now() + delay);
}

// Define processQueue before using it
const processQueue = async (context) => {
    try {
        const now = admin.firestore.Timestamp.now();
        const queueRef = db.collection('queue');

        // Get pending items
        const pendingItems = await queueRef
            .where('status', '==', 'pending')
            .where('nextAttempt', '<=', now)
            .limit(10)
            .get();

        // Process items
        const processPromises = pendingItems.docs.map(async (doc) => {
            const item = { id: doc.id, ...doc.data() };
            try {
                await processQueueItem(item);
            } catch (error) {
                console.error(`Error processing queue item ${item.id}:`, error);
                await handleQueueItemError(item, error);
            }
        });

        await Promise.all(processPromises);
        return null;
    } catch (error) {
        console.error('Error processing queue:', error);
        return null;
    }
};

// Export the scheduled function
exports.scheduledProcessQueue = functions.pubsub.schedule('every 1 minutes').onRun(processQueue);

// Export other functions for use in other files
module.exports = {
    addToQueue,
    processQueueItem,
    handleQueueItemError,
    calculateNextAttempt,
    processQueue
};