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

# Help function
show_help() {
    cat << EOF
Production Database Migration Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --environment ENV       Target environment (production/staging/test)
    --dry-run              Validate migrations without applying
    --rollback PHASE       Rollback to specific phase (1, 2, 3)
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
    if supabase db dump --schema-only > "$backup_file.schema"; then
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
        if supabase db dump --data-only --table "$table" >> "$backup_file.data" 2>/dev/null; then
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
        if ! psql --set ON_ERROR_STOP=1 --quiet --no-psqlrc \
            -c "BEGIN; $(cat "$migration_file"); ROLLBACK;" \
            "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres" \
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
    
    log "Applying migration: $migration_name"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would apply migration $migration_name"
        return 0
    fi
    
    # Check if migration already applied
    if supabase migration list | grep -q "$migration_name"; then
        warning "Migration $migration_name already applied, skipping"
        return 0
    fi
    
    # Apply migration
    if supabase db push --include-all; then
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
                if ! supabase db diff --schema public | grep -q "$table"; then
                    error "Table $table not found after migration"
                    return 1
                fi
            done
            ;;
        "20250719000001_enhance_embedding_queue_phase2")
            # Validate Phase 2 enhancements
            if ! supabase db diff --schema public | grep -q "embedding_queue.*batch_id"; then
                error "Phase 2 queue enhancements not found"
                return 1
            fi
            ;;
        "20250720000003_batch_upload_optimization")
            # Validate Phase 3 tables
            local tables=("batch_upload_sessions" "batch_upload_files")
            for table in "${tables[@]}"; do
                if ! supabase db diff --schema public | grep -q "$table"; then
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

# Rollback to specific phase
rollback_migrations() {
    local target_phase="$1"
    
    log "Rolling back to Phase $target_phase..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would rollback to Phase $target_phase"
        return 0
    fi
    
    case "$target_phase" in
        "1")
            log "Rolling back Phase 3 and Phase 2..."
            supabase db reset --linked
            apply_migration "$MIGRATIONS_DIR/20250717000001_create_embedding_metrics_tables.sql"
            ;;
        "2")
            log "Rolling back Phase 3..."
            supabase db reset --linked
            apply_migration "$MIGRATIONS_DIR/20250717000001_create_embedding_metrics_tables.sql"
            apply_migration "$MIGRATIONS_DIR/20250719000001_enhance_embedding_queue_phase2.sql"
            ;;
        "3")
            log "No rollback needed, already at Phase 3"
            ;;
        *)
            error "Invalid rollback phase: $target_phase"
            exit 1
            ;;
    esac
    
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
    echo "    {\"name\": \"$migration\", \"applied\": $(supabase migration list | grep -q "$(basename "$migration" .sql)" && echo "true" || echo "false")}"
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
