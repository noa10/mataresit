# Master Deployment Guide

This guide provides comprehensive procedures for deploying the Paperless Maverick (Mataresit) application to production environments.

## 📋 Overview

The deployment system uses a multi-phase approach with automated validation, monitoring, and rollback capabilities. All deployments are orchestrated through the master deployment controller with comprehensive logging and audit trails.

## 🚀 Deployment Architecture

### Deployment Phases
1. **Pre-deployment Validation** - Environment and dependency checks
2. **Infrastructure Deployment** - Kubernetes resources and configuration
3. **Database Migration** - Schema updates and data migrations
4. **Application Deployment** - Application code and worker deployments
5. **Feature Flag Deployment** - Feature configuration updates
6. **Monitoring Deployment** - Monitoring and alerting setup
7. **Post-deployment Validation** - Health checks and performance validation

### Deployment Strategies
- **Rolling Update** - Zero-downtime gradual replacement (default)
- **Blue-Green** - Complete environment switch with instant rollback
- **Canary** - Gradual traffic shifting with monitoring

## 🔧 Prerequisites

### Required Tools
```bash
# Install required tools
kubectl version --client  # Kubernetes CLI
helm version              # Helm package manager
docker version           # Docker container runtime
jq --version             # JSON processor
curl --version           # HTTP client
```

### Environment Setup
```bash
# Set environment variables
export ENVIRONMENT="production"
export NAMESPACE="paperless-maverick"
export IMAGE_TAG="v1.2.3"
export DEPLOYMENT_STRATEGY="rolling"

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Access Requirements
- **Kubernetes Cluster Access** - Admin permissions for target namespace
- **Container Registry Access** - Pull permissions for application images
- **Database Access** - Migration execution permissions
- **Monitoring Access** - Prometheus and Grafana configuration access

## 📝 Pre-Deployment Checklist

### Code and Build Verification
- [ ] All tests passing in CI/CD pipeline
- [ ] Code review completed and approved
- [ ] Security scan completed without critical issues
- [ ] Performance benchmarks within acceptable limits
- [ ] Documentation updated for new features

### Infrastructure Verification
- [ ] Kubernetes cluster healthy and accessible
- [ ] Sufficient cluster resources available
- [ ] Database connectivity verified
- [ ] External service dependencies available
- [ ] Monitoring systems operational

### Configuration Verification
- [ ] Environment variables configured
- [ ] Secrets and certificates up to date
- [ ] Feature flags configured appropriately
- [ ] Rate limiting and security policies updated
- [ ] Backup systems operational

## 🚀 Deployment Procedures

### Standard Production Deployment

#### 1. Initiate Deployment
```bash
# Navigate to deployment directory
cd infrastructure/production/scripts

# Execute master deployment with staging
./master-deploy.sh \
  --environment production \
  --image-tag v1.2.3 \
  --strategy rolling \
  --staged \
  --validate-before \
  --validate-after
```

#### 2. Monitor Deployment Progress
```bash
# Watch deployment status
kubectl get deployments -n paperless-maverick -w

# Monitor pod rollout
kubectl rollout status deployment/paperless-maverick -n paperless-maverick

# Check application logs
kubectl logs -f deployment/paperless-maverick -n paperless-maverick
```

#### 3. Validate Deployment Success
```bash
# Run validation framework
./deployment-validation-framework.sh \
  --environment production \
  --comprehensive \
  --generate-report

# Check health endpoints
curl -f https://api.mataresit.com/health
curl -f https://api.mataresit.com/ready
```

### Emergency Deployment

#### Hot Fix Deployment
```bash
# For critical production issues
./master-deploy.sh \
  --environment production \
  --image-tag hotfix-v1.2.4 \
  --strategy rolling \
  --skip-staging \
  --emergency
```

#### Rollback Deployment
```bash
# Immediate rollback to previous version
./rollback-automation.sh \
  --environment production \
  --target-version v1.2.2 \
  --immediate \
  --validate-after
```

## 📊 Monitoring During Deployment

### Key Metrics to Watch
```bash
# Application metrics
kubectl top pods -n paperless-maverick

# Resource utilization
kubectl describe nodes

# Error rates
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])"
```

### Health Check Commands
```bash
# Kubernetes health
kubectl get pods -n paperless-maverick
kubectl get services -n paperless-maverick
kubectl get ingress -n paperless-maverick

# Application health
curl -f https://api.mataresit.com/health/live
curl -f https://api.mataresit.com/health/ready
curl -f https://api.mataresit.com/metrics
```

### Log Monitoring
```bash
# Application logs
kubectl logs -f deployment/paperless-maverick -n paperless-maverick --tail=100

# Worker logs
kubectl logs -f deployment/embedding-queue-workers -n paperless-maverick --tail=100

# Ingress logs
kubectl logs -f -n ingress-nginx deployment/ingress-nginx-controller
```

## 🔄 Staged Deployment Process

### Phase 1: Infrastructure Preparation
```bash
# Deploy infrastructure components
./deploy-infrastructure.sh --environment production --validate

# Verify infrastructure health
kubectl get all -n paperless-maverick
```

### Phase 2: Database Migration
```bash
# Execute database migrations
./migrate-database.sh --environment production --backup --validate

# Verify migration success
./validate-database-migration.sh --environment production
```

### Phase 3: Application Deployment
```bash
# Deploy application with health checks
./deploy-application.sh --environment production --strategy rolling --health-check

# Monitor deployment progress
watch kubectl get pods -n paperless-maverick
```

### Phase 4: Post-Deployment Validation
```bash
# Comprehensive validation
./deployment-validation-framework.sh --environment production --full-suite

# Performance validation
./validate-performance.sh --environment production --baseline
```

## ⚠️ Failure Handling

### Automatic Rollback Triggers
- Health check failures for more than 5 minutes
- Error rate exceeding 5% for more than 2 minutes
- Response time degradation beyond 200% of baseline
- Critical security alerts during deployment

### Manual Rollback Process
```bash
# Check rollback options
./rollback-automation.sh --list-versions --environment production

# Execute rollback
./rollback-automation.sh \
  --environment production \
  --target-version v1.2.2 \
  --reason "Performance degradation" \
  --validate-after
```

### Incident Response
1. **Immediate**: Stop deployment if in progress
2. **Assess**: Determine impact and root cause
3. **Communicate**: Notify stakeholders via Slack/email
4. **Resolve**: Execute rollback or hotfix as appropriate
5. **Document**: Create incident report and lessons learned

## 📋 Post-Deployment Tasks

### Verification Steps
- [ ] All services responding to health checks
- [ ] Application functionality verified through smoke tests
- [ ] Performance metrics within acceptable ranges
- [ ] Error rates below threshold levels
- [ ] Monitoring and alerting operational

### Documentation Updates
- [ ] Deployment log archived
- [ ] Configuration changes documented
- [ ] Known issues and workarounds updated
- [ ] Runbook updates if procedures changed
- [ ] Team notification of successful deployment

### Cleanup Tasks
- [ ] Old container images cleaned up
- [ ] Temporary deployment artifacts removed
- [ ] Log files rotated and archived
- [ ] Monitoring data retention policies applied
- [ ] Security scan results archived

## 📞 Support and Escalation

### During Deployment Hours (9 AM - 6 PM UTC)
- **Primary Contact**: deployment-team@mataresit.com
- **Slack Channel**: #deployment-support
- **Response Time**: 15 minutes

### After Hours Emergency
- **Emergency Hotline**: +1-XXX-XXX-XXXX
- **PagerDuty**: deployment-emergency
- **Escalation**: CTO and VP Engineering

## 📚 Additional Resources

- [Production Deployment Checklist](./production-deployment-checklist.md)
- [Emergency Procedures](./emergency-procedures.md)
- [Rollback Procedures](./rollback-procedures.md)
- [Troubleshooting Guide](./troubleshooting-common-issues.md)
- [Configuration Reference](./configuration-reference.md)

---

**Last Updated**: 2025-01-21  
**Version**: 1.0.0  
**Next Review**: 2025-02-21
