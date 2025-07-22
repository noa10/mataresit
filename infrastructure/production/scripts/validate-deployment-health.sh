#!/bin/bash

# Deployment Health Validation Script for Paperless Maverick
# Comprehensive health checks and performance validation
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly HEALTH_LOG="$PROJECT_ROOT/logs/deployment/health-validation-$(date +%Y%m%d-%H%M%S).log"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
NAMESPACE="paperless-maverick"
ENVIRONMENT="production"
VERBOSE=false
QUICK_CHECK=false
PERFORMANCE_CHECK=true
DEEP_CHECK=false

# Health check results
HEALTH_CHECKS_PASSED=0
HEALTH_CHECKS_FAILED=0
HEALTH_WARNINGS=0

# Health check thresholds
readonly CPU_THRESHOLD=80
readonly MEMORY_THRESHOLD=85
readonly RESPONSE_TIME_THRESHOLD=2000
readonly ERROR_RATE_THRESHOLD=5

# Initialize logging
init_logging() {
    mkdir -p "$(dirname "$HEALTH_LOG")"
    touch "$HEALTH_LOG"
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$HEALTH_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$HEALTH_LOG"
            ((HEALTH_CHECKS_PASSED++))
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$HEALTH_LOG"
            ((HEALTH_WARNINGS++))
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$HEALTH_LOG"
            ((HEALTH_CHECKS_FAILED++))
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${BLUE}[$timestamp] 🔍${NC} $message" | tee -a "$HEALTH_LOG"
            fi
            ;;
    esac
}

# Check deployment status
check_deployment_status() {
    log "INFO" "🔍 Checking deployment status..."
    
    local deployments=("paperless-maverick" "embedding-queue-workers")
    
    for deployment in "${deployments[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            local ready_replicas
            ready_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local desired_replicas
            desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
            local available_replicas
            available_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo "0")
            
            if [[ "$ready_replicas" == "$desired_replicas" ]] && [[ "$available_replicas" == "$desired_replicas" ]]; then
                log "SUCCESS" "Deployment $deployment is healthy: $ready_replicas/$desired_replicas replicas ready"
            else
                log "ERROR" "Deployment $deployment is unhealthy: $ready_replicas/$desired_replicas ready, $available_replicas available"
            fi
        else
            log "ERROR" "Deployment $deployment not found"
        fi
    done
}

# Check pod health
check_pod_health() {
    log "INFO" "🏥 Checking pod health..."
    
    # Check main application pods
    local app_pods
    app_pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$app_pods" ]]; then
        log "ERROR" "No application pods found"
        return 1
    fi
    
    for pod in $app_pods; do
        check_individual_pod_health "$pod" "application"
    done
    
    # Check worker pods
    local worker_pods
    worker_pods=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -n "$worker_pods" ]]; then
        for pod in $worker_pods; do
            check_individual_pod_health "$pod" "worker"
        done
    else
        log "WARNING" "No worker pods found"
    fi
}

# Check individual pod health
check_individual_pod_health() {
    local pod="$1"
    local pod_type="$2"
    
    log "DEBUG" "Checking health for $pod_type pod: $pod"
    
    # Check pod status
    local pod_status
    pod_status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
    
    if [[ "$pod_status" != "Running" ]]; then
        log "ERROR" "Pod $pod is not running (status: $pod_status)"
        return 1
    fi
    
    # Check container readiness
    local ready_containers
    ready_containers=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].ready}')
    
    if [[ "$ready_containers" != "true" ]]; then
        log "ERROR" "Pod $pod containers are not ready"
        return 1
    fi
    
    # Check restart count
    local restart_count
    restart_count=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].restartCount}')
    
    if [[ "$restart_count" -gt 5 ]]; then
        log "WARNING" "Pod $pod has high restart count: $restart_count"
    elif [[ "$restart_count" -gt 0 ]]; then
        log "DEBUG" "Pod $pod restart count: $restart_count"
    fi
    
    log "SUCCESS" "Pod $pod is healthy"
}

# Check health endpoints
check_health_endpoints() {
    log "INFO" "🌐 Checking health endpoints..."
    
    # Get application pods
    local app_pods
    app_pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $app_pods; do
        log "DEBUG" "Checking health endpoints for pod: $pod"
        
        # Health endpoint
        if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
            log "SUCCESS" "Health endpoint accessible for pod: $pod"
        else
            log "ERROR" "Health endpoint failed for pod: $pod"
        fi
        
        # Readiness endpoint
        if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/ready &> /dev/null; then
            log "SUCCESS" "Readiness endpoint accessible for pod: $pod"
        else
            log "ERROR" "Readiness endpoint failed for pod: $pod"
        fi
        
        # Deep health check (if enabled)
        if [[ "$DEEP_CHECK" == "true" ]]; then
            if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health/deep &> /dev/null; then
                log "SUCCESS" "Deep health check passed for pod: $pod"
            else
                log "WARNING" "Deep health check failed for pod: $pod"
            fi
        fi
    done
}

# Check resource utilization
check_resource_utilization() {
    if [[ "$PERFORMANCE_CHECK" != "true" ]]; then
        log "INFO" "Skipping resource utilization check"
        return 0
    fi
    
    log "INFO" "📊 Checking resource utilization..."
    
    # Get application pods
    local app_pods
    app_pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $app_pods; do
        log "DEBUG" "Checking resource utilization for pod: $pod"
        
        # Get CPU and memory usage
        local metrics
        metrics=$(kubectl top pod "$pod" -n "$NAMESPACE" --no-headers 2>/dev/null || echo "$pod 0m 0Mi")
        
        local cpu_usage
        cpu_usage=$(echo "$metrics" | awk '{print $2}' | sed 's/m//')
        local memory_usage
        memory_usage=$(echo "$metrics" | awk '{print $3}' | sed 's/Mi//')
        
        # Get resource limits
        local cpu_limit
        cpu_limit=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.cpu}' | sed 's/m//')
        local memory_limit
        memory_limit=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.memory}' | sed 's/Mi//')
        
        # Calculate utilization percentages
        if [[ -n "$cpu_limit" ]] && [[ "$cpu_limit" != "null" ]] && [[ "$cpu_limit" -gt 0 ]]; then
            local cpu_percent=$((cpu_usage * 100 / cpu_limit))
            
            if [[ "$cpu_percent" -gt "$CPU_THRESHOLD" ]]; then
                log "WARNING" "High CPU usage for pod $pod: ${cpu_percent}%"
            else
                log "DEBUG" "CPU usage for pod $pod: ${cpu_percent}%"
            fi
        fi
        
        if [[ -n "$memory_limit" ]] && [[ "$memory_limit" != "null" ]] && [[ "$memory_limit" -gt 0 ]]; then
            local memory_percent=$((memory_usage * 100 / memory_limit))
            
            if [[ "$memory_percent" -gt "$MEMORY_THRESHOLD" ]]; then
                log "WARNING" "High memory usage for pod $pod: ${memory_percent}%"
            else
                log "DEBUG" "Memory usage for pod $pod: ${memory_percent}%"
            fi
        fi
    done
    
    log "SUCCESS" "Resource utilization check completed"
}

# Check service connectivity
check_service_connectivity() {
    log "INFO" "🔗 Checking service connectivity..."
    
    # Check main service
    if kubectl get service paperless-maverick -n "$NAMESPACE" &> /dev/null; then
        local service_ip
        service_ip=$(kubectl get service paperless-maverick -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
        
        if [[ -n "$service_ip" ]] && [[ "$service_ip" != "None" ]]; then
            log "SUCCESS" "Service paperless-maverick is accessible at: $service_ip"
        else
            log "ERROR" "Service paperless-maverick has no cluster IP"
        fi
    else
        log "ERROR" "Service paperless-maverick not found"
    fi
    
    # Check ingress (if exists)
    if kubectl get ingress paperless-maverick -n "$NAMESPACE" &> /dev/null; then
        local ingress_hosts
        ingress_hosts=$(kubectl get ingress paperless-maverick -n "$NAMESPACE" -o jsonpath='{.spec.rules[*].host}')
        
        if [[ -n "$ingress_hosts" ]]; then
            log "SUCCESS" "Ingress configured for hosts: $ingress_hosts"
        else
            log "WARNING" "Ingress exists but no hosts configured"
        fi
    else
        log "DEBUG" "No ingress found (may be expected)"
    fi
}

# Check database connectivity
check_database_connectivity() {
    if [[ "$QUICK_CHECK" == "true" ]]; then
        log "INFO" "Skipping database connectivity check (quick mode)"
        return 0
    fi
    
    log "INFO" "🗄️ Checking database connectivity..."
    
    # Get application pods
    local app_pods
    app_pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -n "$app_pods" ]]; then
        local pod=$(echo "$app_pods" | awk '{print $1}')
        
        # Test database connection through health endpoint
        local db_health
        db_health=$(kubectl exec -n "$NAMESPACE" "$pod" -- curl -s http://localhost:3000/api/monitoring/health 2>/dev/null | jq -r '.database.status' 2>/dev/null || echo "unknown")
        
        if [[ "$db_health" == "healthy" ]]; then
            log "SUCCESS" "Database connectivity is healthy"
        else
            log "ERROR" "Database connectivity check failed: $db_health"
        fi
    else
        log "ERROR" "No application pods available for database connectivity check"
    fi
}

# Generate health report
generate_health_report() {
    log "INFO" "📊 Generating health report..."
    
    local report_file="$PROJECT_ROOT/logs/deployment/health-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "health_summary": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "namespace": "$NAMESPACE",
        "total_checks": $((HEALTH_CHECKS_PASSED + HEALTH_CHECKS_FAILED + HEALTH_WARNINGS)),
        "passed": $HEALTH_CHECKS_PASSED,
        "failed": $HEALTH_CHECKS_FAILED,
        "warnings": $HEALTH_WARNINGS,
        "success_rate": $(echo "scale=2; $HEALTH_CHECKS_PASSED * 100 / ($HEALTH_CHECKS_PASSED + $HEALTH_CHECKS_FAILED + $HEALTH_WARNINGS)" | bc -l 2>/dev/null || echo "0")
    },
    "health_categories": {
        "deployment_status": true,
        "pod_health": true,
        "health_endpoints": true,
        "resource_utilization": $PERFORMANCE_CHECK,
        "service_connectivity": true,
        "database_connectivity": $([ "$QUICK_CHECK" == "true" ] && echo "false" || echo "true")
    }
}
EOF
    
    log "SUCCESS" "Health report generated: $report_file"
}

# Show help
show_help() {
    cat << EOF
Deployment Health Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -n, --namespace NS      Kubernetes namespace (default: paperless-maverick)
    -e, --environment ENV   Target environment (default: production)
    -v, --verbose           Enable verbose logging
    -q, --quick             Quick health check (skip performance and DB checks)
    -p, --no-performance    Skip performance checks
    -d, --deep              Enable deep health checks

EXAMPLES:
    $0                      # Full health validation
    $0 --quick              # Quick health check
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
                PERFORMANCE_CHECK=false
                shift
                ;;
            -p|--no-performance)
                PERFORMANCE_CHECK=false
                shift
                ;;
            -d|--deep)
                DEEP_CHECK=true
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
    
    log "INFO" "🏥 Starting deployment health validation"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Quick check: $QUICK_CHECK"
    log "INFO" "Performance check: $PERFORMANCE_CHECK"
    log "INFO" "Deep check: $DEEP_CHECK"
    log "INFO" "=================================================="
    
    # Run health checks
    check_deployment_status
    check_pod_health
    check_health_endpoints
    check_resource_utilization
    check_service_connectivity
    check_database_connectivity
    
    # Generate report
    generate_health_report
    
    # Summary
    log "INFO" "=================================================="
    log "INFO" "Health Validation Summary:"
    log "INFO" "  - Total Checks: $((HEALTH_CHECKS_PASSED + HEALTH_CHECKS_FAILED + HEALTH_WARNINGS))"
    log "INFO" "  - Passed: $HEALTH_CHECKS_PASSED"
    log "INFO" "  - Failed: $HEALTH_CHECKS_FAILED"
    log "INFO" "  - Warnings: $HEALTH_WARNINGS"
    log "INFO" "=================================================="
    
    if [[ $HEALTH_CHECKS_FAILED -gt 0 ]]; then
        log "ERROR" "Health validation failed with $HEALTH_CHECKS_FAILED failures"
        exit 1
    elif [[ $HEALTH_WARNINGS -gt 0 ]]; then
        log "WARNING" "Health validation completed with $HEALTH_WARNINGS warnings"
        exit 0
    else
        log "SUCCESS" "All health checks passed successfully"
        exit 0
    fi
}

# Execute main function
main "$@"
