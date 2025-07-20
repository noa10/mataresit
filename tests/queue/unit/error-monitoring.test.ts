/**
 * Error Monitoring and Alerting Tests for Queue System
 * Tests error tracking, monitoring, alerting, and health checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock error monitoring service
class MockErrorMonitoringService {
  private errors: any[] = [];
  private alerts: any[] = [];
  private healthChecks: Map<string, any> = new Map();
  private thresholds = {
    errorRate: 0.05, // 5%
    responseTime: 5000, // 5 seconds
    queueDepth: 100,
    workerFailures: 3
  };

  logError(error: any, context: any = {}): void {
    const errorEntry = {
      id: `error_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: this.determineSeverity(error),
      context,
      resolved: false
    };

    this.errors.push(errorEntry);
    this.checkAlertConditions(errorEntry);
  }

  getErrors(filters: { severity?: string; resolved?: boolean; since?: Date } = {}): any[] {
    return this.errors.filter(error => {
      if (filters.severity && error.severity !== filters.severity) return false;
      if (filters.resolved !== undefined && error.resolved !== filters.resolved) return false;
      if (filters.since && new Date(error.timestamp) < filters.since) return false;
      return true;
    });
  }

  getErrorRate(timeWindow: number = 3600000): number { // 1 hour default
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);
    
    const recentErrors = this.errors.filter(error => 
      new Date(error.timestamp) >= windowStart
    );

    // Mock total operations for rate calculation
    const totalOperations = 1000;
    return recentErrors.length / totalOperations;
  }

  createAlert(type: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata: any = {}): void {
    const alert = {
      id: `alert_${Date.now()}_${Math.random()}`,
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
      metadata,
      acknowledged: false,
      resolved: false
    };

    this.alerts.push(alert);
    console.warn(`🚨 Alert created: ${severity.toUpperCase()} - ${message}`);
  }

  getAlerts(filters: { severity?: string; acknowledged?: boolean; resolved?: boolean } = {}): any[] {
    return this.alerts.filter(alert => {
      if (filters.severity && alert.severity !== filters.severity) return false;
      if (filters.acknowledged !== undefined && alert.acknowledged !== filters.acknowledged) return false;
      if (filters.resolved !== undefined && alert.resolved !== filters.resolved) return false;
      return true;
    });
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
    }
  }

  performHealthCheck(component: string, checkFunction: () => Promise<any>): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      
      try {
        const result = await checkFunction();
        const duration = Date.now() - startTime;
        
        const healthStatus = {
          component,
          status: 'healthy',
          duration,
          timestamp: new Date().toISOString(),
          result
        };

        this.healthChecks.set(component, healthStatus);
        resolve(healthStatus);
      } catch (error) {
        const duration = Date.now() - startTime;
        
        const healthStatus = {
          component,
          status: 'unhealthy',
          duration,
          timestamp: new Date().toISOString(),
          error: error.message
        };

        this.healthChecks.set(component, healthStatus);
        this.logError(error, { component, healthCheck: true });
        reject(healthStatus);
      }
    });
  }

  getHealthStatus(component?: string): any {
    if (component) {
      return this.healthChecks.get(component);
    }
    
    const allStatuses = Array.from(this.healthChecks.values());
    const overallStatus = allStatuses.every(status => status.status === 'healthy') ? 'healthy' : 'unhealthy';
    
    return {
      overall: overallStatus,
      components: Object.fromEntries(this.healthChecks),
      lastUpdated: new Date().toISOString()
    };
  }

  private determineSeverity(error: any): string {
    if (error.code === 'CRITICAL' || error.message.includes('crash')) return 'critical';
    if (error.code === 'RATE_LIMIT' || error.message.includes('timeout')) return 'high';
    if (error.code === 'VALIDATION' || error.message.includes('invalid')) return 'medium';
    return 'low';
  }

  private checkAlertConditions(error: any): void {
    // Check error rate threshold
    const errorRate = this.getErrorRate();
    if (errorRate > this.thresholds.errorRate) {
      this.createAlert(
        'HIGH_ERROR_RATE',
        `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(this.thresholds.errorRate * 100)}%`,
        'high',
        { errorRate, threshold: this.thresholds.errorRate }
      );
    }

    // Check for critical errors
    if (error.severity === 'critical') {
      this.createAlert(
        'CRITICAL_ERROR',
        `Critical error occurred: ${error.message}`,
        'critical',
        { errorId: error.id, context: error.context }
      );
    }

    // Check for repeated errors
    const recentSimilarErrors = this.errors.filter(e => 
      e.message === error.message && 
      new Date(e.timestamp) > new Date(Date.now() - 300000) // Last 5 minutes
    );

    if (recentSimilarErrors.length >= 5) {
      this.createAlert(
        'REPEATED_ERROR',
        `Error "${error.message}" occurred ${recentSimilarErrors.length} times in 5 minutes`,
        'medium',
        { errorMessage: error.message, count: recentSimilarErrors.length }
      );
    }
  }

  // Utility methods for testing
  clearErrors(): void {
    this.errors = [];
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  clearHealthChecks(): void {
    this.healthChecks.clear();
  }

  setThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
}

describe('Error Monitoring and Alerting Tests', () => {
  let errorMonitor: MockErrorMonitoringService;

  beforeEach(() => {
    errorMonitor = new MockErrorMonitoringService();
  });

  afterEach(() => {
    errorMonitor.clearErrors();
    errorMonitor.clearAlerts();
    errorMonitor.clearHealthChecks();
  });

  describe('Error Logging and Tracking', () => {
    it('should log errors with proper metadata', () => {
      const testError = new Error('Test error message');
      testError.code = 'TEST_ERROR';
      
      const context = {
        component: 'queue-worker',
        operation: 'process_batch',
        itemId: 'item-123'
      };

      errorMonitor.logError(testError, context);

      const errors = errorMonitor.getErrors();
      expect(errors).toHaveLength(1);
      
      const loggedError = errors[0];
      expect(loggedError.message).toBe('Test error message');
      expect(loggedError.code).toBe('TEST_ERROR');
      expect(loggedError.context).toEqual(context);
      expect(loggedError.severity).toBe('low');
      expect(loggedError.resolved).toBe(false);
    });

    it('should categorize error severity correctly', () => {
      const criticalError = new Error('Worker process crashed');
      criticalError.code = 'CRITICAL';
      
      const highError = new Error('Request timeout occurred');
      const mediumError = new Error('Invalid input provided');
      mediumError.code = 'VALIDATION';
      
      const lowError = new Error('Minor warning');

      errorMonitor.logError(criticalError);
      errorMonitor.logError(highError);
      errorMonitor.logError(mediumError);
      errorMonitor.logError(lowError);

      const errors = errorMonitor.getErrors();
      expect(errors[0].severity).toBe('critical');
      expect(errors[1].severity).toBe('high');
      expect(errors[2].severity).toBe('medium');
      expect(errors[3].severity).toBe('low');
    });

    it('should filter errors by criteria', () => {
      const criticalError = new Error('Critical failure');
      criticalError.code = 'CRITICAL';
      
      const resolvedError = new Error('Resolved issue');
      
      errorMonitor.logError(criticalError);
      errorMonitor.logError(resolvedError);
      
      // Mark one error as resolved
      const errors = errorMonitor.getErrors();
      errors[1].resolved = true;

      const criticalErrors = errorMonitor.getErrors({ severity: 'critical' });
      expect(criticalErrors).toHaveLength(1);
      expect(criticalErrors[0].message).toBe('Critical failure');

      const unresolvedErrors = errorMonitor.getErrors({ resolved: false });
      expect(unresolvedErrors).toHaveLength(1);
      expect(unresolvedErrors[0].message).toBe('Critical failure');
    });

    it('should calculate error rates correctly', () => {
      // Log multiple errors
      for (let i = 0; i < 10; i++) {
        errorMonitor.logError(new Error(`Error ${i}`));
      }

      const errorRate = errorMonitor.getErrorRate();
      expect(errorRate).toBe(0.01); // 10 errors / 1000 operations = 1%
    });
  });

  describe('Alert Generation', () => {
    it('should create alerts for high error rates', () => {
      // Set low threshold for testing
      errorMonitor.setThresholds({ errorRate: 0.005 }); // 0.5%

      // Generate enough errors to exceed threshold
      for (let i = 0; i < 10; i++) {
        errorMonitor.logError(new Error(`Error ${i}`));
      }

      const alerts = errorMonitor.getAlerts({ type: 'HIGH_ERROR_RATE' });
      expect(alerts.length).toBeGreaterThan(0);
      
      const alert = alerts[0];
      expect(alert.severity).toBe('high');
      expect(alert.message).toContain('Error rate');
      expect(alert.message).toContain('exceeds threshold');
    });

    it('should create alerts for critical errors', () => {
      const criticalError = new Error('System crash detected');
      criticalError.code = 'CRITICAL';

      errorMonitor.logError(criticalError);

      const criticalAlerts = errorMonitor.getAlerts({ type: 'CRITICAL_ERROR' });
      expect(criticalAlerts).toHaveLength(1);
      
      const alert = criticalAlerts[0];
      expect(alert.severity).toBe('critical');
      expect(alert.message).toContain('Critical error occurred');
    });

    it('should create alerts for repeated errors', () => {
      const repeatedError = new Error('Connection timeout');

      // Log the same error multiple times
      for (let i = 0; i < 6; i++) {
        errorMonitor.logError(repeatedError);
      }

      const repeatedAlerts = errorMonitor.getAlerts({ type: 'REPEATED_ERROR' });
      expect(repeatedAlerts.length).toBeGreaterThan(0);
      
      const alert = repeatedAlerts[0];
      expect(alert.severity).toBe('medium');
      expect(alert.message).toContain('occurred');
      expect(alert.message).toContain('times in 5 minutes');
    });

    it('should manage alert lifecycle', () => {
      errorMonitor.createAlert('TEST_ALERT', 'Test alert message', 'medium');

      const alerts = errorMonitor.getAlerts();
      expect(alerts).toHaveLength(1);
      
      const alert = alerts[0];
      expect(alert.acknowledged).toBe(false);
      expect(alert.resolved).toBe(false);

      // Acknowledge alert
      errorMonitor.acknowledgeAlert(alert.id);
      const acknowledgedAlerts = errorMonitor.getAlerts({ acknowledged: true });
      expect(acknowledgedAlerts).toHaveLength(1);

      // Resolve alert
      errorMonitor.resolveAlert(alert.id);
      const resolvedAlerts = errorMonitor.getAlerts({ resolved: true });
      expect(resolvedAlerts).toHaveLength(1);
    });
  });

  describe('Health Checks', () => {
    it('should perform successful health checks', async () => {
      const healthyCheck = async () => {
        return { status: 'ok', connections: 5 };
      };

      const result = await errorMonitor.performHealthCheck('database', healthyCheck);

      expect(result.component).toBe('database');
      expect(result.status).toBe('healthy');
      expect(result.result).toEqual({ status: 'ok', connections: 5 });
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle failed health checks', async () => {
      const failingCheck = async () => {
        throw new Error('Database connection failed');
      };

      try {
        await errorMonitor.performHealthCheck('database', failingCheck);
      } catch (healthStatus) {
        expect(healthStatus.component).toBe('database');
        expect(healthStatus.status).toBe('unhealthy');
        expect(healthStatus.error).toBe('Database connection failed');
      }

      // Should also log the error
      const errors = errorMonitor.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].context.healthCheck).toBe(true);
    });

    it('should track overall system health', async () => {
      const healthyCheck = async () => ({ status: 'ok' });
      const unhealthyCheck = async () => { throw new Error('Failed'); };

      await errorMonitor.performHealthCheck('service1', healthyCheck);
      
      try {
        await errorMonitor.performHealthCheck('service2', unhealthyCheck);
      } catch (error) {
        // Expected failure
      }

      const overallHealth = errorMonitor.getHealthStatus();
      expect(overallHealth.overall).toBe('unhealthy');
      expect(overallHealth.components.service1.status).toBe('healthy');
      expect(overallHealth.components.service2.status).toBe('unhealthy');
    });

    it('should measure health check performance', async () => {
      const slowCheck = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { status: 'ok' };
      };

      const result = await errorMonitor.performHealthCheck('slow-service', slowCheck);

      expect(result.duration).toBeGreaterThanOrEqual(100);
      expect(result.status).toBe('healthy');
    });
  });

  describe('Queue-Specific Error Monitoring', () => {
    it('should monitor queue processing errors', () => {
      const queueErrors = [
        { message: 'Failed to process queue item', code: 'QUEUE_PROCESSING_ERROR' },
        { message: 'Worker timeout during processing', code: 'WORKER_TIMEOUT' },
        { message: 'Invalid queue item format', code: 'VALIDATION_ERROR' }
      ];

      queueErrors.forEach((error, index) => {
        const err = new Error(error.message);
        err.code = error.code;
        errorMonitor.logError(err, { 
          component: 'queue-processor',
          itemId: `item-${index}`,
          workerId: 'worker-1'
        });
      });

      const queueProcessingErrors = errorMonitor.getErrors().filter(
        error => error.context.component === 'queue-processor'
      );

      expect(queueProcessingErrors).toHaveLength(3);
      expect(queueProcessingErrors[0].context.workerId).toBe('worker-1');
    });

    it('should monitor worker health and failures', async () => {
      const workerHealthCheck = async () => {
        // Simulate worker status check
        const response = await fetch('/api/worker/status');
        if (!response.ok) {
          throw new Error(`Worker health check failed: ${response.status}`);
        }
        return await response.json();
      };

      // Mock fetch to simulate worker failure
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503
      });

      try {
        await errorMonitor.performHealthCheck('queue-worker', workerHealthCheck);
      } catch (healthStatus) {
        expect(healthStatus.status).toBe('unhealthy');
        expect(healthStatus.error).toContain('Worker health check failed: 503');
      }
    });

    it('should track queue depth and performance metrics', () => {
      const performanceError = new Error('Queue depth exceeded threshold');
      performanceError.code = 'PERFORMANCE_DEGRADATION';

      errorMonitor.logError(performanceError, {
        component: 'queue-monitor',
        metrics: {
          queueDepth: 150,
          threshold: 100,
          avgProcessingTime: 8000
        }
      });

      const performanceErrors = errorMonitor.getErrors().filter(
        error => error.context.component === 'queue-monitor'
      );

      expect(performanceErrors).toHaveLength(1);
      expect(performanceErrors[0].context.metrics.queueDepth).toBe(150);
    });

    it('should monitor embedding generation failures', () => {
      const embeddingErrors = [
        'API rate limit exceeded',
        'Invalid API key',
        'Model not available',
        'Token limit exceeded'
      ];

      embeddingErrors.forEach((message, index) => {
        const error = new Error(message);
        error.code = 'EMBEDDING_GENERATION_ERROR';
        
        errorMonitor.logError(error, {
          component: 'embedding-generator',
          receiptId: `receipt-${index}`,
          model: 'text-embedding-ada-002',
          tokens: 1000 + index * 100
        });
      });

      const embeddingGenerationErrors = errorMonitor.getErrors().filter(
        error => error.context.component === 'embedding-generator'
      );

      expect(embeddingGenerationErrors).toHaveLength(4);
      
      // Should create alerts for repeated embedding failures
      const embeddingAlerts = errorMonitor.getAlerts().filter(
        alert => alert.message.includes('embedding-generator')
      );
      
      expect(embeddingAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery Monitoring', () => {
    it('should track error resolution', () => {
      const error = new Error('Temporary database issue');
      errorMonitor.logError(error);

      const errors = errorMonitor.getErrors();
      const loggedError = errors[0];

      // Simulate error resolution
      loggedError.resolved = true;
      loggedError.resolvedAt = new Date().toISOString();
      loggedError.resolutionNotes = 'Database connection restored';

      const resolvedErrors = errorMonitor.getErrors({ resolved: true });
      expect(resolvedErrors).toHaveLength(1);
      expect(resolvedErrors[0].resolutionNotes).toBe('Database connection restored');
    });

    it('should monitor retry success rates', () => {
      const retryMetrics = {
        totalAttempts: 0,
        successfulRetries: 0,
        failedRetries: 0
      };

      // Simulate retry scenarios
      for (let i = 0; i < 10; i++) {
        retryMetrics.totalAttempts++;
        
        if (i < 7) {
          retryMetrics.successfulRetries++;
        } else {
          retryMetrics.failedRetries++;
          errorMonitor.logError(new Error(`Retry failed for attempt ${i}`), {
            component: 'retry-manager',
            attempt: i,
            maxRetries: 3
          });
        }
      }

      const retrySuccessRate = retryMetrics.successfulRetries / retryMetrics.totalAttempts;
      expect(retrySuccessRate).toBe(0.7); // 70% success rate

      const retryErrors = errorMonitor.getErrors().filter(
        error => error.context.component === 'retry-manager'
      );
      expect(retryErrors).toHaveLength(3);
    });
  });
});
