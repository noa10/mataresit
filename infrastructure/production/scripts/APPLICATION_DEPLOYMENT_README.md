# Application Deployment Automation

This directory contains comprehensive application deployment automation scripts for the Paperless Maverick application. The system provides robust deployment management with multiple deployment strategies, health checks, rollback procedures, and performance validation.

## 📋 Overview

The application deployment automation system consists of several components:

1. **Main Deployment Script** (`deploy-application.sh`) - Core application deployment orchestration
2. **Health Validation** (`validate-deployment-health.sh`) - Comprehensive health checks and validation
3. **Performance Validation** (`validate-performance.sh`) - Performance testing and validation
4. **Deployment Strategies Configuration** (`../config/deployment-strategies.yaml`) - Strategy definitions and settings

## 🚀 Quick Start

### Basic Application Deployment

```bash
# Rolling update deployment (default)
./deploy-application.sh --image-tag v1.2.3

# Blue-green deployment
./deploy-application.sh --blue-green --image-tag v1.2.3

# Canary deployment
./deploy-application.sh --canary --image-tag v1.2.3

# Dry run to validate deployment
./deploy-application.sh --dry-run --validate-only --image-tag v1.2.3
```

### Health and Performance Validation

```bash
# Comprehensive health validation
./validate-deployment-health.sh

# Performance validation with load testing
./validate-performance.sh --load-test

# Quick health check
./validate-deployment-health.sh --quick
```

## 🔧 Application Deployment (`deploy-application.sh`)

The main deployment script provides comprehensive application deployment automation with multiple strategies.

### Key Features

- **Multiple Deployment Strategies** - Rolling update, blue-green, and canary deployments
- **Comprehensive Health Checks** - Readiness, liveness, and performance validation
- **Automatic Rollback** - Rollback on deployment failure with configurable triggers
- **Image Validation** - Validates container image availability before deployment
- **Performance Monitoring** - Resource utilization and response time monitoring
- **Audit Logging** - Complete audit trail of deployment activities

### Deployment Strategies

#### Rolling Update (Default)
```bash
./deploy-application.sh --image-tag v1.2.3
```
- Zero-downtime deployment with gradual pod replacement
- Configurable surge and unavailable pod limits
- Automatic rollback on failure

#### Blue-Green Deployment
```bash
./deploy-application.sh --blue-green --image-tag v1.2.3
```
- Creates parallel deployment environment
- Switches traffic after validation
- Instant rollback capability

#### Canary Deployment
```bash
./deploy-application.sh --canary --image-tag v1.2.3
```
- Gradual traffic rollout (10% initially)
- Continuous monitoring and validation
- Automatic promotion or rollback based on metrics

### Command Line Options

```
-h, --help                  Show help message
-e, --environment ENV       Target environment (production, staging, development)
-n, --namespace NS          Kubernetes namespace (default: paperless-maverick)
-t, --image-tag TAG         Application image tag (default: latest)
-w, --worker-tag TAG        Worker image tag (default: latest)
-s, --strategy STRATEGY     Deployment strategy (rolling|blue-green|canary)
-d, --dry-run              Perform dry run without making changes
-v, --validate-only        Only validate configuration and images
-f, --force                Force deployment, skip safety checks
--verbose                  Enable verbose logging
--blue-green               Use blue-green deployment strategy
--canary                   Use canary deployment strategy
--skip-health-checks       Skip post-deployment health checks
--no-rollback              Disable automatic rollback on failure
--rollback                 Rollback to previous deployment
```

### Usage Examples

```bash
# Production deployment with blue-green strategy
./deploy-application.sh --environment production --blue-green --image-tag v1.2.3

# Canary deployment with custom worker image
./deploy-application.sh --canary --image-tag v1.2.3 --worker-tag v1.2.3-worker

# Force deployment without health checks
./deploy-application.sh --force --skip-health-checks --image-tag v1.2.4

# Emergency rollback
./deploy-application.sh --rollback

# Dry run validation
./deploy-application.sh --dry-run --validate-only --image-tag v1.2.3
```

## ✅ Health Validation (`validate-deployment-health.sh`)

Comprehensive health validation of deployed applications.

### Health Check Categories

1. **Deployment Status** - Validates deployment readiness and replica counts
2. **Pod Health** - Checks individual pod status, readiness, and restart counts
3. **Health Endpoints** - Tests application health and readiness endpoints
4. **Resource Utilization** - Monitors CPU and memory usage
5. **Service Connectivity** - Validates service and ingress configuration
6. **Database Connectivity** - Tests database connection through application

### Usage Examples

```bash
# Full health validation
./validate-deployment-health.sh --environment production

# Quick health check (skip performance and DB checks)
./validate-deployment-health.sh --quick

# Verbose validation with deep checks
./validate-deployment-health.sh --verbose --deep

# Environment-specific validation
./validate-deployment-health.sh --environment staging --namespace paperless-maverick-staging
```

### Command Line Options

```
-h, --help              Show help message
-n, --namespace NS      Kubernetes namespace (default: paperless-maverick)
-e, --environment ENV   Target environment (default: production)
-v, --verbose           Enable verbose logging
-q, --quick             Quick health check (skip performance and DB checks)
-p, --no-performance    Skip performance checks
-d, --deep              Enable deep health checks
```

## 🚀 Performance Validation (`validate-performance.sh`)

Comprehensive performance testing and validation of deployed applications.

### Performance Test Categories

1. **Response Time Testing** - Measures API response times and latency
2. **Throughput Testing** - Tests requests per second and concurrent load handling
3. **Resource Utilization** - Monitors CPU and memory usage under load
4. **Database Performance** - Tests database query performance

### Performance Thresholds

- **Response Time P95**: 2000ms
- **Minimum RPS**: 10 requests/second
- **Maximum Error Rate**: 5%
- **CPU Threshold**: 80%
- **Memory Threshold**: 85%

### Usage Examples

```bash
# Basic performance validation
./validate-performance.sh --environment production

# Performance validation with load testing
./validate-performance.sh --load-test

# Comprehensive benchmarking
./validate-performance.sh --benchmark --verbose

# Dry run performance validation
./validate-performance.sh --dry-run --load-test
```

### Command Line Options

```
-h, --help              Show help message
-n, --namespace NS      Kubernetes namespace (default: paperless-maverick)
-e, --environment ENV   Target environment (default: production)
-d, --dry-run           Perform dry run without executing tests
-v, --verbose           Enable verbose logging
-l, --load-test         Enable load testing (throughput tests)
-b, --benchmark         Enable comprehensive benchmarking
```

## 📁 Directory Structure

```
infrastructure/production/
├── config/
│   └── deployment-strategies.yaml   # Deployment strategy configurations
├── scripts/
│   ├── deploy-application.sh        # Main deployment script
│   ├── validate-deployment-health.sh # Health validation script
│   ├── validate-performance.sh      # Performance validation script
│   └── APPLICATION_DEPLOYMENT_README.md # This documentation
└── logs/
    └── deployment/                  # Deployment logs and reports
```

## 🔄 Deployment Process

The application deployment follows these phases:

1. **Prerequisites Validation** - Validate tools, connectivity, and prerequisites
2. **Image Validation** - Verify container image availability
3. **Pre-deployment Backup** - Record current deployment state
4. **Strategy Execution** - Execute selected deployment strategy
5. **Health Validation** - Comprehensive health checks
6. **Performance Validation** - Performance testing (if enabled)
7. **Rollback (if needed)** - Automatic rollback on failure

## 🔒 Safety Features

### Deployment Protections

1. **Image Validation** - Ensures container images exist before deployment
2. **Health Checks** - Comprehensive validation of application health
3. **Automatic Rollback** - Rollback on deployment failure
4. **Dry Run Mode** - Validate deployment without making changes
5. **Force Flags** - Explicit confirmation for risky operations

### Rollback Capabilities

1. **Automatic Rollback** - Triggered by health check failures
2. **Manual Rollback** - User-initiated rollback to previous version
3. **Rollback Validation** - Validates rollback success
4. **History Preservation** - Maintains deployment history for rollback

## 📊 Monitoring and Logging

### Log Files

- **Deployment Logs** - `logs/deployment/app-deployment-*.log`
- **Health Validation Logs** - `logs/deployment/health-validation-*.log`
- **Performance Logs** - `logs/deployment/performance-validation-*.log`
- **Audit Logs** - `logs/deployment/app-deployment-audit-*.log`

### Reports

- **Health Reports** - `logs/deployment/health-report-*.json`
- **Performance Reports** - `logs/deployment/performance-report-*.json`

## ⚠️ Important Considerations

### Production Deployment

1. **Image Validation** - Always validate images before production deployment
2. **Health Checks** - Never skip health checks in production
3. **Rollback Plan** - Have tested rollback procedures ready
4. **Team Coordination** - Coordinate with team before production deployments
5. **Monitoring** - Monitor deployment progress and application health

### Performance Considerations

1. **Load Testing** - Test performance under expected load
2. **Resource Limits** - Ensure proper resource limits are configured
3. **Database Performance** - Monitor database performance during deployment
4. **Scaling** - Consider auto-scaling configuration for traffic spikes

## 🛠️ Troubleshooting

### Common Issues

1. **Image Pull Errors** - Check image availability and registry access
2. **Health Check Failures** - Verify application health endpoints
3. **Resource Constraints** - Check CPU and memory limits
4. **Network Issues** - Verify service and ingress configuration

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
./deploy-application.sh --verbose --dry-run
./validate-deployment-health.sh --verbose
./validate-performance.sh --verbose
```

## 📚 Additional Resources

- [Kubernetes Deployment Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Blue-Green Deployment Patterns](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Canary Deployment Strategies](https://martinfowler.com/bliki/CanaryRelease.html)
- [Application Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
