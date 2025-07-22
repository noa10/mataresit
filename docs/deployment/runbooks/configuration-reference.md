# Configuration Reference

This document provides a comprehensive reference for all configuration parameters, environment variables, and settings used in the Paperless Maverick production deployment system.

## 📋 Overview

The deployment system uses multiple configuration layers:
- **Environment Variables** - Runtime configuration for applications
- **ConfigMaps** - Kubernetes configuration data
- **Secrets** - Sensitive configuration data
- **Deployment Configuration** - Infrastructure and deployment settings
- **Monitoring Configuration** - Metrics, alerting, and monitoring settings

## 🔧 Application Configuration

### Core Environment Variables

#### Database Configuration
```yaml
# Database connection settings
DATABASE_URL: "postgresql://user:password@host:5432/database"
DB_POOL_SIZE: "20"                    # Connection pool size (default: 20)
DB_POOL_TIMEOUT: "30000"              # Connection timeout in ms (default: 30s)
DB_POOL_IDLE_TIMEOUT: "600000"        # Idle timeout in ms (default: 10min)
DB_SSL_MODE: "require"                # SSL mode (require/prefer/disable)
DB_RETRY_ATTEMPTS: "5"                # Connection retry attempts
DB_RETRY_DELAY: "5000"                # Retry delay in ms
```

#### Supabase Configuration
```yaml
# Supabase service configuration
SUPABASE_URL: "https://mpmkbtsufihzdelrlszs.supabase.co"
SUPABASE_ANON_KEY: "[REDACTED]"       # Public anonymous key
SUPABASE_SERVICE_ROLE_KEY: "[REDACTED]" # Service role key (sensitive)
SUPABASE_JWT_SECRET: "[REDACTED]"     # JWT signing secret (sensitive)
```

#### AI Service Configuration
```yaml
# Google Gemini API
GEMINI_API_KEY: "[REDACTED]"          # Gemini API key (sensitive)
GEMINI_MODEL: "gemini-2.0-flash-lite" # Default model
GEMINI_MAX_TOKENS: "8192"             # Maximum tokens per request
GEMINI_TEMPERATURE: "0.1"             # Model temperature
GEMINI_TIMEOUT: "30000"               # Request timeout in ms

# OpenRouter API (optional)
OPENROUTER_API_KEY: "[REDACTED]"      # OpenRouter API key (sensitive)
OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1"
```

#### Application Settings
```yaml
# Server configuration
PORT: "3000"                          # Application port
NODE_ENV: "production"                # Environment mode
LOG_LEVEL: "info"                     # Logging level (debug/info/warn/error)
CORS_ORIGIN: "https://app.mataresit.com" # CORS allowed origins

# Feature flags
ENABLE_AI_VISION: "true"              # Enable AI vision processing
ENABLE_BATCH_UPLOAD: "true"           # Enable batch upload feature
ENABLE_REAL_TIME_UPDATES: "true"      # Enable real-time notifications
ENABLE_ANALYTICS: "true"              # Enable analytics collection
```

#### Security Configuration
```yaml
# Authentication and security
JWT_SECRET: "[REDACTED]"              # JWT signing secret (sensitive)
SESSION_SECRET: "[REDACTED]"          # Session secret (sensitive)
ENCRYPTION_KEY: "[REDACTED]"          # Data encryption key (sensitive)
RATE_LIMIT_WINDOW: "3600"             # Rate limit window in seconds
RATE_LIMIT_MAX_REQUESTS: "1000"       # Max requests per window
BCRYPT_ROUNDS: "12"                   # Password hashing rounds
```

### Worker Configuration

#### Queue Processing Settings
```yaml
# Queue worker configuration
WORKER_CONCURRENCY: "5"               # Concurrent jobs per worker
WORKER_MAX_JOBS: "100"                # Max jobs before worker restart
WORKER_TIMEOUT: "300000"              # Job timeout in ms (5 minutes)
WORKER_RETRY_ATTEMPTS: "3"            # Job retry attempts
WORKER_RETRY_DELAY: "5000"            # Retry delay in ms
QUEUE_NAME: "embedding-processing"     # Queue name
```

#### Embedding Processing Settings
```yaml
# Embedding generation configuration
EMBEDDING_BATCH_SIZE: "10"            # Batch size for processing
EMBEDDING_MODEL: "text-embedding-004" # Embedding model
EMBEDDING_DIMENSIONS: "768"           # Embedding dimensions
EMBEDDING_TIMEOUT: "60000"            # Processing timeout in ms
EMBEDDING_RETRY_LIMIT: "3"            # Retry limit for failed embeddings
```

## 🗂️ Kubernetes Configuration

### ConfigMap Structure
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: paperless-maverick
data:
  # Application settings
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  
  # Database settings
  DB_POOL_SIZE: "20"
  DB_POOL_TIMEOUT: "30000"
  DB_POOL_IDLE_TIMEOUT: "600000"
  
  # Feature flags
  ENABLE_AI_VISION: "true"
  ENABLE_BATCH_UPLOAD: "true"
  ENABLE_REAL_TIME_UPDATES: "true"
  
  # Performance settings
  WORKER_CONCURRENCY: "5"
  EMBEDDING_BATCH_SIZE: "10"
  RATE_LIMIT_MAX_REQUESTS: "1000"
```

### Secrets Structure
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: paperless-maverick
type: Opaque
data:
  # Base64 encoded sensitive values
  DATABASE_URL: "[BASE64_ENCODED]"
  SUPABASE_SERVICE_ROLE_KEY: "[BASE64_ENCODED]"
  GEMINI_API_KEY: "[BASE64_ENCODED]"
  JWT_SECRET: "[BASE64_ENCODED]"
  SESSION_SECRET: "[BASE64_ENCODED]"
  ENCRYPTION_KEY: "[BASE64_ENCODED]"
```

## 🚀 Deployment Configuration

### Master Deployment Settings
```yaml
# infrastructure/production/config/deployment-config.yaml
deployment:
  environment: "production"
  namespace: "paperless-maverick"
  strategy: "rolling"                 # rolling/blue-green/canary
  
  # Image configuration
  image_registry: "ghcr.io/mataresit"
  image_tag: "latest"
  pull_policy: "Always"
  
  # Scaling configuration
  replicas:
    min: 2
    max: 10
    target_cpu: 70                    # CPU utilization for HPA
    target_memory: 80                 # Memory utilization for HPA
  
  # Resource limits
  resources:
    requests:
      cpu: "500m"
      memory: "1Gi"
    limits:
      cpu: "2000m"
      memory: "4Gi"
  
  # Health checks
  health_check:
    enabled: true
    path: "/health/live"
    port: 3000
    initial_delay: 30
    period: 10
    timeout: 5
    failure_threshold: 3
  
  # Readiness checks
  readiness_check:
    enabled: true
    path: "/health/ready"
    port: 3000
    initial_delay: 10
    period: 5
    timeout: 3
    failure_threshold: 3
```

### Worker Deployment Settings
```yaml
# Worker-specific configuration
worker_deployment:
  replicas:
    min: 1
    max: 8
    target_cpu: 80
  
  resources:
    requests:
      cpu: "250m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "2Gi"
  
  # Worker-specific settings
  worker_settings:
    concurrency: 5
    max_jobs: 100
    timeout: 300000
    restart_policy: "Always"
```

## 📊 Monitoring Configuration

### Prometheus Configuration
```yaml
# Scrape configurations
scrape_configs:
  - job_name: 'paperless-maverick'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ['paperless-maverick']
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
    scrape_interval: 15s
    metrics_path: /metrics
    
  - job_name: 'embedding-workers'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ['paperless-maverick']
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: embedding-queue-workers
    scrape_interval: 30s
```

### Alert Rules Configuration
```yaml
# Critical alerts
groups:
  - name: paperless-maverick-critical
    rules:
      - alert: ApplicationDown
        expr: up{job="paperless-maverick"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Application is down"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseConnectionFailure
        expr: database_connections_failed_total > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failures"
```

### Grafana Dashboard Configuration
```yaml
# Dashboard settings
dashboard:
  title: "Paperless Maverick - Production Overview"
  refresh: "30s"
  time_range: "1h"
  
  # Panel configurations
  panels:
    - title: "System Health"
      type: "stat"
      targets:
        - expr: "avg(up{job='paperless-maverick'})"
      thresholds:
        - color: "red"
          value: 0
        - color: "yellow"
          value: 0.8
        - color: "green"
          value: 0.95
          
    - title: "Response Time"
      type: "graph"
      targets:
        - expr: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
      y_axis:
        unit: "seconds"
        min: 0
        max: 2
```

## 🔐 Security Configuration

### Network Policies
```yaml
# Default deny all ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: paperless-maverick
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  
# Allow specific ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-ingress
  namespace: paperless-maverick
spec:
  podSelector:
    matchLabels:
      app: paperless-maverick
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
```

### RBAC Configuration
```yaml
# Service account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: paperless-maverick
  namespace: paperless-maverick

# Role for application
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: paperless-maverick-role
  namespace: paperless-maverick
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]

# Role binding
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: paperless-maverick-binding
  namespace: paperless-maverick
subjects:
- kind: ServiceAccount
  name: paperless-maverick
  namespace: paperless-maverick
roleRef:
  kind: Role
  name: paperless-maverick-role
  apiGroup: rbac.authorization.k8s.io
```

## 🔄 Configuration Management

### Environment-Specific Overrides
```yaml
# Staging environment overrides
staging:
  replicas:
    min: 1
    max: 3
  resources:
    requests:
      cpu: "250m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "2Gi"
  log_level: "debug"
  
# Production environment settings
production:
  replicas:
    min: 2
    max: 10
  resources:
    requests:
      cpu: "500m"
      memory: "1Gi"
    limits:
      cpu: "2000m"
      memory: "4Gi"
  log_level: "info"
```

### Configuration Validation
```bash
# Validate configuration files
kubectl apply --dry-run=client -f infrastructure/production/kubernetes/

# Check configuration syntax
yamllint infrastructure/production/config/

# Validate environment variables
./validate-config.sh --environment production --check-secrets
```

## 📝 Configuration Change Process

### Change Management
1. **Development**: Test configuration changes in development environment
2. **Staging**: Validate changes in staging environment
3. **Review**: Peer review of configuration changes
4. **Production**: Apply changes during maintenance window
5. **Validation**: Verify changes are applied correctly
6. **Rollback**: Have rollback plan ready if issues occur

### Configuration Backup
```bash
# Backup current configuration
kubectl get configmaps -n paperless-maverick -o yaml > configmaps-backup-$(date +%Y%m%d).yaml
kubectl get secrets -n paperless-maverick -o yaml > secrets-backup-$(date +%Y%m%d).yaml

# Version control configuration
git add infrastructure/production/config/
git commit -m "feat: update production configuration"
git tag -a config-v1.2.3 -m "Configuration version 1.2.3"
```

---

**Last Updated**: 2025-01-21  
**Version**: 1.0.0  
**Next Review**: 2025-02-21
