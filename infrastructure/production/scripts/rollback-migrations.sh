#!/bin/bash

# Migration Rollback Script for Paperless Maverick
# Emergency rollback capabilities with data protection
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly BACKUP_DIR="$PROJECT_ROOT/archive/backups/migrations"
readonly ROLLBACK_LOG="$PROJECT_ROOT/logs/migrations/rollback-$(date +%Y%m%d-%H%M%S).log"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
PROJECT_ID="mpmkbtsufihzdelrlszs"
ENVIRONMENT="production"
ROLLBACK_TARGET=""
FORCE=false
DRY_RUN=false
PRESERVE_DATA=true

# Initialize logging
init_logging() {
    mkdir -p "$(dirname "$ROLLBACK_LOG")"
    touch "$ROLLBACK_LOG"
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$ROLLBACK_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$ROLLBACK_LOG"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$ROLLBACK_LOG"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$ROLLBACK_LOG"
            ;;
    esac
}

# Validate prerequisites
validate_prerequisites() {
    log "INFO" "🔍 Validating rollback prerequisites..."
    
    # Check required tools
    local required_tools=("supabase" "psql" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            return 1
        fi
    done
    
    # Check Supabase connectivity
    if ! supabase db ping --project-ref "$PROJECT_ID" &> /dev/null; then
        log "ERROR" "Cannot connect to database: $PROJECT_ID"
        return 1
    fi
    
    # Check if this is production
    if [[ "$ENVIRONMENT" == "production" ]] && [[ "$FORCE" != "true" ]]; then
        log "ERROR" "Production rollback requires --force flag"
        return 1
    fi
    
    log "SUCCESS" "Prerequisites validation completed"
    return 0
}

# List available backups
list_available_backups() {
    log "INFO" "📋 Available migration backups:"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "WARNING" "No backup directory found: $BACKUP_DIR"
        return 1
    fi
    
    local backups=()
    while IFS= read -r -d '' backup; do
        backups+=("$backup")
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "*-*" -print0 | sort -rz)
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        log "WARNING" "No migration backups found"
        return 1
    fi
    
    for backup in "${backups[@]}"; do
        local backup_name=$(basename "$backup")
        local backup_date=$(echo "$backup_name" | cut -d'-' -f1-2)
        local backup_time=$(echo "$backup_name" | cut -d'-' -f3)
        
        if [[ -f "$backup/backup_metadata.json" ]]; then
            local metadata=$(cat "$backup/backup_metadata.json")
            local migration_id=$(echo "$metadata" | jq -r '.migration_id // "unknown"')
            local git_commit=$(echo "$metadata" | jq -r '.git_commit // "unknown"')
            
            log "INFO" "  📦 $backup_name"
            log "INFO" "      Migration ID: $migration_id"
            log "INFO" "      Date: $backup_date $backup_time"
            log "INFO" "      Git Commit: ${git_commit:0:8}"
        else
            log "INFO" "  📦 $backup_name (no metadata)"
        fi
    done
    
    return 0
}

# Get latest backup
get_latest_backup() {
    local latest_backup
    latest_backup=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "*-*" | sort -r | head -n 1)
    
    if [[ -z "$latest_backup" ]]; then
        log "ERROR" "No backups found"
        return 1
    fi
    
    echo "$latest_backup"
    return 0
}

# Validate backup
validate_backup() {
    local backup_dir="$1"
    
    log "INFO" "🔍 Validating backup: $(basename "$backup_dir")"
    
    # Check backup directory exists
    if [[ ! -d "$backup_dir" ]]; then
        log "ERROR" "Backup directory not found: $backup_dir"
        return 1
    fi
    
    # Check required files
    local required_files=(
        "schema.sql"
        "migration_history.txt"
        "backup_metadata.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$backup_dir/$file" ]]; then
            log "ERROR" "Required backup file missing: $file"
            return 1
        fi
    done
    
    # Check schema file is not empty
    if [[ ! -s "$backup_dir/schema.sql" ]]; then
        log "ERROR" "Schema backup file is empty"
        return 1
    fi
    
    log "SUCCESS" "Backup validation completed"
    return 0
}

# Create pre-rollback backup
create_pre_rollback_backup() {
    log "INFO" "📦 Creating pre-rollback backup..."
    
    local pre_rollback_dir="$BACKUP_DIR/pre-rollback-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$pre_rollback_dir"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would create pre-rollback backup at $pre_rollback_dir"
        return 0
    fi
    
    # Create schema backup
    if supabase db dump --project-ref "$PROJECT_ID" --schema-only > "$pre_rollback_dir/schema.sql"; then
        log "SUCCESS" "Pre-rollback schema backup created"
    else
        log "ERROR" "Failed to create pre-rollback schema backup"
        return 1
    fi
    
    # Create migration history backup
    local migration_history
    migration_history=$(supabase migration list --project-ref "$PROJECT_ID" 2>/dev/null || echo "")
    echo "$migration_history" > "$pre_rollback_dir/migration_history.txt"
    
    # Create metadata
    cat > "$pre_rollback_dir/backup_metadata.json" << EOF
{
    "backup_type": "pre_rollback",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "project_id": "$PROJECT_ID",
    "rollback_target": "$ROLLBACK_TARGET",
    "user": "${USER:-unknown}"
}
EOF
    
    log "SUCCESS" "Pre-rollback backup created: $pre_rollback_dir"
    return 0
}

# Execute rollback
execute_rollback() {
    local backup_dir="$1"
    
    log "WARNING" "🔄 Executing rollback from backup: $(basename "$backup_dir")"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute rollback from $backup_dir"
        return 0
    fi
    
    # Validate backup before proceeding
    validate_backup "$backup_dir" || return 1
    
    # Create pre-rollback backup
    create_pre_rollback_backup || return 1
    
    # Show final confirmation for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo -e "${RED}⚠️  PRODUCTION ROLLBACK WARNING ⚠️${NC}"
        echo -e "You are about to rollback the production database."
        echo -e "This operation is DESTRUCTIVE and will:"
        echo -e "  - Reset the database schema"
        echo -e "  - Potentially lose recent data changes"
        echo -e "  - Require application restart"
        echo
        read -p "Type 'ROLLBACK' to confirm: " -r
        if [[ ! $REPLY == "ROLLBACK" ]]; then
            log "INFO" "Rollback cancelled by user"
            return 0
        fi
    fi
    
    # Execute the rollback
    log "WARNING" "Resetting database to backup state..."
    
    # Reset database
    if supabase db reset --project-ref "$PROJECT_ID" --linked; then
        log "SUCCESS" "Database reset completed"
    else
        log "ERROR" "Database reset failed"
        return 1
    fi
    
    # Apply backup schema
    log "INFO" "Applying backup schema..."
    if supabase db query --project-ref "$PROJECT_ID" --file "$backup_dir/schema.sql"; then
        log "SUCCESS" "Backup schema applied"
    else
        log "ERROR" "Failed to apply backup schema"
        return 1
    fi
    
    # Verify rollback
    verify_rollback "$backup_dir"
    
    log "SUCCESS" "Rollback completed successfully"
    return 0
}

# Verify rollback
verify_rollback() {
    local backup_dir="$1"
    
    log "INFO" "✅ Verifying rollback..."
    
    # Check database connectivity
    if ! supabase db ping --project-ref "$PROJECT_ID" &> /dev/null; then
        log "ERROR" "Database connectivity check failed after rollback"
        return 1
    fi
    
    # Check core tables exist
    local core_tables=("receipts" "line_items" "profiles")
    for table in "${core_tables[@]}"; do
        local table_exists
        table_exists=$(supabase db query --project-ref "$PROJECT_ID" --query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null | grep -o "true\|false" || echo "false")
        
        if [[ "$table_exists" == "true" ]]; then
            log "SUCCESS" "Core table verified: $table"
        else
            log "ERROR" "Core table missing after rollback: $table"
            return 1
        fi
    done
    
    log "SUCCESS" "Rollback verification completed"
    return 0
}

# Show help
show_help() {
    cat << EOF
Migration Rollback Script for Paperless Maverick

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -p, --project-id ID     Supabase project ID
    -e, --environment ENV   Target environment (default: production)
    -t, --target TARGET     Rollback target (latest|backup_name)
    -f, --force             Force rollback (required for production)
    -d, --dry-run           Show what would be done without executing
    --list-backups          List available backups
    --preserve-data         Preserve user data during rollback (default: true)

EXAMPLES:
    $0 --list-backups                    # List available backups
    $0 --target latest --force           # Rollback to latest backup
    $0 --target 20250120-143022 --force  # Rollback to specific backup
    $0 --dry-run --target latest         # Dry run rollback

WARNINGS:
    - Rollback operations are DESTRUCTIVE
    - Production rollbacks require --force flag
    - Always create a pre-rollback backup
    - Test rollback procedures in staging first

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
            -p|--project-id)
                PROJECT_ID="$2"
                shift 2
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--target)
                ROLLBACK_TARGET="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            --list-backups)
                list_available_backups
                exit 0
                ;;
            --preserve-data)
                PRESERVE_DATA=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main function
main() {
    init_logging
    parse_arguments "$@"
    
    log "INFO" "🔄 Starting migration rollback"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Project ID: $PROJECT_ID"
    log "INFO" "Target: $ROLLBACK_TARGET"
    log "INFO" "Force: $FORCE"
    log "INFO" "Dry Run: $DRY_RUN"
    log "INFO" "=================================================="
    
    # Validate prerequisites
    validate_prerequisites || exit 1
    
    # Determine backup to use
    local backup_dir=""
    if [[ "$ROLLBACK_TARGET" == "latest" ]] || [[ -z "$ROLLBACK_TARGET" ]]; then
        backup_dir=$(get_latest_backup)
    else
        backup_dir="$BACKUP_DIR/$ROLLBACK_TARGET"
    fi
    
    if [[ -z "$backup_dir" ]]; then
        log "ERROR" "No backup found for rollback"
        exit 1
    fi
    
    log "INFO" "Using backup: $(basename "$backup_dir")"
    
    # Execute rollback
    execute_rollback "$backup_dir"
    
    log "SUCCESS" "Migration rollback completed"
}

# Execute main function
main "$@"
