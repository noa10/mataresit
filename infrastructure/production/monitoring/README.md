# Production Monitoring Infrastructure

Comprehensive monitoring solution for Paperless Maverick with real-time dashboards, alerting, and metrics collection.

## 🏗️ Architecture Overview

The monitoring infrastructure consists of:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notifications
- **Blackbox Exporter**: External health monitoring
- **Custom Metrics**: Application-specific metrics collection

## 📁 Directory Structure

```
infrastructure/production/monitoring/
├── grafana/
│   └── dashboards/
│       ├── production-overview-dashboard.json
│       ├── embedding-performance-dashboard.json
│       └── worker-health-dashboard.json
├── prometheus/
│   ├── prometheus.yml
│   └── rules/
│       └── embedding-alerts.yml
└── README.md
```

## 🎯 Key Dashboards

### 1. Production Overview Dashboard
**File**: `grafana/dashboards/production-overview-dashboard.json`

**Key Metrics**:
- System health overview (uptime, success rates)
- Embedding processing rate and success rate
- Queue depth and worker status
- API quota usage and response times
- Error rates by type
- Resource usage trends

**Features**:
- Real-time updates (30s refresh)
- Environment and team filtering
- Deployment and alert annotations
- Threshold-based color coding

### 2. Embedding Performance Deep Dive
**File**: `grafana/dashboards/embedding-performance-dashboard.json`

**Key Metrics**:
- Success rate trends with alerting
- Processing time heatmaps
- Queue depth by priority
- API provider performance comparison
- Rate limiting status
- Cost analysis and projections
- Batch processing efficiency

**Features**:
- 15-second refresh for real-time monitoring
- Team and worker filtering
- Performance heatmaps
- Cost tracking and budgeting

### 3. Worker Health & Resource Monitoring
**File**: `grafana/dashboards/worker-health-dashboard.json`

**Key Metrics**:
- Worker status and availability
- CPU and memory usage per worker
- Restart counts and health scores
- Job processing rates
- Network and disk I/O
- Scaling events and load distribution

**Features**:
- 10-second refresh for immediate feedback
- Individual worker monitoring
- Resource utilization tracking
- Auto-scaling visualization

## 📊 Metrics Collection

### Application Metrics
**File**: `src/lib/monitoring/metrics-collector.ts`

**Collected Metrics**:
- **Embedding Processing**: Success rates, processing times, queue depth
- **API Usage**: Request rates, response times, quota usage, costs
- **Worker Health**: Job processing, resource usage, health scores
- **Database Performance**: Query times, connection usage
- **Feature Flags**: Evaluation counts, error rates
- **System Health**: Memory usage, event loop lag

**Usage Example**:
```typescript
import { metricsCollector } from '@/lib/monitoring/metrics-collector';

// Record embedding job
metricsCollector.recordEmbeddingJob('success', 15.2, {
  teamId: 'team-123',
  provider: 'gemini',
  model: 'text-embedding-004'
});

// Record API request
metricsCollector.recordApiRequest('gemini', '/embeddings', 'POST', '200', 1.5);

// Update queue depth
metricsCollector.updateQueueDepth(25, 'normal', 'team-123');
```

### Prometheus Configuration
**File**: `prometheus/prometheus.yml`

**Scrape Targets**:
- Main application (`paperless-maverick`)
- Embedding queue workers (`embedding-queue-workers`)
- Worker health monitor (`worker-health-monitor`)
- Blackbox exporter for health checks
- Kubernetes cluster metrics (nodes, pods, services)
- Database and Redis exporters

**Key Features**:
- 15-second scrape intervals for real-time data
- Kubernetes service discovery
- Automatic relabeling and metadata
- Remote write to long-term storage

## 🚨 Alerting Rules

### Alert Categories
**File**: `prometheus/rules/embedding-alerts.yml`

**Critical Alerts**:
- Service down (1 minute)
- Success rate below 95% (5 minutes)
- Queue depth above 100 (2 minutes)
- Processing stalled (3 minutes)
- API quota above 95% (1 minute)

**Warning Alerts**:
- Success rate below 98% (10 minutes)
- Queue depth above 50 (5 minutes)
- Processing time above 5 minutes (10 minutes)
- High resource usage (10 minutes)
- Cost projections above budget (30 minutes)

**Alert Routing**:
- **Critical**: Immediate PagerDuty + Slack
- **Warning**: Slack notifications
- **Info**: Email notifications

### Alert Examples

```yaml
# Critical: Embedding service down
- alert: EmbeddingServiceDown
  expr: up{job="paperless-maverick"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Embedding service is down"
    runbook_url: "https://docs.company.com/runbooks/embedding-service-down"

# Warning: High queue depth
- alert: EmbeddingQueueDepthHigh
  expr: embedding_queue_depth > 50
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Embedding queue depth is high"
    description: "Queue depth is {{ $value }} items"
```

## 🖥️ React Dashboard Component

### Production Monitoring Dashboard
**File**: `src/components/admin/ProductionMonitoringDashboard.tsx`

**Features**:
- Real-time metrics display
- System health overview
- Tabbed interface for different metric categories
- Alert management and acknowledgment
- Auto-refresh with manual override
- Responsive design for mobile/desktop

**Key Sections**:
1. **System Health**: Overall status with color-coded indicators
2. **Embedding Metrics**: Success rates, processing times, queue status
3. **Worker Metrics**: Resource usage, health scores, scaling status
4. **API & Costs**: Quota usage, response times, cost tracking
5. **Alerts**: Active alerts with acknowledgment capabilities

### API Endpoints

**Health Monitoring**: `/api/monitoring/health`
- Returns system health metrics
- Calculates health scores based on thresholds
- Provides status indicators and trends

**Embedding Metrics**: `/api/monitoring/embedding`
- Detailed embedding processing metrics
- Success rates, processing times, error analysis

**Worker Metrics**: `/api/monitoring/workers`
- Worker health and resource usage
- Scaling status and job distribution

**API Metrics**: `/api/monitoring/api`
- API performance and quota usage
- Cost tracking and projections

**Alerts**: `/api/monitoring/alerts`
- Active alerts and acknowledgment
- Alert history and trends

## 🚀 Deployment

### Prerequisites

1. **Prometheus Server**: Running and accessible
2. **Grafana Instance**: Configured with Prometheus data source
3. **AlertManager**: Configured for notifications
4. **Kubernetes Cluster**: With proper RBAC permissions

### Setup Steps

1. **Deploy Prometheus Configuration**:
   ```bash
   kubectl apply -f prometheus/prometheus.yml
   kubectl apply -f prometheus/rules/
   ```

2. **Import Grafana Dashboards**:
   ```bash
   # Import via Grafana UI or API
   curl -X POST \
     http://grafana:3000/api/dashboards/db \
     -H "Content-Type: application/json" \
     -d @grafana/dashboards/production-overview-dashboard.json
   ```

3. **Configure Application Metrics**:
   ```typescript
   // Initialize metrics collection
   import { metricsCollector } from '@/lib/monitoring/metrics-collector';
   metricsCollector.startCollection();
   ```

4. **Set Up Alerting**:
   ```yaml
   # Configure AlertManager routes
   route:
     group_by: ['alertname', 'severity']
     group_wait: 10s
     group_interval: 10s
     repeat_interval: 1h
     receiver: 'default'
   ```

### Environment Variables

```bash
# Prometheus configuration
PROMETHEUS_URL=http://prometheus:9090
PROMETHEUS_SCRAPE_INTERVAL=15s

# Grafana configuration
GRAFANA_URL=http://grafana:3000
GRAFANA_API_KEY=your-api-key

# AlertManager configuration
ALERTMANAGER_URL=http://alertmanager:9093
SLACK_WEBHOOK_URL=your-slack-webhook
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-key

# Metrics collection
METRICS_COLLECTION_ENABLED=true
METRICS_COLLECTION_INTERVAL=30000
```

## 📈 Performance Optimization

### Metrics Retention

- **Short-term**: 15 days in Prometheus
- **Long-term**: 1 year in remote storage (Thanos/Cortex)
- **Aggregation**: 5m, 1h, 1d resolution levels

### Query Optimization

- Use recording rules for frequently accessed metrics
- Implement proper label cardinality limits
- Cache dashboard queries where appropriate
- Use downsampling for historical data

### Resource Usage

- **Prometheus**: 4GB RAM, 100GB storage
- **Grafana**: 1GB RAM, 10GB storage
- **AlertManager**: 512MB RAM, 1GB storage

## 🔧 Troubleshooting

### Common Issues

1. **Missing Metrics**:
   ```bash
   # Check Prometheus targets
   curl http://prometheus:9090/api/v1/targets
   
   # Verify service discovery
   kubectl get servicemonitor -n paperless-maverick
   ```

2. **Dashboard Not Loading**:
   ```bash
   # Check Grafana data source
   curl http://grafana:3000/api/datasources
   
   # Verify Prometheus connectivity
   curl http://prometheus:9090/api/v1/query?query=up
   ```

3. **Alerts Not Firing**:
   ```bash
   # Check alert rules
   curl http://prometheus:9090/api/v1/rules
   
   # Verify AlertManager config
   curl http://alertmanager:9093/api/v1/status
   ```

### Debug Commands

```bash
# Check metrics collection
kubectl exec -it deployment/paperless-maverick -- curl localhost:3000/metrics

# Verify worker health
kubectl exec -it deployment/embedding-queue-workers -- curl localhost:8080/health

# Check Prometheus scraping
kubectl port-forward svc/prometheus 9090:9090
curl http://localhost:9090/api/v1/targets
```

## 📚 Best Practices

1. **Metric Naming**: Use consistent naming conventions
2. **Label Management**: Keep cardinality under control
3. **Alert Fatigue**: Set appropriate thresholds and grouping
4. **Dashboard Design**: Focus on actionable metrics
5. **Documentation**: Maintain runbooks for all alerts
6. **Testing**: Regularly test alert and recovery procedures

## 🔗 Integration Points

- **Supabase**: Database metrics and health checks
- **Kubernetes**: Cluster and pod metrics
- **Feature Flags**: Evaluation metrics and performance impact
- **Cost Tracking**: API usage and billing integration
- **Incident Management**: PagerDuty and Slack integration

This monitoring infrastructure provides comprehensive visibility into the Paperless Maverick production environment with real-time dashboards, proactive alerting, and detailed performance analytics.
