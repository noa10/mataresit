# Paperless Maverick Deployment Automation

This directory contains comprehensive deployment automation scripts for the Paperless Maverick application. These scripts provide a robust, production-grade deployment system with validation, monitoring, rollback capabilities, and feature flag management.

## 📋 Overview

The deployment automation system consists of several components:

1. **Master Deployment Script** (`master-deploy.sh`) - Core orchestration script that manages the entire deployment process
2. **Deployment Wrapper** (`deploy-wrapper.sh`) - Simplified interface for common deployment scenarios
3. **Deployment Status Tracker** (`deployment-status.sh`) - Real-time status monitoring for deployments
4. **Configuration Files** (`../config/deployment-config.yaml`) - Centralized configuration for deployment settings

## 🚀 Quick Start

For most deployment scenarios, use the deployment wrapper script:

```bash
# Deploy to production
./deploy-wrapper.sh production v1.2.3

# Deploy to staging
./deploy-wrapper.sh staging

# Update feature flags
./deploy-wrapper.sh feature-flags --embedding-rollout 25

# Check deployment status
./deploy-wrapper.sh status --watch

# Rollback deployment
./deploy-wrapper.sh rollback
```

To see all available deployment scenarios:

```bash
./deploy-wrapper.sh scenarios
```

## 🔧 Deployment Scenarios

The deployment automation system supports the following scenarios:

### Production Deployment

Full production deployment with all safety checks:

```bash
./deploy-wrapper.sh production v1.2.3
```

This will:
- Validate prerequisites and environment
- Create a deployment backup
- Deploy infrastructure components
- Apply database migrations
- Deploy the application with the specified image tag
- Configure feature flags
- Set up monitoring
- Validate the deployment

### Staging Deployment

Deploy to the staging environment for testing:

```bash
./deploy-wrapper.sh staging v1.2.3
```

### Hotfix Deployment

Emergency deployment with minimal checks:

```bash
./deploy-wrapper.sh hotfix v1.2.4-hotfix
```

### Feature Flag Updates

Update only feature flag configurations:

```bash
./deploy-wrapper.sh feature-flags --embedding-rollout 25 --queue-rollout 10 --batch-rollout 5
```

### Monitoring Updates

Update only monitoring infrastructure:

```bash
./deploy-wrapper.sh monitoring
```

### Validation Only

Validate deployment configuration without deploying:

```bash
./deploy-wrapper.sh validate
```

### Rollback

Rollback to previous deployment:

```bash
./deploy-wrapper.sh rollback
```

### Status Check

Check current deployment status:

```bash
./deploy-wrapper.sh status
./deploy-wrapper.sh status --watch  # Real-time monitoring
```

### Dry Run

Simulate deployment without making changes:

```bash
./deploy-wrapper.sh dry-run production v1.2.3
```

## 🛠️ Advanced Usage

For more advanced deployment scenarios, you can use the master deployment script directly:

```bash
./master-deploy.sh --environment production --image-tag v1.2.3 --staged
```

### Available Options

```
OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: production)
    -n, --namespace NS          Kubernetes namespace (default: paperless-maverick)
    -t, --image-tag TAG         Docker image tag (default: latest)
    -d, --dry-run              Perform dry run without making changes
    -v, --validate-only        Only validate the deployment configuration
    -r, --rollback             Rollback to previous deployment
    -s, --skip-tests           Skip post-deployment tests
    -f, --force                Force deployment, skip rollback on failure
    --verbose                  Enable verbose logging
    --staged                   Staged deployment with manual approval
    --feature-flags-only       Deploy only feature flag changes
    --monitoring-only          Deploy only monitoring changes
    --embedding-rollout PCT    Embedding monitoring rollout percentage (0-100)
    --queue-rollout PCT        Queue processing rollout percentage (0-100)
    --batch-rollout PCT        Batch optimization rollout percentage (0-100)
```

## 📊 Deployment Status Tracking

The deployment status tracker provides real-time monitoring of deployment progress:

```bash
./deployment-status.sh --watch
```

### Available Options

```
OPTIONS:
    -h, --help              Show this help message
    -e, --environment ENV   Target environment (default: production)
    -n, --namespace NS      Kubernetes namespace (default: paperless-maverick)
    -w, --watch             Watch mode - continuously update status
    -i, --interval SEC      Refresh interval for watch mode (default: 5)
    -f, --format FORMAT     Output format: table, json (default: table)
    -l, --log-file FILE     Specific log file to parse
```

## 📁 Directory Structure

```
infrastructure/production/
├── config/
│   └── deployment-config.yaml    # Deployment configuration
├── kubernetes/                   # Kubernetes manifests
├── scripts/
│   ├── master-deploy.sh          # Master deployment script
│   ├── deploy-wrapper.sh         # Deployment wrapper
│   ├── deployment-status.sh      # Status tracking
│   └── README.md                 # This documentation
└── env/
    └── .env.production           # Environment variables
```

## 🔄 Deployment Process

The deployment process follows these phases:

1. **Prerequisites Check** - Validate required tools and connectivity
2. **Environment Validation** - Validate environment configuration
3. **Backup Creation** - Create deployment backup
4. **Infrastructure Deployment** - Deploy Kubernetes resources
5. **Database Migration** - Apply database migrations
6. **Application Deployment** - Deploy application containers
7. **Feature Flag Deployment** - Configure feature flags
8. **Monitoring Deployment** - Set up monitoring infrastructure
9. **Deployment Validation** - Validate deployment success
10. **Performance Validation** - Validate performance metrics

## 🔒 Safety Features

The deployment automation includes several safety features:

- **Dry Run Mode** - Simulate deployment without making changes
- **Validation Checks** - Comprehensive validation before deployment
- **Automatic Rollback** - Rollback on deployment failure
- **Backup Creation** - Automatic backup before deployment
- **Staged Deployment** - Manual approval between deployment phases
- **Audit Logging** - Comprehensive audit trail of all deployment actions

## 📝 Logging and Monitoring

Deployment logs are stored in the following locations:

- **Deployment Logs**: `logs/deployment/deployment-*.log`
- **Audit Logs**: `logs/deployment/audit-*.log`
- **Status File**: `logs/deployment/deployment-status.json`

## 🚨 Troubleshooting

### Common Issues

1. **Deployment Fails at Infrastructure Phase**
   - Check Kubernetes connectivity
   - Verify namespace exists
   - Check manifest files for errors

2. **Deployment Fails at Database Migration**
   - Check database connectivity
   - Verify migration scripts
   - Check for migration conflicts

3. **Deployment Fails at Validation**
   - Check application logs
   - Verify health check endpoints
   - Check for resource constraints

### Manual Rollback

If automatic rollback fails, you can manually rollback:

```bash
./deploy-wrapper.sh rollback
```

## 🔍 Deployment Verification

After deployment, verify the following:

1. **Application Health**
   ```bash
   kubectl get pods -n paperless-maverick
   kubectl logs deployment/paperless-maverick -n paperless-maverick
   ```

2. **Worker Health**
   ```bash
   kubectl get pods -n paperless-maverick -l app=embedding-queue-worker
   kubectl logs deployment/embedding-queue-workers -n paperless-maverick
   ```

3. **Monitoring**
   ```bash
   kubectl get pods -n paperless-maverick -l app=prometheus
   kubectl get pods -n paperless-maverick -l app=grafana
   ```

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Deployment Best Practices](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Feature Flag Management](https://martinfowler.com/articles/feature-toggles.html)
