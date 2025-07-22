# Production Database Migration System

This directory contains the complete database migration deployment system for Phase 5 production deployment, implementing staged migration deployment with comprehensive rollback capabilities and validation procedures.

## 📁 Directory Structure

```
database/migrations/production/
├── deploy-migrations.sh           # Main deployment script
├── rollback/                      # Rollback scripts
│   ├── rollback_phase1.sql       # Phase 1 rollback
│   ├── rollback_phase2.sql       # Phase 2 rollback
│   └── rollback_phase3.sql       # Phase 3 rollback
├── validation/                    # Validation scripts
│   ├── validate-phase1.sql       # Phase 1 validation
│   ├── validate-phase2.sql       # Phase 2 validation
│   └── validate-phase3.sql       # Phase 3 validation
├── backups/                       # Backup storage (created automatically)
└── README.md                      # This file
```

## 🚀 Phase 5 Migration Overview

The Phase 5 database migration system implements three sequential phases:

### Phase 1: Embedding Metrics Tables (Monitoring)
- **Migration**: `20250717000001_create_embedding_metrics_tables.sql`
- **Purpose**: Comprehensive monitoring and performance tracking
- **Tables**: `embedding_performance_metrics`, `embedding_hourly_stats`, `embedding_daily_stats`
- **Features**: Real-time performance monitoring, success rate tracking, cost analysis

### Phase 2: Queue System Enhancements (Processing)
- **Migration**: `20250719000001_enhance_embedding_queue_phase2.sql`
- **Purpose**: Advanced queue management and worker coordination
- **Enhancements**: Priority queuing, worker tracking, rate limiting, batch processing
- **Tables**: Enhanced `embedding_queue`, `embedding_queue_workers`, `embedding_queue_config`

### Phase 3: Batch Upload Optimization (Performance)
- **Migration**: `20250720000003_batch_upload_optimization.sql`
- **Purpose**: Optimized batch processing and API quota management
- **Tables**: `batch_upload_sessions`, `batch_upload_files`, `api_quota_tracking`
- **Features**: Concurrent processing, quota management, optimization strategies

## 🔧 Usage Instructions

### Prerequisites

1. **Required Tools**:
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Install PostgreSQL client
   brew install postgresql  # macOS
   sudo apt-get install postgresql-client  # Ubuntu
   ```

2. **Environment Variables**:
   ```bash
   export SUPABASE_PROJECT_ID="your-project-id"
   export SUPABASE_DB_PASSWORD="your-db-password"
   export ENVIRONMENT="production"  # or staging/test
   ```

3. **Authentication**:
   ```bash
   supabase login
   supabase link --project-ref your-project-id
   ```

### Deployment Commands

#### Full Phase 5 Deployment
```bash
# Deploy all phases with backup
./deploy-migrations.sh --environment production --backup-first

# Dry run to validate before deployment
./deploy-migrations.sh --dry-run --environment production
```

#### Validation Only
```bash
# Validate all migrations without applying
./deploy-migrations.sh --validate-only

# Validate specific phase
./deploy-migrations.sh --migration 20250717000001_create_embedding_metrics_tables.sql --validate-only
```

#### Rollback Operations
```bash
# Rollback to Phase 2 (removes Phase 3)
./deploy-migrations.sh --rollback 2 --environment production

# Rollback to Phase 1 (removes Phase 2 and 3)
./deploy-migrations.sh --rollback 1 --environment production

# Complete rollback (removes all phases)
./deploy-migrations.sh --rollback 0 --environment production
```

#### Individual Phase Deployment
```bash
# Deploy specific migration
./deploy-migrations.sh --migration 20250717000001_create_embedding_metrics_tables.sql

# Force deployment even if validation fails
./deploy-migrations.sh --force --environment production
```

### Validation Commands

#### Run Individual Phase Validations
```bash
# Validate Phase 1 deployment
psql -f validation/validate-phase1.sql "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres"

# Validate Phase 2 deployment
psql -f validation/validate-phase2.sql "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres"

# Validate Phase 3 deployment
psql -f validation/validate-phase3.sql "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres"
```

## 🔄 Rollback Procedures

### Automated Rollback
The deployment script includes automated rollback capabilities:

```bash
# Rollback to specific phase
./deploy-migrations.sh --rollback 2  # Keeps Phase 1 & 2, removes Phase 3
./deploy-migrations.sh --rollback 1  # Keeps Phase 1, removes Phase 2 & 3
./deploy-migrations.sh --rollback 0  # Removes all phases
```

### Manual Rollback
For emergency situations, run rollback scripts directly:

```bash
# Rollback Phase 3 only
psql -f rollback/rollback_phase3.sql "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres"

# Rollback Phase 2 (after Phase 3 rollback)
psql -f rollback/rollback_phase2.sql "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres"

# Rollback Phase 1 (complete rollback)
psql -f rollback/rollback_phase1.sql "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres"
```

### Rollback Safety Features
- **Data Backup**: All data is backed up to `*_backup` tables before rollback
- **Validation**: Rollback completion is validated automatically
- **Logging**: Complete rollback audit trail in `migration_rollback_log` table
- **Safety Checks**: Database and environment validation before rollback

## 📊 Monitoring & Validation

### Deployment Validation
Each phase includes comprehensive validation:

- **Table Structure**: Validates all tables, columns, and constraints
- **Index Performance**: Ensures optimal query performance
- **Function Testing**: Tests all stored procedures and functions
- **Data Integrity**: Validates foreign keys and constraints
- **Performance**: Checks query execution plans and index usage

### Validation Results
Validation scripts provide detailed reports:

```sql
-- Example validation output
============================================
PHASE 1 VALIDATION SUMMARY
============================================
Total Checks: 15
Passed: 14
Failed: 0
Warnings: 1

✅ Phase 1 validation PASSED
Embedding metrics infrastructure is properly deployed
============================================
```

### Monitoring Tables
After Phase 1 deployment, monitor system health:

```sql
-- Check embedding success rates
SELECT * FROM public.embedding_success_rate_by_team;

-- Monitor performance metrics
SELECT * FROM public.embedding_performance_summary;

-- View error analysis
SELECT * FROM public.embedding_error_analysis;
```

## 🔐 Security & Best Practices

### Security Features
- **Environment Validation**: Ensures deployment to correct database
- **Permission Checks**: Validates user permissions before deployment
- **Audit Logging**: Complete deployment and rollback audit trail
- **Data Backup**: Automatic backup before destructive operations

### Best Practices
1. **Always run dry-run first**: `--dry-run` flag validates without applying
2. **Create backups**: Use `--backup-first` for production deployments
3. **Validate after deployment**: Run validation scripts after each phase
4. **Monitor performance**: Check query performance after index changes
5. **Test rollback procedures**: Validate rollback scripts in staging first

## 🚨 Emergency Procedures

### Production Issues
If issues occur after deployment:

1. **Immediate Assessment**:
   ```bash
   # Check system status
   ./deploy-migrations.sh --validate-only
   
   # Review recent changes
   supabase migration list
   ```

2. **Emergency Rollback**:
   ```bash
   # Quick rollback to previous phase
   ./deploy-migrations.sh --rollback 2 --environment production
   ```

3. **Data Recovery**:
   ```sql
   -- Restore from backup tables if needed
   INSERT INTO original_table SELECT * FROM original_table_backup;
   ```

### Troubleshooting

#### Common Issues
1. **Migration Already Applied**: Check `supabase migration list`
2. **Permission Denied**: Verify database user permissions
3. **Connection Failed**: Check database connectivity and credentials
4. **Validation Failed**: Review validation output for specific issues

#### Debug Commands
```bash
# Enable verbose logging
export DEBUG=1
./deploy-migrations.sh --dry-run

# Check database connection
psql "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres" -c "SELECT version();"

# Verify migration files
supabase db diff --schema public
```

## 📈 Performance Considerations

### Index Strategy
- **Phase 1**: Optimized for metrics queries and time-based filtering
- **Phase 2**: Enhanced for priority-based queue processing
- **Phase 3**: Optimized for batch operations and quota tracking

### Query Performance
- All validation scripts include query performance checks
- Index usage is validated for critical queries
- Performance regression detection included

### Resource Usage
- Migration deployment is designed for minimal downtime
- Rollback operations preserve data integrity
- Backup operations are optimized for speed

## 🔗 Integration Points

- **Supabase**: Primary database platform
- **GitHub Actions**: CI/CD integration for automated deployment
- **Monitoring**: Integration with Phase 1 metrics collection
- **Queue System**: Phase 2 worker coordination
- **Batch Processing**: Phase 3 optimization features

## 📚 Additional Resources

- [Supabase Migration Documentation](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [Phase 5 Implementation Plan](../../../docs/implementation-plans/phase5-production-deployment.md)

---

**Note**: This migration system implements comprehensive safety measures, validation procedures, and rollback capabilities for production database deployments. Always test in staging environment before production deployment.
