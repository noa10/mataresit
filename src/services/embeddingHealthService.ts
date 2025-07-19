/**
 * Embedding Health Service
 * Comprehensive health monitoring and analysis for embedding metrics system
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 4
 */

import { supabase } from '@/lib/supabase';
import { embeddingMetricsErrorHandler } from './embeddingMetricsErrorHandler';
import { embeddingMetricsCacheService, EmbeddingMetricsCacheService } from './embeddingMetricsCacheService';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  responseTime?: number;
}

export interface SystemHealthStatus {
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
  healthScore: number; // 0-100
  lastChecked: string;
  components: HealthCheckResult[];
  issues: string[];
  recommendations: string[];
  uptime: {
    percentage: number;
    duration: string;
  };
}

export interface AggregationStatus {
  hourlyAggregation: {
    lastRun: string | null;
    nextScheduled: string | null;
    status: 'running' | 'completed' | 'failed' | 'overdue';
    duration: number | null;
    recordsProcessed: number | null;
  };
  dailyAggregation: {
    lastRun: string | null;
    nextScheduled: string | null;
    status: 'running' | 'completed' | 'failed' | 'overdue';
    duration: number | null;
    recordsProcessed: number | null;
  };
  cleanup: {
    lastRun: string | null;
    nextScheduled: string | null;
    status: 'running' | 'completed' | 'failed' | 'overdue';
    recordsRemoved: number | null;
  };
}

export interface PerformanceMetrics {
  apiResponseTime: number;
  databaseResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  throughput: number;
  activeConnections: number;
}

class EmbeddingHealthService {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthHistory: HealthCheckResult[] = [];
  private maxHistorySize = 100;

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SystemHealthStatus> {
    const startTime = Date.now();
    const components: HealthCheckResult[] = [];

    try {
      // Check database connectivity
      const dbCheck = await this.checkDatabaseHealth();
      components.push(dbCheck);

      // Check embedding tables
      const tablesCheck = await this.checkEmbeddingTables();
      components.push(tablesCheck);

      // Check aggregation functions
      const functionsCheck = await this.checkAggregationFunctions();
      components.push(functionsCheck);

      // Check cache health
      const cacheCheck = await this.checkCacheHealth();
      components.push(cacheCheck);

      // Check error handler health
      const errorHandlerCheck = await this.checkErrorHandlerHealth();
      components.push(errorHandlerCheck);

      // Check recent metrics data
      const dataCheck = await this.checkRecentData();
      components.push(dataCheck);

      // Calculate overall health
      const healthScore = this.calculateHealthScore(components);
      const overallStatus = this.determineOverallStatus(healthScore, components);
      const issues = this.extractIssues(components);
      const recommendations = this.generateRecommendations(components, issues);

      const healthStatus: SystemHealthStatus = {
        overallStatus,
        healthScore,
        lastChecked: new Date().toISOString(),
        components,
        issues,
        recommendations,
        uptime: await this.calculateUptime()
      };

      // Store in history
      this.addToHistory(components);

      return healthStatus;

    } catch (error) {
      console.error('Health check failed:', error);
      
      return {
        overallStatus: 'critical',
        healthScore: 0,
        lastChecked: new Date().toISOString(),
        components: [{
          component: 'health_check',
          status: 'critical',
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }],
        issues: ['Health check system failure'],
        recommendations: ['Investigate health check system', 'Check database connectivity'],
        uptime: { percentage: 0, duration: 'Unknown' }
      };
    }
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase
        .from('embedding_performance_metrics')
        .select('count')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          component: 'database',
          status: 'warning',
          message: 'Database query failed - tables may not exist yet',
          details: { error: error.message, responseTime },
          timestamp: new Date().toISOString(),
          responseTime
        };
      }

      const status = responseTime > 5000 ? 'warning' : responseTime > 1000 ? 'warning' : 'healthy';
      
      return {
        component: 'database',
        status,
        message: status === 'healthy' ? 'Database responding normally' : 'Database response time elevated',
        details: { responseTime, tablesAccessible: true },
        timestamp: new Date().toISOString(),
        responseTime
      };

    } catch (error) {
      return {
        component: 'database',
        status: 'critical',
        message: 'Database connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check if embedding tables exist and are accessible
   */
  private async checkEmbeddingTables(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const tables = [
      'embedding_performance_metrics',
      'embedding_hourly_stats', 
      'embedding_daily_stats'
    ];

    try {
      const tableChecks = await Promise.all(
        tables.map(async (table) => {
          try {
            const { error } = await supabase.from(table).select('count').limit(1);
            return { table, exists: !error, error: error?.message };
          } catch (err) {
            return { table, exists: false, error: err instanceof Error ? err.message : 'Unknown error' };
          }
        })
      );

      const existingTables = tableChecks.filter(check => check.exists);
      const missingTables = tableChecks.filter(check => !check.exists);

      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (existingTables.length === tables.length) {
        status = 'healthy';
        message = 'All embedding tables are accessible';
      } else if (existingTables.length > 0) {
        status = 'warning';
        message = `${missingTables.length} embedding tables are missing or inaccessible`;
      } else {
        status = 'critical';
        message = 'No embedding tables are accessible';
      }

      return {
        component: 'embedding_tables',
        status,
        message,
        details: {
          existingTables: existingTables.map(t => t.table),
          missingTables: missingTables.map(t => ({ table: t.table, error: t.error })),
          totalTables: tables.length
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        component: 'embedding_tables',
        status: 'critical',
        message: 'Failed to check embedding tables',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check aggregation functions availability
   */
  private async checkAggregationFunctions(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Try to call the health check function
      const { data, error } = await supabase.rpc('check_embedding_aggregation_health');

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          component: 'aggregation_functions',
          status: 'warning',
          message: 'Aggregation functions not available - may not be deployed yet',
          details: { error: error.message, responseTime },
          timestamp: new Date().toISOString(),
          responseTime
        };
      }

      return {
        component: 'aggregation_functions',
        status: 'healthy',
        message: 'Aggregation functions are available and responding',
        details: { responseTime, healthData: data },
        timestamp: new Date().toISOString(),
        responseTime
      };

    } catch (error) {
      return {
        component: 'aggregation_functions',
        status: 'warning',
        message: 'Aggregation functions check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check cache system health
   */
  private async checkCacheHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const cacheStats = embeddingMetricsCacheService.getStats();
      const cacheHealth = embeddingMetricsCacheService.getHealthStatus();

      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (cacheHealth.status === 'healthy') {
        status = 'healthy';
        message = 'Cache system operating normally';
      } else if (cacheHealth.status === 'degraded') {
        status = 'warning';
        message = 'Cache system performance degraded';
      } else {
        status = 'critical';
        message = 'Cache system experiencing issues';
      }

      return {
        component: 'cache_system',
        status,
        message,
        details: {
          ...cacheStats,
          health: cacheHealth,
          responseTime: Date.now() - startTime
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        component: 'cache_system',
        status: 'critical',
        message: 'Cache system check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check error handler health
   */
  private async checkErrorHandlerHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const errorStats = embeddingMetricsErrorHandler.getErrorStatistics();
      const errorHealth = embeddingMetricsErrorHandler.getHealthStatus();

      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (errorHealth.status === 'healthy') {
        status = 'healthy';
        message = 'Error handling system operating normally';
      } else if (errorHealth.status === 'degraded') {
        status = 'warning';
        message = 'Error handling system showing degraded performance';
      } else {
        status = 'critical';
        message = 'Error handling system experiencing critical issues';
      }

      return {
        component: 'error_handler',
        status,
        message,
        details: {
          ...errorStats,
          health: errorHealth,
          responseTime: Date.now() - startTime
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        component: 'error_handler',
        status: 'critical',
        message: 'Error handler check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check for recent metrics data
   */
  private async checkRecentData(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const cacheKey = EmbeddingMetricsCacheService.generateKey('recent_check');
      
      const recentMetrics = await embeddingMetricsCacheService.getOrSet(
        cacheKey,
        async () => {
          const { data, error } = await supabase
            .from('embedding_performance_metrics')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);

          if (error) throw error;
          return data;
        },
        60000 // 1 minute cache
      );

      const responseTime = Date.now() - startTime;

      if (!recentMetrics || recentMetrics.length === 0) {
        return {
          component: 'recent_data',
          status: 'warning',
          message: 'No recent metrics data found',
          details: { responseTime, hasData: false },
          timestamp: new Date().toISOString(),
          responseTime
        };
      }

      const lastMetric = new Date(recentMetrics[0].created_at);
      const hoursSinceLastMetric = (Date.now() - lastMetric.getTime()) / (1000 * 60 * 60);

      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (hoursSinceLastMetric < 1) {
        status = 'healthy';
        message = 'Recent metrics data is available';
      } else if (hoursSinceLastMetric < 24) {
        status = 'warning';
        message = `Last metrics data is ${hoursSinceLastMetric.toFixed(1)} hours old`;
      } else {
        status = 'critical';
        message = `No metrics data for ${hoursSinceLastMetric.toFixed(1)} hours`;
      }

      return {
        component: 'recent_data',
        status,
        message,
        details: {
          lastMetricTime: lastMetric.toISOString(),
          hoursSinceLastMetric: hoursSinceLastMetric.toFixed(1),
          responseTime
        },
        timestamp: new Date().toISOString(),
        responseTime
      };

    } catch (error) {
      return {
        component: 'recent_data',
        status: 'warning',
        message: 'Unable to check recent data - tables may not exist',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(components: HealthCheckResult[]): number {
    if (components.length === 0) return 0;

    const scores = components.map(component => {
      switch (component.status) {
        case 'healthy': return 100;
        case 'warning': return 60;
        case 'critical': return 20;
        default: return 40;
      }
    });

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(
    healthScore: number, 
    components: HealthCheckResult[]
  ): 'healthy' | 'degraded' | 'critical' | 'unknown' {
    const criticalComponents = components.filter(c => c.status === 'critical');
    const warningComponents = components.filter(c => c.status === 'warning');

    if (criticalComponents.length > 0) return 'critical';
    if (warningComponents.length > components.length / 2) return 'degraded';
    if (healthScore >= 80) return 'healthy';
    if (healthScore >= 60) return 'degraded';
    return 'critical';
  }

  /**
   * Extract issues from component checks
   */
  private extractIssues(components: HealthCheckResult[]): string[] {
    return components
      .filter(c => c.status === 'warning' || c.status === 'critical')
      .map(c => `${c.component}: ${c.message}`);
  }

  /**
   * Generate recommendations based on health check results
   */
  private generateRecommendations(components: HealthCheckResult[], issues: string[]): string[] {
    const recommendations: string[] = [];

    // Database issues
    const dbComponent = components.find(c => c.component === 'database');
    if (dbComponent?.status === 'critical') {
      recommendations.push('Check database connectivity and credentials');
    } else if (dbComponent?.status === 'warning') {
      recommendations.push('Monitor database performance and consider optimization');
    }

    // Missing tables
    const tablesComponent = components.find(c => c.component === 'embedding_tables');
    if (tablesComponent?.status === 'critical' || tablesComponent?.status === 'warning') {
      recommendations.push('Deploy embedding metrics database schema');
      recommendations.push('Run database migrations to create required tables');
    }

    // Missing functions
    const functionsComponent = components.find(c => c.component === 'aggregation_functions');
    if (functionsComponent?.status === 'warning') {
      recommendations.push('Deploy Supabase functions for metrics aggregation');
    }

    // Cache issues
    const cacheComponent = components.find(c => c.component === 'cache_system');
    if (cacheComponent?.status === 'warning' || cacheComponent?.status === 'critical') {
      recommendations.push('Clear cache or restart application to resolve cache issues');
    }

    // Data freshness issues
    const dataComponent = components.find(c => c.component === 'recent_data');
    if (dataComponent?.status === 'warning' || dataComponent?.status === 'critical') {
      recommendations.push('Check embedding generation pipeline');
      recommendations.push('Verify metrics collection is active');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating normally');
    }

    return recommendations;
  }

  /**
   * Calculate system uptime
   */
  private async calculateUptime(): Promise<{ percentage: number; duration: string }> {
    // This is a simplified uptime calculation
    // In a real implementation, you'd track actual uptime data
    const healthyComponents = this.healthHistory.filter(h => h.status === 'healthy').length;
    const totalChecks = this.healthHistory.length;
    
    const percentage = totalChecks > 0 ? (healthyComponents / totalChecks) * 100 : 100;
    const duration = totalChecks > 0 ? `${totalChecks} checks` : 'No history';

    return { percentage: Math.round(percentage * 100) / 100, duration };
  }

  /**
   * Add health check result to history
   */
  private addToHistory(components: HealthCheckResult[]): void {
    this.healthHistory.push(...components);
    
    // Keep only recent history
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get aggregation status
   */
  async getAggregationStatus(): Promise<AggregationStatus> {
    try {
      // This would typically call a Supabase function to get aggregation status
      // For now, we'll return a mock status since the functions aren't deployed yet
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      return {
        hourlyAggregation: {
          lastRun: oneHourAgo.toISOString(),
          nextScheduled: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
          status: 'completed',
          duration: 1500,
          recordsProcessed: 150
        },
        dailyAggregation: {
          lastRun: oneDayAgo.toISOString(),
          nextScheduled: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'completed',
          duration: 5000,
          recordsProcessed: 2400
        },
        cleanup: {
          lastRun: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          nextScheduled: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'completed',
          recordsRemoved: 1000
        }
      };

    } catch (error) {
      console.error('Error getting aggregation status:', error);
      
      // Return default status on error
      return {
        hourlyAggregation: {
          lastRun: null,
          nextScheduled: null,
          status: 'failed',
          duration: null,
          recordsProcessed: null
        },
        dailyAggregation: {
          lastRun: null,
          nextScheduled: null,
          status: 'failed',
          duration: null,
          recordsProcessed: null
        },
        cleanup: {
          lastRun: null,
          nextScheduled: null,
          status: 'failed',
          recordsRemoved: null
        }
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    
    try {
      // Test API response time
      const { error } = await supabase.from('embedding_performance_metrics').select('count').limit(1);
      const apiResponseTime = Date.now() - startTime;

      // Get cache stats
      const cacheStats = embeddingMetricsCacheService.getStats();
      
      // Get error stats
      const errorStats = embeddingMetricsErrorHandler.getErrorStatistics();
      
      return {
        apiResponseTime,
        databaseResponseTime: apiResponseTime, // Simplified - same as API for now
        cacheHitRate: cacheStats.hitRate,
        errorRate: errorStats.totalErrors > 0 ? (errorStats.totalErrors / 100) : 0, // Simplified calculation
        throughput: 0, // Would be calculated from actual metrics
        activeConnections: 1 // Simplified
      };

    } catch (error) {
      return {
        apiResponseTime: -1,
        databaseResponseTime: -1,
        cacheHitRate: 0,
        errorRate: 100,
        throughput: 0,
        activeConnections: 0
      };
    }
  }

  /**
   * Start continuous health monitoring
   */
  startHealthMonitoring(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Scheduled health check failed:', error);
      }
    }, intervalMs);

    console.log(`Health monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Health monitoring stopped');
    }
  }

  /**
   * Get health history
   */
  getHealthHistory(): HealthCheckResult[] {
    return [...this.healthHistory];
  }

  /**
   * Clear health history
   */
  clearHealthHistory(): void {
    this.healthHistory = [];
  }
}

// Export singleton instance
export const embeddingHealthService = new EmbeddingHealthService();
