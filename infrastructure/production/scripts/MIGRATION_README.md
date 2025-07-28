# Database Migration Automation System

This directory contains comprehensive database migration automation scripts for the Paperless Maverick application. The system provides robust migration management with validation, rollback capabilities, and production safety features.

## 📋 Overview

The migration automation system consists of several components:

1. **Main Migration Script** (`migrate-database.sh`) - Core migration orchestration
2. **Migration Validation** (`validate-migrations.sh`) - Comprehensive validation of migration files and database state
3. **Rollback System** (`rollback-migrations.sh`) - Emergency rollback capabilities
4. **Configuration** (`../config/migration-dependencies.yaml`) - Migration dependencies and validation rules

## 🚀 Quick Start

### Apply All Pending Migrations

```bash
# Production deployment (requires careful consideration)
./migrate-database.sh --environment production

# Staging deployment
./migrate-database.sh --environment staging

# Dry run to see what would be applied
./migrate-database.sh --dry-run --environment production
```

### Validate Migrations

```bash
# Full validation including database state
./validate-migrations.sh --environment production

# Quick validation of migration files only
./validate-migrations.sh --quick

# Verbose validation with debug information
./validate-migrations.sh --verbose
```

### Emergency Rollback

```bash
# List available backups
./rollback-migrations.sh --list-backups

# Rollback to latest backup (DESTRUCTIVE - requires --force)
./rollback-migrations.sh --target latest --force

# Dry run rollback
./rollback-migrations.sh --target latest --dry-run
```

## 🔧 Migration Script (`migrate-database.sh`)

The main migration script provides comprehensive migration automation with the following features:

### Key Features

- **Automatic Migration Detection** - Identifies pending migrations
- **Dependency Validation** - Ensures migrations are applied in correct order
- **Backup Creation** - Automatic backup before applying migrations
- **Rollback on Failure** - Automatic rollback if migration fails
- **Production Safety** - Extra validation and confirmation for production
- **Audit Logging** - Comprehensive audit trail of all migration activities

### Usage Examples

```bash
# Apply all pending migrations
./migrate-database.sh --environment production

# Apply specific migration
./migrate-database.sh --migration 20250720000003_batch_upload_optimization

# Dry run with validation
./migrate-database.sh --dry-run --validate-only

# Force migration (skip safety checks)
./migrate-database.sh --force --skip-validation

# Rollback to specific migration
./migrate-database.sh --rollback migration:20250719000001_enhance_embedding_queue_phase2 --force
```

### Command Line Options

```
-h, --help                  Show help message
-e, --environment ENV       Target environment (production, staging, development)
-p, --project-id ID         Supabase project ID
-d, --dry-run              Perform dry run without applying migrations
-v, --validate-only        Only validate migration files and connectivity
-r, --rollback TARGET      Rollback to target (backup|migration:NAME|timestamp:TS)
-m, --migration NAME       Apply specific migration only
-f, --force                Force operations, skip safety checks
--verbose                  Enable verbose logging
--no-backup                Skip backup creation
--skip-validation          Skip post-migration validation
--timeout SECONDS          Migration timeout (default: 1800)
```

## ✅ Validation Script (`validate-migrations.sh`)

Comprehensive validation of migration files and database state.

### Validation Checks

1. **Migration File Format** - Validates filename format and SQL syntax
2. **Dependency Order** - Checks migration dependencies and ordering
3. **Database State** - Validates current database schema and functions
4. **Core Tables** - Ensures required tables exist
5. **Extensions** - Validates required PostgreSQL extensions
6. **Functions** - Checks for required database functions

### Usage Examples

```bash
# Full validation
./validate-migrations.sh --environment production

# Quick file validation only
./validate-migrations.sh --quick

# Verbose validation with debug output
./validate-migrations.sh --verbose --environment staging
```

## 🔄 Rollback Script (`rollback-migrations.sh`)

Emergency rollback capabilities with data protection features.

### Rollback Features

- **Multiple Rollback Targets** - Rollback to backup, specific migration, or timestamp
- **Pre-Rollback Backup** - Creates backup before rollback operation
- **Production Safety** - Requires explicit confirmation for production rollbacks
- **Verification** - Validates rollback success
- **Dry Run Mode** - Preview rollback operations without executing

### Usage Examples

```bash
# List available backups
./rollback-migrations.sh --list-backups

# Rollback to latest backup
./rollback-migrations.sh --target latest --force

# Rollback to specific backup
./rollback-migrations.sh --target 20250120-143022 --force

# Dry run rollback
./rollback-migrations.sh --target latest --dry-run
```

## 📁 Directory Structure

```
infrastructure/production/
├── config/
│   └── migration-dependencies.yaml    # Migration configuration
├── scripts/
│   ├── migrate-database.sh           # Main migration script
│   ├── validate-migrations.sh        # Validation script
│   ├── rollback-migrations.sh        # Rollback script
│   └── MIGRATION_README.md           # This documentation
└── logs/
    └── migrations/                   # Migration logs and reports
```

## 🔒 Safety Features

### Production Protections

1. **Force Flag Requirement** - Production operations require explicit `--force` flag
2. **Confirmation Prompts** - Interactive confirmation for destructive operations
3. **Automatic Backups** - Mandatory backup creation before migrations
4. **Validation Checks** - Comprehensive validation before applying changes
5. **Audit Logging** - Complete audit trail of all operations

### Rollback Protections

1. **Pre-Rollback Backup** - Creates backup before rollback
2. **Verification** - Validates rollback success
3. **Data Preservation** - Options to preserve user data during rollback
4. **Confirmation Required** - Explicit confirmation for production rollbacks

## 📊 Migration Phases

The system organizes migrations into logical phases:

1. **Foundation** - Core schema and tables
2. **Subscriptions** - User management and subscriptions
3. **Embeddings** - Vector search and embeddings
4. **Malaysian Features** - Localization and cultural adaptations
5. **Advanced Features** - Analytics and external APIs
6. **Notifications** - Notification and alerting system
7. **Monitoring** - Metrics and monitoring infrastructure
8. **Queue System** - Queue-based processing

## 🔍 Monitoring and Logging

### Log Files

- **Migration Logs** - `logs/migrations/migration-*.log`
- **Audit Logs** - `logs/migrations/migration-audit-*.log`
- **Validation Reports** - `logs/migrations/validation-report-*.json`
- **Rollback Logs** - `logs/migrations/rollback-*.log`

### Backup Locations

- **Migration Backups** - `archive/backups/migrations/YYYYMMDD-HHMMSS/`
- **Pre-Rollback Backups** - `archive/backups/migrations/pre-rollback-*/`

## ⚠️ Important Warnings

### Production Considerations

1. **Always Test in Staging First** - Never apply untested migrations to production
2. **Backup Verification** - Verify backups are created and valid before proceeding
3. **Maintenance Window** - Schedule migrations during maintenance windows
4. **Rollback Plan** - Always have a tested rollback plan
5. **Team Communication** - Coordinate with team before production migrations

### Emergency Procedures

1. **Migration Failure** - Automatic rollback will be triggered
2. **Manual Rollback** - Use rollback script with latest backup
3. **Data Recovery** - Contact database administrator if data recovery needed
4. **Escalation** - Follow incident response procedures for production issues

## 🛠️ Troubleshooting

### Common Issues

1. **Connection Errors** - Check Supabase authentication and project ID
2. **Permission Errors** - Verify database permissions and access
3. **Migration Conflicts** - Check for conflicting schema changes
4. **Timeout Errors** - Increase timeout for large migrations

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
./migrate-database.sh --verbose --dry-run
./validate-migrations.sh --verbose
```

## 📚 Additional Resources

- [Supabase Migration Documentation](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)
