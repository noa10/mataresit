# Queue Worker Infrastructure

Production-ready Kubernetes deployment manifests for embedding queue workers with comprehensive monitoring, auto-scaling, and health management.

## 🏗️ Architecture Overview

The queue worker infrastructure consists of:

- **Worker Deployment**: Scalable embedding queue workers with resource limits and health checks
- **Auto-scaling**: Horizontal Pod Autoscaler (HPA) and Vertical Pod Autoscaler (VPA)
- **Health Monitoring**: Comprehensive health checks and monitoring system
- **Restart Controller**: Intelligent worker restart and recovery mechanisms
- **Configuration Management**: ConfigMaps, Secrets, and RBAC

## 📁 Directory Structure

```
infrastructure/production/kubernetes/workers/
├── embedding-queue-worker-deployment.yaml    # Main worker deployment
├── embedding-worker-hpa.yaml                 # Auto-scaling configuration
├── embedding-worker-configmap.yaml           # Worker configuration
├── worker-health-monitoring.yaml             # Health monitoring system
├── worker-restart-controller.yaml            # Restart controller
├── worker-dockerfile                          # Production Docker image
├── deployment-scripts/
│   └── deploy-workers.sh                     # Deployment automation script
└── README.md                                 # This documentation
```

## 🚀 Quick Start

### Prerequisites

1. **Kubernetes Cluster**: Running Kubernetes 1.20+
2. **kubectl**: Configured to access your cluster
3. **Docker**: For building worker images
4. **Secrets**: Required secrets must be created first

### Required Secrets

Create the following secrets before deployment:

```bash
# Supabase secrets
kubectl create secret generic supabase-secrets \
  --from-literal=url="https://your-project.supabase.co" \
  --from-literal=service-role-key="your-service-role-key" \
  -n paperless-maverick

# AI API secrets
kubectl create secret generic ai-secrets \
  --from-literal=gemini-api-key="your-gemini-api-key" \
  --from-literal=openai-api-key="your-openai-api-key" \
  -n paperless-maverick

# Feature flags configuration
kubectl create configmap feature-flags-config \
  --from-literal=ENABLE_QUEUE_PROCESSING="true" \
  --from-literal=ENABLE_BATCH_OPTIMIZATION="false" \
  -n paperless-maverick
```

### Deployment

```bash
# Deploy with validation
./deployment-scripts/deploy-workers.sh --environment production

# Dry run to validate
./deployment-scripts/deploy-workers.sh --dry-run

# Force deployment (skip validation)
./deployment-scripts/deploy-workers.sh --force --skip-validation
```

## 🔧 Configuration

### Worker Configuration

Key configuration options in `embedding-worker-configmap.yaml`:

```yaml
# Queue Processing
QUEUE_POLL_INTERVAL: "5000"          # 5 seconds
MAX_CONCURRENT_JOBS: "3"             # Jobs per worker
BATCH_SIZE: "5"                      # Items per batch
HEARTBEAT_INTERVAL: "30000"          # 30 seconds

# Rate Limiting
MAX_REQUESTS_PER_MINUTE: "60"        # API requests limit
MAX_TOKENS_PER_MINUTE: "100000"      # Token limit
BACKOFF_MULTIPLIER: "2"              # Exponential backoff

# Performance
MEMORY_LIMIT_MB: "1024"              # Memory limit
CPU_LIMIT_CORES: "1.0"               # CPU limit
```

### Auto-scaling Configuration

HPA configuration in `embedding-worker-hpa.yaml`:

```yaml
minReplicas: 2
maxReplicas: 10

# Scaling metrics
- CPU utilization: 70%
- Memory utilization: 80%
- Queue depth: 10 items
- Processing rate: 5 items/second
```

### Resource Limits

Per-worker resource allocation:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

## 📊 Monitoring & Health Checks

### Health Endpoints

Each worker exposes the following endpoints:

- `GET /health` - Overall health status
- `GET /ready` - Readiness check
- `GET /startup` - Startup probe
- `GET /metrics` - Prometheus metrics
- `POST /shutdown` - Graceful shutdown

### Prometheus Metrics

Key metrics exposed by workers:

```
# Worker uptime
worker_uptime_seconds

# Memory usage
worker_memory_usage_bytes{type="rss|heapUsed|heapTotal"}

# Job processing
embedding_jobs_processed_total
embedding_jobs_failed_total
embedding_processing_duration_seconds

# Queue metrics
embedding_queue_depth
embedding_queue_processing_rate

# Error metrics
embedding_worker_errors_total
```

### Alerts

Configured alerts include:

- **Worker Down**: Worker pod is not responding
- **High CPU/Memory**: Resource usage above thresholds
- **Queue Depth**: Queue backlog is growing
- **High Error Rate**: Error rate above acceptable levels
- **Slow Processing**: Processing time exceeds thresholds

## 🔄 Auto-scaling

### Horizontal Pod Autoscaler (HPA)

Scales workers based on:

- **CPU Utilization**: Target 70%
- **Memory Utilization**: Target 80%
- **Queue Depth**: Target 10 items per worker
- **Processing Rate**: Target 5 items/second per worker

### Vertical Pod Autoscaler (VPA)

Automatically adjusts resource requests/limits:

- **CPU**: 100m - 2000m
- **Memory**: 256Mi - 2Gi
- **Update Mode**: Auto (with rolling updates)

### Scaling Behavior

```yaml
scaleUp:
  stabilizationWindowSeconds: 60
  policies:
  - type: Percent
    value: 100        # Double replicas
  - type: Pods
    value: 2          # Add 2 pods max

scaleDown:
  stabilizationWindowSeconds: 300
  policies:
  - type: Percent
    value: 50         # Halve replicas
  - type: Pods
    value: 1          # Remove 1 pod max
```

## 🛠️ Worker Restart Controller

### Intelligent Restart Policies

The restart controller handles different failure scenarios:

1. **Critical Failures** (immediate restart):
   - Pod crash loops
   - Image pull failures
   - Out of memory errors

2. **Recoverable Failures** (delayed restart):
   - Health check failures
   - High error rates
   - Slow response times

3. **Capacity Issues** (scaling):
   - High queue depth
   - Resource exhaustion

### Recovery Strategies

- **Graceful Restart**: Drain → Terminate → Restart → Validate
- **Force Restart**: Terminate → Restart → Validate
- **Scale Up**: Add replicas when capacity is insufficient

## 🔒 Security

### Pod Security

- **Non-root user**: Workers run as user ID 1001
- **Read-only filesystem**: Root filesystem is read-only
- **No privilege escalation**: Security contexts prevent escalation
- **Dropped capabilities**: All Linux capabilities dropped

### Network Security

- **Network Policies**: Restrict ingress/egress traffic
- **Service Mesh**: Optional Linkerd integration
- **TLS**: HTTPS for all external API calls

### RBAC

Minimal permissions for worker service accounts:

- Read ConfigMaps and Secrets
- Read own pod information
- Create events for logging

## 🚨 Troubleshooting

### Common Issues

1. **Workers Not Starting**
   ```bash
   # Check pod status
   kubectl get pods -n paperless-maverick -l app=embedding-queue-worker
   
   # Check logs
   kubectl logs -n paperless-maverick deployment/embedding-queue-workers
   
   # Check events
   kubectl get events -n paperless-maverick --sort-by='.lastTimestamp'
   ```

2. **High Memory Usage**
   ```bash
   # Check resource usage
   kubectl top pods -n paperless-maverick -l app=embedding-queue-worker
   
   # Adjust memory limits in ConfigMap
   kubectl edit configmap embedding-worker-config -n paperless-maverick
   ```

3. **Queue Backlog**
   ```bash
   # Check queue depth
   kubectl exec -n paperless-maverick deployment/embedding-queue-workers -- \
     curl -s http://localhost:9091/metrics | grep queue_depth
   
   # Scale up workers
   kubectl scale deployment embedding-queue-workers --replicas=5 -n paperless-maverick
   ```

### Debug Commands

```bash
# Get worker status
kubectl get pods -n paperless-maverick -l app=embedding-queue-worker -o wide

# Check worker health
kubectl exec -n paperless-maverick <pod-name> -- curl http://localhost:8080/health

# View worker metrics
kubectl exec -n paperless-maverick <pod-name> -- curl http://localhost:9091/metrics

# Check HPA status
kubectl get hpa embedding-queue-workers-hpa -n paperless-maverick

# View restart controller logs
kubectl logs -n paperless-maverick deployment/worker-restart-controller
```

## 📈 Performance Tuning

### Worker Performance

1. **Concurrent Jobs**: Adjust `MAX_CONCURRENT_JOBS` based on CPU/memory
2. **Batch Size**: Optimize `BATCH_SIZE` for throughput vs. latency
3. **Poll Interval**: Balance `QUEUE_POLL_INTERVAL` for responsiveness vs. load

### Resource Optimization

1. **CPU Requests**: Set based on actual usage patterns
2. **Memory Limits**: Monitor heap usage and adjust accordingly
3. **Node Affinity**: Use worker-specific nodes for better performance

### Queue Optimization

1. **Priority Queues**: Enable priority processing for urgent jobs
2. **Dead Letter Queue**: Configure for failed job handling
3. **Rate Limiting**: Adjust API rate limits based on quotas

## 🔄 Deployment Strategies

### Rolling Updates

Default deployment strategy with zero downtime:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 2
    maxUnavailable: 1
```

### Blue-Green Deployment

For major updates, use blue-green deployment:

```bash
# Deploy to staging namespace first
./deploy-workers.sh --namespace paperless-maverick-staging

# Validate and switch traffic
kubectl patch service embedding-queue-workers-service \
  -p '{"spec":{"selector":{"version":"v2"}}}'
```

### Canary Deployment

Gradual rollout with traffic splitting:

```bash
# Deploy canary version
kubectl apply -f canary-deployment.yaml

# Monitor metrics and gradually increase traffic
```

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Vertical Pod Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)

## 🤝 Contributing

When modifying worker infrastructure:

1. Test changes in development environment first
2. Update documentation for configuration changes
3. Validate manifests with `kubectl apply --dry-run`
4. Monitor deployment with comprehensive logging
5. Update alerts and monitoring as needed

---

This infrastructure provides a robust, scalable, and monitored queue worker system for production deployment of the Paperless Maverick embedding processing pipeline.
