#!/bin/bash

# Deployment Status Tracking Script
# Provides real-time status monitoring for Paperless Maverick deployments
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly LOG_DIR="$PROJECT_ROOT/logs/deployment"
readonly STATUS_FILE="$LOG_DIR/deployment-status.json"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
WATCH_MODE=false
REFRESH_INTERVAL=5
OUTPUT_FORMAT="table"

# Status tracking
declare -A PHASE_STATUS
declare -A PHASE_TIMESTAMPS
declare -A DEPLOYMENT_METRICS

# Initialize status tracking
init_status_tracking() {
    mkdir -p "$LOG_DIR"
    
    # Initialize phase status
    PHASE_STATUS=(
        ["PREREQUISITES_CHECK"]="PENDING"
        ["ENVIRONMENT_VALIDATION"]="PENDING"
        ["BACKUP_CREATION"]="PENDING"
        ["INFRASTRUCTURE_DEPLOYMENT"]="PENDING"
        ["DATABASE_MIGRATION"]="PENDING"
        ["APPLICATION_DEPLOYMENT"]="PENDING"
        ["FEATURE_FLAG_DEPLOYMENT"]="PENDING"
        ["MONITORING_DEPLOYMENT"]="PENDING"
        ["DEPLOYMENT_VALIDATION"]="PENDING"
        ["PERFORMANCE_VALIDATION"]="PENDING"
    )
    
    # Initialize timestamps
    for phase in "${!PHASE_STATUS[@]}"; do
        PHASE_TIMESTAMPS["$phase"]=""
    done
    
    # Initialize metrics
    DEPLOYMENT_METRICS=(
        ["start_time"]=""
        ["end_time"]=""
        ["duration"]=""
        ["total_phases"]="${#PHASE_STATUS[@]}"
        ["completed_phases"]="0"
        ["failed_phases"]="0"
        ["current_phase"]=""
        ["deployment_id"]=""
    )
}

# Parse deployment logs
parse_deployment_logs() {
    local log_file="$1"
    
    if [[ ! -f "$log_file" ]]; then
        return 1
    fi
    
    # Extract deployment ID
    local deployment_id
    deployment_id=$(grep "Generated deployment ID:" "$log_file" 2>/dev/null | tail -n 1 | awk '{print $NF}' || echo "unknown")
    DEPLOYMENT_METRICS["deployment_id"]="$deployment_id"
    
    # Extract start time
    local start_time
    start_time=$(head -n 1 "$log_file" | grep -o '\[.*\]' | tr -d '[]' || echo "")
    DEPLOYMENT_METRICS["start_time"]="$start_time"
    
    # Parse phase status
    while IFS= read -r line; do
        if [[ "$line" =~ Starting\ phase:\ ([A-Z_]+) ]]; then
            local phase="${BASH_REMATCH[1]}"
            PHASE_STATUS["$phase"]="IN_PROGRESS"
            PHASE_TIMESTAMPS["$phase"]=$(echo "$line" | grep -o '\[.*\]' | tr -d '[]')
            DEPLOYMENT_METRICS["current_phase"]="$phase"
        elif [[ "$line" =~ Completed\ phase:\ ([A-Z_]+) ]]; then
            local phase="${BASH_REMATCH[1]}"
            PHASE_STATUS["$phase"]="COMPLETED"
            ((DEPLOYMENT_METRICS["completed_phases"]++))
        elif [[ "$line" =~ Failed\ phase:\ ([A-Z_]+) ]]; then
            local phase="${BASH_REMATCH[1]}"
            PHASE_STATUS["$phase"]="FAILED"
            ((DEPLOYMENT_METRICS["failed_phases"]++))
        fi
    done < "$log_file"
    
    # Calculate duration if deployment is complete
    if grep -q "Deployment completed successfully" "$log_file" 2>/dev/null; then
        local end_time
        end_time=$(grep "Deployment completed successfully" "$log_file" | tail -n 1 | grep -o '\[.*\]' | tr -d '[]')
        DEPLOYMENT_METRICS["end_time"]="$end_time"
        
        if [[ -n "${DEPLOYMENT_METRICS["start_time"]}" && -n "$end_time" ]]; then
            local start_epoch end_epoch duration
            start_epoch=$(date -d "${DEPLOYMENT_METRICS["start_time"]}" +%s 2>/dev/null || echo "0")
            end_epoch=$(date -d "$end_time" +%s 2>/dev/null || echo "0")
            duration=$((end_epoch - start_epoch))
            DEPLOYMENT_METRICS["duration"]="${duration}s"
        fi
    fi
}

# Get Kubernetes deployment status
get_k8s_status() {
    local deployment_status=()
    
    # Check main application
    if kubectl get deployment paperless-maverick -n "$NAMESPACE" &>/dev/null; then
        local ready_replicas desired_replicas
        ready_replicas=$(kubectl get deployment paperless-maverick -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        desired_replicas=$(kubectl get deployment paperless-maverick -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        deployment_status+=("App: $ready_replicas/$desired_replicas")
    fi
    
    # Check workers
    if kubectl get deployment embedding-queue-workers -n "$NAMESPACE" &>/dev/null; then
        local ready_replicas desired_replicas
        ready_replicas=$(kubectl get deployment embedding-queue-workers -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        desired_replicas=$(kubectl get deployment embedding-queue-workers -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        deployment_status+=("Workers: $ready_replicas/$desired_replicas")
    fi
    
    printf "%s" "${deployment_status[*]}"
}

# Display status in table format
display_table_status() {
    clear
    
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                    Paperless Maverick Deployment Status                     ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # Deployment info
    echo -e "${CYAN}Deployment Information:${NC}"
    echo -e "  ID: ${DEPLOYMENT_METRICS["deployment_id"]}"
    echo -e "  Environment: $ENVIRONMENT"
    echo -e "  Namespace: $NAMESPACE"
    echo -e "  Start Time: ${DEPLOYMENT_METRICS["start_time"]}"
    if [[ -n "${DEPLOYMENT_METRICS["duration"]}" ]]; then
        echo -e "  Duration: ${DEPLOYMENT_METRICS["duration"]}"
    fi
    echo
    
    # Progress summary
    local completed="${DEPLOYMENT_METRICS["completed_phases"]}"
    local total="${DEPLOYMENT_METRICS["total_phases"]}"
    local failed="${DEPLOYMENT_METRICS["failed_phases"]}"
    local progress=$((completed * 100 / total))
    
    echo -e "${CYAN}Progress Summary:${NC}"
    echo -e "  Completed: $completed/$total phases ($progress%)"
    echo -e "  Failed: $failed phases"
    echo -e "  Current: ${DEPLOYMENT_METRICS["current_phase"]}"
    echo
    
    # Kubernetes status
    local k8s_status
    k8s_status=$(get_k8s_status)
    if [[ -n "$k8s_status" ]]; then
        echo -e "${CYAN}Kubernetes Status:${NC}"
        echo -e "  $k8s_status"
        echo
    fi
    
    # Phase status table
    echo -e "${CYAN}Deployment Phases:${NC}"
    printf "%-30s %-12s %-20s\n" "Phase" "Status" "Timestamp"
    echo "────────────────────────────────────────────────────────────────"
    
    for phase in "${!PHASE_STATUS[@]}"; do
        local status="${PHASE_STATUS[$phase]}"
        local timestamp="${PHASE_TIMESTAMPS[$phase]}"
        local status_color=""
        local status_icon=""
        
        case "$status" in
            "COMPLETED")
                status_color="$GREEN"
                status_icon="✅"
                ;;
            "IN_PROGRESS")
                status_color="$YELLOW"
                status_icon="🔄"
                ;;
            "FAILED")
                status_color="$RED"
                status_icon="❌"
                ;;
            "PENDING")
                status_color="$NC"
                status_icon="⏳"
                ;;
        esac
        
        printf "%-30s ${status_color}%-12s${NC} %-20s\n" "$phase" "$status_icon $status" "$timestamp"
    done
    
    echo
    echo -e "${BLUE}Last updated: $(date)${NC}"
    
    if [[ "$WATCH_MODE" == "true" ]]; then
        echo -e "${YELLOW}Press Ctrl+C to exit watch mode${NC}"
    fi
}

# Display status in JSON format
display_json_status() {
    local json_output="{
        \"deployment_info\": {
            \"id\": \"${DEPLOYMENT_METRICS["deployment_id"]}\",
            \"environment\": \"$ENVIRONMENT\",
            \"namespace\": \"$NAMESPACE\",
            \"start_time\": \"${DEPLOYMENT_METRICS["start_time"]}\",
            \"end_time\": \"${DEPLOYMENT_METRICS["end_time"]}\",
            \"duration\": \"${DEPLOYMENT_METRICS["duration"]}\"
        },
        \"progress\": {
            \"total_phases\": ${DEPLOYMENT_METRICS["total_phases"]},
            \"completed_phases\": ${DEPLOYMENT_METRICS["completed_phases"]},
            \"failed_phases\": ${DEPLOYMENT_METRICS["failed_phases"]},
            \"current_phase\": \"${DEPLOYMENT_METRICS["current_phase"]}\"
        },
        \"phases\": {"
    
    local first=true
    for phase in "${!PHASE_STATUS[@]}"; do
        if [[ "$first" == "false" ]]; then
            json_output+=","
        fi
        json_output+="
            \"$phase\": {
                \"status\": \"${PHASE_STATUS[$phase]}\",
                \"timestamp\": \"${PHASE_TIMESTAMPS[$phase]}\"
            }"
        first=false
    done
    
    json_output+="
        },
        \"kubernetes_status\": \"$(get_k8s_status)\",
        \"last_updated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }"
    
    echo "$json_output" | jq '.' 2>/dev/null || echo "$json_output"
}

# Find latest deployment log
find_latest_log() {
    find "$LOG_DIR" -name "deployment-*.log" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-
}

# Show help
show_help() {
    cat << EOF
Deployment Status Tracking Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -e, --environment ENV   Target environment (default: production)
    -n, --namespace NS      Kubernetes namespace (default: paperless-maverick)
    -w, --watch             Watch mode - continuously update status
    -i, --interval SEC      Refresh interval for watch mode (default: 5)
    -f, --format FORMAT     Output format: table, json (default: table)
    -l, --log-file FILE     Specific log file to parse

EXAMPLES:
    $0                      Show current deployment status
    $0 --watch              Watch deployment status in real-time
    $0 --format json        Output status in JSON format
    $0 --log-file /path/to/deployment.log  Parse specific log file

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
            -w|--watch)
                WATCH_MODE=true
                shift
                ;;
            -i|--interval)
                REFRESH_INTERVAL="$2"
                shift 2
                ;;
            -f|--format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            -l|--log-file)
                LOG_FILE="$2"
                shift 2
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
    parse_arguments "$@"
    init_status_tracking
    
    # Find log file if not specified
    if [[ -z "${LOG_FILE:-}" ]]; then
        LOG_FILE=$(find_latest_log)
        if [[ -z "$LOG_FILE" ]]; then
            echo "No deployment logs found in $LOG_DIR"
            exit 1
        fi
    fi
    
    if [[ "$WATCH_MODE" == "true" ]]; then
        # Watch mode
        while true; do
            parse_deployment_logs "$LOG_FILE"
            
            case "$OUTPUT_FORMAT" in
                "json")
                    display_json_status
                    ;;
                "table"|*)
                    display_table_status
                    ;;
            esac
            
            sleep "$REFRESH_INTERVAL"
        done
    else
        # Single run
        parse_deployment_logs "$LOG_FILE"
        
        case "$OUTPUT_FORMAT" in
            "json")
                display_json_status
                ;;
            "table"|*)
                display_table_status
                ;;
        esac
    fi
}

# Execute main function
main "$@"
