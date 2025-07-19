# Phase 5: Production Deployment & Monitoring

## Deployment Strategy Overview

This phase implements a staged deployment approach with comprehensive monitoring, rollback capabilities, and post-deployment performance analysis. The deployment follows a blue-green strategy with feature flags for safe rollout.

## 5.1 Staged Deployment Plan

### Stage 1: Infrastructure Deployment (Week 1)

**Database Migrations:**
```sql
-- Deploy in order with rollback scripts ready
-- 1. Phase 1: Monitoring tables
\i 20250717000001_create_embedding_metrics_tables.sql

-- 2. Phase 2: Queue enhancements  
\i 20250717000002_enhance_embedding_queue_system.sql

-- 3. Phase 3: Batch optimization
\i 20250717000003_batch_upload_optimization.sql

-- Validate each migration
SELECT COUNT(*) FROM embedding_performance_metrics; -- Should be 0
SELECT COUNT(*) FROM embedding_queue_workers; -- Should be 0
SELECT COUNT(*) FROM batch_upload_sessions; -- Should be 0
```

**Feature Flag Configuration:**
```typescript
// Feature flags for gradual rollout
interface FeatureFlags {
  embeddingMonitoring: {
    enabled: boolean
    rolloutPercentage: number // 0-100
    targetTeams?: string[] // Specific teams for testing
  }
  queueBasedProcessing: {
    enabled: boolean
    rolloutPercentage: number
    fallbackToDirectProcessing: boolean
  }
  batchOptimization: {
    enabled: boolean
    rolloutPercentage: number
    rateLimitingEnabled: boolean
    adaptiveProcessing: boolean
  }
}

// Initial deployment configuration
const initialFlags: FeatureFlags = {
  embeddingMonitoring: {
    enabled: true,
    rolloutPercentage: 10, // Start with 10% of users
    targetTeams: ['internal-testing-team']
  },
  queueBasedProcessing: {
    enabled: false, // Start disabled
    rolloutPercentage: 0,
    fallbackToDirectProcessing: true
  },
  batchOptimization: {
    enabled: false, // Start disabled
    rolloutPercentage: 0,
    rateLimitingEnabled: false,
    adaptiveProcessing: false
  }
}
```

### Stage 2: Monitoring System Rollout (Week 1-2)

**Deployment Steps:**
1. Deploy monitoring infrastructure
2. Enable for internal team (5% of traffic)
3. Validate metrics collection accuracy
4. Gradually increase to 25% of users
5. Monitor for 48 hours before next stage

**Validation Criteria:**
```typescript
// Monitoring deployment validation
const monitoringValidation = {
  metricsCollection: {
    dataAccuracy: '>99%',
    collectionLatency: '<500ms',
    storageGrowth: '<expected_rate'
  },
  dashboardPerformance: {
    loadTime: '<2.5s',
    realTimeUpdates: '<1s latency',
    concurrentUsers: '>50 supported'
  },
  systemImpact: {
    cpuOverhead: '<5%',
    memoryOverhead: '<10%',
    databaseLoad: '<15% increase'
  }
}
```

### Stage 3: Queue System Rollout (Week 2-3)

**Deployment Steps:**
1. Deploy queue workers (start with 2 workers)
2. Enable for 5% of embedding requests
3. Monitor queue performance and worker health
4. Gradually increase to 50% of requests
5. Scale workers based on load

**Queue Worker Deployment:**
```yaml
# Kubernetes deployment for queue workers
apiVersion: apps/v1
kind: Deployment
metadata:
  name: embedding-queue-workers
spec:
  replicas: 3
  selector:
    matchLabels:
      app: embedding-queue-worker
  template:
    metadata:
      labels:
        app: embedding-queue-worker
    spec:
      containers:
      - name: worker
        image: paperless-maverick/embedding-worker:latest
        env:
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: supabase-secrets
              key: url
        - name: SUPABASE_SERVICE_ROLE_KEY
          valueFrom:
            secretKeyRef:
              name: supabase-secrets
              key: service-role-key
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: gemini-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Stage 4: Batch Optimization Rollout (Week 3-4)

**Deployment Steps:**
1. Enable rate limiting for 10% of batch uploads
2. Monitor API quota usage and success rates
3. Enable adaptive processing for 25% of batches
4. Gradually increase to 100% of batch uploads

**Rate Limiting Configuration:**
```typescript
// Production rate limiting configuration
const productionRateLimits = {
  conservative: {
    maxConcurrentRequests: 2,
    requestsPerMinute: 30,
    tokensPerMinute: 50000,
    burstAllowance: 5,
    backoffMultiplier: 2,
    maxBackoffMs: 60000
  },
  balanced: {
    maxConcurrentRequests: 4,
    requestsPerMinute: 50,
    tokensPerMinute: 80000,
    burstAllowance: 8,
    backoffMultiplier: 1.5,
    maxBackoffMs: 30000
  },
  aggressive: {
    maxConcurrentRequests: 6,
    requestsPerMinute: 80,
    tokensPerMinute: 120000,
    burstAllowance: 12,
    backoffMultiplier: 1.2,
    maxBackoffMs: 15000
  }
}
```

## 5.2 Monitoring & Alerting Setup

### Production Monitoring Dashboard

```typescript
// Production monitoring configuration
interface ProductionMonitoring {
  metrics: {
    embeddingSuccessRate: {
      threshold: 0.95,
      alertOnBelow: true,
      checkInterval: '5m'
    },
    queueDepth: {
      threshold: 100,
      alertOnAbove: true,
      checkInterval: '1m'
    },
    apiQuotaUsage: {
      threshold: 0.8, // 80% of quota
      alertOnAbove: true,
      checkInterval: '1m'
    },
    workerHealth: {
      minActiveWorkers: 2,
      alertOnBelow: true,
      checkInterval: '30s'
    },
    responseTime: {
      p95Threshold: 10000, // 10 seconds
      alertOnAbove: true,
      checkInterval: '5m'
    }
  },
  alerts: {
    channels: ['slack', 'email', 'pagerduty'],
    escalation: {
      level1: ['dev-team'],
      level2: ['dev-team', 'ops-team'],
      level3: ['dev-team', 'ops-team', 'management']
    }
  }
}
```

### Health Check Endpoints

```typescript
// Health check implementation
app.get('/health/embedding-system', async (req, res) => {
  const healthChecks = await Promise.allSettled([
    checkDatabaseConnection(),
    checkQueueWorkerHealth(),
    checkAPIQuotaStatus(),
    checkMonitoringSystem(),
    checkRateLimiterStatus()
  ])

  const results = {
    database: healthChecks[0].status === 'fulfilled',
    queueWorkers: healthChecks[1].status === 'fulfilled',
    apiQuota: healthChecks[2].status === 'fulfilled',
    monitoring: healthChecks[3].status === 'fulfilled',
    rateLimiter: healthChecks[4].status === 'fulfilled'
  }

  const overallHealth = Object.values(results).every(Boolean)

  res.status(overallHealth ? 200 : 503).json({
    status: overallHealth ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: results,
    version: process.env.APP_VERSION
  })
})
```

### Automated Alerting Rules

```yaml
# Prometheus alerting rules
groups:
- name: embedding-system
  rules:
  - alert: EmbeddingSuccessRateLow
    expr: embedding_success_rate < 0.95
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Embedding success rate below threshold"
      description: "Success rate is {{ $value }} for the last 5 minutes"

  - alert: QueueDepthHigh
    expr: embedding_queue_depth > 100
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Embedding queue depth too high"
      description: "Queue depth is {{ $value }} items"

  - alert: APIQuotaExhaustion
    expr: api_quota_usage > 0.9
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "API quota near exhaustion"
      description: "API quota usage is {{ $value }}%"

  - alert: WorkerDown
    expr: active_embedding_workers < 2
    for: 30s
    labels:
      severity: critical
    annotations:
      summary: "Insufficient embedding workers"
      description: "Only {{ $value }} workers active"
```

## 5.3 Rollback Plans

### Automated Rollback Triggers

```typescript
// Automated rollback conditions
interface RollbackTriggers {
  embeddingSuccessRate: {
    threshold: 0.85,
    duration: '10m',
    action: 'disable_monitoring'
  },
  systemErrorRate: {
    threshold: 0.1, // 10% error rate
    duration: '5m',
    action: 'full_rollback'
  },
  queueBacklog: {
    threshold: 500,
    duration: '15m',
    action: 'disable_queue'
  },
  apiQuotaExhaustion: {
    threshold: 0.95,
    duration: '2m',
    action: 'enable_conservative_mode'
  }
}

// Rollback execution
async function executeRollback(trigger: string, severity: 'partial' | 'full') {
  console.log(`Executing ${severity} rollback due to: ${trigger}`)
  
  if (severity === 'full') {
    // Full rollback to previous version
    await disableAllFeatureFlags()
    await stopQueueWorkers()
    await switchToDirectProcessing()
    await notifyTeam('Full rollback executed', 'critical')
  } else {
    // Partial rollback - disable problematic feature
    switch (trigger) {
      case 'queue_issues':
        await disableQueueProcessing()
        await enableDirectProcessingFallback()
        break
      case 'monitoring_issues':
        await disableMetricsCollection()
        break
      case 'rate_limiting_issues':
        await disableRateLimiting()
        break
    }
  }
}
```

### Manual Rollback Procedures

```bash
#!/bin/bash
# Manual rollback script

echo "Starting rollback procedure..."

# 1. Disable feature flags
curl -X POST "$ADMIN_API/feature-flags/disable-all" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Stop queue workers
kubectl scale deployment embedding-queue-workers --replicas=0

# 3. Revert database migrations (if needed)
# psql -f rollback_scripts/revert_phase3.sql
# psql -f rollback_scripts/revert_phase2.sql
# psql -f rollback_scripts/revert_phase1.sql

# 4. Switch to previous application version
kubectl set image deployment/paperless-maverick \
  app=paperless-maverick:previous-stable

# 5. Verify rollback
./scripts/verify-rollback.sh

echo "Rollback completed. Monitoring system status..."
```

## 5.4 Post-Deployment Performance Analysis

### Performance Monitoring Dashboard

```typescript
// Post-deployment metrics collection
interface PostDeploymentMetrics {
  beforeDeployment: {
    avgProcessingTime: number
    successRate: number
    throughput: number
    errorRate: number
  },
  afterDeployment: {
    avgProcessingTime: number
    successRate: number
    throughput: number
    errorRate: number
  },
  improvements: {
    processingTimeImprovement: string // percentage
    successRateImprovement: string
    throughputImprovement: string
    errorRateReduction: string
  }
}

// Automated performance comparison
async function generatePerformanceReport(days: number = 7) {
  const beforeMetrics = await getMetrics(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000),
    new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  )
  
  const afterMetrics = await getMetrics(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    new Date()
  )
  
  return {
    beforeDeployment: beforeMetrics,
    afterDeployment: afterMetrics,
    improvements: calculateImprovements(beforeMetrics, afterMetrics)
  }
}
```

### Success Criteria Validation

```typescript
// Validate deployment success against targets
const deploymentSuccessCriteria = {
  performance: {
    processingTimeImprovement: '>10%',
    successRateImprovement: '>5%',
    throughputIncrease: '>25%'
  },
  reliability: {
    uptimePercentage: '>99.9%',
    errorRateReduction: '>50%',
    recoveryTime: '<30s'
  },
  scalability: {
    concurrentUserSupport: '>50',
    queueThroughput: '>45 items/min',
    resourceUtilization: '<80%'
  }
}

async function validateDeploymentSuccess(): Promise<boolean> {
  const metrics = await generatePerformanceReport(7)
  const criteria = deploymentSuccessCriteria
  
  // Check each criterion
  const results = {
    processingTime: parseFloat(metrics.improvements.processingTimeImprovement) > 10,
    successRate: parseFloat(metrics.improvements.successRateImprovement) > 5,
    throughput: parseFloat(metrics.improvements.throughputImprovement) > 25,
    uptime: await getUptimePercentage(7) > 99.9,
    errorRate: parseFloat(metrics.improvements.errorRateReduction) > 50
  }
  
  return Object.values(results).every(Boolean)
}
```

## 5.5 Operational Procedures

### Daily Operations Checklist

```markdown
## Daily Embedding System Health Check

### Morning Checks (9:00 AM)
- [ ] Check overnight processing statistics
- [ ] Verify queue worker health and count
- [ ] Review API quota usage from previous day
- [ ] Check for any failed embeddings requiring retry
- [ ] Validate monitoring dashboard accuracy

### Midday Checks (1:00 PM)
- [ ] Monitor current queue depth and processing rate
- [ ] Check rate limiting effectiveness
- [ ] Review any alerts or warnings
- [ ] Validate batch upload performance

### Evening Checks (6:00 PM)
- [ ] Review daily performance metrics
- [ ] Check system resource utilization
- [ ] Plan for overnight processing load
- [ ] Update capacity planning metrics
```

### Incident Response Procedures

```typescript
// Incident response automation
interface IncidentResponse {
  severity: 'low' | 'medium' | 'high' | 'critical'
  autoActions: string[]
  notificationChannels: string[]
  escalationTime: number // minutes
}

const incidentResponses: Record<string, IncidentResponse> = {
  'embedding_failure_spike': {
    severity: 'high',
    autoActions: ['enable_fallback_processing', 'increase_retry_attempts'],
    notificationChannels: ['slack', 'email'],
    escalationTime: 15
  },
  'queue_worker_failure': {
    severity: 'critical',
    autoActions: ['restart_workers', 'enable_direct_processing'],
    notificationChannels: ['slack', 'email', 'pagerduty'],
    escalationTime: 5
  },
  'api_quota_exhaustion': {
    severity: 'critical',
    autoActions: ['enable_conservative_mode', 'pause_non_critical_processing'],
    notificationChannels: ['slack', 'email', 'pagerduty'],
    escalationTime: 2
  }
}
```

## Timeline & Resource Requirements

### Deployment Timeline
- **Week 1**: Infrastructure deployment and monitoring rollout
- **Week 2**: Queue system deployment and validation
- **Week 3**: Batch optimization rollout
- **Week 4**: Full deployment and performance analysis

### Resource Requirements
- **DevOps Engineer**: Full-time for deployment coordination
- **Backend Developer**: 50% time for deployment support
- **QA Engineer**: 50% time for validation testing
- **SRE/Operations**: On-call support during rollout

### Success Metrics
- **Zero-downtime deployment**: No service interruptions
- **Performance targets met**: All Phase 4 benchmarks achieved
- **Monitoring accuracy**: >99% correlation with actual metrics
- **User satisfaction**: No increase in support tickets

## Risk Mitigation

### High-Risk Scenarios
1. **Database migration failures**: Comprehensive backup and rollback procedures
2. **Queue worker instability**: Automatic fallback to direct processing
3. **API quota exhaustion**: Conservative rate limiting with monitoring
4. **Performance degradation**: Automated rollback triggers

### Mitigation Strategies
- Feature flags for gradual rollout
- Comprehensive monitoring and alerting
- Automated rollback procedures
- 24/7 on-call support during deployment
- Staged deployment with validation gates

This comprehensive deployment plan ensures a safe, monitored rollout of all embedding system enhancements with minimal risk to production operations.
