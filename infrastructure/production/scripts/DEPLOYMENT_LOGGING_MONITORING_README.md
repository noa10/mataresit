# Deployment Logging and Monitoring System

This directory contains a comprehensive deployment logging and monitoring system for the Paperless Maverick application. The system provides deployment metrics, error tracking, performance monitoring, and audit trails with real-time monitoring capabilities and Prometheus integration.

## 📋 Overview

The deployment logging and monitoring system consists of several components:

1. **Deployment Logging Monitor** (`deployment-logging-monitor.sh`) - Core monitoring and metrics collection
2. **Monitoring Configuration** (`../config/deployment-monitoring-config.yaml`) - Comprehensive monitoring policies
3. **Grafana Dashboard** (`../monitoring/grafana/dashboards/deployment-monitoring-dashboard.json`) - Visual monitoring dashboard
4. **Prometheus Rules** - Recording and alerting rules for deployment metrics

## 🚀 Quick Start

### Basic Monitoring Operations

```bash
# Start continuous monitoring
./deployment-logging-monitor.sh --environment production --mode continuous

# One-shot metrics collection
./deployment-logging-monitor.sh --mode oneshot --verbose

# Generate report from existing data
./deployment-logging-monitor.sh --mode report --environment staging

# Custom monitoring interval
./deployment-logging-monitor.sh --mode continuous --interval 60 --verbose
```

### Advanced Monitoring Options

```bash
# Monitoring with custom configuration
./deployment-logging-monitor.sh \
  --environment production \
  --namespace paperless-maverick \
  --mode continuous \
  --interval 30 \
  --verbose

# Disable metrics export (for testing)
./deployment-logging-monitor.sh \
  --mode continuous \
  --no-metrics-export \
  --no-audit

# Dry run monitoring
./deployment-logging-monitor.sh --dry-run --mode oneshot
```

## 🔧 Deployment Logging Monitor (`deployment-logging-monitor.sh`)

The main monitoring script provides comprehensive deployment monitoring with metrics collection, error tracking, and audit trails.

### Key Features

- **Real-time Monitoring** - Continuous monitoring with configurable intervals
- **Comprehensive Metrics** - Kubernetes, health, performance, and resource metrics
- **Prometheus Integration** - Automatic metrics export to Prometheus Push Gateway
- **Error Tracking** - Automated error detection and pattern analysis
- **Audit Trails** - Comprehensive audit logging for compliance
- **Multiple Modes** - Continuous, one-shot, and report generation modes

### Monitoring Modes

#### Continuous Monitoring
- **Real-time Metrics** - Continuous collection with configurable intervals
- **Automatic Reporting** - Periodic report generation and cleanup
- **Event Detection** - Real-time deployment and error event detection
- **Prometheus Export** - Continuous metrics export for dashboards

#### One-shot Monitoring
- **Single Collection** - One-time metrics collection and analysis
- **Immediate Reporting** - Instant report generation
- **Quick Assessment** - Rapid deployment health assessment
- **Testing Mode** - Ideal for testing and validation

#### Report Mode
- **Historical Analysis** - Generate reports from existing data
- **Trend Analysis** - Analyze patterns and trends over time
- **Audit Reporting** - Comprehensive audit trail reports
- **Error Analysis** - Detailed error pattern analysis

### Metrics Collection

#### Kubernetes Metrics
- **Deployment Status** - Ready vs total deployments
- **Pod Health** - Running vs total pods
- **Service Availability** - Available services count
- **Resource Status** - ConfigMaps, secrets, and other resources

#### Health Metrics
- **Health Score** - Overall deployment health percentage
- **Endpoint Availability** - Health and readiness endpoint status
- **Response Times** - Average response times for health checks
- **Availability Tracking** - Endpoint availability over time

#### Performance Metrics
- **CPU Usage** - Average CPU utilization in millicores
- **Memory Usage** - Average memory utilization in MB
- **Resource Utilization** - Pod-level resource consumption
- **Performance Trends** - Historical performance data

#### Resource Metrics
- **Node Status** - Cluster node availability and health
- **Cluster Utilization** - Overall cluster CPU and memory usage
- **Namespace Resources** - Namespace-specific resource usage
- **Capacity Planning** - Resource capacity and utilization trends

### Command Line Options

```
-h, --help                  Show help message
-e, --environment ENV       Target environment (production, staging, development)
-n, --namespace NS          Kubernetes namespace (default: paperless-maverick)
-m, --mode MODE             Monitoring mode (continuous|oneshot|report)
-i, --interval SECONDS      Monitoring interval in seconds (default: 30)
--no-metrics-export         Disable metrics export to Prometheus
--no-audit                  Disable audit logging
-d, --dry-run              Perform dry run without making changes
-v, --verbose              Enable verbose logging
```

## 📊 Prometheus Integration

The monitoring system integrates seamlessly with Prometheus for metrics storage and alerting.

### Metrics Export

#### Deployment Metrics
- `deployment_ready_count` - Number of ready deployments
- `deployment_total_count` - Total number of deployments
- `pod_ready_count` - Number of ready pods
- `pod_total_count` - Total number of pods

#### Health Metrics
- `deployment_health_score` - Overall deployment health score (0-100)
- `deployment_endpoints_healthy` - Number of healthy endpoints
- `deployment_response_time_avg` - Average response time in milliseconds

#### Performance Metrics
- `deployment_cpu_usage` - CPU usage in millicores
- `deployment_memory_usage` - Memory usage in MB
- `cluster_cpu_usage` - Cluster CPU utilization percentage
- `cluster_memory_usage` - Cluster memory utilization percentage

#### Lifecycle Metrics
- `deployment_lifecycle_events_total` - Total deployment lifecycle events
- `deployment_errors_total` - Total deployment errors
- `deployment_audit_events_total` - Total audit events

### Recording Rules

The system creates Prometheus recording rules for efficient querying:

```yaml
# Deployment health recording rules
- record: deployment:health_score:avg
  expr: avg(deployment_health_score) by (environment, namespace)

- record: deployment:availability:ratio
  expr: deployment_ready_count / deployment_total_count

# Performance recording rules
- record: deployment:response_time:p95
  expr: histogram_quantile(0.95, rate(deployment_response_time_avg[5m]))

- record: deployment:cpu_utilization:avg
  expr: avg(deployment_cpu_usage) by (environment, namespace)
```

### Alerting Rules

Comprehensive alerting rules for deployment monitoring:

```yaml
# Critical deployment alerts
- alert: DeploymentDown
  expr: deployment:availability:ratio < 0.5
  for: 2m
  labels:
    severity: critical

- alert: DeploymentHealthDegraded
  expr: deployment:health_score:avg < 70
  for: 5m
  labels:
    severity: warning
```

## 📈 Grafana Dashboard

The deployment monitoring dashboard provides comprehensive visualization of deployment metrics.

### Dashboard Panels

#### Deployment Availability
- **Time Series** - Deployment and pod availability over time
- **Thresholds** - Visual indicators for availability levels
- **Multi-Environment** - Support for multiple environments

#### Health Score Gauge
- **Real-time Health** - Current deployment health score
- **Color Coding** - Red (0-70), Yellow (70-90), Green (90-100)
- **Threshold Indicators** - Visual threshold markers

#### Response Time Monitoring
- **Average Response Time** - Mean response time trends
- **P95 Response Time** - 95th percentile response time
- **Performance Trends** - Historical performance data

#### Resource Usage
- **CPU Usage** - CPU utilization in millicores
- **Memory Usage** - Memory utilization in MB
- **Resource Trends** - Historical resource consumption

#### Status Distribution
- **Pie Chart** - Ready vs not ready deployments
- **Visual Distribution** - Clear status visualization
- **Real-time Updates** - Live status updates

#### Error and Audit Rates
- **Error Rate** - Rate of deployment errors
- **Audit Events** - Rate of audit events
- **Trend Analysis** - Error and audit trends

### Dashboard Variables

- **Environment** - Filter by environment (production, staging, development)
- **Namespace** - Filter by Kubernetes namespace
- **Auto-refresh** - 30-second refresh interval

## 🔍 Audit Trail and Error Tracking

### Audit Trail Features

#### Comprehensive Logging
- **Deployment Lifecycle** - All deployment events and state changes
- **User Actions** - User-initiated actions and commands
- **System Events** - Automated system events and triggers
- **Configuration Changes** - Configuration and policy changes

#### Audit Metadata
- **Session Information** - Unique session IDs and tracking
- **User Context** - User identification and authentication
- **Environment Context** - Environment and namespace information
- **Timestamp Tracking** - Precise timestamp information

#### Compliance Support
- **Structured Logging** - JSON-formatted audit logs
- **Retention Policies** - Configurable retention periods
- **Access Control** - RBAC-based audit access
- **Encryption Support** - Optional audit log encryption

### Error Tracking Features

#### Error Detection
- **Real-time Detection** - Immediate error event detection
- **Pattern Recognition** - Automated error pattern analysis
- **Categorization** - Error classification and categorization
- **Correlation Analysis** - Error correlation and root cause analysis

#### Error Analysis
- **Trend Analysis** - Error frequency and trend analysis
- **Impact Assessment** - Error impact on deployment health
- **Root Cause Analysis** - Automated root cause identification
- **Resolution Tracking** - Error resolution and follow-up

## 📁 Directory Structure

```
infrastructure/production/
├── config/
│   └── deployment-monitoring-config.yaml    # Monitoring configuration
├── scripts/
│   ├── deployment-logging-monitor.sh        # Main monitoring script
│   └── DEPLOYMENT_LOGGING_MONITORING_README.md  # This documentation
├── monitoring/
│   ├── grafana/
│   │   └── dashboards/
│   │       └── deployment-monitoring-dashboard.json  # Grafana dashboard
│   └── prometheus/
│       └── rules/
│           └── deployment-monitoring-rules.yml       # Prometheus rules
├── logs/
│   └── deployment/                           # Deployment logs
├── metrics/
│   └── deployment/                           # Metrics data
└── audit/
    └── deployment/                           # Audit logs
```

## ⚙️ Configuration

### Environment-Specific Settings

#### Production Configuration
- **Continuous Monitoring** - 24/7 monitoring with 30-second intervals
- **Full Metrics Export** - Complete metrics export to Prometheus
- **Comprehensive Audit** - Full audit logging with 365-day retention
- **Strict Thresholds** - Production-grade alerting thresholds

#### Staging Configuration
- **Regular Monitoring** - Monitoring with 60-second intervals
- **Selective Metrics** - Essential metrics export only
- **Standard Audit** - Standard audit logging with 90-day retention
- **Moderate Thresholds** - Staging-appropriate alerting thresholds

#### Development Configuration
- **Minimal Monitoring** - Basic monitoring with 120-second intervals
- **Local Metrics** - Local metrics collection only
- **Basic Audit** - Basic audit logging with 30-day retention
- **Relaxed Thresholds** - Development-friendly alerting thresholds

### Monitoring Intervals

- **Metrics Collection** - 30 seconds (production), 60 seconds (staging)
- **Health Checks** - 15 seconds (production), 30 seconds (staging)
- **Performance Checks** - 60 seconds (production), 120 seconds (staging)
- **Audit Events** - 10 seconds (production), 30 seconds (staging)

### Retention Policies

- **Metrics Retention** - 30 days (production), 14 days (staging)
- **Log Retention** - 90 days (production), 30 days (staging)
- **Audit Retention** - 365 days (production), 90 days (staging)
- **Error Log Retention** - 180 days (production), 60 days (staging)

## 🚨 Alerting and Notifications

### Alert Thresholds

#### Production Thresholds
- **Deployment Availability Critical** - < 50%
- **Deployment Availability Warning** - < 80%
- **Health Score Critical** - < 50
- **Health Score Warning** - < 70
- **Response Time Critical** - > 5000ms
- **Response Time Warning** - > 2000ms

#### Staging Thresholds
- **Deployment Availability Critical** - < 30%
- **Deployment Availability Warning** - < 60%
- **Health Score Critical** - < 40
- **Health Score Warning** - < 60
- **Response Time Critical** - > 8000ms
- **Response Time Warning** - > 4000ms

### Notification Channels

- **Prometheus Alerts** - Integration with AlertManager
- **Slack Notifications** - Real-time Slack alerts (configurable)
- **Email Notifications** - Email alerts for critical issues (configurable)
- **PagerDuty Integration** - PagerDuty alerts for production (configurable)

## 🛠️ Troubleshooting

### Common Issues

1. **Metrics Export Failures** - Check Prometheus Push Gateway connectivity
2. **High Resource Usage** - Adjust monitoring intervals and retention policies
3. **Missing Metrics** - Verify Kubernetes RBAC permissions
4. **Dashboard Issues** - Check Grafana data source configuration

### Debug Commands

```bash
# Check monitoring system health
./deployment-logging-monitor.sh --mode oneshot --verbose

# Test Prometheus connectivity
curl -s http://prometheus-pushgateway:9091/metrics

# Check Kubernetes permissions
kubectl auth can-i get deployments --namespace paperless-maverick

# Verify log files
tail -f logs/deployment/deployment-monitor-*.log
```

### Log Analysis

```bash
# Check deployment logs
tail -f logs/deployment/deployment-monitor-*.log

# Review error logs
grep "ERROR" logs/deployment/deployment-errors-*.log

# Analyze audit logs
jq '.' audit/deployment/audit-trail-*.json

# Check metrics data
jq '.' metrics/deployment/deployment-metrics-*.json
```

## 📚 Additional Resources

- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Kubernetes Monitoring](https://kubernetes.io/docs/tasks/debug-application-cluster/resource-usage-monitoring/)
- [Deployment Best Practices](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
