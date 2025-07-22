#!/bin/bash

# Comprehensive Rollback Automation System for Paperless Maverick
# Supports partial, full, and automated rollback procedures with safety checks
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

# Rollback configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly BACKUP_DIR="$PROJECT_ROOT/backups/rollback"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"

# Logging configuration
readonly LOG_DIR="$PROJECT_ROOT/logs/rollback"
readonly ROLLBACK_LOG="$LOG_DIR/rollback-$(date +%Y%m%d-%H%M%S).log"
readonly AUDIT_LOG="$LOG_DIR/rollback-audit-$(date +%Y%m%d).log"

# Default values
readonly DEFAULT_ENVIRONMENT="production"
readonly DEFAULT_NAMESPACE="paperless-maverick"
readonly ROLLBACK_TIMEOUT=600  # 10 minutes
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
NAMESPACE="$DEFAULT_NAMESPACE"
ROLLBACK_TYPE="full"
ROLLBACK_TARGET=""
DRY_RUN=false
FORCE=false
VERBOSE=false
SKIP_VALIDATION=false
SKIP_BACKUP=false
AUTO_APPROVE=false

# Rollback state
ROLLBACK_ID=""
ROLLBACK_START_TIME=""
ROLLBACK_REASON=""
ROLLBACK_INITIATED_BY="${USER:-unknown}"

# Component tracking
ROLLBACK_COMPONENTS=()
ROLLBACK_SUCCESS=()
ROLLBACK_FAILED=()

# Rollback levels
declare -A ROLLBACK_LEVELS=(
    ["application"]="Application deployment only"
    ["database"]="Database migrations only"
    ["infrastructure"]="Infrastructure components only"
    ["monitoring"]="Monitoring stack only"
    ["partial"]="Selected components only"
    ["full"]="Complete system rollback"
)

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Initialize logging
init_logging() {
    mkdir -p "$LOG_DIR" "$BACKUP_DIR"
    touch "$ROLLBACK_LOG" "$AUDIT_LOG"
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
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[$timestamp] 🔍${NC} $message" | tee -a "$ROLLBACK_LOG"
            fi
            ;;
        "AUDIT")
            echo "[$timestamp] $message" >> "$AUDIT_LOG"
            ;;
    esac
}

# Audit logging
audit_log() {
    local action="$1"
    local details="$2"
    local rollback_id="${ROLLBACK_ID:-unknown}"
    
    log "AUDIT" "ROLLBACK_ID=$rollback_id USER=$ROLLBACK_INITIATED_BY ACTION=$action DETAILS=$details"
}

# Generate unique rollback ID
generate_rollback_id() {
    ROLLBACK_ID="rollback-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    log "INFO" "Generated rollback ID: $ROLLBACK_ID"
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate prerequisites
validate_prerequisites() {
    log "INFO" "🔍 Validating rollback prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "curl" "jq" "yq")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log "ERROR" "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "ERROR" "Namespace '$NAMESPACE' does not exist"
        return 1
    fi
    
    # Production safety check
    if [[ "$ENVIRONMENT" == "production" ]] && [[ "$FORCE" != "true" ]]; then
        log "ERROR" "Production rollback requires --force flag for safety"
        return 1
    fi
    
    log "SUCCESS" "Prerequisites validation completed"
    return 0
}

# Validate rollback target
validate_rollback_target() {
    log "INFO" "🔍 Validating rollback target..."
    
    case "$ROLLBACK_TYPE" in
        "application"|"database"|"infrastructure"|"monitoring"|"partial"|"full")
            log "SUCCESS" "Valid rollback type: $ROLLBACK_TYPE"
            ;;
        *)
            log "ERROR" "Invalid rollback type: $ROLLBACK_TYPE"
            return 1
            ;;
    esac
    
    # Validate specific target if provided
    if [[ -n "$ROLLBACK_TARGET" ]]; then
        case "$ROLLBACK_TARGET" in
            "previous"|"latest")
                log "SUCCESS" "Valid rollback target: $ROLLBACK_TARGET"
                ;;
            "revision:"*)
                local revision="${ROLLBACK_TARGET#revision:}"
                if [[ "$revision" =~ ^[0-9]+$ ]]; then
                    log "SUCCESS" "Valid revision target: $revision"
                else
                    log "ERROR" "Invalid revision format: $revision"
                    return 1
                fi
                ;;
            "backup:"*)
                local backup_name="${ROLLBACK_TARGET#backup:}"
                if [[ -d "$BACKUP_DIR/$backup_name" ]]; then
                    log "SUCCESS" "Valid backup target: $backup_name"
                else
                    log "ERROR" "Backup not found: $backup_name"
                    return 1
                fi
                ;;
            *)
                log "ERROR" "Invalid rollback target format: $ROLLBACK_TARGET"
                return 1
                ;;
        esac
    fi
    
    return 0
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

# Create pre-rollback backup
create_pre_rollback_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log "INFO" "Skipping pre-rollback backup"
        return 0
    fi
    
    log "INFO" "💾 Creating pre-rollback backup..."
    
    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_path="$BACKUP_DIR/pre-rollback-$backup_timestamp"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would create backup at $backup_path"
        return 0
    fi
    
    mkdir -p "$backup_path"
    
    # Backup Kubernetes resources
    backup_kubernetes_resources "$backup_path"
    
    # Backup configuration
    backup_configuration "$backup_path"
    
    # Create backup metadata
    create_backup_metadata "$backup_path"
    
    log "SUCCESS" "Pre-rollback backup created: $backup_path"
    audit_log "BACKUP_CREATED" "path=$backup_path"
    return 0
}

# Backup Kubernetes resources
backup_kubernetes_resources() {
    local backup_path="$1"
    
    log "DEBUG" "Backing up Kubernetes resources..."
    
    local k8s_backup_dir="$backup_path/kubernetes"
    mkdir -p "$k8s_backup_dir"
    
    # Backup deployments
    kubectl get deployments -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/deployments.yaml"
    
    # Backup services
    kubectl get services -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/services.yaml"
    
    # Backup configmaps
    kubectl get configmaps -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/configmaps.yaml"
    
    # Backup secrets (metadata only for security)
    kubectl get secrets -n "$NAMESPACE" -o yaml | yq eval 'del(.items[].data)' - > "$k8s_backup_dir/secrets-metadata.yaml"
    
    # Backup HPA
    kubectl get hpa -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/hpa.yaml" 2>/dev/null || true
    
    log "SUCCESS" "Kubernetes resources backed up"
}

# Backup configuration
backup_configuration() {
    local backup_path="$1"
    
    log "DEBUG" "Backing up configuration..."
    
    local config_backup_dir="$backup_path/config"
    mkdir -p "$config_backup_dir"
    
    # Copy configuration files
    if [[ -d "$CONFIG_DIR" ]]; then
        cp -r "$CONFIG_DIR"/* "$config_backup_dir/"
    fi
    
    # Backup environment variables (if accessible)
    kubectl get configmap -n "$NAMESPACE" -o yaml > "$config_backup_dir/runtime-config.yaml" 2>/dev/null || true
    
    log "SUCCESS" "Configuration backed up"
}

# Create backup metadata
create_backup_metadata() {
    local backup_path="$1"
    
    cat > "$backup_path/backup-metadata.json" << EOF
{
    "backup_id": "$(basename "$backup_path")",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "rollback_id": "$ROLLBACK_ID",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "rollback_type": "$ROLLBACK_TYPE",
    "rollback_target": "$ROLLBACK_TARGET",
    "rollback_reason": "$ROLLBACK_REASON",
    "initiated_by": "$ROLLBACK_INITIATED_BY",
    "kubernetes_version": "$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')",
    "cluster_info": {
        "server_version": "$(kubectl version -o json | jq -r '.serverVersion.gitVersion' 2>/dev/null || echo 'unknown')"
    }
}
EOF
    
    log "SUCCESS" "Backup metadata created"
}

# ============================================================================
# ROLLBACK EXECUTION FUNCTIONS
# ============================================================================

# Execute application rollback
rollback_application() {
    log "INFO" "🔄 Executing application rollback..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would rollback application deployment"
        return 0
    fi

    local deployments=("paperless-maverick" "embedding-queue-workers")

    for deployment in "${deployments[@]}"; do
        log "INFO" "Rolling back deployment: $deployment"

        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            case "$ROLLBACK_TARGET" in
                "previous"|"latest"|"")
                    kubectl rollout undo deployment/"$deployment" -n "$NAMESPACE"
                    ;;
                "revision:"*)
                    local revision="${ROLLBACK_TARGET#revision:}"
                    kubectl rollout undo deployment/"$deployment" -n "$NAMESPACE" --to-revision="$revision"
                    ;;
                *)
                    log "ERROR" "Unsupported rollback target for application: $ROLLBACK_TARGET"
                    ROLLBACK_FAILED+=("$deployment")
                    continue
                    ;;
            esac

            # Wait for rollback to complete
            if kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout="${ROLLBACK_TIMEOUT}s"; then
                log "SUCCESS" "Deployment $deployment rolled back successfully"
                ROLLBACK_SUCCESS+=("$deployment")
            else
                log "ERROR" "Deployment $deployment rollback failed"
                ROLLBACK_FAILED+=("$deployment")
            fi
        else
            log "WARNING" "Deployment $deployment not found"
        fi
    done

    audit_log "APPLICATION_ROLLBACK" "deployments=${deployments[*]} target=$ROLLBACK_TARGET"
    return 0
}

# Execute database rollback
rollback_database() {
    log "INFO" "🗄️ Executing database rollback..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would rollback database migrations"
        return 0
    fi

    # Use existing database rollback script
    local db_rollback_script="$SCRIPT_DIR/rollback-migrations.sh"

    if [[ ! -f "$db_rollback_script" ]]; then
        log "ERROR" "Database rollback script not found: $db_rollback_script"
        ROLLBACK_FAILED+=("database")
        return 1
    fi

    local rollback_args=()

    # Determine rollback target
    case "$ROLLBACK_TARGET" in
        "backup:"*)
            local backup_name="${ROLLBACK_TARGET#backup:}"
            rollback_args+=("--target" "$backup_name")
            ;;
        "latest"|"previous"|"")
            rollback_args+=("--target" "latest")
            ;;
        *)
            log "ERROR" "Unsupported database rollback target: $ROLLBACK_TARGET"
            ROLLBACK_FAILED+=("database")
            return 1
            ;;
    esac

    # Add common arguments
    rollback_args+=("--environment" "$ENVIRONMENT")
    if [[ "$FORCE" == "true" ]]; then
        rollback_args+=("--force")
    fi
    if [[ "$VERBOSE" == "true" ]]; then
        rollback_args+=("--verbose")
    fi

    # Execute database rollback
    if "$db_rollback_script" "${rollback_args[@]}"; then
        log "SUCCESS" "Database rollback completed successfully"
        ROLLBACK_SUCCESS+=("database")
    else
        log "ERROR" "Database rollback failed"
        ROLLBACK_FAILED+=("database")
        return 1
    fi

    audit_log "DATABASE_ROLLBACK" "target=$ROLLBACK_TARGET"
    return 0
}

# Execute infrastructure rollback
rollback_infrastructure() {
    log "INFO" "🏗️ Executing infrastructure rollback..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would rollback infrastructure components"
        return 0
    fi

    # Rollback infrastructure components
    local components=("configmaps" "services" "hpa")

    for component in "${components[@]}"; do
        log "INFO" "Rolling back $component..."

        case "$ROLLBACK_TARGET" in
            "backup:"*)
                local backup_name="${ROLLBACK_TARGET#backup:}"
                local backup_file="$BACKUP_DIR/$backup_name/kubernetes/${component}.yaml"

                if [[ -f "$backup_file" ]]; then
                    if kubectl apply -f "$backup_file"; then
                        log "SUCCESS" "Restored $component from backup"
                        ROLLBACK_SUCCESS+=("infrastructure-$component")
                    else
                        log "ERROR" "Failed to restore $component from backup"
                        ROLLBACK_FAILED+=("infrastructure-$component")
                    fi
                else
                    log "WARNING" "Backup file not found for $component"
                fi
                ;;
            *)
                log "WARNING" "Infrastructure rollback requires backup target"
                ;;
        esac
    done

    audit_log "INFRASTRUCTURE_ROLLBACK" "components=${components[*]} target=$ROLLBACK_TARGET"
    return 0
}

# Execute monitoring rollback
rollback_monitoring() {
    log "INFO" "📊 Executing monitoring rollback..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would rollback monitoring components"
        return 0
    fi

    local monitoring_namespace="monitoring"
    local monitoring_components=("prometheus" "grafana" "alertmanager")

    for component in "${monitoring_components[@]}"; do
        log "INFO" "Rolling back monitoring component: $component"

        if kubectl get deployment "$component" -n "$monitoring_namespace" &> /dev/null; then
            case "$ROLLBACK_TARGET" in
                "previous"|"latest"|"")
                    kubectl rollout undo deployment/"$component" -n "$monitoring_namespace"
                    ;;
                "revision:"*)
                    local revision="${ROLLBACK_TARGET#revision:}"
                    kubectl rollout undo deployment/"$component" -n "$monitoring_namespace" --to-revision="$revision"
                    ;;
                *)
                    log "ERROR" "Unsupported monitoring rollback target: $ROLLBACK_TARGET"
                    ROLLBACK_FAILED+=("monitoring-$component")
                    continue
                    ;;
            esac

            # Wait for rollback to complete
            if kubectl rollout status deployment/"$component" -n "$monitoring_namespace" --timeout="${ROLLBACK_TIMEOUT}s"; then
                log "SUCCESS" "Monitoring component $component rolled back successfully"
                ROLLBACK_SUCCESS+=("monitoring-$component")
            else
                log "ERROR" "Monitoring component $component rollback failed"
                ROLLBACK_FAILED+=("monitoring-$component")
            fi
        else
            log "WARNING" "Monitoring component $component not found"
        fi
    done

    audit_log "MONITORING_ROLLBACK" "components=${monitoring_components[*]} target=$ROLLBACK_TARGET"
    return 0
}

# Execute partial rollback
rollback_partial() {
    log "INFO" "🔧 Executing partial rollback..."

    # Parse rollback components from ROLLBACK_TARGET
    if [[ -z "$ROLLBACK_TARGET" ]]; then
        log "ERROR" "Partial rollback requires specific components in target"
        return 1
    fi

    # Expected format: "components:app,db,infra"
    if [[ "$ROLLBACK_TARGET" =~ ^components: ]]; then
        local components_list="${ROLLBACK_TARGET#components:}"
        IFS=',' read -ra COMPONENTS <<< "$components_list"

        for component in "${COMPONENTS[@]}"; do
            case "$component" in
                "app"|"application")
                    rollback_application
                    ;;
                "db"|"database")
                    rollback_database
                    ;;
                "infra"|"infrastructure")
                    rollback_infrastructure
                    ;;
                "monitoring"|"mon")
                    rollback_monitoring
                    ;;
                *)
                    log "ERROR" "Unknown component for partial rollback: $component"
                    ROLLBACK_FAILED+=("partial-$component")
                    ;;
            esac
        done
    else
        log "ERROR" "Invalid partial rollback target format: $ROLLBACK_TARGET"
        return 1
    fi

    audit_log "PARTIAL_ROLLBACK" "components=$ROLLBACK_TARGET"
    return 0
}

# Execute full rollback
rollback_full() {
    log "INFO" "🔄 Executing full system rollback..."

    # Execute rollbacks in reverse dependency order
    rollback_monitoring
    rollback_application
    rollback_infrastructure
    rollback_database

    audit_log "FULL_ROLLBACK" "target=$ROLLBACK_TARGET"
    return 0
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate rollback success
validate_rollback_success() {
    if [[ "$SKIP_VALIDATION" == "true" ]]; then
        log "INFO" "Skipping rollback validation"
        return 0
    fi

    log "INFO" "✅ Validating rollback success..."

    local validation_failed=false

    # Validate application rollback
    if [[ " ${ROLLBACK_SUCCESS[*]} " =~ " paperless-maverick " ]]; then
        if ! validate_application_health; then
            validation_failed=true
        fi
    fi

    # Validate database rollback
    if [[ " ${ROLLBACK_SUCCESS[*]} " =~ " database " ]]; then
        if ! validate_database_health; then
            validation_failed=true
        fi
    fi

    # Validate monitoring rollback
    if [[ " ${ROLLBACK_SUCCESS[*]} " =~ " monitoring-prometheus " ]]; then
        if ! validate_monitoring_health; then
            validation_failed=true
        fi
    fi

    if [[ "$validation_failed" == "true" ]]; then
        log "ERROR" "Rollback validation failed"
        return 1
    else
        log "SUCCESS" "Rollback validation completed successfully"
        return 0
    fi
}

# Validate application health after rollback
validate_application_health() {
    log "DEBUG" "Validating application health..."

    local deployments=("paperless-maverick" "embedding-queue-workers")

    for deployment in "${deployments[@]}"; do
        # Check deployment status
        local ready_replicas
        ready_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired_replicas
        desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

        if [[ "$ready_replicas" != "$desired_replicas" ]] || [[ "$ready_replicas" -eq 0 ]]; then
            log "ERROR" "Deployment $deployment is not healthy after rollback: $ready_replicas/$desired_replicas"
            return 1
        fi

        # Check health endpoint if available
        local pods
        pods=$(kubectl get pods -n "$NAMESPACE" -l app="$deployment" -o jsonpath='{.items[*].metadata.name}')

        for pod in $pods; do
            if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
                log "DEBUG" "Health check passed for pod: $pod"
            else
                log "WARNING" "Health check failed for pod: $pod"
            fi
        done
    done

    log "SUCCESS" "Application health validation passed"
    return 0
}

# Validate database health after rollback
validate_database_health() {
    log "DEBUG" "Validating database health..."

    # Use existing database validation if available
    local db_validate_script="$SCRIPT_DIR/validate-migrations.sh"

    if [[ -f "$db_validate_script" ]]; then
        if "$db_validate_script" --environment "$ENVIRONMENT" --quick; then
            log "SUCCESS" "Database health validation passed"
            return 0
        else
            log "ERROR" "Database health validation failed"
            return 1
        fi
    else
        log "WARNING" "Database validation script not found, skipping detailed validation"
        return 0
    fi
}

# Validate monitoring health after rollback
validate_monitoring_health() {
    log "DEBUG" "Validating monitoring health..."

    local monitoring_namespace="monitoring"
    local monitoring_components=("prometheus" "grafana" "alertmanager")

    for component in "${monitoring_components[@]}"; do
        if kubectl get deployment "$component" -n "$monitoring_namespace" &> /dev/null; then
            local ready_replicas
            ready_replicas=$(kubectl get deployment "$component" -n "$monitoring_namespace" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

            if [[ "$ready_replicas" -eq 0 ]]; then
                log "ERROR" "Monitoring component $component is not ready after rollback"
                return 1
            fi
        fi
    done

    log "SUCCESS" "Monitoring health validation passed"
    return 0
}

# ============================================================================
# AUTOMATED TRIGGER DETECTION
# ============================================================================

# Check for automated rollback triggers
check_automated_triggers() {
    log "INFO" "🔍 Checking for automated rollback triggers..."

    local triggers_detected=()

    # Check deployment failure trigger
    if check_deployment_failure_trigger; then
        triggers_detected+=("deployment_failure")
    fi

    # Check health check failure trigger
    if check_health_failure_trigger; then
        triggers_detected+=("health_check_failure")
    fi

    # Check performance degradation trigger
    if check_performance_degradation_trigger; then
        triggers_detected+=("performance_degradation")
    fi

    # Check error rate trigger
    if check_error_rate_trigger; then
        triggers_detected+=("error_rate_exceeded")
    fi

    if [[ ${#triggers_detected[@]} -gt 0 ]]; then
        log "WARNING" "Automated rollback triggers detected: ${triggers_detected[*]}"
        ROLLBACK_REASON="Automated trigger: ${triggers_detected[*]}"
        return 0
    else
        log "INFO" "No automated rollback triggers detected"
        return 1
    fi
}

# Check deployment failure trigger
check_deployment_failure_trigger() {
    log "DEBUG" "Checking deployment failure trigger..."

    local deployments=("paperless-maverick" "embedding-queue-workers")

    for deployment in "${deployments[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            local ready_replicas
            ready_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local desired_replicas
            desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

            if [[ "$ready_replicas" -lt "$desired_replicas" ]]; then
                log "DEBUG" "Deployment failure detected for $deployment: $ready_replicas/$desired_replicas"
                return 0
            fi
        fi
    done

    return 1
}

# Check health check failure trigger
check_health_failure_trigger() {
    log "DEBUG" "Checking health check failure trigger..."

    local failed_health_checks=0
    local total_health_checks=0

    # Get application pods
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    for pod in $pods; do
        ((total_health_checks++))

        if ! kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
            ((failed_health_checks++))
        fi
    done

    if [[ $total_health_checks -gt 0 ]]; then
        local failure_rate=$((failed_health_checks * 100 / total_health_checks))

        if [[ $failure_rate -gt 50 ]]; then
            log "DEBUG" "Health check failure rate: $failure_rate%"
            return 0
        fi
    fi

    return 1
}

# Check performance degradation trigger
check_performance_degradation_trigger() {
    log "DEBUG" "Checking performance degradation trigger..."

    # This would typically integrate with monitoring system
    # For now, we'll check basic resource utilization

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    for pod in $pods; do
        # Check if pod is consuming excessive resources (simplified check)
        local pod_status
        pod_status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')

        if [[ "$pod_status" != "Running" ]]; then
            log "DEBUG" "Performance issue detected: pod $pod is not running"
            return 0
        fi
    done

    return 1
}

# Check error rate trigger
check_error_rate_trigger() {
    log "DEBUG" "Checking error rate trigger..."

    # This would typically integrate with application metrics
    # For now, we'll check pod restart counts as a proxy

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    for pod in $pods; do
        local restart_count
        restart_count=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")

        if [[ "$restart_count" -gt 5 ]]; then
            log "DEBUG" "High restart count detected for pod $pod: $restart_count"
            return 0
        fi
    done

    return 1
}

# ============================================================================
# MAIN ORCHESTRATION FUNCTIONS
# ============================================================================

# Main rollback orchestration
main_rollback() {
    log "INFO" "🚀 Starting rollback automation"
    log "INFO" "Rollback ID: $ROLLBACK_ID"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Rollback Type: $ROLLBACK_TYPE"
    log "INFO" "Rollback Target: $ROLLBACK_TARGET"
    log "INFO" "Rollback Reason: $ROLLBACK_REASON"
    log "INFO" "Dry Run: $DRY_RUN"
    log "INFO" "=================================================="

    ROLLBACK_START_TIME=$(date +%s)
    audit_log "ROLLBACK_STARTED" "type=$ROLLBACK_TYPE target=$ROLLBACK_TARGET reason=$ROLLBACK_REASON"

    # Set up error handling
    trap 'handle_rollback_failure' ERR

    # Phase 1: Validation
    validate_prerequisites || return 1
    validate_rollback_target || return 1

    # Phase 2: Pre-rollback backup
    create_pre_rollback_backup || return 1

    # Phase 3: Confirmation (if not auto-approved)
    if [[ "$AUTO_APPROVE" != "true" ]] && [[ "$DRY_RUN" != "true" ]]; then
        request_rollback_confirmation || return 1
    fi

    # Phase 4: Execute rollback based on type
    case "$ROLLBACK_TYPE" in
        "application")
            rollback_application || return 1
            ;;
        "database")
            rollback_database || return 1
            ;;
        "infrastructure")
            rollback_infrastructure || return 1
            ;;
        "monitoring")
            rollback_monitoring || return 1
            ;;
        "partial")
            rollback_partial || return 1
            ;;
        "full")
            rollback_full || return 1
            ;;
        *)
            log "ERROR" "Unknown rollback type: $ROLLBACK_TYPE"
            return 1
            ;;
    esac

    # Phase 5: Validation
    validate_rollback_success || return 1

    # Rollback summary
    local rollback_end_time=$(date +%s)
    local rollback_duration=$((rollback_end_time - ROLLBACK_START_TIME))

    log "SUCCESS" "🎉 Rollback completed successfully!"
    log "INFO" "=================================================="
    log "INFO" "Rollback Summary:"
    log "INFO" "  - Rollback ID: $ROLLBACK_ID"
    log "INFO" "  - Duration: ${rollback_duration}s"
    log "INFO" "  - Type: $ROLLBACK_TYPE"
    log "INFO" "  - Target: $ROLLBACK_TARGET"
    log "INFO" "  - Successful Components: ${#ROLLBACK_SUCCESS[@]}"
    log "INFO" "  - Failed Components: ${#ROLLBACK_FAILED[@]}"
    log "INFO" "=================================================="

    if [[ ${#ROLLBACK_SUCCESS[@]} -gt 0 ]]; then
        log "INFO" "Successfully Rolled Back:"
        for component in "${ROLLBACK_SUCCESS[@]}"; do
            log "INFO" "  ✅ $component"
        done
    fi

    if [[ ${#ROLLBACK_FAILED[@]} -gt 0 ]]; then
        log "WARNING" "Failed Rollbacks:"
        for component in "${ROLLBACK_FAILED[@]}"; do
            log "WARNING" "  ❌ $component"
        done
    fi

    audit_log "ROLLBACK_COMPLETED" "duration=${rollback_duration}s successful=${#ROLLBACK_SUCCESS[@]} failed=${#ROLLBACK_FAILED[@]}"

    return 0
}

# Request rollback confirmation
request_rollback_confirmation() {
    log "WARNING" "⚠️  ROLLBACK CONFIRMATION REQUIRED"
    log "WARNING" "Environment: $ENVIRONMENT"
    log "WARNING" "Rollback Type: $ROLLBACK_TYPE"
    log "WARNING" "Rollback Target: $ROLLBACK_TARGET"
    log "WARNING" "Rollback Reason: $ROLLBACK_REASON"

    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "WARNING" "🚨 THIS IS A PRODUCTION ROLLBACK 🚨"
    fi

    echo
    read -p "Do you want to proceed with this rollback? (yes/no): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "INFO" "Rollback cancelled by user"
        exit 0
    fi

    log "INFO" "Rollback confirmed by user"
    audit_log "ROLLBACK_CONFIRMED" "user_response=$REPLY"
    return 0
}

# Handle rollback failures
handle_rollback_failure() {
    local exit_code=$?

    log "ERROR" "💥 Rollback failed"
    audit_log "ROLLBACK_FAILED" "exit_code=$exit_code"

    if [[ ${#ROLLBACK_SUCCESS[@]} -gt 0 ]]; then
        log "WARNING" "Some components were rolled back before failure occurred"
        log "INFO" "Successfully rolled back components: ${ROLLBACK_SUCCESS[*]}"
    fi

    if [[ ${#ROLLBACK_FAILED[@]} -gt 0 ]]; then
        log "ERROR" "Failed rollback components: ${ROLLBACK_FAILED[*]}"
    fi

    exit $exit_code
}

# Automated rollback check
automated_rollback_check() {
    log "INFO" "🤖 Running automated rollback check..."

    if check_automated_triggers; then
        log "WARNING" "Automated rollback triggers detected"

        # Set automated rollback parameters
        ROLLBACK_TYPE="full"
        ROLLBACK_TARGET="previous"
        AUTO_APPROVE=true

        # Execute automated rollback
        main_rollback
    else
        log "INFO" "No automated rollback triggers detected"
        exit 0
    fi
}

# List available rollback targets
list_rollback_targets() {
    log "INFO" "📋 Available rollback targets:"

    # List deployment revisions
    log "INFO" "Application Deployment Revisions:"
    kubectl rollout history deployment/paperless-maverick -n "$NAMESPACE" 2>/dev/null || log "WARNING" "No deployment history found"

    # List available backups
    log "INFO" "Available Backups:"
    if [[ -d "$BACKUP_DIR" ]]; then
        local backups
        backups=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "*" | sort -r | head -10)

        if [[ -n "$backups" ]]; then
            for backup in $backups; do
                local backup_name=$(basename "$backup")
                if [[ -f "$backup/backup-metadata.json" ]]; then
                    local created_at
                    created_at=$(jq -r '.created_at' "$backup/backup-metadata.json" 2>/dev/null || echo "unknown")
                    log "INFO" "  - $backup_name (created: $created_at)"
                else
                    log "INFO" "  - $backup_name"
                fi
            done
        else
            log "INFO" "  No backups found"
        fi
    else
        log "INFO" "  Backup directory not found"
    fi
}

# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

# Show help
show_help() {
    cat << EOF
Comprehensive Rollback Automation System v$SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

DESCRIPTION:
    Comprehensive rollback automation with support for partial, full, and
    automated rollback procedures. Includes safety checks, validation, and
    proper backup procedures for production environments.

OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: $DEFAULT_ENVIRONMENT)
    -n, --namespace NS          Kubernetes namespace (default: $DEFAULT_NAMESPACE)
    -t, --type TYPE             Rollback type (application|database|infrastructure|monitoring|partial|full)
    -r, --target TARGET         Rollback target (previous|latest|revision:N|backup:NAME|components:LIST)
    --reason REASON             Reason for rollback (required for production)
    -d, --dry-run              Perform dry run without making changes
    -f, --force                Force rollback, skip safety checks
    -v, --verbose              Enable verbose logging
    --skip-validation          Skip post-rollback validation
    --skip-backup              Skip pre-rollback backup
    --auto-approve             Skip confirmation prompts
    --automated-check          Check for automated rollback triggers
    --list-targets             List available rollback targets

ROLLBACK TYPES:
    application                Application deployments only
    database                   Database migrations only
    infrastructure             Infrastructure components only
    monitoring                 Monitoring stack only
    partial                    Selected components (requires components: target)
    full                       Complete system rollback

ROLLBACK TARGETS:
    previous                   Previous version/revision
    latest                     Latest backup
    revision:N                 Specific revision number
    backup:NAME                Specific backup name
    components:LIST            Comma-separated component list (for partial rollback)

EXAMPLES:
    # Full system rollback to previous version
    $SCRIPT_NAME --type full --target previous --reason "Critical bug fix"

    # Application rollback to specific revision
    $SCRIPT_NAME --type application --target revision:5 --reason "Performance issue"

    # Database rollback to latest backup
    $SCRIPT_NAME --type database --target backup:backup-20240101-120000 --force

    # Partial rollback of specific components
    $SCRIPT_NAME --type partial --target components:app,monitoring --reason "Monitoring issues"

    # Automated rollback check
    $SCRIPT_NAME --automated-check

    # Dry run full rollback
    $SCRIPT_NAME --type full --target previous --dry-run

    # List available rollback targets
    $SCRIPT_NAME --list-targets

ENVIRONMENT VARIABLES:
    ROLLBACK_TIMEOUT           Rollback timeout in seconds (default: 600)
    VALIDATION_TIMEOUT         Validation timeout in seconds (default: 300)

FILES:
    $ROLLBACK_LOG              Rollback log
    $AUDIT_LOG                 Audit log

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
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -t|--type)
                ROLLBACK_TYPE="$2"
                shift 2
                ;;
            -r|--target)
                ROLLBACK_TARGET="$2"
                shift 2
                ;;
            --reason)
                ROLLBACK_REASON="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --auto-approve)
                AUTO_APPROVE=true
                shift
                ;;
            --automated-check)
                automated_rollback_check
                exit $?
                ;;
            --list-targets)
                list_rollback_targets
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$ROLLBACK_TYPE" ]]; then
        log "ERROR" "Rollback type is required (use --type)"
        exit 1
    fi

    # Require reason for production rollbacks
    if [[ "$ENVIRONMENT" == "production" ]] && [[ -z "$ROLLBACK_REASON" ]] && [[ "$DRY_RUN" != "true" ]]; then
        log "ERROR" "Rollback reason is required for production (use --reason)"
        exit 1
    fi

    # Set default reason if not provided
    if [[ -z "$ROLLBACK_REASON" ]]; then
        ROLLBACK_REASON="Manual rollback initiated"
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

    # Generate rollback ID
    generate_rollback_id

    # Log startup information
    log "INFO" "Comprehensive Rollback Automation System v$SCRIPT_VERSION"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: $ROLLBACK_INITIATED_BY"
    log "INFO" "Working directory: $(pwd)"
    log "INFO" "Script directory: $SCRIPT_DIR"
    log "INFO" "Project root: $PROJECT_ROOT"

    # Run main rollback process
    main_rollback
    exit $?
}

# Execute main function with all arguments
main "$@"
