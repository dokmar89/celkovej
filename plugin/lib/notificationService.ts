import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { QueueService } from './queueService';
import { MonitoringService } from './monitoringService';
import { createLogger } from 'logger'; // Importuj createLogger

const logger = createLogger(); // Vytvoř instanci loggeru

interface WebhookPayload {
  event: 'verification.success' | 'verification.failed';
  eshopId: string;
  verificationId: string;
  method: string;
  timestamp: number;
  data: any;
}

export class NotificationService {
  private queueService: QueueService;
  private monitoringService: MonitoringService;

  constructor() {
    this.queueService = new QueueService();
    this.monitoringService = new MonitoringService();
  }

  private async getEshopWebhookUrl(eshopId: string): Promise<string | null> {
    try {
      const docRef = doc(db, 'eshops', eshopId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.webhookUrl || null;
      }
      return null;
    } catch (error) {
      logger.error('Error fetching webhook URL', error);
      return null;
    }
  }

  private async sendWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Verification-Signature': this.generateSignature(payload),
        },
        body: JSON.stringify(payload),
      });

      const duration = Date.now() - startTime;
      await this.monitoringService.recordMetric(
        MonitoringService.METRICS.WEBHOOK_DELIVERY_TIME,
        duration,
        'ms',
        { eshopId: payload.eshopId }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      logger.error('Error sending webhook', error);

      await this.monitoringService.recordMetric(
        MonitoringService.METRICS.ERROR_RATE,
        1,
        'count',
        { type: 'webhook_delivery', eshopId: payload.eshopId }
      );

      return false;
    }
  }

  private generateSignature(payload: WebhookPayload): string {
    // In production, implement proper HMAC signature
    return 'test-signature';
  }

  async notifyVerificationResult(
    eshopId: string,
    verificationId: string,
    success: boolean,
    method: string,
    data: any
  ): Promise<void> {
    const webhookUrl = await this.getEshopWebhookUrl(eshopId);

    if (!webhookUrl) {
      logger.warn('No webhook URL configured for eshop', { eshopId });
      return;
    }

    const payload: WebhookPayload = {
      event: success ? 'verification.success' : 'verification.failed',
      eshopId,
      verificationId,
      method,
      timestamp: Date.now(),
      data,
    };

    // Add to queue instead of sending directly
    await this.queueService.enqueue('webhook', {
      url: webhookUrl,
      payload
    });

    // Record verification result metric
    await this.monitoringService.recordMetric(
      MonitoringService.METRICS.VERIFICATION_SUCCESS_RATE,
      success ? 1 : 0,
      'count',
      { method, eshopId }
    );
  }

  // This method should be called by a scheduled job
  async processWebhookQueue(): Promise<void> {
    const pendingItems = await this.queueService.getPendingItems();

    for (const item of pendingItems) {
      if (item.type !== 'webhook') continue;

      await this.queueService.processItem(item.id!, async (data) => {
        const success = await this.sendWebhook(data.url, data.payload);
        if (!success) {
          throw new Error('Failed to deliver webhook');
        }
      });
    }
  }
}