#!/bin/bash

# Performance Validation Script for Paperless Maverick
# Comprehensive performance testing and validation
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly PERFORMANCE_LOG="$PROJECT_ROOT/logs/deployment/performance-validation-$(date +%Y%m%d-%H%M%S).log"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
NAMESPACE="paperless-maverick"
ENVIRONMENT="production"
DRY_RUN=false
VERBOSE=false
LOAD_TEST=false
BENCHMARK=false

# Performance thresholds
readonly RESPONSE_TIME_P50_THRESHOLD=500
readonly RESPONSE_TIME_P95_THRESHOLD=2000
readonly RESPONSE_TIME_P99_THRESHOLD=5000
readonly MIN_REQUESTS_PER_SECOND=10
readonly MAX_ERROR_RATE=0.05
readonly CPU_THRESHOLD=80
readonly MEMORY_THRESHOLD=85

# Test configuration
readonly TEST_DURATION=60
readonly CONCURRENT_USERS=10
readonly RAMP_UP_TIME=30

# Performance results
PERFORMANCE_TESTS_PASSED=0
PERFORMANCE_TESTS_FAILED=0
PERFORMANCE_WARNINGS=0

# Initialize logging
init_logging() {
    mkdir -p "$(dirname "$PERFORMANCE_LOG")"
    touch "$PERFORMANCE_LOG"
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$PERFORMANCE_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$PERFORMANCE_LOG"
            ((PERFORMANCE_TESTS_PASSED++))
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$PERFORMANCE_LOG"
            ((PERFORMANCE_WARNINGS++))
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$PERFORMANCE_LOG"
            ((PERFORMANCE_TESTS_FAILED++))
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${BLUE}[$timestamp] 🔍${NC} $message" | tee -a "$PERFORMANCE_LOG"
            fi
            ;;
    esac
}

# Get service endpoint
get_service_endpoint() {
    local service_ip
    service_ip=$(kubectl get service paperless-maverick -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    
    if [[ -n "$service_ip" ]] && [[ "$service_ip" != "None" ]]; then
        echo "http://$service_ip:3000"
    else
        # Try to get external IP or LoadBalancer IP
        local external_ip
        external_ip=$(kubectl get service paperless-maverick -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
        
        if [[ -n "$external_ip" ]]; then
            echo "http://$external_ip:3000"
        else
            log "ERROR" "Cannot determine service endpoint"
            return 1
        fi
    fi
}

# Test response time
test_response_time() {
    log "INFO" "⏱️ Testing response time..."
    
    local endpoint
    endpoint=$(get_service_endpoint)
    
    if [[ -z "$endpoint" ]]; then
        log "ERROR" "Cannot get service endpoint for response time test"
        return 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would test response time for $endpoint"
        return 0
    fi
    
    # Test health endpoint response time
    local response_times=()
    local total_requests=10
    
    for ((i=1; i<=total_requests; i++)); do
        local response_time
        response_time=$(kubectl run perf-test-$i --rm -i --restart=Never --image=curlimages/curl -- \
            curl -w "%{time_total}" -s -o /dev/null "$endpoint/health" 2>/dev/null | tail -n 1)
        
        if [[ -n "$response_time" ]]; then
            response_times+=("$response_time")
            log "DEBUG" "Request $i response time: ${response_time}s"
        fi
    done
    
    # Calculate statistics
    if [[ ${#response_times[@]} -gt 0 ]]; then
        local sum=0
        for time in "${response_times[@]}"; do
            sum=$(echo "$sum + $time" | bc -l)
        done
        
        local avg_response_time
        avg_response_time=$(echo "scale=3; $sum / ${#response_times[@]}" | bc -l)
        local avg_response_time_ms
        avg_response_time_ms=$(echo "$avg_response_time * 1000" | bc -l | cut -d. -f1)
        
        log "INFO" "Average response time: ${avg_response_time_ms}ms"
        
        if [[ "$avg_response_time_ms" -lt "$RESPONSE_TIME_P95_THRESHOLD" ]]; then
            log "SUCCESS" "Response time within acceptable limits"
        else
            log "ERROR" "Response time exceeds threshold: ${avg_response_time_ms}ms > ${RESPONSE_TIME_P95_THRESHOLD}ms"
        fi
    else
        log "ERROR" "No valid response time measurements"
    fi
}

# Test throughput
test_throughput() {
    if [[ "$LOAD_TEST" != "true" ]]; then
        log "INFO" "Skipping throughput test (load test not enabled)"
        return 0
    fi
    
    log "INFO" "🚀 Testing throughput..."
    
    local endpoint
    endpoint=$(get_service_endpoint)
    
    if [[ -z "$endpoint" ]]; then
        log "ERROR" "Cannot get service endpoint for throughput test"
        return 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would test throughput for $endpoint"
        return 0
    fi
    
    # Simple throughput test using curl
    local start_time=$(date +%s)
    local request_count=0
    local error_count=0
    local test_end_time=$((start_time + TEST_DURATION))
    
    log "INFO" "Running throughput test for ${TEST_DURATION}s..."
    
    while [[ $(date +%s) -lt $test_end_time ]]; do
        if kubectl run throughput-test-$request_count --rm -i --restart=Never --image=curlimages/curl -- \
            curl -f -s "$endpoint/health" &> /dev/null; then
            ((request_count++))
        else
            ((error_count++))
        fi
        
        # Brief pause to avoid overwhelming the system
        sleep 0.1
    done
    
    local actual_duration=$(($(date +%s) - start_time))
    local requests_per_second=$((request_count / actual_duration))
    local error_rate=$(echo "scale=4; $error_count / ($request_count + $error_count)" | bc -l)
    
    log "INFO" "Throughput test results:"
    log "INFO" "  - Total requests: $request_count"
    log "INFO" "  - Total errors: $error_count"
    log "INFO" "  - Duration: ${actual_duration}s"
    log "INFO" "  - Requests per second: $requests_per_second"
    log "INFO" "  - Error rate: $error_rate"
    
    if [[ "$requests_per_second" -ge "$MIN_REQUESTS_PER_SECOND" ]]; then
        log "SUCCESS" "Throughput meets minimum requirements"
    else
        log "ERROR" "Throughput below minimum: $requests_per_second < $MIN_REQUESTS_PER_SECOND"
    fi
    
    if [[ $(echo "$error_rate < $MAX_ERROR_RATE" | bc -l) -eq 1 ]]; then
        log "SUCCESS" "Error rate within acceptable limits"
    else
        log "ERROR" "Error rate exceeds threshold: $error_rate > $MAX_ERROR_RATE"
    fi
}

# Test resource utilization under load
test_resource_utilization() {
    log "INFO" "📊 Testing resource utilization..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would test resource utilization"
        return 0
    fi
    
    # Get application pods
    local app_pods
    app_pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$app_pods" ]]; then
        log "ERROR" "No application pods found for resource utilization test"
        return 1
    fi
    
    # Monitor resource usage for a period
    local monitoring_duration=30
    local check_interval=5
    local checks=$((monitoring_duration / check_interval))
    
    log "INFO" "Monitoring resource utilization for ${monitoring_duration}s..."
    
    local max_cpu_usage=0
    local max_memory_usage=0
    
    for ((i=1; i<=checks; i++)); do
        for pod in $app_pods; do
            local metrics
            metrics=$(kubectl top pod "$pod" -n "$NAMESPACE" --no-headers 2>/dev/null || echo "$pod 0m 0Mi")
            
            local cpu_usage
            cpu_usage=$(echo "$metrics" | awk '{print $2}' | sed 's/m//')
            local memory_usage
            memory_usage=$(echo "$metrics" | awk '{print $3}' | sed 's/Mi//')
            
            # Track maximum usage
            if [[ "$cpu_usage" -gt "$max_cpu_usage" ]]; then
                max_cpu_usage="$cpu_usage"
            fi
            
            if [[ "$memory_usage" -gt "$max_memory_usage" ]]; then
                max_memory_usage="$memory_usage"
            fi
            
            log "DEBUG" "Pod $pod - CPU: ${cpu_usage}m, Memory: ${memory_usage}Mi"
        done
        
        sleep "$check_interval"
    done
    
    # Get resource limits for comparison
    local pod=$(echo "$app_pods" | awk '{print $1}')
    local cpu_limit
    cpu_limit=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.cpu}' | sed 's/m//')
    local memory_limit
    memory_limit=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.memory}' | sed 's/Mi//')
    
    # Calculate utilization percentages
    if [[ -n "$cpu_limit" ]] && [[ "$cpu_limit" != "null" ]] && [[ "$cpu_limit" -gt 0 ]]; then
        local cpu_percent=$((max_cpu_usage * 100 / cpu_limit))
        log "INFO" "Maximum CPU utilization: ${cpu_percent}%"
        
        if [[ "$cpu_percent" -lt "$CPU_THRESHOLD" ]]; then
            log "SUCCESS" "CPU utilization within limits"
        else
            log "WARNING" "High CPU utilization: ${cpu_percent}%"
        fi
    fi
    
    if [[ -n "$memory_limit" ]] && [[ "$memory_limit" != "null" ]] && [[ "$memory_limit" -gt 0 ]]; then
        local memory_percent=$((max_memory_usage * 100 / memory_limit))
        log "INFO" "Maximum memory utilization: ${memory_percent}%"
        
        if [[ "$memory_percent" -lt "$MEMORY_THRESHOLD" ]]; then
            log "SUCCESS" "Memory utilization within limits"
        else
            log "WARNING" "High memory utilization: ${memory_percent}%"
        fi
    fi
}

# Test database performance
test_database_performance() {
    log "INFO" "🗄️ Testing database performance..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would test database performance"
        return 0
    fi
    
    # Get application pods
    local app_pods
    app_pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -n "$app_pods" ]]; then
        local pod=$(echo "$app_pods" | awk '{print $1}')
        
        # Test database query performance through API
        local db_response_time
        db_response_time=$(kubectl exec -n "$NAMESPACE" "$pod" -- \
            curl -w "%{time_total}" -s -o /dev/null http://localhost:3000/api/monitoring/health 2>/dev/null || echo "999")
        
        local db_response_time_ms
        db_response_time_ms=$(echo "$db_response_time * 1000" | bc -l | cut -d. -f1)
        
        log "INFO" "Database query response time: ${db_response_time_ms}ms"
        
        if [[ "$db_response_time_ms" -lt 1000 ]]; then
            log "SUCCESS" "Database performance is good"
        elif [[ "$db_response_time_ms" -lt 3000 ]]; then
            log "WARNING" "Database performance is acceptable but could be improved"
        else
            log "ERROR" "Database performance is poor: ${db_response_time_ms}ms"
        fi
    else
        log "ERROR" "No application pods available for database performance test"
    fi
}

# Generate performance report
generate_performance_report() {
    log "INFO" "📊 Generating performance report..."
    
    local report_file="$PROJECT_ROOT/logs/deployment/performance-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "performance_summary": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "namespace": "$NAMESPACE",
        "total_tests": $((PERFORMANCE_TESTS_PASSED + PERFORMANCE_TESTS_FAILED + PERFORMANCE_WARNINGS)),
        "passed": $PERFORMANCE_TESTS_PASSED,
        "failed": $PERFORMANCE_TESTS_FAILED,
        "warnings": $PERFORMANCE_WARNINGS,
        "success_rate": $(echo "scale=2; $PERFORMANCE_TESTS_PASSED * 100 / ($PERFORMANCE_TESTS_PASSED + $PERFORMANCE_TESTS_FAILED + $PERFORMANCE_WARNINGS)" | bc -l 2>/dev/null || echo "0")
    },
    "test_categories": {
        "response_time": true,
        "throughput": $LOAD_TEST,
        "resource_utilization": true,
        "database_performance": true
    },
    "thresholds": {
        "response_time_p95": $RESPONSE_TIME_P95_THRESHOLD,
        "min_requests_per_second": $MIN_REQUESTS_PER_SECOND,
        "max_error_rate": $MAX_ERROR_RATE,
        "cpu_threshold": $CPU_THRESHOLD,
        "memory_threshold": $MEMORY_THRESHOLD
    }
}
EOF
    
    log "SUCCESS" "Performance report generated: $report_file"
}

# Show help
show_help() {
    cat << EOF
Performance Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -n, --namespace NS      Kubernetes namespace (default: paperless-maverick)
    -e, --environment ENV   Target environment (default: production)
    -d, --dry-run           Perform dry run without executing tests
    -v, --verbose           Enable verbose logging
    -l, --load-test         Enable load testing (throughput tests)
    -b, --benchmark         Enable comprehensive benchmarking

EXAMPLES:
    $0                      # Basic performance validation
    $0 --load-test          # Include load testing
    $0 --verbose --benchmark # Comprehensive performance testing

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
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -l|--load-test)
                LOAD_TEST=true
                shift
                ;;
            -b|--benchmark)
                BENCHMARK=true
                LOAD_TEST=true
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
    
    log "INFO" "🚀 Starting performance validation"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Dry run: $DRY_RUN"
    log "INFO" "Load test: $LOAD_TEST"
    log "INFO" "Benchmark: $BENCHMARK"
    log "INFO" "=================================================="
    
    # Run performance tests
    test_response_time
    test_throughput
    test_resource_utilization
    test_database_performance
    
    # Generate report
    generate_performance_report
    
    # Summary
    log "INFO" "=================================================="
    log "INFO" "Performance Validation Summary:"
    log "INFO" "  - Total Tests: $((PERFORMANCE_TESTS_PASSED + PERFORMANCE_TESTS_FAILED + PERFORMANCE_WARNINGS))"
    log "INFO" "  - Passed: $PERFORMANCE_TESTS_PASSED"
    log "INFO" "  - Failed: $PERFORMANCE_TESTS_FAILED"
    log "INFO" "  - Warnings: $PERFORMANCE_WARNINGS"
    log "INFO" "=================================================="
    
    if [[ $PERFORMANCE_TESTS_FAILED -gt 0 ]]; then
        log "ERROR" "Performance validation failed with $PERFORMANCE_TESTS_FAILED failures"
        exit 1
    elif [[ $PERFORMANCE_WARNINGS -gt 0 ]]; then
        log "WARNING" "Performance validation completed with $PERFORMANCE_WARNINGS warnings"
        exit 0
    else
        log "SUCCESS" "All performance tests passed successfully"
        exit 0
    fi
}

# Execute main function
main "$@"
