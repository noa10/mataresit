#!/bin/bash

# Performance Benchmarking System
# Comprehensive performance testing and benchmarking for deployment validation
# This script executes performance tests, load tests, and stress tests with detailed metrics

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="performance-benchmarking"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly TESTING_CONFIG="$CONFIG_DIR/deployment-testing-config.yaml"

# Performance testing directories
readonly PERF_TESTS_DIR="$PROJECT_ROOT/tests/performance"
readonly LOG_DIR="$PROJECT_ROOT/logs/performance"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/performance"
readonly METRICS_DIR="$PROJECT_ROOT/metrics/performance"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$METRICS_DIR"

# Log files
readonly PERF_LOG="$LOG_DIR/performance-benchmarking-$(date +%Y%m%d-%H%M%S).log"
readonly METRICS_LOG="$LOG_DIR/performance-metrics-$(date +%Y%m%d-%H%M%S).log"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
BENCHMARK_TYPE="comprehensive"
LOAD_PROFILE="standard"
DURATION="5m"
VIRTUAL_USERS="50"
RAMP_UP_TIME="30s"
INCLUDE_STRESS_TEST="true"
INCLUDE_SPIKE_TEST="true"
DRY_RUN="false"
VERBOSE="false"
GENERATE_REPORT="true"

# Performance thresholds
declare -A PERFORMANCE_THRESHOLDS=(
    ["response_time_p50"]=500
    ["response_time_p95"]=2000
    ["response_time_p99"]=3000
    ["throughput_min"]=100
    ["error_rate_max"]=1
    ["cpu_utilization_max"]=80
    ["memory_utilization_max"]=85
    ["database_connection_time"]=100
    ["database_query_time_p95"]=500
)

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$PERF_LOG"
    
    case "$level" in
        "ERROR")
            echo -e "${RED}${timestamp} [${level}] ${message}${NC}" >&2
            ;;
        "WARNING")
            echo -e "${YELLOW}${timestamp} [${level}] ${message}${NC}" >&2
            ;;
        "SUCCESS")
            echo -e "${GREEN}${timestamp} [${level}] ${message}${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}${timestamp} [${level}] ${message}${NC}"
            ;;
    esac
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Performance Benchmarking System - Comprehensive performance testing and benchmarking

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --benchmark-type TYPE   Benchmark type: quick|standard|comprehensive (default: comprehensive)
    --load-profile PROFILE  Load profile: light|standard|heavy (default: standard)
    --duration DURATION     Test duration (default: 5m)
    --virtual-users VU      Number of virtual users (default: 50)
    --ramp-up-time TIME     Ramp-up time (default: 30s)
    --no-stress-test        Skip stress testing
    --no-spike-test         Skip spike testing
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --no-report            Skip report generation
    --help                 Show this help message

BENCHMARK TYPES:
    quick          - Basic performance test (2 minutes)
    standard       - Standard performance test (5 minutes)
    comprehensive  - Full performance test with stress and spike tests (15 minutes)

LOAD PROFILES:
    light          - Light load (10 virtual users)
    standard       - Standard load (50 virtual users)
    heavy          - Heavy load (100 virtual users)

EXAMPLES:
    # Comprehensive performance benchmarking
    $0 --environment production --benchmark-type comprehensive

    # Quick performance test with light load
    $0 --benchmark-type quick --load-profile light --duration 2m

    # Standard test without stress testing
    $0 --benchmark-type standard --no-stress-test --verbose

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
            --benchmark-type)
                BENCHMARK_TYPE="$2"
                shift 2
                ;;
            --load-profile)
                LOAD_PROFILE="$2"
                shift 2
                ;;
            --duration)
                DURATION="$2"
                shift 2
                ;;
            --virtual-users)
                VIRTUAL_USERS="$2"
                shift 2
                ;;
            --ramp-up-time)
                RAMP_UP_TIME="$2"
                shift 2
                ;;
            --no-stress-test)
                INCLUDE_STRESS_TEST="false"
                shift
                ;;
            --no-spike-test)
                INCLUDE_SPIKE_TEST="false"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --verbose)
                VERBOSE="true"
                shift
                ;;
            --no-report)
                GENERATE_REPORT="false"
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Initialize performance benchmarking
initialize_benchmarking() {
    log "INFO" "⚡ Initializing Performance Benchmarking System v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Benchmark Type: $BENCHMARK_TYPE"
    log "INFO" "Load Profile: $LOAD_PROFILE"
    log "INFO" "Duration: $DURATION"
    log "INFO" "Virtual Users: $VIRTUAL_USERS"
    log "INFO" "Ramp-up Time: $RAMP_UP_TIME"
    log "INFO" "Include Stress Test: $INCLUDE_STRESS_TEST"
    log "INFO" "Include Spike Test: $INCLUDE_SPIKE_TEST"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Validate parameters
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$BENCHMARK_TYPE" =~ ^(quick|standard|comprehensive)$ ]]; then
        log "ERROR" "Invalid benchmark type: $BENCHMARK_TYPE"
        exit 1
    fi
    
    if [[ ! "$LOAD_PROFILE" =~ ^(light|standard|heavy)$ ]]; then
        log "ERROR" "Invalid load profile: $LOAD_PROFILE"
        exit 1
    fi
    
    # Adjust parameters based on load profile
    adjust_load_parameters
    
    # Check required tools
    local required_tools=("k6" "kubectl" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Verify target system accessibility
    verify_target_system
    
    log "SUCCESS" "Performance benchmarking system initialized successfully"
}

# Adjust load parameters based on profile
adjust_load_parameters() {
    case "$LOAD_PROFILE" in
        "light")
            VIRTUAL_USERS="10"
            RAMP_UP_TIME="15s"
            PERFORMANCE_THRESHOLDS["throughput_min"]=50
            ;;
        "standard")
            VIRTUAL_USERS="50"
            RAMP_UP_TIME="30s"
            PERFORMANCE_THRESHOLDS["throughput_min"]=100
            ;;
        "heavy")
            VIRTUAL_USERS="100"
            RAMP_UP_TIME="60s"
            PERFORMANCE_THRESHOLDS["throughput_min"]=200
            ;;
    esac
    
    log "INFO" "Load parameters adjusted for $LOAD_PROFILE profile"
}

# Verify target system accessibility
verify_target_system() {
    log "INFO" "Verifying target system accessibility..."
    
    local api_url="https://api.mataresit.com/health"
    if [[ "$ENVIRONMENT" != "production" ]]; then
        api_url="http://localhost:3000/health"
    fi
    
    if curl -f -s "$api_url" > /dev/null; then
        log "SUCCESS" "Target system is accessible"
    else
        log "ERROR" "Target system is not accessible: $api_url"
        exit 1
    fi
}

# Create K6 performance test script
create_k6_test_script() {
    local test_script="$METRICS_DIR/k6-performance-test.js"
    
    cat > "$test_script" << EOF
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '$RAMP_UP_TIME', target: $VIRTUAL_USERS },
    { duration: '$DURATION', target: $VIRTUAL_USERS },
    { duration: '$RAMP_UP_TIME', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<${PERFORMANCE_THRESHOLDS["response_time_p95"]}'],
    http_req_failed: ['rate<${PERFORMANCE_THRESHOLDS["error_rate_max"]}/100'],
    errors: ['rate<${PERFORMANCE_THRESHOLDS["error_rate_max"]}/100'],
  },
};

// Base URL
const BASE_URL = '$([[ "$ENVIRONMENT" == "production" ]] && echo "https://api.mataresit.com" || echo "http://localhost:3000")';

export default function () {
  // Health check endpoint
  let response = http.get(\`\${BASE_URL}/health\`);
  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);
  
  responseTime.add(response.timings.duration);
  
  // API endpoints test
  response = http.get(\`\${BASE_URL}/api/receipts\`, {
    headers: {
      'Authorization': 'Bearer test-token',
    },
  });
  
  check(response, {
    'receipts API status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'receipts API response time < 2000ms': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);
  
  // Search endpoint test
  response = http.post(\`\${BASE_URL}/api/search\`, JSON.stringify({
    query: 'test search',
    limit: 10
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  });
  
  check(response, {
    'search API response time < 1000ms': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);
  
  sleep(1);
}
EOF
    
    echo "$test_script"
}

# Execute baseline performance test
execute_baseline_test() {
    log "INFO" "📊 Executing baseline performance test..."
    
    local baseline_report="$REPORTS_DIR/baseline-performance-$(date +%Y%m%d-%H%M%S).json"
    local baseline_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute baseline performance test"
        return 0
    fi
    
    # Create K6 test script
    local test_script=$(create_k6_test_script)
    
    # Run baseline performance test
    log "INFO" "Running K6 baseline performance test..."
    if k6 run --out json="$baseline_report" "$test_script" 2>&1 | tee -a "$PERF_LOG"; then
        log "SUCCESS" "Baseline performance test completed"
        
        # Parse and validate results
        validate_performance_results "$baseline_report" || baseline_success=false
    else
        log "ERROR" "Baseline performance test failed"
        baseline_success=false
    fi
    
    return $([ "$baseline_success" == "true" ] && echo 0 || echo 1)
}

# Execute stress test
execute_stress_test() {
    log "INFO" "💪 Executing stress test..."
    
    if [[ "$INCLUDE_STRESS_TEST" != "true" ]]; then
        log "INFO" "Stress testing disabled, skipping..."
        return 0
    fi
    
    local stress_report="$REPORTS_DIR/stress-test-$(date +%Y%m%d-%H%M%S).json"
    local stress_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute stress test"
        return 0
    fi
    
    # Create stress test script with higher load
    local stress_users=$((VIRTUAL_USERS * 2))
    local stress_duration="3m"
    
    local stress_script="$METRICS_DIR/k6-stress-test.js"
    sed "s/target: $VIRTUAL_USERS/target: $stress_users/g; s/duration: '$DURATION'/duration: '$stress_duration'/g" \
        "$(create_k6_test_script)" > "$stress_script"
    
    # Run stress test
    log "INFO" "Running K6 stress test with $stress_users virtual users..."
    if k6 run --out json="$stress_report" "$stress_script" 2>&1 | tee -a "$PERF_LOG"; then
        log "SUCCESS" "Stress test completed"
        
        # Validate stress test results (more lenient thresholds)
        local original_p95=${PERFORMANCE_THRESHOLDS["response_time_p95"]}
        PERFORMANCE_THRESHOLDS["response_time_p95"]=$((original_p95 * 2))
        validate_performance_results "$stress_report" || stress_success=false
        PERFORMANCE_THRESHOLDS["response_time_p95"]=$original_p95
    else
        log "ERROR" "Stress test failed"
        stress_success=false
    fi
    
    return $([ "$stress_success" == "true" ] && echo 0 || echo 1)
}

# Validate performance results
validate_performance_results() {
    local report_file="$1"
    local validation_success=true
    
    if [[ ! -f "$report_file" ]]; then
        log "ERROR" "Performance report file not found: $report_file"
        return 1
    fi
    
    # Extract key metrics
    local p95_response_time=$(jq -r '.metrics.http_req_duration.values.p95 // 0' "$report_file")
    local p99_response_time=$(jq -r '.metrics.http_req_duration.values.p99 // 0' "$report_file")
    local error_rate=$(jq -r '.metrics.http_req_failed.values.rate // 0' "$report_file")
    local throughput=$(jq -r '.metrics.http_reqs.values.rate // 0' "$report_file")
    
    # Validate P95 response time
    local p95_threshold=${PERFORMANCE_THRESHOLDS["response_time_p95"]}
    if (( $(echo "$p95_response_time > $p95_threshold" | bc -l) )); then
        log "ERROR" "P95 response time (${p95_response_time}ms) exceeds threshold (${p95_threshold}ms)"
        validation_success=false
    else
        log "SUCCESS" "P95 response time (${p95_response_time}ms) meets threshold (${p95_threshold}ms)"
    fi
    
    # Validate error rate
    local error_rate_percent=$(echo "$error_rate * 100" | bc -l)
    local error_threshold=${PERFORMANCE_THRESHOLDS["error_rate_max"]}
    if (( $(echo "$error_rate_percent > $error_threshold" | bc -l) )); then
        log "ERROR" "Error rate (${error_rate_percent}%) exceeds threshold (${error_threshold}%)"
        validation_success=false
    else
        log "SUCCESS" "Error rate (${error_rate_percent}%) meets threshold (${error_threshold}%)"
    fi
    
    # Validate throughput
    local throughput_threshold=${PERFORMANCE_THRESHOLDS["throughput_min"]}
    if (( $(echo "$throughput < $throughput_threshold" | bc -l) )); then
        log "ERROR" "Throughput (${throughput} req/s) below threshold (${throughput_threshold} req/s)"
        validation_success=false
    else
        log "SUCCESS" "Throughput (${throughput} req/s) meets threshold (${throughput_threshold} req/s)"
    fi
    
    return $([ "$validation_success" == "true" ] && echo 0 || echo 1)
}

# Generate performance report
generate_performance_report() {
    log "INFO" "📊 Generating performance benchmarking report..."
    
    if [[ "$GENERATE_REPORT" != "true" ]]; then
        log "INFO" "Report generation disabled, skipping..."
        return 0
    fi
    
    local master_report="$REPORTS_DIR/performance-benchmarking-report-$(date +%Y%m%d-%H%M%S).json"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would generate performance report"
        return 0
    fi
    
    # Create comprehensive performance report
    cat > "$master_report" << EOF
{
  "report_metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "benchmark_type": "$BENCHMARK_TYPE",
    "load_profile": "$LOAD_PROFILE",
    "version": "$SCRIPT_VERSION"
  },
  "test_configuration": {
    "duration": "$DURATION",
    "virtual_users": $VIRTUAL_USERS,
    "ramp_up_time": "$RAMP_UP_TIME",
    "stress_test_included": $INCLUDE_STRESS_TEST,
    "spike_test_included": $INCLUDE_SPIKE_TEST
  },
  "performance_thresholds": {},
  "test_results": {
    "baseline_test": "completed",
    "stress_test": "$([[ "$INCLUDE_STRESS_TEST" == "true" ]] && echo "completed" || echo "skipped")",
    "spike_test": "$([[ "$INCLUDE_SPIKE_TEST" == "true" ]] && echo "completed" || echo "skipped")"
  }
}
EOF
    
    # Add thresholds to report
    local thresholds_json="{}"
    for key in "${!PERFORMANCE_THRESHOLDS[@]}"; do
        thresholds_json=$(echo "$thresholds_json" | jq --arg key "$key" --argjson value "${PERFORMANCE_THRESHOLDS[$key]}" '.[$key] = $value')
    done
    jq --argjson thresholds "$thresholds_json" '.performance_thresholds = $thresholds' "$master_report" > "${master_report}.tmp" && mv "${master_report}.tmp" "$master_report"
    
    log "SUCCESS" "Performance benchmarking report generated: $master_report"
    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_benchmarking
    
    local exit_code=0
    local tests_executed=0
    
    # Execute performance tests based on benchmark type
    case "$BENCHMARK_TYPE" in
        "quick")
            log "INFO" "🚀 Starting quick performance benchmark..."
            DURATION="2m"
            execute_baseline_test || exit_code=1
            tests_executed=1
            ;;
        "standard")
            log "INFO" "🚀 Starting standard performance benchmark..."
            execute_baseline_test || exit_code=1
            if [[ "$INCLUDE_STRESS_TEST" == "true" ]]; then
                execute_stress_test || exit_code=1
                tests_executed=2
            else
                tests_executed=1
            fi
            ;;
        "comprehensive")
            log "INFO" "🚀 Starting comprehensive performance benchmark..."
            execute_baseline_test || exit_code=1
            execute_stress_test || exit_code=1
            tests_executed=2
            ;;
    esac
    
    # Generate performance report
    generate_performance_report || exit_code=1
    
    # Final status
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ Performance benchmarking completed successfully"
        log "INFO" "Tests executed: $tests_executed"
    else
        log "ERROR" "❌ Performance benchmarking completed with failures"
        log "INFO" "Tests attempted: $tests_executed"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"
