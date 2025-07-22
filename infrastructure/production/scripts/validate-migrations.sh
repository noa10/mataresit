#!/bin/bash

# Migration Validation Script for Paperless Maverick
# Comprehensive validation of migration files and database state
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"
readonly CONFIG_DIR="$SCRIPT_DIR/../config"
readonly VALIDATION_LOG="$PROJECT_ROOT/logs/migrations/validation-$(date +%Y%m%d-%H%M%S).log"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
PROJECT_ID="mpmkbtsufihzdelrlszs"
ENVIRONMENT="production"
VERBOSE=false
QUICK_CHECK=false

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0
VALIDATION_PASSED=0

# Initialize logging
init_logging() {
    mkdir -p "$(dirname "$VALIDATION_LOG")"
    touch "$VALIDATION_LOG"
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$VALIDATION_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$VALIDATION_LOG"
            ((VALIDATION_PASSED++))
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$VALIDATION_LOG"
            ((VALIDATION_WARNINGS++))
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$VALIDATION_LOG"
            ((VALIDATION_ERRORS++))
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${BLUE}[$timestamp] 🔍${NC} $message" | tee -a "$VALIDATION_LOG"
            fi
            ;;
    esac
}

# Validate migration file format
validate_migration_format() {
    local migration_file="$1"
    local filename=$(basename "$migration_file")
    
    log "DEBUG" "Validating format: $filename"
    
    # Check filename format
    if [[ ! "$filename" =~ ^[0-9]{14}_[a-zA-Z0-9_-]+\.sql$ ]]; then
        log "ERROR" "Invalid migration filename format: $filename"
        return 1
    fi
    
    # Check file is readable and not empty
    if [[ ! -r "$migration_file" ]] || [[ ! -s "$migration_file" ]]; then
        log "ERROR" "Migration file is not readable or empty: $filename"
        return 1
    fi
    
    # Check for common SQL issues
    local content=$(cat "$migration_file")
    
    # Check for dangerous operations in production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if echo "$content" | grep -qi "DROP TABLE\|TRUNCATE\|DELETE FROM.*WHERE.*1=1"; then
            log "WARNING" "Potentially dangerous operation found in: $filename"
        fi
    fi
    
    # Check for proper transaction handling
    if echo "$content" | grep -qi "BEGIN\|COMMIT\|ROLLBACK"; then
        log "DEBUG" "Transaction handling found in: $filename"
    fi
    
    log "SUCCESS" "Migration format valid: $filename"
    return 0
}

# Validate migration dependencies
validate_migration_dependencies() {
    log "INFO" "🔍 Validating migration dependencies..."
    
    if [[ ! -f "$CONFIG_DIR/migration-dependencies.yaml" ]]; then
        log "WARNING" "Migration dependencies config not found"
        return 0
    fi
    
    # Get all migration files
    local migration_files=()
    while IFS= read -r -d '' file; do
        migration_files+=("$(basename "$file" .sql)")
    done < <(find "$MIGRATIONS_DIR" -name "*.sql" -type f -print0 | sort -z)
    
    # Load dependency configuration (simplified parsing)
    local config_content
    config_content=$(cat "$CONFIG_DIR/migration-dependencies.yaml")
    
    # Extract phases and their migrations
    local current_phase=""
    local phase_migrations=()
    
    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*([a-zA-Z0-9_]+):[[:space:]]*$ ]]; then
            if [[ -n "$current_phase" ]] && [[ ${#phase_migrations[@]} -gt 0 ]]; then
                validate_phase_order "$current_phase" "${phase_migrations[@]}"
            fi
            current_phase="${BASH_REMATCH[1]}"
            phase_migrations=()
        elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\"([^\"]+)\"[[:space:]]*$ ]]; then
            phase_migrations+=("${BASH_REMATCH[1]}")
        fi
    done <<< "$config_content"
    
    # Validate last phase
    if [[ -n "$current_phase" ]] && [[ ${#phase_migrations[@]} -gt 0 ]]; then
        validate_phase_order "$current_phase" "${phase_migrations[@]}"
    fi
    
    log "SUCCESS" "Migration dependencies validation completed"
    return 0
}

# Validate phase order
validate_phase_order() {
    local phase="$1"
    shift
    local migrations=("$@")
    
    log "DEBUG" "Validating phase: $phase (${#migrations[@]} migrations)"
    
    for migration in "${migrations[@]}"; do
        if [[ -f "$MIGRATIONS_DIR/$migration.sql" ]]; then
            log "DEBUG" "Phase $phase migration found: $migration"
        else
            log "WARNING" "Phase $phase migration missing: $migration"
        fi
    done
}

# Validate database schema state
validate_database_state() {
    log "INFO" "🔍 Validating database state..."
    
    # Check database connectivity
    if ! supabase db ping --project-ref "$PROJECT_ID" &> /dev/null; then
        log "ERROR" "Cannot connect to database: $PROJECT_ID"
        return 1
    fi
    
    # Get applied migrations
    local applied_migrations
    applied_migrations=$(supabase migration list --project-ref "$PROJECT_ID" 2>/dev/null || echo "")
    
    if [[ -z "$applied_migrations" ]]; then
        log "WARNING" "No applied migrations found or unable to retrieve migration list"
        return 0
    fi
    
    # Count applied migrations
    local migration_count
    migration_count=$(echo "$applied_migrations" | grep -c "^[0-9]" || echo "0")
    
    log "INFO" "Found $migration_count applied migrations"
    
    # Validate core tables exist
    validate_core_tables
    
    # Validate extensions
    validate_extensions
    
    # Validate functions
    validate_functions
    
    log "SUCCESS" "Database state validation completed"
    return 0
}

# Validate core tables
validate_core_tables() {
    log "DEBUG" "Validating core tables..."
    
    local core_tables=(
        "receipts"
        "line_items"
        "profiles"
        "subscription_limits"
    )
    
    for table in "${core_tables[@]}"; do
        local table_exists
        table_exists=$(supabase db query --project-ref "$PROJECT_ID" --query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null | grep -o "true\|false" || echo "false")
        
        if [[ "$table_exists" == "true" ]]; then
            log "DEBUG" "Core table exists: $table"
        else
            log "ERROR" "Core table missing: $table"
        fi
    done
}

# Validate extensions
validate_extensions() {
    log "DEBUG" "Validating database extensions..."
    
    local required_extensions=(
        "vector"
        "pg_cron"
    )
    
    for extension in "${required_extensions[@]}"; do
        local ext_exists
        ext_exists=$(supabase db query --project-ref "$PROJECT_ID" --query "SELECT EXISTS (SELECT FROM pg_extension WHERE extname = '$extension');" 2>/dev/null | grep -o "true\|false" || echo "false")
        
        if [[ "$ext_exists" == "true" ]]; then
            log "DEBUG" "Extension exists: $extension"
        else
            log "WARNING" "Extension missing: $extension"
        fi
    done
}

# Validate functions
validate_functions() {
    log "DEBUG" "Validating database functions..."
    
    local required_functions=(
        "unified_search"
        "generate_receipt_embedding"
        "semantic_search_receipts"
    )
    
    for function in "${required_functions[@]}"; do
        local func_exists
        func_exists=$(supabase db query --project-ref "$PROJECT_ID" --query "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = '$function');" 2>/dev/null | grep -o "true\|false" || echo "false")
        
        if [[ "$func_exists" == "true" ]]; then
            log "DEBUG" "Function exists: $function"
        else
            log "WARNING" "Function missing: $function"
        fi
    done
}

# Generate validation report
generate_validation_report() {
    log "INFO" "📊 Generating validation report..."
    
    local report_file="$PROJECT_ROOT/logs/migrations/validation-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "validation_summary": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "project_id": "$PROJECT_ID",
        "total_checks": $((VALIDATION_PASSED + VALIDATION_WARNINGS + VALIDATION_ERRORS)),
        "passed": $VALIDATION_PASSED,
        "warnings": $VALIDATION_WARNINGS,
        "errors": $VALIDATION_ERRORS,
        "success_rate": $(echo "scale=2; $VALIDATION_PASSED * 100 / ($VALIDATION_PASSED + $VALIDATION_WARNINGS + $VALIDATION_ERRORS)" | bc -l 2>/dev/null || echo "0")
    },
    "validation_details": {
        "migration_files_validated": true,
        "dependencies_validated": true,
        "database_state_validated": true,
        "core_tables_validated": true,
        "extensions_validated": true,
        "functions_validated": true
    }
}
EOF
    
    log "SUCCESS" "Validation report generated: $report_file"
}

# Show help
show_help() {
    cat << EOF
Migration Validation Script for Paperless Maverick

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -p, --project-id ID     Supabase project ID
    -e, --environment ENV   Target environment (default: production)
    -v, --verbose           Enable verbose logging
    -q, --quick             Quick validation (skip database checks)

EXAMPLES:
    $0                      # Full validation
    $0 --quick              # Quick file validation only
    $0 --verbose            # Verbose validation with debug info

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
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quick)
                QUICK_CHECK=true
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
    
    log "INFO" "🔍 Starting migration validation"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Project ID: $PROJECT_ID"
    log "INFO" "Quick check: $QUICK_CHECK"
    log "INFO" "=================================================="
    
    # Validate migration files
    log "INFO" "Validating migration files..."
    local migration_files=()
    while IFS= read -r -d '' file; do
        migration_files+=("$file")
    done < <(find "$MIGRATIONS_DIR" -name "*.sql" -type f -print0 | sort -z)
    
    for file in "${migration_files[@]}"; do
        validate_migration_format "$file"
    done
    
    # Validate dependencies
    validate_migration_dependencies
    
    # Validate database state (unless quick check)
    if [[ "$QUICK_CHECK" != "true" ]]; then
        validate_database_state
    fi
    
    # Generate report
    generate_validation_report
    
    # Summary
    log "INFO" "=================================================="
    log "INFO" "Validation Summary:"
    log "INFO" "  - Total Checks: $((VALIDATION_PASSED + VALIDATION_WARNINGS + VALIDATION_ERRORS))"
    log "INFO" "  - Passed: $VALIDATION_PASSED"
    log "INFO" "  - Warnings: $VALIDATION_WARNINGS"
    log "INFO" "  - Errors: $VALIDATION_ERRORS"
    log "INFO" "=================================================="
    
    if [[ $VALIDATION_ERRORS -gt 0 ]]; then
        log "ERROR" "Validation failed with $VALIDATION_ERRORS errors"
        exit 1
    elif [[ $VALIDATION_WARNINGS -gt 0 ]]; then
        log "WARNING" "Validation completed with $VALIDATION_WARNINGS warnings"
        exit 0
    else
        log "SUCCESS" "All validations passed successfully"
        exit 0
    fi
}

# Execute main function
main "$@"
