#!/bin/bash

# Deployment System Dashboard
# Real-time status dashboard for the complete production deployment system
# This script provides comprehensive system status, health metrics, and operational insights

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="deployment-system-dashboard"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly SCRIPTS_DIR="$INFRASTRUCTURE_DIR/scripts"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
REFRESH_INTERVAL="30"
DASHBOARD_MODE="interactive"
OUTPUT_FORMAT="console"
INCLUDE_METRICS="true"
INCLUDE_LOGS="false"
WATCH_MODE="false"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deployment System Dashboard - Real-time status dashboard for production deployment system

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --refresh SECONDS       Refresh interval in seconds (default: 30)
    --mode MODE            Dashboard mode: interactive|static (default: interactive)
    --format FORMAT        Output format: console|json|html (default: console)
    --include-metrics      Include performance metrics
    --include-logs         Include recent log entries
    --watch                Watch mode with continuous updates
    --help                 Show this help message

DASHBOARD MODES:
    interactive    - Interactive dashboard with real-time updates
    static         - Static dashboard snapshot

OUTPUT FORMATS:
    console        - Formatted console output
    json           - JSON format for programmatic use
    html           - HTML format for web display

EXAMPLES:
    # Interactive dashboard with real-time updates
    $0 --environment production --mode interactive --watch

    # Static dashboard snapshot in JSON format
    $0 --mode static --format json --include-metrics

    # Watch mode with 10-second refresh
    $0 --watch --refresh 10 --include-logs

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --refresh)
                REFRESH_INTERVAL="$2"
                shift 2
                ;;
            --mode)
                DASHBOARD_MODE="$2"
                shift 2
                ;;
            --format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            --include-metrics)
                INCLUDE_METRICS="true"
                shift
                ;;
            --include-logs)
                INCLUDE_LOGS="true"
                shift
                ;;
            --watch)
                WATCH_MODE="true"
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Clear screen function
clear_screen() {
    if [[ "$OUTPUT_FORMAT" == "console" && "$DASHBOARD_MODE" == "interactive" ]]; then
        clear
    fi
}

# Print header
print_header() {
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BOLD}${BLUE}║                    PAPERLESS MAVERICK DEPLOYMENT SYSTEM                     ║${NC}"
        echo -e "${BOLD}${BLUE}║                              STATUS DASHBOARD                               ║${NC}"
        echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
        echo
        echo -e "${BOLD}Environment:${NC} $ENVIRONMENT | ${BOLD}Namespace:${NC} $NAMESPACE | ${BOLD}Updated:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
        echo
    fi
}

# Get system overview
get_system_overview() {
    local total_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
    local running_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l || echo "0")
    local pending_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l || echo "0")
    local failed_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed --no-headers 2>/dev/null | wc -l || echo "0")
    
    local services=$(kubectl get services -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
    local deployments=$(kubectl get deployments -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
    local configmaps=$(kubectl get configmaps -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
    local secrets=$(kubectl get secrets -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")
    
    local health_percentage=0
    if [[ $total_pods -gt 0 ]]; then
        health_percentage=$((running_pods * 100 / total_pods))
    fi
    
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        echo -e "${BOLD}${CYAN}📊 SYSTEM OVERVIEW${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Pods status with color coding
        local pod_status_color=$GREEN
        if [[ $health_percentage -lt 80 ]]; then
            pod_status_color=$YELLOW
        fi
        if [[ $health_percentage -lt 50 ]]; then
            pod_status_color=$RED
        fi
        
        echo -e "Pods:        ${pod_status_color}$running_pods/$total_pods running${NC} (${health_percentage}% healthy)"
        if [[ $pending_pods -gt 0 ]]; then
            echo -e "             ${YELLOW}$pending_pods pending${NC}"
        fi
        if [[ $failed_pods -gt 0 ]]; then
            echo -e "             ${RED}$failed_pods failed${NC}"
        fi
        
        echo -e "Services:    $services"
        echo -e "Deployments: $deployments"
        echo -e "ConfigMaps:  $configmaps"
        echo -e "Secrets:     $secrets"
        echo
    fi
    
    # Store values for JSON output
    SYSTEM_OVERVIEW="{
        \"total_pods\": $total_pods,
        \"running_pods\": $running_pods,
        \"pending_pods\": $pending_pods,
        \"failed_pods\": $failed_pods,
        \"health_percentage\": $health_percentage,
        \"services\": $services,
        \"deployments\": $deployments,
        \"configmaps\": $configmaps,
        \"secrets\": $secrets
    }"
}

# Get deployment status
get_deployment_status() {
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        echo -e "${BOLD}${CYAN}🚀 DEPLOYMENT STATUS${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi
    
    # Check main application deployment
    local app_status="Unknown"
    local app_replicas="0/0"
    local app_image="Unknown"
    
    if kubectl get deployment paperless-maverick -n "$NAMESPACE" &>/dev/null; then
        app_status=$(kubectl get deployment paperless-maverick -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || echo "Unknown")
        app_replicas=$(kubectl get deployment paperless-maverick -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}/{.spec.replicas}' 2>/dev/null || echo "0/0")
        app_image=$(kubectl get deployment paperless-maverick -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "Unknown")
        
        if [[ "$app_status" == "True" ]]; then
            app_status="Healthy"
        else
            app_status="Unhealthy"
        fi
    fi
    
    # Check worker deployment
    local worker_status="Unknown"
    local worker_replicas="0/0"
    
    if kubectl get deployment embedding-queue-workers -n "$NAMESPACE" &>/dev/null; then
        worker_status=$(kubectl get deployment embedding-queue-workers -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || echo "Unknown")
        worker_replicas=$(kubectl get deployment embedding-queue-workers -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}/{.spec.replicas}' 2>/dev/null || echo "0/0")
        
        if [[ "$worker_status" == "True" ]]; then
            worker_status="Healthy"
        else
            worker_status="Unhealthy"
        fi
    fi
    
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        # Application status with color coding
        local app_color=$GREEN
        if [[ "$app_status" != "Healthy" ]]; then
            app_color=$RED
        fi
        
        local worker_color=$GREEN
        if [[ "$worker_status" != "Healthy" ]]; then
            worker_color=$RED
        fi
        
        echo -e "Application: ${app_color}$app_status${NC} ($app_replicas replicas)"
        echo -e "Image:       $app_image"
        echo -e "Workers:     ${worker_color}$worker_status${NC} ($worker_replicas replicas)"
        echo
    fi
    
    # Store values for JSON output
    DEPLOYMENT_STATUS="{
        \"application\": {
            \"status\": \"$app_status\",
            \"replicas\": \"$app_replicas\",
            \"image\": \"$app_image\"
        },
        \"workers\": {
            \"status\": \"$worker_status\",
            \"replicas\": \"$worker_replicas\"
        }
    }"
}

# Get service health
get_service_health() {
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        echo -e "${BOLD}${CYAN}🏥 SERVICE HEALTH${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi
    
    # Check API health
    local api_health="Unknown"
    local api_response_time="N/A"
    
    # Determine API URL based on environment
    local api_url="http://localhost:3000/health"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        api_url="https://api.mataresit.com/health"
    fi
    
    # Test API health
    local start_time=$(date +%s%3N)
    if curl -f -s "$api_url" >/dev/null 2>&1; then
        api_health="Healthy"
        local end_time=$(date +%s%3N)
        api_response_time="$((end_time - start_time))ms"
    else
        api_health="Unhealthy"
    fi
    
    # Check database connectivity
    local db_health="Unknown"
    if kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick --no-headers | head -1 | awk '{print $1}' | xargs -I {} kubectl exec -n "$NAMESPACE" {} -- curl -f -s http://localhost:3000/health/database >/dev/null 2>&1; then
        db_health="Healthy"
    else
        db_health="Unhealthy"
    fi
    
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        # Health status with color coding
        local api_color=$GREEN
        if [[ "$api_health" != "Healthy" ]]; then
            api_color=$RED
        fi
        
        local db_color=$GREEN
        if [[ "$db_health" != "Healthy" ]]; then
            db_color=$RED
        fi
        
        echo -e "API:         ${api_color}$api_health${NC} ($api_response_time)"
        echo -e "Database:    ${db_color}$db_health${NC}"
        echo
    fi
    
    # Store values for JSON output
    SERVICE_HEALTH="{
        \"api\": {
            \"status\": \"$api_health\",
            \"response_time\": \"$api_response_time\"
        },
        \"database\": {
            \"status\": \"$db_health\"
        }
    }"
}

# Get performance metrics
get_performance_metrics() {
    if [[ "$INCLUDE_METRICS" != "true" ]]; then
        return 0
    fi
    
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        echo -e "${BOLD}${CYAN}📈 PERFORMANCE METRICS${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi
    
    # Get resource utilization
    local cpu_usage="N/A"
    local memory_usage="N/A"
    
    if kubectl top pods -n "$NAMESPACE" --no-headers >/dev/null 2>&1; then
        cpu_usage=$(kubectl top pods -n "$NAMESPACE" --no-headers | awk '{sum+=$2} END {print sum"m"}' | sed 's/mm/m/')
        memory_usage=$(kubectl top pods -n "$NAMESPACE" --no-headers | awk '{sum+=$3} END {print sum"Mi"}' | sed 's/MiMi/Mi/')
    fi
    
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        echo -e "CPU Usage:   $cpu_usage"
        echo -e "Memory:      $memory_usage"
        echo
    fi
    
    # Store values for JSON output
    PERFORMANCE_METRICS="{
        \"cpu_usage\": \"$cpu_usage\",
        \"memory_usage\": \"$memory_usage\"
    }"
}

# Generate JSON output
generate_json_output() {
    cat << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "system_overview": $SYSTEM_OVERVIEW,
    "deployment_status": $DEPLOYMENT_STATUS,
    "service_health": $SERVICE_HEALTH,
    "performance_metrics": $PERFORMANCE_METRICS
}
EOF
}

# Main dashboard function
show_dashboard() {
    if [[ "$OUTPUT_FORMAT" == "console" ]]; then
        clear_screen
        print_header
    fi
    
    get_system_overview
    get_deployment_status
    get_service_health
    get_performance_metrics
    
    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        generate_json_output
    elif [[ "$OUTPUT_FORMAT" == "console" ]]; then
        if [[ "$WATCH_MODE" == "true" ]]; then
            echo -e "${BOLD}${YELLOW}⏱️  Refreshing every ${REFRESH_INTERVAL} seconds... (Press Ctrl+C to exit)${NC}"
        fi
    fi
}

# Main execution
main() {
    parse_args "$@"
    
    # Validate parameters
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        echo "Error: Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$OUTPUT_FORMAT" =~ ^(console|json|html)$ ]]; then
        echo "Error: Invalid output format: $OUTPUT_FORMAT"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("kubectl" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            echo "Error: Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Show dashboard
    if [[ "$WATCH_MODE" == "true" ]]; then
        # Watch mode with continuous updates
        while true; do
            show_dashboard
            sleep "$REFRESH_INTERVAL"
        done
    else
        # Single snapshot
        show_dashboard
    fi
}

# Execute main function
main "$@"
