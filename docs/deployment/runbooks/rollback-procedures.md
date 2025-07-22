# Rollback Procedures

This document provides comprehensive procedures for rolling back deployments in the Paperless Maverick production environment. These procedures ensure rapid recovery from failed deployments while maintaining data integrity.

## 📋 Overview

### Rollback Types
- **Automatic Rollback** - Triggered by monitoring systems detecting failures
- **Manual Rollback** - Initiated by operations team due to identified issues
- **Emergency Rollback** - Immediate rollback for critical production issues
- **Partial Rollback** - Rolling back specific components while maintaining others

### Rollback Triggers
- Health check failures exceeding threshold (5 minutes)
- Error rate above 5% for more than 2 minutes
- Response time degradation beyond 200% of baseline
- Critical security vulnerabilities detected
- Data corruption or integrity issues
- Manual intervention due to business impact

## 🔄 Rollback Decision Matrix

### Automatic Rollback Conditions
```yaml
triggers:
  health_check_failure:
    threshold: 5_minutes
    action: automatic_rollback
  
  error_rate_spike:
    threshold: 5_percent
    duration: 2_minutes
    action: automatic_rollback
  
  response_time_degradation:
    threshold: 200_percent_of_baseline
    duration: 3_minutes
    action: automatic_rollback
  
  memory_leak_detection:
    threshold: 90_percent_memory_usage
    duration: 5_minutes
    action: automatic_rollback
```

### Manual Rollback Scenarios
- Business functionality regression
- User experience degradation
- Performance issues not meeting SLA
- Integration failures with external services
- Data inconsistency issues

## 🚀 Rollback Procedures

### 1. Emergency Rollback (Immediate)

#### For Critical Production Issues
```bash
# Immediate rollback to last known good version
cd infrastructure/production/scripts

# Execute emergency rollback
./rollback-automation.sh \
  --environment production \
  --immediate \
  --reason "Critical production issue" \
  --skip-validation
```

#### Verify Rollback Success
```bash
# Check deployment status
kubectl rollout status deployment/paperless-maverick -n paperless-maverick
kubectl rollout status deployment/embedding-queue-workers -n paperless-maverick

# Verify application health
curl -f https://api.mataresit.com/health/live
curl -f https://api.mataresit.com/health/ready
```

### 2. Standard Rollback (Validated)

#### Pre-Rollback Assessment
```bash
# List available rollback versions
./rollback-automation.sh --list-versions --environment production

# Check current deployment status
kubectl get deployments -n paperless-maverick
kubectl describe deployment paperless-maverick -n paperless-maverick
```

#### Execute Standard Rollback
```bash
# Rollback to specific version with validation
./rollback-automation.sh \
  --environment production \
  --target-version v1.2.2 \
  --reason "Performance regression in v1.2.3" \
  --validate-before \
  --validate-after \
  --create-backup
```

#### Monitor Rollback Progress
```bash
# Watch rollback progress
kubectl get pods -n paperless-maverick -w

# Monitor application logs
kubectl logs -f deployment/paperless-maverick -n paperless-maverick --tail=100

# Check rollback status
kubectl rollout history deployment/paperless-maverick -n paperless-maverick
```

### 3. Database Rollback

#### Database Schema Rollback
```bash
# Create database backup before rollback
./backup-database.sh --environment production --pre-rollback

# Execute database rollback
./rollback-database.sh \
  --environment production \
  --target-migration 20250120120000 \
  --validate-before \
  --validate-after
```

#### Data Migration Rollback
```bash
# Rollback data migrations if needed
./rollback-data-migration.sh \
  --environment production \
  --migration-id embedding_enhancement_v2 \
  --preserve-new-data \
  --validate-integrity
```

### 4. Partial Component Rollback

#### Application-Only Rollback
```bash
# Rollback only application, keep workers at current version
kubectl rollout undo deployment/paperless-maverick -n paperless-maverick --to-revision=2

# Verify application rollback
kubectl rollout status deployment/paperless-maverick -n paperless-maverick
```

#### Worker-Only Rollback
```bash
# Rollback only workers, keep application at current version
kubectl rollout undo deployment/embedding-queue-workers -n paperless-maverick --to-revision=1

# Verify worker rollback
kubectl rollout status deployment/embedding-queue-workers -n paperless-maverick
```

#### Configuration Rollback
```bash
# Rollback configuration changes
kubectl apply -f infrastructure/production/kubernetes/configmap-v1.2.2.yaml
kubectl apply -f infrastructure/production/kubernetes/secrets-v1.2.2.yaml

# Restart deployments to pick up configuration changes
kubectl rollout restart deployment/paperless-maverick -n paperless-maverick
```

## 📊 Rollback Validation

### Health Check Validation
```bash
# Comprehensive health validation
./deployment-validation-framework.sh \
  --environment production \
  --post-rollback-validation \
  --comprehensive

# API endpoint validation
curl -f https://api.mataresit.com/health/live
curl -f https://api.mataresit.com/health/ready
curl -f https://api.mataresit.com/health/database
curl -f https://api.mataresit.com/metrics
```

### Performance Validation
```bash
# Response time validation
for i in {1..20}; do
  curl -w "%{time_total}\n" -o /dev/null -s https://api.mataresit.com/health
done | awk '{sum+=$1; count++} END {print "Average:", sum/count}'

# Resource utilization check
kubectl top pods -n paperless-maverick
kubectl top nodes
```

### Functional Validation
```bash
# Test core functionality
./test-core-functionality.sh --environment production --post-rollback

# Test user workflows
./test-user-workflows.sh --environment production --critical-paths

# Verify data integrity
./validate-data-integrity.sh --environment production --post-rollback
```

## 🔍 Rollback Troubleshooting

### Common Rollback Issues

#### Rollback Stuck or Failed
```bash
# Force rollback if stuck
kubectl patch deployment paperless-maverick -n paperless-maverick --patch '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "paperless-maverick",
            "image": "paperless-maverick:v1.2.2"
          }
        ]
      }
    }
  }
}'

# Delete problematic pods
kubectl delete pods -n paperless-maverick -l app=paperless-maverick --grace-period=0 --force
```

#### Database Rollback Issues
```bash
# Check database connection
kubectl exec -n paperless-maverick deployment/paperless-maverick -- \
  curl -f http://localhost:3000/health/database

# Verify migration status
kubectl exec -n database deployment/postgresql -- \
  psql -U postgres -d paperless_maverick -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 10;"
```

#### Configuration Conflicts
```bash
# Check configuration differences
kubectl diff -f infrastructure/production/kubernetes/configmap-v1.2.2.yaml
kubectl diff -f infrastructure/production/kubernetes/secrets-v1.2.2.yaml

# Apply configuration forcefully
kubectl replace -f infrastructure/production/kubernetes/configmap-v1.2.2.yaml --force
```

### Rollback Recovery Procedures

#### If Rollback Fails Completely
```bash
# Emergency recovery to known good state
kubectl scale deployment/paperless-maverick --replicas=0 -n paperless-maverick
kubectl scale deployment/embedding-queue-workers --replicas=0 -n paperless-maverick

# Restore from backup
./restore-from-backup.sh \
  --environment production \
  --backup-timestamp 2025-01-21-10-30-00 \
  --full-restore

# Restart services
kubectl scale deployment/paperless-maverick --replicas=3 -n paperless-maverick
kubectl scale deployment/embedding-queue-workers --replicas=2 -n paperless-maverick
```

## 📋 Post-Rollback Procedures

### Immediate Actions (0-30 minutes)
- [ ] Verify all systems operational
- [ ] Update incident status to resolved
- [ ] Notify stakeholders of rollback completion
- [ ] Document rollback timeline and actions
- [ ] Monitor system stability

### Short-term Actions (30 minutes - 4 hours)
- [ ] Conduct rollback review meeting
- [ ] Document root cause of original issue
- [ ] Plan fix for rolled-back deployment
- [ ] Update monitoring and alerting if needed
- [ ] Communicate lessons learned to team

### Long-term Actions (4 hours - 7 days)
- [ ] Implement fix for original deployment issue
- [ ] Test fix in staging environment
- [ ] Update deployment procedures if needed
- [ ] Review and improve rollback automation
- [ ] Update documentation and runbooks

## 📊 Rollback Metrics and Reporting

### Key Metrics to Track
```bash
# Rollback frequency
echo "Rollbacks in last 30 days: $(grep -c 'ROLLBACK_COMPLETED' logs/deployment/*.log)"

# Rollback success rate
echo "Successful rollbacks: $(grep -c 'ROLLBACK_SUCCESS' logs/deployment/*.log)"

# Average rollback time
grep 'ROLLBACK_DURATION' logs/deployment/*.log | awk '{sum+=$3; count++} END {print "Average rollback time:", sum/count, "minutes"}'
```

### Rollback Report Template
```markdown
## Rollback Report

**Date**: 2025-01-21
**Time**: 14:30 UTC
**Duration**: 8 minutes
**Trigger**: Automatic (error rate spike)
**Target Version**: v1.2.2
**Rolled Back From**: v1.2.3

### Impact
- **Users Affected**: ~500 active users
- **Downtime**: 2 minutes during rollback
- **Data Loss**: None
- **Revenue Impact**: Minimal

### Root Cause
Performance regression in new search algorithm causing 15% increase in response times.

### Actions Taken
1. Automatic rollback triggered at 14:30 UTC
2. Application rolled back to v1.2.2
3. Health checks passed at 14:38 UTC
4. Monitoring confirmed stability

### Follow-up Actions
- [ ] Fix performance regression in v1.2.4
- [ ] Add performance regression tests
- [ ] Update deployment validation criteria
```

## 📞 Escalation and Support

### Rollback Support Contacts
- **Primary On-Call**: rollback-support@mataresit.com
- **Database Team**: dba-oncall@mataresit.com
- **Infrastructure Team**: infra-oncall@mataresit.com
- **Security Team**: security-oncall@mataresit.com

### Emergency Escalation
- **Level 1**: Operations Engineer (0-15 minutes)
- **Level 2**: Senior Engineer (15-30 minutes)
- **Level 3**: Engineering Manager (30-60 minutes)
- **Level 4**: VP Engineering (60+ minutes)

## 📚 Related Documentation

- [Master Deployment Guide](./master-deployment-guide.md)
- [Emergency Procedures](./emergency-procedures.md)
- [Production Deployment Checklist](./production-deployment-checklist.md)
- [Troubleshooting Common Issues](./troubleshooting-common-issues.md)

---

**Last Updated**: 2025-01-21
**Version**: 1.0.0
**Next Review**: 2025-02-21
