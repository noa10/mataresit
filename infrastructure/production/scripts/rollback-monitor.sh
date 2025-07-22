#!/bin/bash

# Rollback Trigger Monitoring Script
# Continuously monitors system health and triggers automated rollbacks
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly MONITOR_LOG="$PROJECT_ROOT/logs/rollback/rollback-monitor-$(date +%Y%m%d).log"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
NAMESPACE="paperless-maverick"
ENVIRONMENT="production"
MONITORING_INTERVAL=60  # 1 minute
VERBOSE=false
DRY_RUN=false

# Trigger thresholds
EMBEDDING_SUCCESS_RATE_THRESHOLD=85
SYSTEM_ERROR_RATE_THRESHOLD=10
QUEUE_BACKLOG_THRESHOLD=500
API_QUOTA_THRESHOLD=95
HEALTH_CHECK_FAILURE_THRESHOLD=50
RESTART_COUNT_THRESHOLD=5

# Trigger windows (in seconds)
EMBEDDING_SUCCESS_WINDOW=600    # 10 minutes
SYSTEM_ERROR_WINDOW=300         # 5 minutes
QUEUE_BACKLOG_WINDOW=900        # 15 minutes
API_QUOTA_WINDOW=120            # 2 minutes

# State tracking
declare -A TRIGGER_STATES
declare -A TRIGGER_TIMESTAMPS

# Initialize logging
init_logging() {
    mkdir -p "$(dirname "$MONITOR_LOG")"
    touch "$MONITOR_LOG"
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$MONITOR_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$MONITOR_LOG"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$MONITOR_LOG"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$MONITOR_LOG"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${BLUE}[$timestamp] 🔍${NC} $message" | tee -a "$MONITOR_LOG"
            fi
            ;;
    esac
}

# Check embedding success rate
check_embedding_success_rate() {
    log "DEBUG" "Checking embedding success rate..."
    
    # This would typically query Prometheus or application metrics
    # For now, we'll simulate by checking pod health and restart counts
    
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    local total_pods=0
    local healthy_pods=0
    
    for pod in $pods; do
        ((total_pods++))
        
        # Check pod status
        local pod_status
        pod_status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        
        if [[ "$pod_status" == "Running" ]]; then
            # Check health endpoint
            if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
                ((healthy_pods++))
            fi
        fi
    done
    
    if [[ $total_pods -gt 0 ]]; then
        local success_rate=$((healthy_pods * 100 / total_pods))
        log "DEBUG" "Embedding success rate: $success_rate% ($healthy_pods/$total_pods)"
        
        if [[ $success_rate -lt $EMBEDDING_SUCCESS_RATE_THRESHOLD ]]; then
            return 0  # Trigger detected
        fi
    fi
    
    return 1  # No trigger
}

# Check system error rate
check_system_error_rate() {
    log "DEBUG" "Checking system error rate..."
    
    # Check pod restart counts as a proxy for error rate
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    local high_restart_pods=0
    local total_pods=0
    
    for pod in $pods; do
        ((total_pods++))
        
        local restart_count
        restart_count=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")
        
        if [[ "$restart_count" -gt $RESTART_COUNT_THRESHOLD ]]; then
            ((high_restart_pods++))
        fi
    done
    
    if [[ $total_pods -gt 0 ]]; then
        local error_rate=$((high_restart_pods * 100 / total_pods))
        log "DEBUG" "System error rate (high restarts): $error_rate% ($high_restart_pods/$total_pods)"
        
        if [[ $error_rate -gt $SYSTEM_ERROR_RATE_THRESHOLD ]]; then
            return 0  # Trigger detected
        fi
    fi
    
    return 1  # No trigger
}

# Check queue backlog
check_queue_backlog() {
    log "DEBUG" "Checking queue backlog..."
    
    # This would typically query the queue system or database
    # For now, we'll check worker pod status as a proxy
    
    local worker_pods
    worker_pods=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker -o jsonpath='{.items[*].metadata.name}')
    
    local running_workers=0
    local total_workers=0
    
    for pod in $worker_pods; do
        ((total_workers++))
        
        local pod_status
        pod_status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        
        if [[ "$pod_status" == "Running" ]]; then
            ((running_workers++))
        fi
    done
    
    # If less than 50% of workers are running, assume queue backlog
    if [[ $total_workers -gt 0 ]]; then
        local worker_availability=$((running_workers * 100 / total_workers))
        log "DEBUG" "Worker availability: $worker_availability% ($running_workers/$total_workers)"
        
        if [[ $worker_availability -lt 50 ]]; then
            return 0  # Trigger detected
        fi
    fi
    
    return 1  # No trigger
}

# Check API quota exhaustion
check_api_quota_exhaustion() {
    log "DEBUG" "Checking API quota exhaustion..."
    
    # This would typically check API usage metrics
    # For now, we'll check for specific error patterns in logs
    
    # Check recent pod logs for quota-related errors
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $pods; do
        # Check for quota-related errors in recent logs
        local quota_errors
        quota_errors=$(kubectl logs "$pod" -n "$NAMESPACE" --since=5m 2>/dev/null | grep -i "quota\|rate.limit\|429" | wc -l || echo "0")
        
        if [[ "$quota_errors" -gt 10 ]]; then
            log "DEBUG" "API quota issues detected in pod $pod: $quota_errors errors"
            return 0  # Trigger detected
        fi
    done
    
    return 1  # No trigger
}

# Check trigger with time window
check_trigger_with_window() {
    local trigger_name="$1"
    local check_function="$2"
    local window_duration="$3"
    
    local current_time=$(date +%s)
    local trigger_key="$trigger_name"
    
    # Run the check function
    if $check_function; then
        # Trigger condition met
        if [[ -z "${TRIGGER_STATES[$trigger_key]:-}" ]]; then
            # First time trigger detected
            TRIGGER_STATES[$trigger_key]="detected"
            TRIGGER_TIMESTAMPS[$trigger_key]=$current_time
            log "WARNING" "Trigger detected: $trigger_name (monitoring for ${window_duration}s)"
        else
            # Trigger already detected, check if window exceeded
            local trigger_start_time=${TRIGGER_TIMESTAMPS[$trigger_key]}
            local trigger_duration=$((current_time - trigger_start_time))
            
            if [[ $trigger_duration -ge $window_duration ]]; then
                log "ERROR" "Trigger threshold exceeded: $trigger_name (duration: ${trigger_duration}s)"
                return 0  # Trigger threshold exceeded
            else
                log "DEBUG" "Trigger still active: $trigger_name (duration: ${trigger_duration}s/${window_duration}s)"
            fi
        fi
    else
        # Trigger condition not met, reset if previously detected
        if [[ -n "${TRIGGER_STATES[$trigger_key]:-}" ]]; then
            log "INFO" "Trigger resolved: $trigger_name"
            unset TRIGGER_STATES[$trigger_key]
            unset TRIGGER_TIMESTAMPS[$trigger_key]
        fi
    fi
    
    return 1  # Trigger threshold not exceeded
}

# Execute automated rollback
execute_automated_rollback() {
    local trigger_reason="$1"
    
    log "ERROR" "🚨 Executing automated rollback due to: $trigger_reason"
    
    local rollback_script="$SCRIPT_DIR/rollback-automation.sh"
    
    if [[ ! -f "$rollback_script" ]]; then
        log "ERROR" "Rollback automation script not found: $rollback_script"
        return 1
    fi
    
    local rollback_args=(
        "--type" "full"
        "--target" "previous"
        "--reason" "Automated rollback: $trigger_reason"
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--auto-approve"
    )
    
    if [[ "$DRY_RUN" == "true" ]]; then
        rollback_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        rollback_args+=("--verbose")
    fi
    
    # Execute rollback
    if "$rollback_script" "${rollback_args[@]}"; then
        log "SUCCESS" "Automated rollback completed successfully"
        return 0
    else
        log "ERROR" "Automated rollback failed"
        return 1
    fi
}

# Main monitoring loop
monitoring_loop() {
    log "INFO" "🔍 Starting rollback trigger monitoring..."
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Monitoring interval: ${MONITORING_INTERVAL}s"
    log "INFO" "Dry run: $DRY_RUN"
    log "INFO" "=================================================="
    
    while true; do
        log "DEBUG" "Running monitoring checks..."
        
        # Check all triggers with their respective windows
        if check_trigger_with_window "embedding_success_rate" "check_embedding_success_rate" "$EMBEDDING_SUCCESS_WINDOW"; then
            execute_automated_rollback "Embedding success rate below threshold"
            break
        fi
        
        if check_trigger_with_window "system_error_rate" "check_system_error_rate" "$SYSTEM_ERROR_WINDOW"; then
            execute_automated_rollback "System error rate exceeded threshold"
            break
        fi
        
        if check_trigger_with_window "queue_backlog" "check_queue_backlog" "$QUEUE_BACKLOG_WINDOW"; then
            execute_automated_rollback "Queue backlog exceeded threshold"
            break
        fi
        
        if check_trigger_with_window "api_quota_exhaustion" "check_api_quota_exhaustion" "$API_QUOTA_WINDOW"; then
            execute_automated_rollback "API quota exhaustion detected"
            break
        fi
        
        # Sleep until next check
        sleep "$MONITORING_INTERVAL"
    done
}

# Show help
show_help() {
    cat << EOF
Rollback Trigger Monitoring Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -n, --namespace NS      Kubernetes namespace (default: paperless-maverick)
    -e, --environment ENV   Target environment (default: production)
    -i, --interval SECONDS  Monitoring interval in seconds (default: 60)
    -d, --dry-run           Dry run mode (don't execute rollbacks)
    -v, --verbose           Enable verbose logging

EXAMPLES:
    $0                      # Start monitoring with default settings
    $0 --interval 30        # Monitor every 30 seconds
    $0 --dry-run --verbose  # Dry run with verbose output

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
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -i|--interval)
                MONITORING_INTERVAL="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
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
    
    log "INFO" "Rollback Trigger Monitoring Script v1.0.0"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: ${USER:-unknown}"
    
    # Start monitoring loop
    monitoring_loop
}

# Execute main function
main "$@"
