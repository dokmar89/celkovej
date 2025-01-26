import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, Timestamp, DocumentData } from 'firebase/firestore';
import { createLogger } from 'logger'; // Importuj createLogger z balíčku 'logger'

const logger = createLogger(); // Vytvoří instanci loggeru

interface Metric {
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: Date;
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: Record<string, any>;
  timestamp: Date;
}

export class MonitoringService {
  private readonly METRICS_COLLECTION = 'metrics';
  private readonly HEALTH_COLLECTION = 'health_checks';

  // Metric names
  static readonly METRICS = {
    VERIFICATION_DURATION: 'verification.duration',
    VERIFICATION_SUCCESS_RATE: 'verification.success_rate',
    API_LATENCY: 'api.latency',
    WEBHOOK_DELIVERY_TIME: 'webhook.delivery_time',
    QUEUE_SIZE: 'queue.size',
    ERROR_RATE: 'error.rate'
  } as const;

  // Services to monitor
  static readonly SERVICES = {
    AGE_VERIFICATION: 'age-verification',
    WEBHOOK_DELIVERY: 'webhook-delivery',
    DATABASE: 'database',
    QUEUE: 'queue'
  } as const;

  async recordMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {}
  ): Promise<void> {
    const metric: Metric = {
      name,
      value,
      unit,
      tags,
      timestamp: new Date()
    };

    try {
      await addDoc(collection(db, this.METRICS_COLLECTION), {
        ...metric,
        timestamp: Timestamp.fromDate(metric.timestamp)
      });

      logger.debug('Recorded metric', metric);
    } catch (error) {
      logger.error('Failed to record metric', error);
    }
  }

  async recordHealthCheck(
    service: string,
    status: HealthCheck['status'],
    details?: Record<string, any>
  ): Promise<void> {
    const healthCheck: HealthCheck = {
      service,
      status,
      details,
      timestamp: new Date()
    };

    try {
      await addDoc(collection(db, this.HEALTH_COLLECTION), {
        ...healthCheck,
        timestamp: Timestamp.fromDate(healthCheck.timestamp)
      });

      if (status !== 'healthy') {
        logger.warn('Unhealthy service detected', { service, status, details });
      }
    } catch (error) {
      logger.error('Failed to record health check', error);
    }
  }

  async getMetrics(
    name: string,
    timeRange: { start: Date; end: Date },
    tags?: Record<string, string>
  ): Promise<Metric[]> {
    try {
      let q = query(
        collection(db, this.METRICS_COLLECTION),
        where('name', '==', name),
        where('timestamp', '>=', Timestamp.fromDate(timeRange.start)),
        where('timestamp', '<=', Timestamp.fromDate(timeRange.end))
      );

      const querySnapshot = await getDocs(q);
      const metrics = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: (data.timestamp as Timestamp).toDate()
        } as Metric;
      });

      // Filter by tags if provided
      if (tags) {
        return metrics.filter(metric => {
          return Object.entries(tags).every(
            ([key, value]) => metric.tags[key] === value
          );
        });
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get metrics', error);
      return [];
    }
  }

  async getServiceHealth(service: string): Promise<HealthCheck | null> {
    try {
      const q = query(
        collection(db, this.HEALTH_COLLECTION),
        where('service', '==', service),
        where('timestamp', '>=', Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000))) // Last 5 minutes
      );

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }

      // Get the most recent health check
      const mostRecent = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            timestamp: (data.timestamp as Timestamp).toDate()
          } as HealthCheck;
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      return mostRecent;
    } catch (error) {
      logger.error('Failed to get service health', error);
      return null;
    }
  }

  async calculateMetricStatistics(
    name: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    count: number;
    p95: number;
    p99: number;
  }> {
    const metrics = await this.getMetrics(name, timeRange);
    if (metrics.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0, p95: 0, p99: 0 };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      count: values.length,
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)]
    };
  }
}