# Rollback Automation System

This directory contains a comprehensive rollback automation system for the Paperless Maverick application. The system provides automated and manual rollback capabilities with multiple rollback levels, trigger detection, safety checks, and proper validation procedures.

## 📋 Overview

The rollback automation system consists of several components:

1. **Main Rollback Automation Script** (`rollback-automation.sh`) - Core rollback orchestration and execution
2. **Rollback Trigger Monitor** (`rollback-monitor.sh`) - Continuous monitoring for automated rollback triggers
3. **Rollback Configuration** (`../config/rollback-config.yaml`) - Comprehensive rollback policies and settings

## 🚀 Quick Start

### Manual Rollback Operations

```bash
# Full system rollback to previous version
./rollback-automation.sh --type full --target previous --reason "Critical bug fix"

# Application rollback to specific revision
./rollback-automation.sh --type application --target revision:5 --reason "Performance issue"

# Database rollback to latest backup
./rollback-automation.sh --type database --target backup:backup-20240101-120000 --force

# Partial rollback of specific components
./rollback-automation.sh --type partial --target components:app,monitoring --reason "Monitoring issues"
```

### Automated Rollback Monitoring

```bash
# Start continuous monitoring for rollback triggers
./rollback-monitor.sh --environment production

# Monitor with custom interval
./rollback-monitor.sh --interval 30 --verbose

# Dry run monitoring (no actual rollbacks)
./rollback-monitor.sh --dry-run --verbose
```

## 🔧 Rollback Automation (`rollback-automation.sh`)

The main rollback automation script provides comprehensive rollback capabilities with safety checks and validation.

### Key Features

- **Multiple Rollback Types** - Application, database, infrastructure, monitoring, partial, and full rollbacks
- **Flexible Rollback Targets** - Previous version, specific revision, backup restore, or component selection
- **Safety Mechanisms** - Pre-rollback backups, confirmation prompts, and validation checks
- **Automated Triggers** - Integration with monitoring for automated rollback execution
- **Comprehensive Logging** - Detailed audit trails and rollback tracking

### Rollback Types

#### Application Rollback
- **Scope**: Application deployments and worker services
- **Method**: Kubernetes rollout undo to previous or specific revision
- **Validation**: Health checks and endpoint validation
- **Timeout**: 10 minutes default

#### Database Rollback
- **Scope**: Database schema and data migrations
- **Method**: Migration script execution with backup restore
- **Validation**: Database consistency and connectivity checks
- **Timeout**: 10 minutes default

#### Infrastructure Rollback
- **Scope**: ConfigMaps, Services, and infrastructure components
- **Method**: Manifest restoration from backup
- **Validation**: Resource status and connectivity validation
- **Timeout**: 5 minutes default

#### Monitoring Rollback
- **Scope**: Prometheus, Grafana, and AlertManager
- **Method**: Kubernetes rollout undo for monitoring components
- **Validation**: Monitoring stack health checks
- **Timeout**: 3 minutes default

#### Partial Rollback
- **Scope**: Selected components based on user specification
- **Method**: Combination of above methods for specified components
- **Validation**: Component-specific validation
- **Timeout**: Variable based on components

#### Full Rollback
- **Scope**: Complete system rollback in dependency order
- **Method**: Sequential rollback of all components
- **Validation**: Comprehensive system validation
- **Timeout**: 20 minutes default

### Rollback Targets

```bash
# Target Options
--target previous           # Previous version/revision
--target latest            # Latest backup
--target revision:N        # Specific revision number
--target backup:NAME       # Specific backup name
--target components:LIST   # Component list for partial rollback
```

### Command Line Options

```
-h, --help                  Show help message
-e, --environment ENV       Target environment (production, staging, development)
-n, --namespace NS          Kubernetes namespace (default: paperless-maverick)
-t, --type TYPE             Rollback type (application|database|infrastructure|monitoring|partial|full)
-r, --target TARGET         Rollback target specification
--reason REASON             Reason for rollback (required for production)
-d, --dry-run              Perform dry run without making changes
-f, --force                Force rollback, skip safety checks
-v, --verbose              Enable verbose logging
--skip-validation          Skip post-rollback validation
--skip-backup              Skip pre-rollback backup
--auto-approve             Skip confirmation prompts
--automated-check          Check for automated rollback triggers
--list-targets             List available rollback targets
```

## 🔍 Rollback Trigger Monitor (`rollback-monitor.sh`)

Continuous monitoring system that detects conditions requiring automated rollbacks.

### Monitored Triggers

1. **Embedding Success Rate** - Monitors embedding processing success rate
2. **System Error Rate** - Tracks application error rates and restart counts
3. **Queue Backlog** - Monitors worker availability and queue processing
4. **API Quota Exhaustion** - Detects API rate limiting and quota issues
5. **Health Check Failures** - Monitors application health endpoint failures
6. **Deployment Failures** - Detects failed deployments and pod issues

### Trigger Configuration

Each trigger has configurable thresholds and time windows:

```yaml
embedding_success_rate:
  threshold: 85%           # Success rate threshold
  window_duration: 600s    # 10-minute evaluation window
  evaluation_interval: 60s # Check every minute
  automated_action: "rollback_application"
```

### Usage Examples

```bash
# Start monitoring with default settings
./rollback-monitor.sh

# Monitor every 30 seconds with verbose output
./rollback-monitor.sh --interval 30 --verbose

# Dry run monitoring (detect but don't execute rollbacks)
./rollback-monitor.sh --dry-run

# Monitor specific environment
./rollback-monitor.sh --environment staging --namespace paperless-maverick-staging
```

## 📁 Directory Structure

```
infrastructure/production/
├── config/
│   └── rollback-config.yaml           # Rollback configuration and policies
├── scripts/
│   ├── rollback-automation.sh         # Main rollback automation script
│   ├── rollback-monitor.sh            # Rollback trigger monitoring
│   └── ROLLBACK_AUTOMATION_README.md  # This documentation
└── backups/
    └── rollback/                       # Rollback backup storage
```

## 🔄 Rollback Process

The rollback automation follows these phases:

1. **Prerequisites Validation** - Validate tools, connectivity, and permissions
2. **Target Validation** - Validate rollback type and target specification
3. **Pre-rollback Backup** - Create backup of current state
4. **Confirmation** - Request user confirmation (unless auto-approved)
5. **Rollback Execution** - Execute rollback based on type and target
6. **Post-rollback Validation** - Validate rollback success and system health

## 🔒 Safety Features

### Production Protections

1. **Force Flag Requirement** - Production rollbacks require explicit --force flag
2. **Reason Requirement** - Production rollbacks must include rollback reason
3. **Confirmation Prompts** - Interactive confirmation unless auto-approved
4. **Pre-rollback Backups** - Automatic backup creation before rollback
5. **Comprehensive Validation** - Post-rollback health and functionality checks

### Backup Management

1. **Automated Backups** - Pre-rollback backup creation
2. **Backup Metadata** - Detailed backup information and context
3. **Backup Validation** - Integrity checks and restoration testing
4. **Retention Policies** - Configurable backup retention periods

### Audit and Compliance

1. **Comprehensive Logging** - Detailed rollback logs and audit trails
2. **User Tracking** - Track rollback initiator and approval chain
3. **Reason Documentation** - Mandatory reason documentation for production
4. **Compliance Reporting** - Rollback frequency and success rate reporting

## ⚠️ Important Considerations

### Production Rollback Guidelines

1. **Impact Assessment** - Assess rollback impact before execution
2. **Team Coordination** - Coordinate with team before production rollbacks
3. **Communication** - Notify stakeholders of rollback activities
4. **Monitoring** - Monitor system health during and after rollback
5. **Documentation** - Document rollback reason and outcomes

### Rollback Limitations

1. **Data Loss Risk** - Database rollbacks may result in data loss
2. **Dependency Conflicts** - Component rollbacks may create version conflicts
3. **External Dependencies** - External service dependencies may not be rolled back
4. **State Consistency** - Ensure consistent state across all components

## 🛠️ Troubleshooting

### Common Issues

1. **Rollback Timeout** - Increase timeout values for complex rollbacks
2. **Validation Failures** - Check component health and connectivity
3. **Backup Failures** - Verify backup storage and permissions
4. **Permission Errors** - Ensure proper RBAC and cluster access

### Debug Commands

```bash
# List available rollback targets
./rollback-automation.sh --list-targets

# Dry run rollback to test configuration
./rollback-automation.sh --type full --target previous --dry-run

# Check automated triggers
./rollback-automation.sh --automated-check

# Monitor rollback triggers
./rollback-monitor.sh --dry-run --verbose
```

### Log Analysis

```bash
# Check rollback logs
tail -f logs/rollback/rollback-*.log

# Check monitoring logs
tail -f logs/rollback/rollback-monitor-*.log

# Check audit logs
grep "ROLLBACK" logs/rollback/rollback-audit-*.log
```

## 📊 Monitoring and Metrics

### Rollback Metrics

- **Rollback Frequency** - Number of rollbacks per time period
- **Rollback Success Rate** - Percentage of successful rollbacks
- **Rollback Duration** - Time taken for rollback completion
- **Trigger Accuracy** - Accuracy of automated trigger detection
- **Validation Success Rate** - Post-rollback validation success rate

### Integration with Monitoring Stack

- **Prometheus Metrics** - Rollback metrics collection
- **Grafana Dashboards** - Rollback overview and analysis dashboards
- **Alert Rules** - Alerts for frequent rollbacks or failures
- **Notification Integration** - Slack, email, and PagerDuty notifications

## 📚 Additional Resources

- [Kubernetes Rollback Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment)
- [Database Migration Best Practices](https://martinfowler.com/articles/evodb.html)
- [Disaster Recovery Planning](https://cloud.google.com/architecture/disaster-recovery-planning-guide)
- [Chaos Engineering Principles](https://principlesofchaos.org/)

## 🔗 Integration Points

### CI/CD Integration

- **Deployment Pipeline** - Integration with deployment automation
- **Rollback Triggers** - Automated rollback on deployment failures
- **Testing Integration** - Rollback testing in staging environments

### Monitoring Integration

- **Health Checks** - Integration with application health monitoring
- **Performance Metrics** - Performance-based rollback triggers
- **Alert Integration** - Alert-driven automated rollbacks

### External Systems

- **Notification Systems** - Slack, email, and PagerDuty integration
- **Ticketing Systems** - Automatic ticket creation for rollbacks
- **Compliance Systems** - Audit trail integration for compliance
