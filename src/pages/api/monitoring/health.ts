// Production Health Monitoring API
// Provides real-time system health metrics for the monitoring dashboard

import { NextApiRequest, NextApiResponse } from 'next';
import { metricsCollector } from '@/lib/monitoring/metrics-collector';

interface HealthMetric {
  value: number;
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

interface SystemHealth {
  overall: HealthMetric;
  embedding: HealthMetric;
  workers: HealthMetric;
  database: HealthMetric;
  api: HealthMetric;
}

// Health thresholds
const HEALTH_THRESHOLDS = {
  embedding: {
    successRate: { warning: 95, critical: 90 },
    queueDepth: { warning: 50, critical: 100 },
    processingTime: { warning: 30, critical: 60 }
  },
  workers: {
    activeCount: { warning: 2, critical: 1 },
    cpuUsage: { warning: 70, critical: 85 },
    memoryUsage: { warning: 80, critical: 90 }
  },
  database: {
    queryTime: { warning: 1, critical: 5 },
    connections: { warning: 80, critical: 95 }
  },
  api: {
    successRate: { warning: 95, critical: 90 },
    responseTime: { warning: 2, critical: 5 },
    quotaUsage: { warning: 80, critical: 95 }
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const systemHealth = await calculateSystemHealth();
    
    res.status(200).json(systemHealth);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      error: 'Failed to get system health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function calculateSystemHealth(): Promise<SystemHealth> {
  const timestamp = new Date().toISOString();
  
  // Get metrics from Prometheus/internal collectors
  const metrics = await getMetricsFromPrometheus();
  
  // Calculate embedding health
  const embeddingHealth = calculateEmbeddingHealth(metrics, timestamp);
  
  // Calculate worker health
  const workerHealth = calculateWorkerHealth(metrics, timestamp);
  
  // Calculate database health
  const databaseHealth = calculateDatabaseHealth(metrics, timestamp);
  
  // Calculate API health
  const apiHealth = calculateApiHealth(metrics, timestamp);
  
  // Calculate overall health
  const overallHealth = calculateOverallHealth([
    embeddingHealth,
    workerHealth,
    databaseHealth,
    apiHealth
  ], timestamp);
  
  return {
    overall: overallHealth,
    embedding: embeddingHealth,
    workers: workerHealth,
    database: databaseHealth,
    api: apiHealth
  };
}

function calculateEmbeddingHealth(metrics: any, timestamp: string): HealthMetric {
  const successRate = metrics.embedding?.successRate || 0;
  const queueDepth = metrics.embedding?.queueDepth || 0;
  const processingTime = metrics.embedding?.avgProcessingTime || 0;
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  let healthScore = 100;
  
  // Check success rate
  if (successRate < HEALTH_THRESHOLDS.embedding.successRate.critical) {
    status = 'critical';
    healthScore -= 40;
  } else if (successRate < HEALTH_THRESHOLDS.embedding.successRate.warning) {
    status = 'warning';
    healthScore -= 20;
  }
  
  // Check queue depth
  if (queueDepth > HEALTH_THRESHOLDS.embedding.queueDepth.critical) {
    status = 'critical';
    healthScore -= 30;
  } else if (queueDepth > HEALTH_THRESHOLDS.embedding.queueDepth.warning) {
    if (status !== 'critical') status = 'warning';
    healthScore -= 15;
  }
  
  // Check processing time
  if (processingTime > HEALTH_THRESHOLDS.embedding.processingTime.critical) {
    status = 'critical';
    healthScore -= 30;
  } else if (processingTime > HEALTH_THRESHOLDS.embedding.processingTime.warning) {
    if (status !== 'critical') status = 'warning';
    healthScore -= 15;
  }
  
  return {
    value: Math.max(0, healthScore),
    timestamp,
    status,
    trend: calculateTrend(metrics.embedding?.trend)
  };
}

function calculateWorkerHealth(metrics: any, timestamp: string): HealthMetric {
  const activeWorkers = metrics.workers?.activeCount || 0;
  const avgCpuUsage = metrics.workers?.avgCpuUsage || 0;
  const avgMemoryUsage = metrics.workers?.avgMemoryUsage || 0;
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  let healthScore = 100;
  
  // Check active worker count
  if (activeWorkers < HEALTH_THRESHOLDS.workers.activeCount.critical) {
    status = 'critical';
    healthScore -= 50;
  } else if (activeWorkers < HEALTH_THRESHOLDS.workers.activeCount.warning) {
    status = 'warning';
    healthScore -= 25;
  }
  
  // Check CPU usage
  if (avgCpuUsage > HEALTH_THRESHOLDS.workers.cpuUsage.critical) {
    status = 'critical';
    healthScore -= 25;
  } else if (avgCpuUsage > HEALTH_THRESHOLDS.workers.cpuUsage.warning) {
    if (status !== 'critical') status = 'warning';
    healthScore -= 15;
  }
  
  // Check memory usage
  if (avgMemoryUsage > HEALTH_THRESHOLDS.workers.memoryUsage.critical) {
    status = 'critical';
    healthScore -= 25;
  } else if (avgMemoryUsage > HEALTH_THRESHOLDS.workers.memoryUsage.warning) {
    if (status !== 'critical') status = 'warning';
    healthScore -= 15;
  }
  
  return {
    value: activeWorkers,
    timestamp,
    status,
    trend: calculateTrend(metrics.workers?.trend)
  };
}

function calculateDatabaseHealth(metrics: any, timestamp: string): HealthMetric {
  const avgQueryTime = metrics.database?.avgQueryTime || 0;
  const connectionUsage = metrics.database?.connectionUsage || 0;
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  let healthScore = 100;
  
  // Check query time
  if (avgQueryTime > HEALTH_THRESHOLDS.database.queryTime.critical) {
    status = 'critical';
    healthScore -= 40;
  } else if (avgQueryTime > HEALTH_THRESHOLDS.database.queryTime.warning) {
    status = 'warning';
    healthScore -= 20;
  }
  
  // Check connection usage
  if (connectionUsage > HEALTH_THRESHOLDS.database.connections.critical) {
    status = 'critical';
    healthScore -= 40;
  } else if (connectionUsage > HEALTH_THRESHOLDS.database.connections.warning) {
    if (status !== 'critical') status = 'warning';
    healthScore -= 20;
  }
  
  return {
    value: avgQueryTime,
    timestamp,
    status,
    trend: calculateTrend(metrics.database?.trend)
  };
}

function calculateApiHealth(metrics: any, timestamp: string): HealthMetric {
  const successRate = metrics.api?.successRate || 0;
  const avgResponseTime = metrics.api?.avgResponseTime || 0;
  const quotaUsage = metrics.api?.quotaUsage || 0;
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  let healthScore = 100;
  
  // Check success rate
  if (successRate < HEALTH_THRESHOLDS.api.successRate.critical) {
    status = 'critical';
    healthScore -= 40;
  } else if (successRate < HEALTH_THRESHOLDS.api.successRate.warning) {
    status = 'warning';
    healthScore -= 20;
  }
  
  // Check response time
  if (avgResponseTime > HEALTH_THRESHOLDS.api.responseTime.critical) {
    status = 'critical';
    healthScore -= 30;
  } else if (avgResponseTime > HEALTH_THRESHOLDS.api.responseTime.warning) {
    if (status !== 'critical') status = 'warning';
    healthScore -= 15;
  }
  
  // Check quota usage
  if (quotaUsage > HEALTH_THRESHOLDS.api.quotaUsage.critical) {
    status = 'critical';
    healthScore -= 30;
  } else if (quotaUsage > HEALTH_THRESHOLDS.api.quotaUsage.warning) {
    if (status !== 'critical') status = 'warning';
    healthScore -= 15;
  }
  
  return {
    value: successRate,
    timestamp,
    status,
    trend: calculateTrend(metrics.api?.trend)
  };
}

function calculateOverallHealth(
  componentHealths: HealthMetric[],
  timestamp: string
): HealthMetric {
  const criticalCount = componentHealths.filter(h => h.status === 'critical').length;
  const warningCount = componentHealths.filter(h => h.status === 'warning').length;
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  let overallScore = 100;
  
  if (criticalCount > 0) {
    status = 'critical';
    overallScore = Math.min(...componentHealths.map(h => h.value));
  } else if (warningCount > 0) {
    status = 'warning';
    overallScore = componentHealths.reduce((sum, h) => sum + h.value, 0) / componentHealths.length;
  } else {
    overallScore = componentHealths.reduce((sum, h) => sum + h.value, 0) / componentHealths.length;
  }
  
  return {
    value: overallScore,
    timestamp,
    status,
    trend: 'stable' // Could be calculated based on historical data
  };
}

function calculateTrend(trendData?: any): 'up' | 'down' | 'stable' {
  if (!trendData || !Array.isArray(trendData) || trendData.length < 2) {
    return 'stable';
  }
  
  const recent = trendData.slice(-5); // Last 5 data points
  const first = recent[0];
  const last = recent[recent.length - 1];
  
  const change = ((last - first) / first) * 100;
  
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
}

async function getMetricsFromPrometheus(): Promise<any> {
  // In a real implementation, this would query Prometheus
  // Example implementation with actual Prometheus client:

  try {
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';

    // Example Prometheus queries
    const queries = {
      embeddingSuccessRate: 'rate(embedding_jobs_processed_total{status="success"}[5m]) / rate(embedding_jobs_processed_total[5m])',
      queueDepth: 'embedding_queue_depth',
      workerCount: 'count(up{job="embedding-queue-workers"} == 1)',
      cpuUsage: 'avg(rate(container_cpu_usage_seconds_total{pod=~"embedding-queue-workers-.*"}[5m])) * 100',
      memoryUsage: 'avg(container_memory_usage_bytes{pod=~"embedding-queue-workers-.*"} / container_spec_memory_limit_bytes) * 100',
      dbQueryTime: 'histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))',
      apiSuccessRate: 'rate(api_requests_total{status="success"}[5m]) / rate(api_requests_total[5m])',
      apiResponseTime: 'histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))',
      quotaUsage: 'api_quota_usage_percent{provider="gemini", type="requests"}'
    };

    // In production, you would make actual HTTP requests to Prometheus
    // const results = await Promise.all(
    //   Object.entries(queries).map(async ([key, query]) => {
    //     const response = await fetch(`${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
    //     const data = await response.json();
    //     return [key, parsePrometheusResult(data)];
    //   })
    // );

    // For now, return realistic mock data
    return {
      embedding: {
        successRate: 98.5,
        queueDepth: 25,
        avgProcessingTime: 15.2,
        trend: [95, 96, 97, 98, 98.5]
      },
      workers: {
        activeCount: 3,
        avgCpuUsage: 45.2,
        avgMemoryUsage: 62.8,
        trend: [3, 3, 2, 3, 3]
      },
      database: {
        avgQueryTime: 0.15,
        connectionUsage: 35.5,
        trend: [0.12, 0.13, 0.14, 0.15, 0.15]
      },
      api: {
        successRate: 99.2,
        avgResponseTime: 1.2,
        quotaUsage: 45.8,
        trend: [99, 99.1, 99.2, 99.2, 99.2]
      }
    };
  } catch (error) {
    console.error('Failed to fetch metrics from Prometheus:', error);

    // Return default/fallback metrics
    return {
      embedding: { successRate: 0, queueDepth: 0, avgProcessingTime: 0 },
      workers: { activeCount: 0, avgCpuUsage: 0, avgMemoryUsage: 0 },
      database: { avgQueryTime: 0, connectionUsage: 0 },
      api: { successRate: 0, avgResponseTime: 0, quotaUsage: 0 }
    };
  }
}
