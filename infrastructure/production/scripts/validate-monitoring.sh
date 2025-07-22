#!/bin/bash

# Monitoring Infrastructure Validation Script
# Validates Prometheus, Grafana, AlertManager, and monitoring configurations
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly MONITORING_DIR="$PROJECT_ROOT/infrastructure/production/monitoring"
readonly VALIDATION_LOG="$PROJECT_ROOT/logs/monitoring/monitoring-validation-$(date +%Y%m%d-%H%M%S).log"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
NAMESPACE="paperless-maverick"
MONITORING_NAMESPACE="monitoring"
ENVIRONMENT="production"
VERBOSE=false
QUICK_CHECK=false
DEEP_VALIDATION=false

# Validation results
VALIDATION_PASSED=0
VALIDATION_FAILED=0
VALIDATION_WARNINGS=0

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
            ((VALIDATION_FAILED++))
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${BLUE}[$timestamp] 🔍${NC} $message" | tee -a "$VALIDATION_LOG"
            fi
            ;;
    esac
}

# Validate Prometheus deployment
validate_prometheus() {
    log "INFO" "🔍 Validating Prometheus deployment..."
    
    # Check if Prometheus deployment exists
    if ! kubectl get deployment prometheus -n "$MONITORING_NAMESPACE" &> /dev/null; then
        log "ERROR" "Prometheus deployment not found in namespace: $MONITORING_NAMESPACE"
        return 1
    fi
    
    # Check deployment status
    local ready_replicas
    ready_replicas=$(kubectl get deployment prometheus -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired_replicas
    desired_replicas=$(kubectl get deployment prometheus -n "$MONITORING_NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    
    if [[ "$ready_replicas" == "$desired_replicas" ]] && [[ "$ready_replicas" -gt 0 ]]; then
        log "SUCCESS" "Prometheus deployment is healthy: $ready_replicas/$desired_replicas replicas ready"
    else
        log "ERROR" "Prometheus deployment is unhealthy: $ready_replicas/$desired_replicas replicas ready"
        return 1
    fi
    
    # Check Prometheus service
    if kubectl get service prometheus -n "$MONITORING_NAMESPACE" &> /dev/null; then
        log "SUCCESS" "Prometheus service is available"
    else
        log "ERROR" "Prometheus service not found"
        return 1
    fi
    
    # Check Prometheus health endpoint
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/prometheus -- \
        curl -f -s http://localhost:9090/-/healthy &> /dev/null; then
        log "SUCCESS" "Prometheus health endpoint is accessible"
    else
        log "ERROR" "Prometheus health endpoint is not accessible"
        return 1
    fi
    
    # Check Prometheus configuration
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/prometheus -- \
        curl -f -s http://localhost:9090/api/v1/status/config &> /dev/null; then
        log "SUCCESS" "Prometheus configuration is loaded"
    else
        log "WARNING" "Prometheus configuration may have issues"
    fi
    
    # Check targets if deep validation is enabled
    if [[ "$DEEP_VALIDATION" == "true" ]]; then
        validate_prometheus_targets
    fi
    
    return 0
}

# Validate Prometheus targets
validate_prometheus_targets() {
    log "DEBUG" "Validating Prometheus targets..."
    
    # Get targets status
    local targets_response
    targets_response=$(kubectl exec -n "$MONITORING_NAMESPACE" deployment/prometheus -- \
        curl -s http://localhost:9090/api/v1/targets 2>/dev/null || echo '{"status":"error"}')
    
    if echo "$targets_response" | jq -e '.status == "success"' &> /dev/null; then
        local active_targets
        active_targets=$(echo "$targets_response" | jq -r '.data.activeTargets | length')
        log "SUCCESS" "Prometheus has $active_targets active targets"
        
        # Check for unhealthy targets
        local unhealthy_targets
        unhealthy_targets=$(echo "$targets_response" | jq -r '.data.activeTargets[] | select(.health != "up") | .discoveredLabels.__address__' 2>/dev/null || echo "")
        
        if [[ -n "$unhealthy_targets" ]]; then
            log "WARNING" "Some Prometheus targets are unhealthy:"
            echo "$unhealthy_targets" | while read -r target; do
                log "WARNING" "  - $target"
            done
        else
            log "SUCCESS" "All Prometheus targets are healthy"
        fi
    else
        log "ERROR" "Failed to retrieve Prometheus targets status"
    fi
}

# Validate Grafana deployment
validate_grafana() {
    log "INFO" "📊 Validating Grafana deployment..."
    
    # Check if Grafana deployment exists
    if ! kubectl get deployment grafana -n "$MONITORING_NAMESPACE" &> /dev/null; then
        log "ERROR" "Grafana deployment not found in namespace: $MONITORING_NAMESPACE"
        return 1
    fi
    
    # Check deployment status
    local ready_replicas
    ready_replicas=$(kubectl get deployment grafana -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired_replicas
    desired_replicas=$(kubectl get deployment grafana -n "$MONITORING_NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    
    if [[ "$ready_replicas" == "$desired_replicas" ]] && [[ "$ready_replicas" -gt 0 ]]; then
        log "SUCCESS" "Grafana deployment is healthy: $ready_replicas/$desired_replicas replicas ready"
    else
        log "ERROR" "Grafana deployment is unhealthy: $ready_replicas/$desired_replicas replicas ready"
        return 1
    fi
    
    # Check Grafana service
    if kubectl get service grafana -n "$MONITORING_NAMESPACE" &> /dev/null; then
        log "SUCCESS" "Grafana service is available"
    else
        log "ERROR" "Grafana service not found"
        return 1
    fi
    
    # Check Grafana health endpoint
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/grafana -- \
        curl -f -s http://localhost:3000/api/health &> /dev/null; then
        log "SUCCESS" "Grafana health endpoint is accessible"
    else
        log "ERROR" "Grafana health endpoint is not accessible"
        return 1
    fi
    
    # Check Grafana data sources if deep validation is enabled
    if [[ "$DEEP_VALIDATION" == "true" ]]; then
        validate_grafana_datasources
    fi
    
    return 0
}

# Validate Grafana data sources
validate_grafana_datasources() {
    log "DEBUG" "Validating Grafana data sources..."
    
    # Get admin password
    local admin_password
    admin_password=$(kubectl get secret grafana-secrets -n "$MONITORING_NAMESPACE" -o jsonpath='{.data.admin-password}' 2>/dev/null | base64 -d || echo "")
    
    if [[ -z "$admin_password" ]]; then
        log "WARNING" "Cannot retrieve Grafana admin password for data source validation"
        return 0
    fi
    
    # Check data sources
    local datasources_response
    datasources_response=$(kubectl exec -n "$MONITORING_NAMESPACE" deployment/grafana -- \
        curl -s -u "admin:$admin_password" http://localhost:3000/api/datasources 2>/dev/null || echo '[]')
    
    local datasource_count
    datasource_count=$(echo "$datasources_response" | jq length 2>/dev/null || echo "0")
    
    if [[ "$datasource_count" -gt 0 ]]; then
        log "SUCCESS" "Grafana has $datasource_count data source(s) configured"
        
        # Check Prometheus data source specifically
        local prometheus_ds
        prometheus_ds=$(echo "$datasources_response" | jq -r '.[] | select(.type == "prometheus") | .name' 2>/dev/null || echo "")
        
        if [[ -n "$prometheus_ds" ]]; then
            log "SUCCESS" "Prometheus data source is configured: $prometheus_ds"
        else
            log "WARNING" "No Prometheus data source found in Grafana"
        fi
    else
        log "WARNING" "No data sources configured in Grafana"
    fi
}

# Validate AlertManager deployment
validate_alertmanager() {
    log "INFO" "🚨 Validating AlertManager deployment..."
    
    # Check if AlertManager deployment exists
    if ! kubectl get deployment alertmanager -n "$MONITORING_NAMESPACE" &> /dev/null; then
        log "ERROR" "AlertManager deployment not found in namespace: $MONITORING_NAMESPACE"
        return 1
    fi
    
    # Check deployment status
    local ready_replicas
    ready_replicas=$(kubectl get deployment alertmanager -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired_replicas
    desired_replicas=$(kubectl get deployment alertmanager -n "$MONITORING_NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    
    if [[ "$ready_replicas" == "$desired_replicas" ]] && [[ "$ready_replicas" -gt 0 ]]; then
        log "SUCCESS" "AlertManager deployment is healthy: $ready_replicas/$desired_replicas replicas ready"
    else
        log "ERROR" "AlertManager deployment is unhealthy: $ready_replicas/$desired_replicas replicas ready"
        return 1
    fi
    
    # Check AlertManager service
    if kubectl get service alertmanager -n "$MONITORING_NAMESPACE" &> /dev/null; then
        log "SUCCESS" "AlertManager service is available"
    else
        log "ERROR" "AlertManager service not found"
        return 1
    fi
    
    # Check AlertManager health endpoint
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/alertmanager -- \
        curl -f -s http://localhost:9093/-/healthy &> /dev/null; then
        log "SUCCESS" "AlertManager health endpoint is accessible"
    else
        log "ERROR" "AlertManager health endpoint is not accessible"
        return 1
    fi
    
    return 0
}

# Validate monitoring configuration files
validate_monitoring_configs() {
    log "INFO" "⚙️ Validating monitoring configuration files..."
    
    # Validate Prometheus configuration
    if [[ -f "$MONITORING_DIR/prometheus/prometheus.yml" ]]; then
        if yq eval '.' "$MONITORING_DIR/prometheus/prometheus.yml" &> /dev/null; then
            log "SUCCESS" "Prometheus configuration is valid YAML"
        else
            log "ERROR" "Prometheus configuration is invalid YAML"
        fi
    else
        log "ERROR" "Prometheus configuration file not found"
    fi
    
    # Validate alert rules
    if [[ -f "$MONITORING_DIR/prometheus/rules/embedding-alerts.yml" ]]; then
        if yq eval '.' "$MONITORING_DIR/prometheus/rules/embedding-alerts.yml" &> /dev/null; then
            log "SUCCESS" "Alert rules configuration is valid YAML"
        else
            log "ERROR" "Alert rules configuration is invalid YAML"
        fi
    else
        log "WARNING" "Alert rules file not found"
    fi
    
    # Validate Grafana dashboards
    local dashboard_files=(
        "$MONITORING_DIR/grafana/dashboards/production-overview-dashboard.json"
        "$MONITORING_DIR/grafana/dashboards/embedding-performance-dashboard.json"
        "$MONITORING_DIR/grafana/dashboards/worker-health-dashboard.json"
    )
    
    for dashboard in "${dashboard_files[@]}"; do
        if [[ -f "$dashboard" ]]; then
            local dashboard_name=$(basename "$dashboard")
            if jq empty "$dashboard" &> /dev/null; then
                log "SUCCESS" "Dashboard $dashboard_name is valid JSON"
            else
                log "ERROR" "Dashboard $dashboard_name is invalid JSON"
            fi
        else
            log "WARNING" "Dashboard not found: $(basename "$dashboard")"
        fi
    done
}

# Validate monitoring connectivity
validate_monitoring_connectivity() {
    if [[ "$QUICK_CHECK" == "true" ]]; then
        log "INFO" "Skipping connectivity validation (quick mode)"
        return 0
    fi
    
    log "INFO" "🔗 Validating monitoring connectivity..."
    
    # Check if monitoring namespace exists
    if ! kubectl get namespace "$MONITORING_NAMESPACE" &> /dev/null; then
        log "ERROR" "Monitoring namespace does not exist: $MONITORING_NAMESPACE"
        return 1
    fi
    
    # Check Prometheus to Grafana connectivity
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/grafana -- \
        curl -f -s http://prometheus:9090/api/v1/query?query=up &> /dev/null; then
        log "SUCCESS" "Grafana can connect to Prometheus"
    else
        log "WARNING" "Grafana cannot connect to Prometheus"
    fi
    
    # Check Prometheus to AlertManager connectivity
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/prometheus -- \
        curl -f -s http://alertmanager:9093/-/healthy &> /dev/null; then
        log "SUCCESS" "Prometheus can connect to AlertManager"
    else
        log "WARNING" "Prometheus cannot connect to AlertManager"
    fi
    
    return 0
}

# Generate validation report
generate_validation_report() {
    log "INFO" "📊 Generating validation report..."
    
    local report_file="$PROJECT_ROOT/logs/monitoring/monitoring-validation-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "validation_summary": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "namespace": "$NAMESPACE",
        "monitoring_namespace": "$MONITORING_NAMESPACE",
        "total_checks": $((VALIDATION_PASSED + VALIDATION_FAILED + VALIDATION_WARNINGS)),
        "passed": $VALIDATION_PASSED,
        "failed": $VALIDATION_FAILED,
        "warnings": $VALIDATION_WARNINGS,
        "success_rate": $(echo "scale=2; $VALIDATION_PASSED * 100 / ($VALIDATION_PASSED + $VALIDATION_FAILED + $VALIDATION_WARNINGS)" | bc -l 2>/dev/null || echo "0")
    },
    "validation_categories": {
        "prometheus": true,
        "grafana": true,
        "alertmanager": true,
        "configuration_files": true,
        "connectivity": $([ "$QUICK_CHECK" == "true" ] && echo "false" || echo "true")
    }
}
EOF
    
    log "SUCCESS" "Validation report generated: $report_file"
}

# Show help
show_help() {
    cat << EOF
Monitoring Infrastructure Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -n, --namespace NS      Application namespace (default: paperless-maverick)
    -m, --monitoring-ns NS  Monitoring namespace (default: monitoring)
    -e, --environment ENV   Target environment (default: production)
    -v, --verbose           Enable verbose logging
    -q, --quick             Quick validation (skip connectivity checks)
    -d, --deep              Enable deep validation with detailed checks

EXAMPLES:
    $0                      # Full monitoring validation
    $0 --quick              # Quick validation without connectivity checks
    $0 --verbose --deep     # Verbose validation with deep checks

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
            -m|--monitoring-ns)
                MONITORING_NAMESPACE="$2"
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
            -d|--deep)
                DEEP_VALIDATION=true
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
    
    log "INFO" "🔍 Starting monitoring infrastructure validation"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Application Namespace: $NAMESPACE"
    log "INFO" "Monitoring Namespace: $MONITORING_NAMESPACE"
    log "INFO" "Quick check: $QUICK_CHECK"
    log "INFO" "Deep validation: $DEEP_VALIDATION"
    log "INFO" "=================================================="
    
    # Run validation checks
    validate_monitoring_configs
    validate_prometheus
    validate_grafana
    validate_alertmanager
    validate_monitoring_connectivity
    
    # Generate report
    generate_validation_report
    
    # Summary
    log "INFO" "=================================================="
    log "INFO" "Monitoring Validation Summary:"
    log "INFO" "  - Total Checks: $((VALIDATION_PASSED + VALIDATION_FAILED + VALIDATION_WARNINGS))"
    log "INFO" "  - Passed: $VALIDATION_PASSED"
    log "INFO" "  - Failed: $VALIDATION_FAILED"
    log "INFO" "  - Warnings: $VALIDATION_WARNINGS"
    log "INFO" "=================================================="
    
    if [[ $VALIDATION_FAILED -gt 0 ]]; then
        log "ERROR" "Monitoring validation failed with $VALIDATION_FAILED failures"
        exit 1
    elif [[ $VALIDATION_WARNINGS -gt 0 ]]; then
        log "WARNING" "Monitoring validation completed with $VALIDATION_WARNINGS warnings"
        exit 0
    else
        log "SUCCESS" "All monitoring validation checks passed successfully"
        exit 0
    fi
}

# Execute main function
main "$@"
