#!/bin/bash

# Comprehensive Deployment Validation Framework for Paperless Maverick
# Automated validation scripts for post-deployment testing, health checks, performance validation
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

# Validation configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly VALIDATION_CONFIG="$CONFIG_DIR/validation-config.yaml"

# Logging configuration
readonly LOG_DIR="$PROJECT_ROOT/logs/validation"
readonly VALIDATION_LOG="$LOG_DIR/deployment-validation-$(date +%Y%m%d-%H%M%S).log"
readonly REPORT_DIR="$PROJECT_ROOT/reports/validation"

# Default values
readonly DEFAULT_ENVIRONMENT="production"
readonly DEFAULT_NAMESPACE="paperless-maverick"
readonly VALIDATION_TIMEOUT=1800  # 30 minutes
readonly HEALTH_CHECK_TIMEOUT=300  # 5 minutes
readonly PERFORMANCE_TEST_DURATION=300  # 5 minutes

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
VALIDATION_SUITE="comprehensive"
DRY_RUN=false
VERBOSE=false
PARALLEL_EXECUTION=false
GENERATE_REPORT=true
FAIL_FAST=false

# Validation state
VALIDATION_ID=""
VALIDATION_START_TIME=""
VALIDATION_RESULTS=()
VALIDATION_METRICS=()

# Test categories
declare -A TEST_CATEGORIES=(
    ["health"]="Health and readiness checks"
    ["performance"]="Performance and load testing"
    ["functional"]="Functional and integration testing"
    ["security"]="Security and compliance validation"
    ["database"]="Database connectivity and integrity"
    ["monitoring"]="Monitoring and alerting validation"
    ["api"]="API endpoint and contract testing"
    ["ui"]="User interface and accessibility testing"
)

# Success criteria thresholds
declare -A SUCCESS_CRITERIA=(
    ["health_check_success_rate"]=95
    ["api_response_time_p95"]=2000
    ["api_success_rate"]=99
    ["database_query_time_p95"]=500
    ["embedding_success_rate"]=90
    ["worker_availability"]=80
    ["memory_utilization_max"]=85
    ["cpu_utilization_max"]=80
    ["error_rate_max"]=5
)

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Initialize logging and directories
init_validation() {
    mkdir -p "$LOG_DIR" "$REPORT_DIR"
    touch "$VALIDATION_LOG"
    
    # Generate unique validation ID
    VALIDATION_ID="validation-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    VALIDATION_START_TIME=$(date +%s)
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
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$VALIDATION_LOG"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$VALIDATION_LOG"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[$timestamp] 🔍${NC} $message" | tee -a "$VALIDATION_LOG"
            fi
            ;;
    esac
}

# Record validation result
record_validation_result() {
    local test_name="$1"
    local test_category="$2"
    local result="$3"
    local duration="$4"
    local details="${5:-}"
    
    local result_entry="$test_name|$test_category|$result|$duration|$details"
    VALIDATION_RESULTS+=("$result_entry")
    
    log "DEBUG" "Recorded result: $test_name -> $result (${duration}s)"
}

# Record validation metric
record_validation_metric() {
    local metric_name="$1"
    local metric_value="$2"
    local metric_unit="${3:-}"
    local threshold="${4:-}"
    
    local metric_entry="$metric_name|$metric_value|$metric_unit|$threshold"
    VALIDATION_METRICS+=("$metric_entry")
    
    log "DEBUG" "Recorded metric: $metric_name = $metric_value $metric_unit"
}

# ============================================================================
# HEALTH VALIDATION FUNCTIONS
# ============================================================================

# Comprehensive health validation
validate_health() {
    log "INFO" "🏥 Running comprehensive health validation..."
    
    local start_time=$(date +%s)
    local health_tests_passed=0
    local health_tests_total=0
    
    # Basic deployment health
    if validate_deployment_health; then
        ((health_tests_passed++))
    fi
    ((health_tests_total++))
    
    # Pod health and readiness
    if validate_pod_health; then
        ((health_tests_passed++))
    fi
    ((health_tests_total++))
    
    # Service connectivity
    if validate_service_connectivity; then
        ((health_tests_passed++))
    fi
    ((health_tests_total++))
    
    # Health endpoints
    if validate_health_endpoints; then
        ((health_tests_passed++))
    fi
    ((health_tests_total++))
    
    # Database connectivity
    if validate_database_connectivity; then
        ((health_tests_passed++))
    fi
    ((health_tests_total++))
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local success_rate=$((health_tests_passed * 100 / health_tests_total))
    
    record_validation_metric "health_check_success_rate" "$success_rate" "%" "${SUCCESS_CRITERIA[health_check_success_rate]}"
    
    if [[ $success_rate -ge ${SUCCESS_CRITERIA[health_check_success_rate]} ]]; then
        record_validation_result "health_validation" "health" "PASS" "$duration" "Success rate: $success_rate%"
        log "SUCCESS" "Health validation passed: $success_rate% success rate"
        return 0
    else
        record_validation_result "health_validation" "health" "FAIL" "$duration" "Success rate: $success_rate%"
        log "ERROR" "Health validation failed: $success_rate% success rate"
        return 1
    fi
}

# Validate deployment health
validate_deployment_health() {
    log "DEBUG" "Validating deployment health..."
    
    local deployments=("paperless-maverick" "embedding-queue-workers")
    
    for deployment in "${deployments[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            local ready_replicas
            ready_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local desired_replicas
            desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
            
            if [[ "$ready_replicas" == "$desired_replicas" ]] && [[ "$ready_replicas" -gt 0 ]]; then
                log "DEBUG" "Deployment $deployment is healthy: $ready_replicas/$desired_replicas"
            else
                log "ERROR" "Deployment $deployment is unhealthy: $ready_replicas/$desired_replicas"
                return 1
            fi
        else
            log "ERROR" "Deployment $deployment not found"
            return 1
        fi
    done
    
    return 0
}

# Validate pod health
validate_pod_health() {
    log "DEBUG" "Validating pod health..."
    
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$pods" ]]; then
        log "ERROR" "No application pods found"
        return 1
    fi
    
    local healthy_pods=0
    local total_pods=0
    
    for pod in $pods; do
        ((total_pods++))
        
        local pod_status
        pod_status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        
        local ready_condition
        ready_condition=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
        
        if [[ "$pod_status" == "Running" ]] && [[ "$ready_condition" == "True" ]]; then
            ((healthy_pods++))
            log "DEBUG" "Pod $pod is healthy"
        else
            log "ERROR" "Pod $pod is unhealthy: status=$pod_status, ready=$ready_condition"
        fi
    done
    
    local pod_health_rate=$((healthy_pods * 100 / total_pods))
    record_validation_metric "pod_health_rate" "$pod_health_rate" "%"
    
    if [[ $pod_health_rate -ge 90 ]]; then
        return 0
    else
        return 1
    fi
}

# Validate service connectivity
validate_service_connectivity() {
    log "DEBUG" "Validating service connectivity..."
    
    local services=("paperless-maverick")
    
    for service in "${services[@]}"; do
        if kubectl get service "$service" -n "$NAMESPACE" &> /dev/null; then
            local cluster_ip
            cluster_ip=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
            
            if [[ -n "$cluster_ip" ]] && [[ "$cluster_ip" != "None" ]]; then
                log "DEBUG" "Service $service is accessible at $cluster_ip"
            else
                log "ERROR" "Service $service has no cluster IP"
                return 1
            fi
        else
            log "ERROR" "Service $service not found"
            return 1
        fi
    done
    
    return 0
}

# Validate health endpoints
validate_health_endpoints() {
    log "DEBUG" "Validating health endpoints..."
    
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    local healthy_endpoints=0
    local total_endpoints=0
    
    for pod in $pods; do
        # Health endpoint
        ((total_endpoints++))
        if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
            ((healthy_endpoints++))
            log "DEBUG" "Health endpoint accessible for pod: $pod"
        else
            log "ERROR" "Health endpoint failed for pod: $pod"
        fi
        
        # Readiness endpoint
        ((total_endpoints++))
        if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/ready &> /dev/null; then
            ((healthy_endpoints++))
            log "DEBUG" "Readiness endpoint accessible for pod: $pod"
        else
            log "ERROR" "Readiness endpoint failed for pod: $pod"
        fi
    done
    
    local endpoint_health_rate=$((healthy_endpoints * 100 / total_endpoints))
    record_validation_metric "endpoint_health_rate" "$endpoint_health_rate" "%"
    
    if [[ $endpoint_health_rate -ge 90 ]]; then
        return 0
    else
        return 1
    fi
}

# Validate database connectivity
validate_database_connectivity() {
    log "DEBUG" "Validating database connectivity..."
    
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -n "$pods" ]]; then
        local pod=$(echo "$pods" | awk '{print $1}')
        
        local db_health
        db_health=$(kubectl exec -n "$NAMESPACE" "$pod" -- curl -s http://localhost:3000/api/monitoring/health 2>/dev/null | jq -r '.database.status' 2>/dev/null || echo "unknown")
        
        if [[ "$db_health" == "healthy" ]]; then
            log "DEBUG" "Database connectivity is healthy"
            return 0
        else
            log "ERROR" "Database connectivity check failed: $db_health"
            return 1
        fi
    else
        log "ERROR" "No application pods available for database connectivity check"
        return 1
    fi
}

# ============================================================================
# PERFORMANCE VALIDATION FUNCTIONS
# ============================================================================

# Comprehensive performance validation
validate_performance() {
    log "INFO" "🚀 Running comprehensive performance validation..."

    local start_time=$(date +%s)
    local performance_tests_passed=0
    local performance_tests_total=0

    # API response time validation
    if validate_api_response_time; then
        ((performance_tests_passed++))
    fi
    ((performance_tests_total++))

    # Throughput validation
    if validate_throughput; then
        ((performance_tests_passed++))
    fi
    ((performance_tests_total++))

    # Resource utilization validation
    if validate_resource_utilization; then
        ((performance_tests_passed++))
    fi
    ((performance_tests_total++))

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local success_rate=$((performance_tests_passed * 100 / performance_tests_total))

    record_validation_metric "performance_test_success_rate" "$success_rate" "%"

    if [[ $success_rate -ge 75 ]]; then
        record_validation_result "performance_validation" "performance" "PASS" "$duration" "Success rate: $success_rate%"
        log "SUCCESS" "Performance validation passed: $success_rate% success rate"
        return 0
    else
        record_validation_result "performance_validation" "performance" "FAIL" "$duration" "Success rate: $success_rate%"
        log "ERROR" "Performance validation failed: $success_rate% success rate"
        return 1
    fi
}

# Validate API response time
validate_api_response_time() {
    log "DEBUG" "Validating API response time..."

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log "ERROR" "No application pods found for response time test"
        return 1
    fi

    local pod=$(echo "$pods" | awk '{print $1}')
    local response_times=()
    local test_count=10

    for ((i=1; i<=test_count; i++)); do
        local response_time
        response_time=$(kubectl exec -n "$NAMESPACE" "$pod" -- curl -w "%{time_total}" -s -o /dev/null http://localhost:3000/health 2>/dev/null || echo "999")

        if [[ -n "$response_time" ]] && [[ "$response_time" != "999" ]]; then
            response_times+=("$response_time")
        fi
    done

    if [[ ${#response_times[@]} -gt 0 ]]; then
        local sum=0
        for time in "${response_times[@]}"; do
            sum=$(echo "$sum + $time" | bc -l)
        done

        local avg_response_time
        avg_response_time=$(echo "scale=3; $sum / ${#response_times[@]}" | bc -l)
        local avg_response_time_ms
        avg_response_time_ms=$(echo "$avg_response_time * 1000" | bc -l | cut -d. -f1)

        record_validation_metric "api_response_time_avg" "$avg_response_time_ms" "ms" "${SUCCESS_CRITERIA[api_response_time_p95]}"

        if [[ "$avg_response_time_ms" -lt "${SUCCESS_CRITERIA[api_response_time_p95]}" ]]; then
            log "DEBUG" "API response time within limits: ${avg_response_time_ms}ms"
            return 0
        else
            log "ERROR" "API response time exceeds threshold: ${avg_response_time_ms}ms > ${SUCCESS_CRITERIA[api_response_time_p95]}ms"
            return 1
        fi
    else
        log "ERROR" "No valid response time measurements"
        return 1
    fi
}

# Validate throughput
validate_throughput() {
    log "DEBUG" "Validating throughput..."

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log "ERROR" "No application pods found for throughput test"
        return 1
    fi

    local pod=$(echo "$pods" | awk '{print $1}')
    local test_duration=30
    local start_time=$(date +%s)
    local request_count=0
    local error_count=0
    local test_end_time=$((start_time + test_duration))

    while [[ $(date +%s) -lt $test_end_time ]]; do
        if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
            ((request_count++))
        else
            ((error_count++))
        fi

        sleep 0.1
    done

    local actual_duration=$(($(date +%s) - start_time))
    local requests_per_second=$((request_count / actual_duration))
    local error_rate=0

    if [[ $((request_count + error_count)) -gt 0 ]]; then
        error_rate=$(echo "scale=2; $error_count * 100 / ($request_count + $error_count)" | bc -l)
    fi

    record_validation_metric "throughput_rps" "$requests_per_second" "rps"
    record_validation_metric "throughput_error_rate" "$error_rate" "%"

    if [[ "$requests_per_second" -ge 5 ]] && [[ $(echo "$error_rate < 10" | bc -l) -eq 1 ]]; then
        log "DEBUG" "Throughput validation passed: ${requests_per_second} RPS, ${error_rate}% error rate"
        return 0
    else
        log "ERROR" "Throughput validation failed: ${requests_per_second} RPS, ${error_rate}% error rate"
        return 1
    fi
}

# Validate resource utilization
validate_resource_utilization() {
    log "DEBUG" "Validating resource utilization..."

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log "ERROR" "No application pods found for resource utilization test"
        return 1
    fi

    local max_cpu_usage=0
    local max_memory_usage=0
    local monitoring_duration=60
    local check_interval=10
    local checks=$((monitoring_duration / check_interval))

    for ((i=1; i<=checks; i++)); do
        for pod in $pods; do
            local metrics
            metrics=$(kubectl top pod "$pod" -n "$NAMESPACE" --no-headers 2>/dev/null || echo "$pod 0m 0Mi")

            local cpu_usage
            cpu_usage=$(echo "$metrics" | awk '{print $2}' | sed 's/m//')
            local memory_usage
            memory_usage=$(echo "$metrics" | awk '{print $3}' | sed 's/Mi//')

            if [[ "$cpu_usage" -gt "$max_cpu_usage" ]]; then
                max_cpu_usage="$cpu_usage"
            fi

            if [[ "$memory_usage" -gt "$max_memory_usage" ]]; then
                max_memory_usage="$memory_usage"
            fi
        done

        sleep "$check_interval"
    done

    # Get resource limits for comparison
    local pod=$(echo "$pods" | awk '{print $1}')
    local cpu_limit
    cpu_limit=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.cpu}' | sed 's/m//')
    local memory_limit
    memory_limit=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.memory}' | sed 's/Mi//')

    local cpu_percent=0
    local memory_percent=0

    if [[ -n "$cpu_limit" ]] && [[ "$cpu_limit" != "null" ]] && [[ "$cpu_limit" -gt 0 ]]; then
        cpu_percent=$((max_cpu_usage * 100 / cpu_limit))
    fi

    if [[ -n "$memory_limit" ]] && [[ "$memory_limit" != "null" ]] && [[ "$memory_limit" -gt 0 ]]; then
        memory_percent=$((max_memory_usage * 100 / memory_limit))
    fi

    record_validation_metric "cpu_utilization_max" "$cpu_percent" "%" "${SUCCESS_CRITERIA[cpu_utilization_max]}"
    record_validation_metric "memory_utilization_max" "$memory_percent" "%" "${SUCCESS_CRITERIA[memory_utilization_max]}"

    if [[ $cpu_percent -le ${SUCCESS_CRITERIA[cpu_utilization_max]} ]] && [[ $memory_percent -le ${SUCCESS_CRITERIA[memory_utilization_max]} ]]; then
        log "DEBUG" "Resource utilization within limits: CPU ${cpu_percent}%, Memory ${memory_percent}%"
        return 0
    else
        log "ERROR" "Resource utilization exceeds limits: CPU ${cpu_percent}%, Memory ${memory_percent}%"
        return 1
    fi
}

# ============================================================================
# FUNCTIONAL VALIDATION FUNCTIONS
# ============================================================================

# Comprehensive functional validation
validate_functional() {
    log "INFO" "⚙️ Running comprehensive functional validation..."

    local start_time=$(date +%s)
    local functional_tests_passed=0
    local functional_tests_total=0

    # API endpoint validation
    if validate_api_endpoints; then
        ((functional_tests_passed++))
    fi
    ((functional_tests_total++))

    # Embedding functionality validation
    if validate_embedding_functionality; then
        ((functional_tests_passed++))
    fi
    ((functional_tests_total++))

    # Worker functionality validation
    if validate_worker_functionality; then
        ((functional_tests_passed++))
    fi
    ((functional_tests_total++))

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local success_rate=$((functional_tests_passed * 100 / functional_tests_total))

    record_validation_metric "functional_test_success_rate" "$success_rate" "%"

    if [[ $success_rate -ge 80 ]]; then
        record_validation_result "functional_validation" "functional" "PASS" "$duration" "Success rate: $success_rate%"
        log "SUCCESS" "Functional validation passed: $success_rate% success rate"
        return 0
    else
        record_validation_result "functional_validation" "functional" "FAIL" "$duration" "Success rate: $success_rate%"
        log "ERROR" "Functional validation failed: $success_rate% success rate"
        return 1
    fi
}

# Validate API endpoints
validate_api_endpoints() {
    log "DEBUG" "Validating API endpoints..."

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log "ERROR" "No application pods found for API endpoint test"
        return 1
    fi

    local pod=$(echo "$pods" | awk '{print $1}')
    local endpoints=("/health" "/ready" "/api/monitoring/health")
    local successful_endpoints=0

    for endpoint in "${endpoints[@]}"; do
        if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s "http://localhost:3000$endpoint" &> /dev/null; then
            log "DEBUG" "API endpoint accessible: $endpoint"
            ((successful_endpoints++))
        else
            log "ERROR" "API endpoint failed: $endpoint"
        fi
    done

    local endpoint_success_rate=$((successful_endpoints * 100 / ${#endpoints[@]}))
    record_validation_metric "api_endpoint_success_rate" "$endpoint_success_rate" "%"

    if [[ $endpoint_success_rate -ge ${SUCCESS_CRITERIA[api_success_rate]} ]]; then
        return 0
    else
        return 1
    fi
}

# Validate embedding functionality
validate_embedding_functionality() {
    log "DEBUG" "Validating embedding functionality..."

    # This would typically test actual embedding processing
    # For now, we'll check if embedding workers are running
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

    if [[ $total_workers -gt 0 ]]; then
        local worker_availability=$((running_workers * 100 / total_workers))
        record_validation_metric "worker_availability" "$worker_availability" "%" "${SUCCESS_CRITERIA[worker_availability]}"

        if [[ $worker_availability -ge ${SUCCESS_CRITERIA[worker_availability]} ]]; then
            log "DEBUG" "Embedding functionality validation passed: $worker_availability% workers available"
            return 0
        else
            log "ERROR" "Embedding functionality validation failed: $worker_availability% workers available"
            return 1
        fi
    else
        log "WARNING" "No embedding workers found"
        return 1
    fi
}

# Validate worker functionality
validate_worker_functionality() {
    log "DEBUG" "Validating worker functionality..."

    local worker_pods
    worker_pods=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$worker_pods" ]]; then
        log "WARNING" "No worker pods found"
        return 1
    fi

    local healthy_workers=0
    local total_workers=0

    for pod in $worker_pods; do
        ((total_workers++))

        # Check pod status
        local pod_status
        pod_status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')

        # Check restart count
        local restart_count
        restart_count=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")

        if [[ "$pod_status" == "Running" ]] && [[ "$restart_count" -lt 5 ]]; then
            ((healthy_workers++))
            log "DEBUG" "Worker pod $pod is healthy"
        else
            log "ERROR" "Worker pod $pod is unhealthy: status=$pod_status, restarts=$restart_count"
        fi
    done

    local worker_health_rate=$((healthy_workers * 100 / total_workers))
    record_validation_metric "worker_health_rate" "$worker_health_rate" "%"

    if [[ $worker_health_rate -ge 80 ]]; then
        return 0
    else
        return 1
    fi
}

# ============================================================================
# REPORTING FUNCTIONS
# ============================================================================

# Generate comprehensive validation report
generate_validation_report() {
    if [[ "$GENERATE_REPORT" != "true" ]]; then
        return 0
    fi

    log "INFO" "📊 Generating validation report..."

    local report_file="$REPORT_DIR/deployment-validation-report-$(date +%Y%m%d-%H%M%S).json"
    local html_report_file="$REPORT_DIR/deployment-validation-report-$(date +%Y%m%d-%H%M%S).html"

    # Calculate summary statistics
    local total_tests=${#VALIDATION_RESULTS[@]}
    local passed_tests=0
    local failed_tests=0
    local warning_tests=0

    for result in "${VALIDATION_RESULTS[@]}"; do
        local test_result=$(echo "$result" | cut -d'|' -f3)
        case "$test_result" in
            "PASS") ((passed_tests++)) ;;
            "FAIL") ((failed_tests++)) ;;
            "WARNING") ((warning_tests++)) ;;
        esac
    done

    local success_rate=0
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$((passed_tests * 100 / total_tests))
    fi

    local validation_end_time=$(date +%s)
    local validation_duration=$((validation_end_time - VALIDATION_START_TIME))

    # Generate JSON report
    cat > "$report_file" << EOF
{
    "validation_summary": {
        "validation_id": "$VALIDATION_ID",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "namespace": "$NAMESPACE",
        "validation_suite": "$VALIDATION_SUITE",
        "duration": $validation_duration,
        "total_tests": $total_tests,
        "passed_tests": $passed_tests,
        "failed_tests": $failed_tests,
        "warning_tests": $warning_tests,
        "success_rate": $success_rate
    },
    "test_results": [
EOF

    # Add test results
    local first_result=true
    for result in "${VALIDATION_RESULTS[@]}"; do
        if [[ "$first_result" != "true" ]]; then
            echo "," >> "$report_file"
        fi
        first_result=false

        local test_name=$(echo "$result" | cut -d'|' -f1)
        local test_category=$(echo "$result" | cut -d'|' -f2)
        local test_result=$(echo "$result" | cut -d'|' -f3)
        local test_duration=$(echo "$result" | cut -d'|' -f4)
        local test_details=$(echo "$result" | cut -d'|' -f5)

        cat >> "$report_file" << EOF
        {
            "test_name": "$test_name",
            "category": "$test_category",
            "result": "$test_result",
            "duration": $test_duration,
            "details": "$test_details"
        }
EOF
    done

    echo "    ]," >> "$report_file"
    echo "    \"metrics\": [" >> "$report_file"

    # Add metrics
    local first_metric=true
    for metric in "${VALIDATION_METRICS[@]}"; do
        if [[ "$first_metric" != "true" ]]; then
            echo "," >> "$report_file"
        fi
        first_metric=false

        local metric_name=$(echo "$metric" | cut -d'|' -f1)
        local metric_value=$(echo "$metric" | cut -d'|' -f2)
        local metric_unit=$(echo "$metric" | cut -d'|' -f3)
        local metric_threshold=$(echo "$metric" | cut -d'|' -f4)

        cat >> "$report_file" << EOF
        {
            "name": "$metric_name",
            "value": $metric_value,
            "unit": "$metric_unit",
            "threshold": "$metric_threshold"
        }
EOF
    done

    echo "    ]" >> "$report_file"
    echo "}" >> "$report_file"

    log "SUCCESS" "Validation report generated: $report_file"

    # Generate HTML report
    generate_html_report "$html_report_file" "$report_file"

    return 0
}

# Generate HTML report
generate_html_report() {
    local html_file="$1"
    local json_file="$2"

    cat > "$html_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deployment Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 24px; font-weight: bold; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .warning { color: #ffc107; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background-color: #f8f9fa; font-weight: bold; }
        .status-pass { background-color: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px; }
        .status-fail { background-color: #f8d7da; color: #721c24; padding: 4px 8px; border-radius: 4px; }
        .status-warning { background-color: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Deployment Validation Report</h1>
            <p>Generated on: <span id="timestamp"></span></p>
        </div>

        <div class="summary" id="summary">
            <!-- Summary cards will be populated by JavaScript -->
        </div>

        <h2>Test Results</h2>
        <table class="table" id="results-table">
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Category</th>
                    <th>Result</th>
                    <th>Duration (s)</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody id="results-body">
                <!-- Results will be populated by JavaScript -->
            </tbody>
        </table>

        <h2>Metrics</h2>
        <table class="table" id="metrics-table">
            <thead>
                <tr>
                    <th>Metric Name</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Threshold</th>
                </tr>
            </thead>
            <tbody id="metrics-body">
                <!-- Metrics will be populated by JavaScript -->
            </tbody>
        </table>
    </div>

    <script>
        // Load and display report data
        fetch('REPORT_DATA_PLACEHOLDER')
            .then(response => response.json())
            .then(data => {
                displayReport(data);
            })
            .catch(error => {
                console.error('Error loading report data:', error);
            });

        function displayReport(data) {
            // Display summary
            document.getElementById('timestamp').textContent = new Date(data.validation_summary.timestamp).toLocaleString();

            const summary = data.validation_summary;
            const summaryHtml = `
                <div class="summary-card">
                    <h3>Total Tests</h3>
                    <div class="value">${summary.total_tests}</div>
                </div>
                <div class="summary-card">
                    <h3>Passed</h3>
                    <div class="value pass">${summary.passed_tests}</div>
                </div>
                <div class="summary-card">
                    <h3>Failed</h3>
                    <div class="value fail">${summary.failed_tests}</div>
                </div>
                <div class="summary-card">
                    <h3>Success Rate</h3>
                    <div class="value ${summary.success_rate >= 90 ? 'pass' : summary.success_rate >= 70 ? 'warning' : 'fail'}">${summary.success_rate}%</div>
                </div>
                <div class="summary-card">
                    <h3>Duration</h3>
                    <div class="value">${summary.duration}s</div>
                </div>
            `;
            document.getElementById('summary').innerHTML = summaryHtml;

            // Display test results
            const resultsBody = document.getElementById('results-body');
            data.test_results.forEach(result => {
                const row = resultsBody.insertRow();
                row.innerHTML = `
                    <td>${result.test_name}</td>
                    <td>${result.category}</td>
                    <td><span class="status-${result.result.toLowerCase()}">${result.result}</span></td>
                    <td>${result.duration}</td>
                    <td>${result.details}</td>
                `;
            });

            // Display metrics
            const metricsBody = document.getElementById('metrics-body');
            data.metrics.forEach(metric => {
                const row = metricsBody.insertRow();
                row.innerHTML = `
                    <td>${metric.name}</td>
                    <td>${metric.value}</td>
                    <td>${metric.unit}</td>
                    <td>${metric.threshold}</td>
                `;
            });
        }
    </script>
</body>
</html>
EOF

    # Replace placeholder with actual JSON data
    local json_data=$(cat "$json_file" | sed 's/"/\\"/g' | tr -d '\n')
    sed -i "s|REPORT_DATA_PLACEHOLDER|data:application/json;charset=utf-8,$json_data|g" "$html_file"

    log "SUCCESS" "HTML validation report generated: $html_file"
}

# ============================================================================
# MAIN ORCHESTRATION FUNCTIONS
# ============================================================================

# Main validation orchestration
main_validation() {
    log "INFO" "🚀 Starting comprehensive deployment validation"
    log "INFO" "Validation ID: $VALIDATION_ID"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Validation Suite: $VALIDATION_SUITE"
    log "INFO" "Dry Run: $DRY_RUN"
    log "INFO" "=================================================="

    local validation_start_time=$(date +%s)
    local validation_success=true

    # Run validation suites based on configuration
    case "$VALIDATION_SUITE" in
        "health")
            if ! validate_health; then
                validation_success=false
                if [[ "$FAIL_FAST" == "true" ]]; then
                    log "ERROR" "Health validation failed, stopping due to fail-fast mode"
                    return 1
                fi
            fi
            ;;
        "performance")
            if ! validate_performance; then
                validation_success=false
                if [[ "$FAIL_FAST" == "true" ]]; then
                    log "ERROR" "Performance validation failed, stopping due to fail-fast mode"
                    return 1
                fi
            fi
            ;;
        "functional")
            if ! validate_functional; then
                validation_success=false
                if [[ "$FAIL_FAST" == "true" ]]; then
                    log "ERROR" "Functional validation failed, stopping due to fail-fast mode"
                    return 1
                fi
            fi
            ;;
        "comprehensive"|"all")
            # Run all validation suites
            if ! validate_health; then
                validation_success=false
                if [[ "$FAIL_FAST" == "true" ]]; then
                    log "ERROR" "Health validation failed, stopping due to fail-fast mode"
                    return 1
                fi
            fi

            if ! validate_performance; then
                validation_success=false
                if [[ "$FAIL_FAST" == "true" ]]; then
                    log "ERROR" "Performance validation failed, stopping due to fail-fast mode"
                    return 1
                fi
            fi

            if ! validate_functional; then
                validation_success=false
                if [[ "$FAIL_FAST" == "true" ]]; then
                    log "ERROR" "Functional validation failed, stopping due to fail-fast mode"
                    return 1
                fi
            fi
            ;;
        *)
            log "ERROR" "Unknown validation suite: $VALIDATION_SUITE"
            return 1
            ;;
    esac

    # Generate validation report
    generate_validation_report

    # Validation summary
    local validation_end_time=$(date +%s)
    local validation_duration=$((validation_end_time - validation_start_time))

    local total_tests=${#VALIDATION_RESULTS[@]}
    local passed_tests=0
    local failed_tests=0

    for result in "${VALIDATION_RESULTS[@]}"; do
        local test_result=$(echo "$result" | cut -d'|' -f3)
        case "$test_result" in
            "PASS") ((passed_tests++)) ;;
            "FAIL") ((failed_tests++)) ;;
        esac
    done

    local success_rate=0
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$((passed_tests * 100 / total_tests))
    fi

    log "INFO" "=================================================="
    log "INFO" "Deployment Validation Summary:"
    log "INFO" "  - Validation ID: $VALIDATION_ID"
    log "INFO" "  - Duration: ${validation_duration}s"
    log "INFO" "  - Total Tests: $total_tests"
    log "INFO" "  - Passed Tests: $passed_tests"
    log "INFO" "  - Failed Tests: $failed_tests"
    log "INFO" "  - Success Rate: $success_rate%"
    log "INFO" "=================================================="

    if [[ "$validation_success" == "true" ]] && [[ $success_rate -ge 90 ]]; then
        log "SUCCESS" "🎉 Deployment validation completed successfully!"
        return 0
    else
        log "ERROR" "💥 Deployment validation failed"
        return 1
    fi
}

# Show help
show_help() {
    cat << EOF
Comprehensive Deployment Validation Framework v$SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

DESCRIPTION:
    Comprehensive deployment validation framework with automated testing,
    health checks, performance validation, and success criteria verification.
    Provides detailed reporting and metrics collection for deployment validation.

OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: $DEFAULT_ENVIRONMENT)
    -n, --namespace NS          Kubernetes namespace (default: $DEFAULT_NAMESPACE)
    -s, --suite SUITE           Validation suite (health|performance|functional|comprehensive)
    -d, --dry-run              Perform dry run without making changes
    -v, --verbose              Enable verbose logging
    -p, --parallel             Enable parallel test execution
    --no-report                Skip report generation
    --fail-fast                Stop on first test failure

VALIDATION SUITES:
    health                     Health and readiness validation
    performance                Performance and load testing
    functional                 Functional and integration testing
    comprehensive              All validation suites (default)

EXAMPLES:
    # Comprehensive validation
    $SCRIPT_NAME --environment production

    # Health validation only
    $SCRIPT_NAME --suite health --verbose

    # Performance validation with fail-fast
    $SCRIPT_NAME --suite performance --fail-fast

    # Dry run comprehensive validation
    $SCRIPT_NAME --dry-run --verbose

FILES:
    $VALIDATION_LOG            Validation log
    $REPORT_DIR                Validation reports directory

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
            -s|--suite)
                VALIDATION_SUITE="$2"
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
            -p|--parallel)
                PARALLEL_EXECUTION=true
                shift
                ;;
            --no-report)
                GENERATE_REPORT=false
                shift
                ;;
            --fail-fast)
                FAIL_FAST=true
                shift
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Main function
main() {
    # Initialize validation
    init_validation

    # Parse command line arguments
    parse_arguments "$@"

    # Log startup information
    log "INFO" "Comprehensive Deployment Validation Framework v$SCRIPT_VERSION"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: ${USER:-unknown}"
    log "INFO" "Working directory: $(pwd)"
    log "INFO" "Script directory: $SCRIPT_DIR"
    log "INFO" "Project root: $PROJECT_ROOT"

    # Run main validation process
    main_validation
    exit $?
}

# Execute main function with all arguments
main "$@"

# ============================================================================
# PERFORMANCE VALIDATION FUNCTIONS
# ============================================================================

# Comprehensive performance validation
validate_performance() {
    log "INFO" "🚀 Running comprehensive performance validation..."

    local start_time=$(date +%s)
    local performance_tests_passed=0
    local performance_tests_total=0

    # API response time validation
    if validate_api_response_time; then
        ((performance_tests_passed++))
    fi
    ((performance_tests_total++))

    # Throughput validation
    if validate_throughput; then
        ((performance_tests_passed++))
    fi
    ((performance_tests_total++))

    # Resource utilization validation
    if validate_resource_utilization; then
        ((performance_tests_passed++))
    fi
    ((performance_tests_total++))

    # Database performance validation
    if validate_database_performance; then
        ((performance_tests_passed++))
    fi
    ((performance_tests_total++))

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local success_rate=$((performance_tests_passed * 100 / performance_tests_total))

    record_validation_metric "performance_test_success_rate" "$success_rate" "%"

    if [[ $success_rate -ge 75 ]]; then
        record_validation_result "performance_validation" "performance" "PASS" "$duration" "Success rate: $success_rate%"
        log "SUCCESS" "Performance validation passed: $success_rate% success rate"
        return 0
    else
        record_validation_result "performance_validation" "performance" "FAIL" "$duration" "Success rate: $success_rate%"
        log "ERROR" "Performance validation failed: $success_rate% success rate"
        return 1
    fi
}

# Validate API response time
validate_api_response_time() {
    log "DEBUG" "Validating API response time..."

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log "ERROR" "No application pods found for response time test"
        return 1
    fi

    local pod=$(echo "$pods" | awk '{print $1}')
    local response_times=()
    local test_count=10

    for ((i=1; i<=test_count; i++)); do
        local response_time
        response_time=$(kubectl exec -n "$NAMESPACE" "$pod" -- curl -w "%{time_total}" -s -o /dev/null http://localhost:3000/health 2>/dev/null || echo "999")

        if [[ -n "$response_time" ]] && [[ "$response_time" != "999" ]]; then
            response_times+=("$response_time")
        fi
    done

    if [[ ${#response_times[@]} -gt 0 ]]; then
        local sum=0
        for time in "${response_times[@]}"; do
            sum=$(echo "$sum + $time" | bc -l)
        done

        local avg_response_time
        avg_response_time=$(echo "scale=3; $sum / ${#response_times[@]}" | bc -l)
        local avg_response_time_ms
        avg_response_time_ms=$(echo "$avg_response_time * 1000" | bc -l | cut -d. -f1)

        record_validation_metric "api_response_time_avg" "$avg_response_time_ms" "ms" "${SUCCESS_CRITERIA[api_response_time_p95]}"

        if [[ "$avg_response_time_ms" -lt "${SUCCESS_CRITERIA[api_response_time_p95]}" ]]; then
            log "DEBUG" "API response time within limits: ${avg_response_time_ms}ms"
            return 0
        else
            log "ERROR" "API response time exceeds threshold: ${avg_response_time_ms}ms > ${SUCCESS_CRITERIA[api_response_time_p95]}ms"
            return 1
        fi
    else
        log "ERROR" "No valid response time measurements"
        return 1
    fi
}

# Validate throughput
validate_throughput() {
    log "DEBUG" "Validating throughput..."

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log "ERROR" "No application pods found for throughput test"
        return 1
    fi

    local pod=$(echo "$pods" | awk '{print $1}')
    local test_duration=30
    local start_time=$(date +%s)
    local request_count=0
    local error_count=0
    local test_end_time=$((start_time + test_duration))

    while [[ $(date +%s) -lt $test_end_time ]]; do
        if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
            ((request_count++))
        else
            ((error_count++))
        fi

        sleep 0.1
    done

    local actual_duration=$(($(date +%s) - start_time))
    local requests_per_second=$((request_count / actual_duration))
    local error_rate=0

    if [[ $((request_count + error_count)) -gt 0 ]]; then
        error_rate=$(echo "scale=2; $error_count * 100 / ($request_count + $error_count)" | bc -l)
    fi

    record_validation_metric "throughput_rps" "$requests_per_second" "rps"
    record_validation_metric "throughput_error_rate" "$error_rate" "%"

    if [[ "$requests_per_second" -ge 5 ]] && [[ $(echo "$error_rate < 10" | bc -l) -eq 1 ]]; then
        log "DEBUG" "Throughput validation passed: ${requests_per_second} RPS, ${error_rate}% error rate"
        return 0
    else
        log "ERROR" "Throughput validation failed: ${requests_per_second} RPS, ${error_rate}% error rate"
        return 1
    fi
}
