# Production Infrastructure for Paperless Maverick

This directory contains the complete production infrastructure configuration for the Paperless Maverick embedding system, implementing Phase 5 production deployment planning.

## 📁 Directory Structure

```
infrastructure/production/
├── docker/                     # Docker configurations
│   ├── Dockerfile             # Main application container
│   ├── Dockerfile.worker      # Embedding worker container
│   └── docker-compose.yml     # Local production testing
├── kubernetes/                # Kubernetes manifests
│   ├── namespace.yaml         # Namespace and resource quotas
│   ├── configmap.yaml         # Configuration maps
│   ├── secrets.yaml           # Secret templates
│   ├── deployment.yaml        # Application and worker deployments
│   ├── service.yaml           # Services and ingress
│   └── hpa.yaml              # Horizontal Pod Autoscaler
├── terraform/                 # Infrastructure as Code
│   ├── main.tf               # Main Terraform configuration
│   ├── variables.tf          # Variable definitions
│   └── outputs.tf            # Output definitions
├── env/                      # Environment configurations
│   └── .env.production       # Production environment variables
├── workers/                  # Worker implementations
│   ├── embedding-worker.js   # Queue worker implementation
│   └── health-check.js       # Health check script
├── scripts/                  # Deployment scripts
│   ├── deploy.sh            # Main deployment script
│   └── setup-secrets.sh     # Secrets management script
└── README.md                # This file
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Kubernetes cluster access
- kubectl configured
- Terraform (optional, for IaC)
- Node.js 18+ (for workers)

### 1. Environment Setup

```bash
# Copy and configure environment variables
cp infrastructure/production/env/.env.production .env.production
# Edit .env.production with your actual values

# Set up Kubernetes secrets
./infrastructure/production/scripts/setup-secrets.sh --from-file .env.production
```

### 2. Deploy to Production

```bash
# Validate configuration
./infrastructure/production/scripts/deploy.sh --validate-only

# Deploy with dry run first
./infrastructure/production/scripts/deploy.sh --dry-run

# Full deployment
./infrastructure/production/scripts/deploy.sh
```

### 3. Verify Deployment

```bash
# Check pod status
kubectl get pods -n paperless-maverick

# Check services
kubectl get services -n paperless-maverick

# View logs
kubectl logs -f deployment/paperless-maverick -n paperless-maverick
kubectl logs -f deployment/embedding-queue-workers -n paperless-maverick
```

## 🏗️ Architecture Overview

### Components

1. **Main Application** (`paperless-maverick`)
   - React frontend with Node.js backend
   - Handles user requests and API endpoints
   - Integrates with Supabase for data storage
   - Implements feature flags for gradual rollout

2. **Embedding Workers** (`embedding-queue-workers`)
   - Processes embedding generation requests
   - Implements rate limiting and retry logic
   - Provides health checks and metrics
   - Auto-scales based on queue depth

3. **Monitoring Stack**
   - Prometheus for metrics collection
   - Grafana for visualization
   - Custom health check endpoints
   - Automated alerting system

### Deployment Strategy

- **Blue-Green Deployment**: Zero-downtime deployments
- **Feature Flags**: Gradual rollout with percentage-based controls
- **Auto-scaling**: HPA based on CPU, memory, and custom metrics
- **Health Checks**: Comprehensive liveness and readiness probes

## 🔧 Configuration

### Feature Flags

The system implements gradual rollout using feature flags:

```yaml
# Initial deployment configuration
ENABLE_EMBEDDING_MONITORING: true
EMBEDDING_MONITORING_ROLLOUT_PERCENTAGE: 10
ENABLE_QUEUE_PROCESSING: false
QUEUE_PROCESSING_ROLLOUT_PERCENTAGE: 0
ENABLE_BATCH_OPTIMIZATION: false
BATCH_OPTIMIZATION_ROLLOUT_PERCENTAGE: 0
```

### Resource Allocation

**Application Pods:**
- Requests: 250m CPU, 512Mi memory
- Limits: 500m CPU, 1Gi memory
- Replicas: 3-10 (auto-scaling)

**Worker Pods:**
- Requests: 250m CPU, 256Mi memory
- Limits: 500m CPU, 512Mi memory
- Replicas: 2-6 (auto-scaling)

### Auto-scaling Configuration

- **CPU Threshold**: 70% (app), 80% (workers)
- **Memory Threshold**: 80% (app), 85% (workers)
- **Custom Metrics**: Queue depth for workers
- **Scale-up Policy**: Fast (30s stabilization)
- **Scale-down Policy**: Conservative (300s stabilization)

## 🔐 Security

### Security Features

- **Network Policies**: Restrict pod-to-pod communication
- **Pod Security Standards**: Restricted security context
- **RBAC**: Role-based access control
- **Secret Management**: Kubernetes secrets with encryption
- **TLS Termination**: Automatic SSL certificates
- **Rate Limiting**: API and ingress level protection

### Required Secrets

```bash
# Supabase Configuration
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# AI/ML APIs
GEMINI_API_KEY
OPENAI_API_KEY (optional)

# Security
API_KEY_ENCRYPTION_KEY
JWT_SECRET

# Monitoring
SENTRY_DSN (optional)
GRAFANA_ADMIN_PASSWORD

# Notifications
RESEND_API_KEY (optional)
SLACK_WEBHOOK_URL (optional)
PAGERDUTY_INTEGRATION_KEY (optional)
```

## 📊 Monitoring

### Health Check Endpoints

- **Application**: `/health`, `/ready`
- **Workers**: `:8080/health`, `:8080/ready`
- **Metrics**: `:9090/metrics` (app), `:9091/metrics` (workers)

### Key Metrics

- Embedding success rate
- Queue depth and processing time
- API quota usage
- Worker health and performance
- Resource utilization

### Alerting Rules

- Embedding success rate < 95%
- Queue depth > 100 items
- API quota usage > 80%
- Worker count < minimum threshold
- High error rates or response times

## 🔄 Operations

### Deployment Commands

```bash
# Deploy new version
./infrastructure/production/scripts/deploy.sh --image-tag v1.2.3

# Rollback deployment
./infrastructure/production/scripts/deploy.sh --rollback

# Update configuration
kubectl apply -f infrastructure/production/kubernetes/configmap.yaml

# Scale workers manually
kubectl scale deployment embedding-queue-workers --replicas=5 -n paperless-maverick
```

### Troubleshooting

```bash
# Check pod status
kubectl describe pods -n paperless-maverick

# View recent events
kubectl get events -n paperless-maverick --sort-by='.lastTimestamp'

# Check HPA status
kubectl describe hpa -n paperless-maverick

# Port forward for local access
kubectl port-forward service/paperless-maverick-service 8080:80 -n paperless-maverick
```

### Backup and Recovery

- **Database**: Automated Supabase backups
- **Configuration**: Version controlled in Git
- **Secrets**: Stored in secure secret management
- **Application State**: Stateless design for easy recovery

## 🚨 Rollback Procedures

### Automated Rollback Triggers

- Embedding success rate < 85% for 10 minutes
- System error rate > 10% for 5 minutes
- Queue backlog > 500 items for 15 minutes
- API quota exhaustion > 95% for 2 minutes

### Manual Rollback

```bash
# Quick rollback
./infrastructure/production/scripts/deploy.sh --rollback

# Kubernetes rollback
kubectl rollout undo deployment/paperless-maverick -n paperless-maverick
kubectl rollout undo deployment/embedding-queue-workers -n paperless-maverick
```

## 📈 Scaling Guidelines

### Horizontal Scaling

- **Application**: Scales based on CPU/memory usage
- **Workers**: Scales based on queue depth and resource usage
- **Database**: Managed by Supabase (automatic scaling)

### Vertical Scaling

- Monitor resource usage patterns
- Adjust resource requests/limits as needed
- Consider node capacity when scaling

## 🔗 Integration Points

- **Supabase**: Database, authentication, storage
- **Gemini API**: AI/ML processing
- **Prometheus**: Metrics collection
- **Grafana**: Monitoring dashboards
- **Kubernetes**: Container orchestration
- **Docker**: Container runtime

## 📚 Additional Resources

- [Phase 5 Implementation Plan](../../docs/implementation-plans/phase5-production-deployment.md)
- [Production Configuration Guide](../../docs/deployment/production-config.md)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Terraform Documentation](https://www.terraform.io/docs/)

## 🆘 Support

For deployment issues or questions:

1. Check the deployment logs: `tail -f deployment-*.log`
2. Review Kubernetes events: `kubectl get events -n paperless-maverick`
3. Monitor application logs: `kubectl logs -f deployment/paperless-maverick -n paperless-maverick`
4. Check worker status: `kubectl logs -f deployment/embedding-queue-workers -n paperless-maverick`

---

**Note**: This infrastructure configuration implements the complete Phase 5 production deployment plan with comprehensive monitoring, security, and operational procedures.
