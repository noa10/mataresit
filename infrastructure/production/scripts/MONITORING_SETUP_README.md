# Monitoring Setup Automation

This directory contains comprehensive monitoring infrastructure deployment automation scripts for the Paperless Maverick application. The system provides complete observability stack deployment with Prometheus, Grafana, AlertManager, and comprehensive monitoring configurations.

## 📋 Overview

The monitoring setup automation system consists of several components:

1. **Main Monitoring Deployment Script** (`deploy-monitoring.sh`) - Core monitoring infrastructure orchestration
2. **Monitoring Validation Script** (`validate-monitoring.sh`) - Comprehensive validation of monitoring components
3. **Monitoring Manifests** (`../monitoring/kubernetes/monitoring-manifests.yaml`) - Additional monitoring resources
4. **Configuration Files** - Prometheus, Grafana, and AlertManager configurations

## 🚀 Quick Start

### Basic Monitoring Stack Deployment

```bash
# Full monitoring stack deployment
./deploy-monitoring.sh --environment production

# Deploy without AlertManager
./deploy-monitoring.sh --skip-alertmanager

# Dry run to validate deployment
./deploy-monitoring.sh --dry-run --validate-only

# Update existing monitoring stack
./deploy-monitoring.sh --update-existing
```

### Monitoring Validation

```bash
# Comprehensive monitoring validation
./validate-monitoring.sh

# Quick validation without connectivity checks
./validate-monitoring.sh --quick

# Deep validation with detailed checks
./validate-monitoring.sh --verbose --deep
```

## 🔧 Monitoring Deployment (`deploy-monitoring.sh`)

The main deployment script provides comprehensive monitoring infrastructure automation.

### Key Features

- **Complete Observability Stack** - Prometheus, Grafana, AlertManager deployment
- **Automated Configuration** - ConfigMaps and secrets management
- **Dashboard Import** - Automatic Grafana dashboard provisioning
- **Health Validation** - Post-deployment health checks and validation
- **RBAC Setup** - Proper service accounts and permissions
- **Persistent Storage** - Automated PVC creation for data persistence

### Monitoring Components

#### Prometheus Server
- **Metrics Collection** - Application and infrastructure metrics
- **Alert Rules** - Comprehensive alerting rules for embedding system
- **Service Discovery** - Kubernetes service discovery configuration
- **Data Retention** - 15-day retention with remote write capability

#### Grafana Dashboards
- **Production Overview** - System health and performance overview
- **Embedding Performance** - Deep dive into embedding processing metrics
- **Worker Health** - Worker status and resource monitoring
- **Custom Dashboards** - Application-specific monitoring dashboards

#### AlertManager
- **Alert Routing** - Intelligent alert routing and grouping
- **Notification Channels** - Slack, email, and PagerDuty integration
- **Alert Suppression** - Inhibition rules and alert deduplication
- **Escalation Policies** - Configurable alert escalation

### Command Line Options

```
-h, --help                  Show help message
-e, --environment ENV       Target environment (production, staging, development)
-n, --namespace NS          Application namespace (default: paperless-maverick)
-m, --monitoring-ns NS      Monitoring namespace (default: monitoring)
-d, --dry-run              Perform dry run without making changes
-v, --validate-only        Only validate configuration
-f, --force                Force deployment, skip safety checks
--verbose                  Enable verbose logging
--skip-prometheus          Skip Prometheus deployment
--skip-grafana             Skip Grafana deployment
--skip-alertmanager        Skip AlertManager deployment
--skip-dashboards          Skip dashboard import
--update-existing          Update existing monitoring components
```

### Usage Examples

```bash
# Production monitoring stack deployment
./deploy-monitoring.sh --environment production --verbose

# Deploy only Prometheus and Grafana
./deploy-monitoring.sh --skip-alertmanager --environment staging

# Update existing monitoring with new dashboards
./deploy-monitoring.sh --update-existing --skip-prometheus --skip-alertmanager

# Force deployment with verbose logging
./deploy-monitoring.sh --force --verbose --environment production

# Dry run validation
./deploy-monitoring.sh --dry-run --validate-only
```

## ✅ Monitoring Validation (`validate-monitoring.sh`)

Comprehensive validation of deployed monitoring infrastructure.

### Validation Categories

1. **Configuration Files** - Validates YAML/JSON syntax of all configuration files
2. **Prometheus Validation** - Deployment status, health endpoints, and target validation
3. **Grafana Validation** - Deployment status, health endpoints, and data source validation
4. **AlertManager Validation** - Deployment status and health endpoint validation
5. **Connectivity Validation** - Inter-component connectivity and service discovery

### Usage Examples

```bash
# Full monitoring validation
./validate-monitoring.sh --environment production

# Quick validation (skip connectivity checks)
./validate-monitoring.sh --quick --monitoring-ns monitoring

# Deep validation with detailed target and data source checks
./validate-monitoring.sh --deep --verbose

# Environment-specific validation
./validate-monitoring.sh --environment staging --namespace paperless-maverick-staging
```

### Command Line Options

```
-h, --help              Show help message
-n, --namespace NS      Application namespace (default: paperless-maverick)
-m, --monitoring-ns NS  Monitoring namespace (default: monitoring)
-e, --environment ENV   Target environment (default: production)
-v, --verbose           Enable verbose logging
-q, --quick             Quick validation (skip connectivity checks)
-d, --deep              Enable deep validation with detailed checks
```

## 📁 Directory Structure

```
infrastructure/production/
├── monitoring/
│   ├── prometheus/
│   │   ├── prometheus.yml              # Prometheus configuration
│   │   └── rules/
│   │       └── embedding-alerts.yml    # Alert rules
│   ├── grafana/
│   │   └── dashboards/
│   │       ├── production-overview-dashboard.json
│   │       ├── embedding-performance-dashboard.json
│   │       └── worker-health-dashboard.json
│   └── kubernetes/
│       └── monitoring-manifests.yaml   # Additional monitoring resources
└── scripts/
    ├── deploy-monitoring.sh            # Main deployment script
    ├── validate-monitoring.sh          # Validation script
    └── MONITORING_SETUP_README.md      # This documentation
```

## 🔄 Deployment Process

The monitoring deployment follows these phases:

1. **Prerequisites Validation** - Validate tools, connectivity, and configuration files
2. **Configuration Validation** - Validate Prometheus, Grafana, and AlertManager configs
3. **Namespace and RBAC Setup** - Create monitoring namespace and service accounts
4. **Component Deployment** - Deploy Prometheus, Grafana, and AlertManager
5. **Dashboard Import** - Import Grafana dashboards via API
6. **Health Validation** - Comprehensive health checks and connectivity validation

## 🔒 Security Features

### RBAC Configuration

1. **Service Accounts** - Dedicated service accounts for each component
2. **Cluster Roles** - Minimal required permissions for metrics collection
3. **Role Bindings** - Proper binding of roles to service accounts
4. **Network Policies** - Optional network policy enforcement

### Secrets Management

1. **Grafana Credentials** - Auto-generated admin password with secure storage
2. **AlertManager Secrets** - Webhook URLs and integration keys
3. **TLS Configuration** - Optional TLS configuration for secure communication

## 📊 Monitoring and Alerting

### Key Metrics Collected

- **Application Metrics** - Embedding processing rates, success rates, queue depth
- **Worker Metrics** - Worker health, resource utilization, job processing
- **Infrastructure Metrics** - CPU, memory, disk, network utilization
- **Kubernetes Metrics** - Pod status, deployment health, resource quotas

### Alert Categories

1. **Critical Alerts** - System down, high error rates, resource exhaustion
2. **Warning Alerts** - Performance degradation, high resource usage
3. **Info Alerts** - Deployment events, configuration changes

### Dashboard Features

- **Real-time Monitoring** - 15-second refresh intervals for critical metrics
- **Historical Analysis** - Time-series data with configurable time ranges
- **Custom Variables** - Environment and team filtering
- **Alert Integration** - Visual alert status and history

## ⚠️ Important Considerations

### Production Deployment

1. **Resource Requirements** - Ensure adequate cluster resources for monitoring stack
2. **Storage Planning** - Configure appropriate storage for metrics retention
3. **Network Configuration** - Ensure proper network connectivity between components
4. **Backup Strategy** - Regular backup of Grafana dashboards and configurations

### Performance Considerations

1. **Metrics Cardinality** - Monitor and control label cardinality
2. **Scrape Intervals** - Balance between data granularity and resource usage
3. **Retention Policies** - Configure appropriate data retention periods
4. **Query Optimization** - Use recording rules for frequently accessed metrics

## 🛠️ Troubleshooting

### Common Issues

1. **Component Not Starting** - Check resource limits and node capacity
2. **Missing Metrics** - Verify service discovery and target configuration
3. **Dashboard Not Loading** - Check Grafana data source configuration
4. **Alerts Not Firing** - Verify AlertManager configuration and routing rules

### Debug Commands

```bash
# Check monitoring namespace resources
kubectl get all -n monitoring

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
curl http://localhost:9090/api/v1/targets

# Check Grafana health
kubectl port-forward -n monitoring svc/grafana 3000:3000
curl http://localhost:3000/api/health

# Check AlertManager status
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
curl http://localhost:9093/api/v1/status
```

### Log Analysis

```bash
# Check deployment logs
kubectl logs -n monitoring deployment/prometheus
kubectl logs -n monitoring deployment/grafana
kubectl logs -n monitoring deployment/alertmanager

# Check validation logs
tail -f logs/monitoring/monitoring-validation-*.log
```

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Kubernetes Monitoring Best Practices](https://kubernetes.io/docs/concepts/cluster-administration/monitoring/)

## 🔗 Integration Points

### Application Integration

- **Metrics Endpoints** - Application exposes `/metrics` endpoint
- **Health Checks** - Integration with application health endpoints
- **Custom Metrics** - Application-specific business metrics

### CI/CD Integration

- **Deployment Validation** - Automated monitoring validation in CI/CD
- **Alert Testing** - Automated alert rule testing
- **Dashboard Updates** - Automated dashboard deployment

### External Systems

- **Slack Integration** - Alert notifications to Slack channels
- **PagerDuty Integration** - Critical alert escalation
- **Email Notifications** - Alert notifications via email
