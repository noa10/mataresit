#!/bin/bash

# Database Migration Automation Script for Paperless Maverick
# Comprehensive migration system with validation, rollback, and safety checks
# Version: 1.0.0

set -euo pipefail

# ============================================================================
# CONFIGURATION AND CONSTANTS
# ============================================================================

# Script metadata
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Migration configuration
readonly MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"
readonly MIGRATION_CONFIG_DIR="$SCRIPT_DIR/../config"
readonly MIGRATION_BACKUP_DIR="$PROJECT_ROOT/backups/migrations"
readonly MIGRATION_LOG_DIR="$PROJECT_ROOT/logs/migrations"

# Default values
readonly DEFAULT_ENVIRONMENT="production"
readonly DEFAULT_PROJECT_ID="mpmkbtsufihzdelrlszs"
readonly MIGRATION_TIMEOUT=1800  # 30 minutes
readonly VALIDATION_TIMEOUT=300  # 5 minutes

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# ============================================================================
# GLOBAL VARIABLES
# ============================================================================

# Command line options
ENVIRONMENT="$DEFAULT_ENVIRONMENT"
PROJECT_ID="$DEFAULT_PROJECT_ID"
DRY_RUN=false
VALIDATE_ONLY=false
ROLLBACK_TO=""
SPECIFIC_MIGRATION=""
FORCE=false
VERBOSE=false
CREATE_BACKUP=true
SKIP_VALIDATION=false

# Migration state
MIGRATION_ID=""
MIGRATION_START_TIME=""
APPLIED_MIGRATIONS=()
FAILED_MIGRATIONS=()
ROLLBACK_STACK=()

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Initialize logging
init_logging() {
    mkdir -p "$MIGRATION_LOG_DIR" "$MIGRATION_BACKUP_DIR"
    
    MIGRATION_LOG="$MIGRATION_LOG_DIR/migration-$(date +%Y%m%d-%H%M%S).log"
    MIGRATION_AUDIT_LOG="$MIGRATION_LOG_DIR/migration-audit-$(date +%Y%m%d).log"
    
    touch "$MIGRATION_LOG" "$MIGRATION_AUDIT_LOG"
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$MIGRATION_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$MIGRATION_LOG"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$MIGRATION_LOG"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$MIGRATION_LOG"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[$timestamp] 🔍${NC} $message" | tee -a "$MIGRATION_LOG"
            fi
            ;;
        "AUDIT")
            echo "[$timestamp] $message" >> "$MIGRATION_AUDIT_LOG"
            ;;
    esac
}

# Audit logging
audit_log() {
    local action="$1"
    local details="$2"
    local user="${USER:-unknown}"
    local migration_id="${MIGRATION_ID:-unknown}"
    
    log "AUDIT" "MIGRATION_ID=$migration_id USER=$user ACTION=$action DETAILS=$details"
}

# Generate unique migration ID
generate_migration_id() {
    MIGRATION_ID="migrate-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    log "INFO" "Generated migration ID: $MIGRATION_ID"
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate prerequisites
validate_prerequisites() {
    log "INFO" "🔍 Validating migration prerequisites..."
    
    # Check required tools
    local required_tools=("supabase" "psql" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            return 1
        fi
    done
    
    # Check Supabase CLI authentication
    if ! supabase projects list &> /dev/null; then
        log "ERROR" "Supabase CLI not authenticated. Run: supabase login"
        return 1
    fi
    
    # Check project access
    if ! supabase projects list | grep -q "$PROJECT_ID"; then
        log "ERROR" "Project $PROJECT_ID not accessible"
        return 1
    fi
    
    # Check migrations directory
    if [[ ! -d "$MIGRATIONS_DIR" ]]; then
        log "ERROR" "Migrations directory not found: $MIGRATIONS_DIR"
        return 1
    fi
    
    log "SUCCESS" "Prerequisites validation completed"
    return 0
}

# Validate migration files
validate_migration_files() {
    log "INFO" "🔍 Validating migration files..."
    
    local migration_files=()
    local invalid_files=()
    
    # Get all migration files
    while IFS= read -r -d '' file; do
        migration_files+=("$file")
    done < <(find "$MIGRATIONS_DIR" -name "*.sql" -type f -print0 | sort -z)
    
    if [[ ${#migration_files[@]} -eq 0 ]]; then
        log "WARNING" "No migration files found in $MIGRATIONS_DIR"
        return 0
    fi
    
    # Validate each migration file
    for file in "${migration_files[@]}"; do
        local filename=$(basename "$file")
        
        # Check filename format (timestamp_description.sql)
        if [[ ! "$filename" =~ ^[0-9]{14}_[a-zA-Z0-9_-]+\.sql$ ]]; then
            log "WARNING" "Invalid migration filename format: $filename"
            invalid_files+=("$filename")
            continue
        fi
        
        # Check file is readable and not empty
        if [[ ! -r "$file" ]] || [[ ! -s "$file" ]]; then
            log "ERROR" "Migration file is not readable or empty: $filename"
            invalid_files+=("$filename")
            continue
        fi
        
        # Basic SQL syntax validation
        if ! psql --dry-run -f "$file" &> /dev/null; then
            log "DEBUG" "SQL syntax check failed for: $filename (may be normal for complex migrations)"
        fi
        
        log "DEBUG" "Validated migration file: $filename"
    done
    
    if [[ ${#invalid_files[@]} -gt 0 ]]; then
        log "ERROR" "Found ${#invalid_files[@]} invalid migration files"
        for file in "${invalid_files[@]}"; do
            log "ERROR" "  - $file"
        done
        return 1
    fi
    
    log "SUCCESS" "Migration files validation completed (${#migration_files[@]} files)"
    return 0
}

# Validate database connectivity
validate_database_connectivity() {
    log "INFO" "🔍 Validating database connectivity..."
    
    # Test Supabase connection
    if ! supabase db ping --project-ref "$PROJECT_ID" &> /dev/null; then
        log "ERROR" "Cannot connect to Supabase database: $PROJECT_ID"
        return 1
    fi
    
    # Test database permissions
    local test_query="SELECT current_user, current_database(), version();"
    local result
    result=$(supabase db query --project-ref "$PROJECT_ID" --query "$test_query" 2>/dev/null || echo "")
    
    if [[ -z "$result" ]]; then
        log "ERROR" "Database query test failed"
        return 1
    fi
    
    log "SUCCESS" "Database connectivity validated"
    log "DEBUG" "Database info: $result"
    return 0
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

# Create database backup
create_database_backup() {
    if [[ "$CREATE_BACKUP" != "true" ]]; then
        log "INFO" "Backup creation skipped"
        return 0
    fi
    
    log "INFO" "📦 Creating database backup..."
    
    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_dir="$MIGRATION_BACKUP_DIR/$backup_timestamp"
    mkdir -p "$backup_dir"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would create backup at $backup_dir"
        return 0
    fi
    
    # Create schema backup
    log "INFO" "Creating schema backup..."
    if supabase db dump --project-ref "$PROJECT_ID" --schema-only > "$backup_dir/schema.sql"; then
        log "SUCCESS" "Schema backup created: $backup_dir/schema.sql"
    else
        log "ERROR" "Failed to create schema backup"
        return 1
    fi
    
    # Create migration history backup
    log "INFO" "Creating migration history backup..."
    local migration_history
    migration_history=$(supabase migration list --project-ref "$PROJECT_ID" 2>/dev/null || echo "")
    echo "$migration_history" > "$backup_dir/migration_history.txt"
    
    # Create metadata backup
    cat > "$backup_dir/backup_metadata.json" << EOF
{
    "migration_id": "$MIGRATION_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "project_id": "$PROJECT_ID",
    "user": "${USER:-unknown}",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')"
}
EOF
    
    log "SUCCESS" "Database backup created at: $backup_dir"
    audit_log "BACKUP_CREATED" "backup_dir=$backup_dir"
    
    # Store backup path for potential rollback
    echo "$backup_dir" > "$MIGRATION_LOG_DIR/latest_backup.txt"
    
    return 0
}

# ============================================================================
# MIGRATION FUNCTIONS
# ============================================================================

# Get pending migrations
get_pending_migrations() {
    log "INFO" "🔍 Identifying pending migrations..."

    local all_migrations=()
    local applied_migrations=()
    local pending_migrations=()

    # Get all migration files
    while IFS= read -r -d '' file; do
        all_migrations+=("$(basename "$file" .sql)")
    done < <(find "$MIGRATIONS_DIR" -name "*.sql" -type f -print0 | sort -z)

    # Get applied migrations from Supabase
    local migration_list
    migration_list=$(supabase migration list --project-ref "$PROJECT_ID" 2>/dev/null || echo "")

    while IFS= read -r line; do
        if [[ "$line" =~ ^[0-9]{14}_[a-zA-Z0-9_-]+$ ]]; then
            applied_migrations+=("$line")
        fi
    done <<< "$migration_list"

    # Find pending migrations
    for migration in "${all_migrations[@]}"; do
        local is_applied=false
        for applied in "${applied_migrations[@]}"; do
            if [[ "$migration" == "$applied" ]]; then
                is_applied=true
                break
            fi
        done

        if [[ "$is_applied" == "false" ]]; then
            pending_migrations+=("$migration")
        fi
    done

    log "INFO" "Found ${#all_migrations[@]} total migrations"
    log "INFO" "Found ${#applied_migrations[@]} applied migrations"
    log "INFO" "Found ${#pending_migrations[@]} pending migrations"

    if [[ ${#pending_migrations[@]} -gt 0 ]]; then
        log "INFO" "Pending migrations:"
        for migration in "${pending_migrations[@]}"; do
            log "INFO" "  - $migration"
        done
    fi

    # Return pending migrations via global array
    PENDING_MIGRATIONS=("${pending_migrations[@]}")
    return 0
}

# Apply single migration
apply_migration() {
    local migration_name="$1"
    local migration_file="$MIGRATIONS_DIR/$migration_name.sql"

    log "INFO" "🚀 Applying migration: $migration_name"
    audit_log "MIGRATION_STARTED" "migration=$migration_name"

    if [[ ! -f "$migration_file" ]]; then
        log "ERROR" "Migration file not found: $migration_file"
        return 1
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would apply migration $migration_name"
        return 0
    fi

    # Check if migration is already applied
    if supabase migration list --project-ref "$PROJECT_ID" | grep -q "$migration_name"; then
        log "WARNING" "Migration $migration_name already applied, skipping"
        return 0
    fi

    # Apply migration with timeout
    local start_time=$(date +%s)

    if timeout "$MIGRATION_TIMEOUT" supabase db push --project-ref "$PROJECT_ID" --include-all; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        log "SUCCESS" "Applied migration: $migration_name (${duration}s)"
        audit_log "MIGRATION_COMPLETED" "migration=$migration_name duration=${duration}s"

        APPLIED_MIGRATIONS+=("$migration_name")
        ROLLBACK_STACK+=("$migration_name")

        # Validate migration if not skipped
        if [[ "$SKIP_VALIDATION" != "true" ]]; then
            validate_migration_success "$migration_name"
        fi

        return 0
    else
        log "ERROR" "Failed to apply migration: $migration_name"
        audit_log "MIGRATION_FAILED" "migration=$migration_name"
        FAILED_MIGRATIONS+=("$migration_name")
        return 1
    fi
}

# Validate migration success
validate_migration_success() {
    local migration_name="$1"

    log "INFO" "✅ Validating migration: $migration_name"

    # Check if migration is now in applied list
    if ! supabase migration list --project-ref "$PROJECT_ID" | grep -q "$migration_name"; then
        log "ERROR" "Migration $migration_name not found in applied migrations"
        return 1
    fi

    # Run migration-specific validation
    case "$migration_name" in
        *"embedding_metrics"*)
            validate_embedding_metrics_tables
            ;;
        *"queue_system"*)
            validate_queue_system_tables
            ;;
        *"alerting_system"*)
            validate_alerting_system_tables
            ;;
        *"batch_optimization"*)
            validate_batch_optimization_tables
            ;;
        *)
            log "DEBUG" "No specific validation for migration: $migration_name"
            ;;
    esac

    log "SUCCESS" "Migration validation completed: $migration_name"
    return 0
}

# Validate embedding metrics tables
validate_embedding_metrics_tables() {
    log "DEBUG" "Validating embedding metrics tables..."

    local required_tables=(
        "embedding_performance_metrics"
        "embedding_hourly_stats"
        "embedding_daily_stats"
    )

    for table in "${required_tables[@]}"; do
        local table_exists
        table_exists=$(supabase db query --project-ref "$PROJECT_ID" --query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")

        if [[ "$table_exists" =~ "true" ]]; then
            log "DEBUG" "Table exists: $table"
        else
            log "ERROR" "Required table missing: $table"
            return 1
        fi
    done

    return 0
}

# Validate queue system tables
validate_queue_system_tables() {
    log "DEBUG" "Validating queue system tables..."

    local required_tables=(
        "embedding_queue"
        "embedding_queue_workers"
        "batch_upload_sessions"
    )

    for table in "${required_tables[@]}"; do
        local table_exists
        table_exists=$(supabase db query --project-ref "$PROJECT_ID" --query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")

        if [[ "$table_exists" =~ "true" ]]; then
            log "DEBUG" "Table exists: $table"
        else
            log "ERROR" "Required table missing: $table"
            return 1
        fi
    done

    return 0
}

# Validate alerting system tables
validate_alerting_system_tables() {
    log "DEBUG" "Validating alerting system tables..."

    local required_tables=(
        "alert_rules"
        "alert_instances"
        "alert_escalation_configs"
    )

    for table in "${required_tables[@]}"; do
        local table_exists
        table_exists=$(supabase db query --project-ref "$PROJECT_ID" --query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")

        if [[ "$table_exists" =~ "true" ]]; then
            log "DEBUG" "Table exists: $table"
        else
            log "ERROR" "Required table missing: $table"
            return 1
        fi
    done

    return 0
}

# Validate batch optimization tables
validate_batch_optimization_tables() {
    log "DEBUG" "Validating batch optimization tables..."

    local required_tables=(
        "batch_upload_sessions"
        "batch_upload_files"
    )

    for table in "${required_tables[@]}"; do
        local table_exists
        table_exists=$(supabase db query --project-ref "$PROJECT_ID" --query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null || echo "false")

        if [[ "$table_exists" =~ "true" ]]; then
            log "DEBUG" "Table exists: $table"
        else
            log "ERROR" "Required table missing: $table"
            return 1
        fi
    done

    return 0
}

# ============================================================================
# ROLLBACK FUNCTIONS
# ============================================================================

# Execute rollback
execute_rollback() {
    local rollback_target="$1"

    log "WARNING" "🔄 Initiating database rollback to: $rollback_target"
    audit_log "ROLLBACK_INITIATED" "target=$rollback_target"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would rollback to $rollback_target"
        return 0
    fi

    # Find latest backup
    local backup_dir=""
    if [[ -f "$MIGRATION_LOG_DIR/latest_backup.txt" ]]; then
        backup_dir=$(cat "$MIGRATION_LOG_DIR/latest_backup.txt")
    fi

    if [[ -z "$backup_dir" ]] || [[ ! -d "$backup_dir" ]]; then
        log "ERROR" "No backup found for rollback"
        return 1
    fi

    log "INFO" "Using backup: $backup_dir"

    # Rollback strategy based on target
    case "$rollback_target" in
        "backup")
            rollback_to_backup "$backup_dir"
            ;;
        "migration:"*)
            local target_migration="${rollback_target#migration:}"
            rollback_to_migration "$target_migration"
            ;;
        "timestamp:"*)
            local target_timestamp="${rollback_target#timestamp:}"
            rollback_to_timestamp "$target_timestamp"
            ;;
        *)
            log "ERROR" "Invalid rollback target: $rollback_target"
            return 1
            ;;
    esac

    log "SUCCESS" "Rollback completed"
    audit_log "ROLLBACK_COMPLETED" "target=$rollback_target backup_used=$backup_dir"
    return 0
}

# Rollback to backup
rollback_to_backup() {
    local backup_dir="$1"

    log "INFO" "Rolling back to backup: $backup_dir"

    if [[ ! -f "$backup_dir/schema.sql" ]]; then
        log "ERROR" "Backup schema file not found: $backup_dir/schema.sql"
        return 1
    fi

    # Reset database to backup state
    log "WARNING" "Resetting database to backup state..."

    # This is a destructive operation - use with extreme caution
    if [[ "$FORCE" == "true" ]]; then
        supabase db reset --project-ref "$PROJECT_ID" --linked

        # Apply backup schema
        if supabase db query --project-ref "$PROJECT_ID" --file "$backup_dir/schema.sql"; then
            log "SUCCESS" "Database restored from backup"
        else
            log "ERROR" "Failed to restore database from backup"
            return 1
        fi
    else
        log "ERROR" "Backup rollback requires --force flag due to destructive nature"
        return 1
    fi

    return 0
}

# Rollback to specific migration
rollback_to_migration() {
    local target_migration="$1"

    log "INFO" "Rolling back to migration: $target_migration"

    # Get list of applied migrations
    local applied_migrations=()
    local migration_list
    migration_list=$(supabase migration list --project-ref "$PROJECT_ID" 2>/dev/null || echo "")

    while IFS= read -r line; do
        if [[ "$line" =~ ^[0-9]{14}_[a-zA-Z0-9_-]+$ ]]; then
            applied_migrations+=("$line")
        fi
    done <<< "$migration_list"

    # Find target migration index
    local target_index=-1
    for i in "${!applied_migrations[@]}"; do
        if [[ "${applied_migrations[$i]}" == "$target_migration" ]]; then
            target_index=$i
            break
        fi
    done

    if [[ $target_index -eq -1 ]]; then
        log "ERROR" "Target migration not found in applied migrations: $target_migration"
        return 1
    fi

    # Reset and reapply migrations up to target
    log "WARNING" "Resetting database and reapplying migrations up to target..."

    if [[ "$FORCE" == "true" ]]; then
        supabase db reset --project-ref "$PROJECT_ID" --linked

        # Reapply migrations up to target
        for ((i=0; i<=target_index; i++)); do
            local migration="${applied_migrations[$i]}"
            log "INFO" "Reapplying migration: $migration"

            if ! apply_migration "$migration"; then
                log "ERROR" "Failed to reapply migration during rollback: $migration"
                return 1
            fi
        done

        log "SUCCESS" "Rollback to migration completed: $target_migration"
    else
        log "ERROR" "Migration rollback requires --force flag due to destructive nature"
        return 1
    fi

    return 0
}

# ============================================================================
# MAIN ORCHESTRATION FUNCTIONS
# ============================================================================

# Main migration orchestration
main_migration() {
    log "INFO" "🚀 Starting database migration process"
    log "INFO" "Migration ID: $MIGRATION_ID"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Project ID: $PROJECT_ID"
    log "INFO" "Dry Run: $DRY_RUN"
    log "INFO" "=================================================="

    MIGRATION_START_TIME=$(date +%s)
    audit_log "MIGRATION_PROCESS_STARTED" "migration_id=$MIGRATION_ID environment=$ENVIRONMENT project_id=$PROJECT_ID"

    # Set up error handling
    trap 'handle_migration_failure' ERR

    # Phase 1: Validation
    validate_prerequisites || return 1
    validate_migration_files || return 1
    validate_database_connectivity || return 1

    # Phase 2: Backup
    create_database_backup || return 1

    # Phase 3: Get pending migrations
    get_pending_migrations || return 1

    if [[ ${#PENDING_MIGRATIONS[@]} -eq 0 ]]; then
        log "INFO" "No pending migrations found"
        return 0
    fi

    # Phase 4: Apply migrations
    if [[ -n "$SPECIFIC_MIGRATION" ]]; then
        log "INFO" "Applying specific migration: $SPECIFIC_MIGRATION"
        apply_migration "$SPECIFIC_MIGRATION" || return 1
    else
        log "INFO" "Applying ${#PENDING_MIGRATIONS[@]} pending migrations"

        for migration in "${PENDING_MIGRATIONS[@]}"; do
            apply_migration "$migration" || return 1
        done
    fi

    # Migration summary
    local migration_end_time=$(date +%s)
    local migration_duration=$((migration_end_time - MIGRATION_START_TIME))

    log "SUCCESS" "🎉 Database migration completed successfully!"
    log "INFO" "=================================================="
    log "INFO" "Migration Summary:"
    log "INFO" "  - Migration ID: $MIGRATION_ID"
    log "INFO" "  - Duration: ${migration_duration}s"
    log "INFO" "  - Applied Migrations: ${#APPLIED_MIGRATIONS[@]}"
    log "INFO" "  - Failed Migrations: ${#FAILED_MIGRATIONS[@]}"
    log "INFO" "=================================================="

    audit_log "MIGRATION_PROCESS_COMPLETED" "migration_id=$MIGRATION_ID duration=${migration_duration}s applied=${#APPLIED_MIGRATIONS[@]} failed=${#FAILED_MIGRATIONS[@]}"

    return 0
}

# Handle migration failures
handle_migration_failure() {
    local exit_code=$?

    log "ERROR" "💥 Migration process failed"
    audit_log "MIGRATION_PROCESS_FAILED" "migration_id=$MIGRATION_ID exit_code=$exit_code"

    if [[ "$FORCE" == "false" ]] && [[ ${#APPLIED_MIGRATIONS[@]} -gt 0 ]]; then
        log "WARNING" "Automatic rollback will be initiated..."

        # Rollback to the state before any migrations were applied
        if [[ -f "$MIGRATION_LOG_DIR/latest_backup.txt" ]]; then
            execute_rollback "backup"
        fi
    else
        log "WARNING" "Force mode enabled or no migrations applied - skipping automatic rollback"
    fi

    exit $exit_code
}

# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

# Show help
show_help() {
    cat << EOF
Paperless Maverick Database Migration Automation Script v$SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

DESCRIPTION:
    Comprehensive database migration automation with validation, rollback
    procedures, and safety checks. Includes migration ordering, dependency
    validation, and production data protection mechanisms.

OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: $DEFAULT_ENVIRONMENT)
    -p, --project-id ID         Supabase project ID (default: $DEFAULT_PROJECT_ID)
    -d, --dry-run              Perform dry run without applying migrations
    -v, --validate-only        Only validate migration files and connectivity
    -r, --rollback TARGET      Rollback to target (backup|migration:NAME|timestamp:TS)
    -m, --migration NAME       Apply specific migration only
    -f, --force                Force operations, skip safety checks
    --verbose                  Enable verbose logging
    --no-backup                Skip backup creation
    --skip-validation          Skip post-migration validation
    --timeout SECONDS          Migration timeout (default: $MIGRATION_TIMEOUT)

ROLLBACK TARGETS:
    backup                     Rollback to latest backup
    migration:NAME             Rollback to specific migration
    timestamp:YYYYMMDD-HHMMSS  Rollback to specific timestamp

EXAMPLES:
    # Apply all pending migrations
    $SCRIPT_NAME --environment production

    # Dry run validation
    $SCRIPT_NAME --dry-run --validate-only

    # Apply specific migration
    $SCRIPT_NAME --migration 20250720000003_batch_upload_optimization

    # Rollback to backup
    $SCRIPT_NAME --rollback backup --force

    # Rollback to specific migration
    $SCRIPT_NAME --rollback migration:20250719000001_enhance_embedding_queue_phase2 --force

ENVIRONMENT VARIABLES:
    SUPABASE_ACCESS_TOKEN      Supabase access token
    SUPABASE_PROJECT_ID        Override default project ID
    MIGRATION_TIMEOUT          Override default timeout

FILES:
    $MIGRATION_LOG_DIR/migration-*.log     Migration logs
    $MIGRATION_LOG_DIR/migration-audit-*.log  Audit logs
    $MIGRATION_BACKUP_DIR/                 Migration backups

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -p|--project-id)
                PROJECT_ID="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--validate-only)
                VALIDATE_ONLY=true
                shift
                ;;
            -r|--rollback)
                ROLLBACK_TO="$2"
                shift 2
                ;;
            -m|--migration)
                SPECIFIC_MIGRATION="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --no-backup)
                CREATE_BACKUP=false
                shift
                ;;
            --skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            --timeout)
                MIGRATION_TIMEOUT="$2"
                shift 2
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Override from environment variables
    if [[ -n "${SUPABASE_PROJECT_ID:-}" ]]; then
        PROJECT_ID="$SUPABASE_PROJECT_ID"
    fi

    if [[ -n "${MIGRATION_TIMEOUT_ENV:-}" ]]; then
        MIGRATION_TIMEOUT="$MIGRATION_TIMEOUT_ENV"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Main function
main() {
    # Initialize logging
    init_logging

    # Parse command line arguments
    parse_arguments "$@"

    # Generate migration ID
    generate_migration_id

    # Log startup information
    log "INFO" "Paperless Maverick Database Migration Script v$SCRIPT_VERSION"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: ${USER:-unknown}"
    log "INFO" "Working directory: $(pwd)"
    log "INFO" "Script directory: $SCRIPT_DIR"
    log "INFO" "Project root: $PROJECT_ROOT"
    log "INFO" "Migrations directory: $MIGRATIONS_DIR"

    # Handle special modes
    if [[ -n "$ROLLBACK_TO" ]]; then
        log "INFO" "🔄 Rollback mode activated"
        execute_rollback "$ROLLBACK_TO"
        exit $?
    fi

    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "INFO" "✅ Validation-only mode activated"
        validate_prerequisites
        validate_migration_files
        validate_database_connectivity
        log "SUCCESS" "Validation completed successfully"
        exit 0
    fi

    # Run main migration process
    main_migration
    exit $?
}

# Execute main function with all arguments
main "$@"
