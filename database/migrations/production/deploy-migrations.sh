#!/bin/bash

# Production Database Migration Deployment Script
# Implements staged migration deployment with rollback capabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"
ROLLBACK_DIR="$SCRIPT_DIR/rollback"
VALIDATION_DIR="$SCRIPT_DIR/validation"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Migration files in deployment order
PHASE5_MIGRATIONS=(
    "20250717000001_create_embedding_metrics_tables.sql"
    "20250719000001_enhance_embedding_queue_phase2.sql" 
    "20250720000003_batch_upload_optimization.sql"
)

# Environment variables
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-mpmkbtsufihzdelrlszs}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Hosted database connection
REMOTE_DB_HOST="db.$SUPABASE_PROJECT_ID.supabase.co"
REMOTE_DB_PORT="5432"
REMOTE_DB_USER="postgres"
REMOTE_DB_NAME="postgres"

# Run psql against the hosted project database
psql_remote() {
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
        --no-psqlrc \
        --set ON_ERROR_STOP=1 \
        --host "$REMOTE_DB_HOST" \
        --port "$REMOTE_DB_PORT" \
        --username "$REMOTE_DB_USER" \
        --dbname "$REMOTE_DB_NAME" \
        "$@"
}

# Extract the migration version (timestamp prefix) from a migration file path
migration_version() {
    local base
    base=$(basename "$1" .sql)
    echo "${base%%_*}"
}

# Check whether a migration version is recorded in the hosted migration history
migration_is_applied() {
    local version="$1"
    local result
    result=$(psql_remote --no-align --tuples-only \
        --command "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$version' LIMIT 1;")
    [[ "$result" == "1" ]]
}

# Check whether a relation exists in the hosted public schema
remote_relation_exists() {
    local relation="$1"
    local result
    result=$(psql_remote --no-align --tuples-only \
        --command "SELECT to_regclass('public.$relation') IS NOT NULL;")
    [[ "$result" == "t" ]]
}

# Check whether a column exists on a hosted public table
remote_column_exists() {
    local table="$1"
    local column="$2"
    local result
    result=$(psql_remote --no-align --tuples-only \
        --command "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' AND column_name = '$column');")
    [[ "$result" == "t" ]]
}

# Help function
show_help() {
    cat << EOF
Production Database Migration Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --environment ENV       Target environment (production/staging/test)
    --dry-run              Validate migrations without applying
    --rollback PHASE       Rollback to specific phase (0, 1, 2, 3)
    --validate-only        Only run validation checks
    --backup-first         Create backup before migration
    --force                Force migration even if validation fails
    --migration FILE       Deploy specific migration file

PHASES:
    Phase 1: Embedding metrics tables (monitoring)
    Phase 2: Queue system enhancements (processing)
    Phase 3: Batch upload optimization (performance)

EXAMPLES:
    $0 --environment production --backup-first
    $0 --dry-run --environment staging
    $0 --rollback 2 --environment production
    $0 --validate-only

EOF
}

# Parse command line arguments
DRY_RUN=false
ROLLBACK_PHASE=""
VALIDATE_ONLY=false
BACKUP_FIRST=false
FORCE=false
SPECIFIC_MIGRATION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --rollback)
            ROLLBACK_PHASE="$2"
            shift 2
            ;;
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        --backup-first)
            BACKUP_FIRST=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --migration)
            SPECIFIC_MIGRATION="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."
    
    # Check required tools
    local required_tools=("supabase" "psql" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check environment variables
    if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
        error "SUPABASE_DB_PASSWORD environment variable is required"
        exit 1
    fi
    
    # Check Supabase connection
    if ! supabase status &> /dev/null; then
        warning "Supabase CLI not connected, attempting to connect..."
        if ! supabase login; then
            error "Failed to connect to Supabase"
            exit 1
        fi
    fi
    
    # Create necessary directories
    mkdir -p "$BACKUP_DIR" "$ROLLBACK_DIR" "$VALIDATION_DIR"
    
    success "Prerequisites validation completed"
}

# Create database backup
create_backup() {
    if [[ "$BACKUP_FIRST" != "true" ]]; then
        return 0
    fi
    
    log "Creating database backup..."
    
    local backup_file="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create backup at $backup_file"
        return 0
    fi
    
    # Create schema backup
    if supabase db dump --schema-only --remote > "$backup_file.schema"; then
        success "Schema backup created: $backup_file.schema"
    else
        error "Failed to create schema backup"
        exit 1
    fi
    
    # Create data backup for critical tables
    local critical_tables=(
        "embedding_performance_metrics"
        "embedding_hourly_stats" 
        "embedding_daily_stats"
        "embedding_queue"
        "batch_upload_sessions"
        "batch_upload_files"
    )
    
    for table in "${critical_tables[@]}"; do
        if supabase db dump --data-only --table "$table" --remote >> "$backup_file.data" 2>/dev/null; then
            log "Backed up table: $table"
        else
            warning "Table $table does not exist or backup failed"
        fi
    done
    
    success "Database backup completed"
}

# Validate migration files
validate_migrations() {
    log "Validating migration files..."
    
    local validation_failed=false
    
    for migration in "${PHASE5_MIGRATIONS[@]}"; do
        local migration_file="$MIGRATIONS_DIR/$migration"
        
        if [[ ! -f "$migration_file" ]]; then
            error "Migration file not found: $migration"
            validation_failed=true
            continue
        fi
        
        # Check SQL syntax
        if ! psql_remote --quiet \
            --command "BEGIN; $(cat "$migration_file"); ROLLBACK;" \
            &> /dev/null; then
            error "SQL syntax validation failed for: $migration"
            validation_failed=true
        else
            success "Validated migration: $migration"
        fi
    done
    
    if [[ "$validation_failed" == "true" && "$FORCE" != "true" ]]; then
        error "Migration validation failed. Use --force to proceed anyway."
        exit 1
    fi
    
    success "Migration validation completed"
}

# Apply single migration
apply_migration() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file" .sql)
    local migration_ver=$(migration_version "$migration_file")

    log "Applying migration: $migration_name"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would apply migration $migration_name"
        return 0
    fi

    # Check if migration already applied
    if migration_is_applied "$migration_ver"; then
        warning "Migration $migration_name already applied, skipping"
        return 0
    fi

    # Apply this migration file only, recording it in remote history atomically
    if psql_remote --single-transaction \
        --file "$migration_file" \
        --command "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('$migration_ver') ON CONFLICT (version) DO NOTHING;"; then
        success "Applied migration: $migration_name"

        # Run post-migration validation
        validate_migration_success "$migration_name"
    else
        error "Failed to apply migration: $migration_name"
        return 1
    fi
}

# Validate migration success
validate_migration_success() {
    local migration_name="$1"
    
    log "Validating migration success: $migration_name"
    
    case "$migration_name" in
        "20250717000001_create_embedding_metrics_tables")
            # Validate Phase 1 tables exist
            local tables=("embedding_performance_metrics" "embedding_hourly_stats" "embedding_daily_stats")
            for table in "${tables[@]}"; do
                if ! remote_relation_exists "$table"; then
                    error "Table $table not found after migration"
                    return 1
                fi
            done
            ;;
        "20250719000001_enhance_embedding_queue_phase2")
            # Validate Phase 2 enhancements
            local columns=("batch_id" "worker_id" "processing_started_at" "processing_completed_at" "estimated_tokens" "actual_tokens" "rate_limit_delay_ms")
            for column in "${columns[@]}"; do
                if ! remote_column_exists "embedding_queue" "$column"; then
                    error "Column embedding_queue.$column not found after migration"
                    return 1
                fi
            done
            ;;
        "20250720000003_batch_upload_optimization")
            # Validate Phase 3 tables
            local tables=("batch_upload_sessions" "batch_upload_files")
            for table in "${tables[@]}"; do
                if ! remote_relation_exists "$table"; then
                    error "Table $table not found after migration"
                    return 1
                fi
            done
            ;;
    esac
    
    success "Migration validation passed: $migration_name"
}

# Deploy all migrations
deploy_migrations() {
    log "Starting Phase 5 migration deployment..."
    log "Environment: $ENVIRONMENT"
    log "Migrations to deploy: ${#PHASE5_MIGRATIONS[@]}"
    
    local failed_migrations=()
    
    for migration in "${PHASE5_MIGRATIONS[@]}"; do
        local migration_file="$MIGRATIONS_DIR/$migration"
        
        if apply_migration "$migration_file"; then
            success "Successfully deployed: $migration"
        else
            error "Failed to deploy: $migration"
            failed_migrations+=("$migration")
        fi
    done
    
    if [[ ${#failed_migrations[@]} -gt 0 ]]; then
        error "Failed migrations:"
        for migration in "${failed_migrations[@]}"; do
            error "  - $migration"
        done
        exit 1
    fi
    
    success "All Phase 5 migrations deployed successfully"
}

# Run a rollback script and mark its migration version as reverted
run_rollback_script() {
    local rollback_file="$1"
    local migration_ver="$2"

    if [[ ! -f "$rollback_file" ]]; then
        error "Rollback script not found: $rollback_file"
        return 1
    fi

    log "Running rollback script: $(basename "$rollback_file")"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would run $(basename "$rollback_file") and mark version $migration_ver as reverted"
        return 0
    fi

    # Roll back the schema and remove the migration from remote history atomically
    if psql_remote --single-transaction \
        --file "$rollback_file" \
        --command "DELETE FROM supabase_migrations.schema_migrations WHERE version = '$migration_ver';"; then
        success "Rollback script completed: $(basename "$rollback_file")"
    else
        error "Rollback script failed: $(basename "$rollback_file")"
        return 1
    fi
}

# Rollback to specific phase
rollback_migrations() {
    local target_phase="$1"

    log "Rolling back to Phase $target_phase..."

    case "$target_phase" in
        "0")
            log "Rolling back Phase 3, Phase 2 and Phase 1..."
            run_rollback_script "$ROLLBACK_DIR/rollback_phase3.sql" "20250720000003"
            run_rollback_script "$ROLLBACK_DIR/rollback_phase2.sql" "20250719000001"
            run_rollback_script "$ROLLBACK_DIR/rollback_phase1.sql" "20250717000001"
            ;;
        "1")
            log "Rolling back Phase 3 and Phase 2..."
            run_rollback_script "$ROLLBACK_DIR/rollback_phase3.sql" "20250720000003"
            run_rollback_script "$ROLLBACK_DIR/rollback_phase2.sql" "20250719000001"
            ;;
        "2")
            log "Rolling back Phase 3..."
            run_rollback_script "$ROLLBACK_DIR/rollback_phase3.sql" "20250720000003"
            ;;
        "3")
            log "No rollback needed, already at Phase 3"
            ;;
        *)
            error "Invalid rollback phase: $target_phase"
            exit 1
            ;;
    esac

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Rollback to Phase $target_phase not executed"
        return 0
    fi

    success "Rollback to Phase $target_phase completed"
}

# Generate migration report
generate_report() {
    local status="$1"
    local report_file="$BACKUP_DIR/migration_report_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "status": "$status",
  "migrations": [
$(for migration in "${PHASE5_MIGRATIONS[@]}"; do
    applied=$(migration_is_applied "$(migration_version "$migration")" && echo "true" || echo "false")
    echo "    {\"name\": \"$migration\", \"applied\": $applied}"
done | paste -sd ',' -)
  ],
  "supabase_project_id": "$SUPABASE_PROJECT_ID"
}
EOF
    
    log "Migration report generated: $report_file"
}

# Main execution
main() {
    log "Phase 5 Database Migration Deployment"
    log "Environment: $ENVIRONMENT"
    log "Project ID: $SUPABASE_PROJECT_ID"
    log "======================================="
    
    # Validate prerequisites
    validate_prerequisites
    
    # Handle specific operations
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        validate_migrations
        success "Validation completed successfully"
        exit 0
    fi
    
    if [[ -n "$ROLLBACK_PHASE" ]]; then
        rollback_migrations "$ROLLBACK_PHASE"
        generate_report "rollback_completed"
        exit 0
    fi
    
    # Create backup if requested
    create_backup
    
    # Validate migrations
    validate_migrations
    
    # Deploy migrations
    if [[ -n "$SPECIFIC_MIGRATION" ]]; then
        apply_migration "$MIGRATIONS_DIR/$SPECIFIC_MIGRATION"
    else
        deploy_migrations
    fi
    
    # Generate report
    generate_report "deployment_completed"
    
    success "Phase 5 database migration deployment completed successfully"
}

# Error handling
trap 'error "Migration deployment failed at line $LINENO"' ERR

# Run main function
main "$@"
