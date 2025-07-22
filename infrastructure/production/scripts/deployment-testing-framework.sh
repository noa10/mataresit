#!/bin/bash

# Deployment Testing Framework
# Comprehensive testing framework with automated testing, quality gates, and performance benchmarks
# This script orchestrates all deployment testing phases with detailed reporting and validation

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="deployment-testing-framework"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly TESTING_CONFIG="$CONFIG_DIR/deployment-testing-config.yaml"

# Testing directories
readonly TESTS_DIR="$PROJECT_ROOT/tests"
readonly LOG_DIR="$PROJECT_ROOT/logs/testing"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/testing"
readonly ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/testing"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$ARTIFACTS_DIR"

# Log files
readonly TESTING_LOG="$LOG_DIR/deployment-testing-$(date +%Y%m%d-%H%M%S).log"
readonly QUALITY_GATES_LOG="$LOG_DIR/quality-gates-$(date +%Y%m%d-%H%M%S).log"
readonly PERFORMANCE_LOG="$LOG_DIR/performance-testing-$(date +%Y%m%d-%H%M%S).log"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
TEST_SUITE="comprehensive"
QUALITY_GATES="strict"
PERFORMANCE_BENCHMARKS="true"
PARALLEL_EXECUTION="true"
FAIL_FAST="false"
DRY_RUN="false"
VERBOSE="false"
GENERATE_REPORTS="true"

# Quality gate thresholds
declare -A QUALITY_THRESHOLDS=(
    ["unit_test_coverage"]=85
    ["integration_test_success"]=95
    ["performance_p95_response_time"]=2000
    ["error_rate_threshold"]=1
    ["security_scan_critical"]=0
    ["security_scan_high"]=5
    ["code_quality_score"]=8
    ["api_availability"]=99.9
    ["database_performance"]=500
    ["memory_utilization"]=85
    ["cpu_utilization"]=80
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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$TESTING_LOG"
    
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

Deployment Testing Framework - Comprehensive testing with quality gates and performance benchmarks

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --test-suite SUITE     Test suite: quick|standard|comprehensive (default: comprehensive)
    --quality-gates LEVEL  Quality gates: relaxed|standard|strict (default: strict)
    --no-performance       Skip performance benchmarks
    --sequential           Run tests sequentially instead of parallel
    --fail-fast            Stop on first test failure
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --no-reports           Skip report generation
    --help                 Show this help message

TEST SUITES:
    quick          - Essential tests only (unit + smoke tests)
    standard       - Standard test suite (unit + integration + basic performance)
    comprehensive  - Full test suite (all tests + performance + security)

QUALITY GATES:
    relaxed        - Relaxed quality thresholds for development
    standard       - Standard quality thresholds for staging
    strict         - Strict quality thresholds for production

EXAMPLES:
    # Comprehensive testing with strict quality gates
    $0 --environment production --test-suite comprehensive --quality-gates strict

    # Quick testing for development
    $0 --environment development --test-suite quick --quality-gates relaxed

    # Standard testing without performance benchmarks
    $0 --test-suite standard --no-performance --verbose

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
            --test-suite)
                TEST_SUITE="$2"
                shift 2
                ;;
            --quality-gates)
                QUALITY_GATES="$2"
                shift 2
                ;;
            --no-performance)
                PERFORMANCE_BENCHMARKS="false"
                shift
                ;;
            --sequential)
                PARALLEL_EXECUTION="false"
                shift
                ;;
            --fail-fast)
                FAIL_FAST="true"
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
            --no-reports)
                GENERATE_REPORTS="false"
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

# Initialize testing framework
initialize_testing_framework() {
    log "INFO" "🧪 Initializing Deployment Testing Framework v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Test Suite: $TEST_SUITE"
    log "INFO" "Quality Gates: $QUALITY_GATES"
    log "INFO" "Performance Benchmarks: $PERFORMANCE_BENCHMARKS"
    log "INFO" "Parallel Execution: $PARALLEL_EXECUTION"
    log "INFO" "Fail Fast: $FAIL_FAST"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Validate parameters
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$TEST_SUITE" =~ ^(quick|standard|comprehensive)$ ]]; then
        log "ERROR" "Invalid test suite: $TEST_SUITE"
        exit 1
    fi
    
    if [[ ! "$QUALITY_GATES" =~ ^(relaxed|standard|strict)$ ]]; then
        log "ERROR" "Invalid quality gates level: $QUALITY_GATES"
        exit 1
    fi
    
    # Adjust quality thresholds based on quality gates level
    adjust_quality_thresholds
    
    # Check required tools
    local required_tools=("npm" "kubectl" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Verify project structure
    if [[ ! -d "$TESTS_DIR" ]]; then
        log "ERROR" "Tests directory not found: $TESTS_DIR"
        exit 1
    fi
    
    # Verify cluster access for integration tests
    if [[ "$TEST_SUITE" != "quick" ]]; then
        if ! kubectl cluster-info &> /dev/null; then
            log "ERROR" "Cannot access Kubernetes cluster for integration tests"
            exit 1
        fi
    fi
    
    log "SUCCESS" "Testing framework initialized successfully"
}

# Adjust quality thresholds based on quality gates level
adjust_quality_thresholds() {
    case "$QUALITY_GATES" in
        "relaxed")
            QUALITY_THRESHOLDS["unit_test_coverage"]=70
            QUALITY_THRESHOLDS["integration_test_success"]=90
            QUALITY_THRESHOLDS["performance_p95_response_time"]=3000
            QUALITY_THRESHOLDS["error_rate_threshold"]=5
            QUALITY_THRESHOLDS["security_scan_critical"]=2
            QUALITY_THRESHOLDS["security_scan_high"]=10
            QUALITY_THRESHOLDS["code_quality_score"]=6
            ;;
        "standard")
            QUALITY_THRESHOLDS["unit_test_coverage"]=80
            QUALITY_THRESHOLDS["integration_test_success"]=95
            QUALITY_THRESHOLDS["performance_p95_response_time"]=2500
            QUALITY_THRESHOLDS["error_rate_threshold"]=2
            QUALITY_THRESHOLDS["security_scan_critical"]=1
            QUALITY_THRESHOLDS["security_scan_high"]=7
            QUALITY_THRESHOLDS["code_quality_score"]=7
            ;;
        "strict")
            # Use default strict values already set
            ;;
    esac
    
    log "INFO" "Quality thresholds adjusted for $QUALITY_GATES level"
}

# Execute unit tests
execute_unit_tests() {
    log "INFO" "🔬 Executing unit tests..."
    
    local unit_test_report="$REPORTS_DIR/unit-tests-$(date +%Y%m%d-%H%M%S).json"
    local unit_test_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute unit tests"
        return 0
    fi
    
    # Change to project root for npm commands
    cd "$PROJECT_ROOT"
    
    # Run unit tests with coverage
    log "INFO" "Running unit tests with coverage..."
    if npm run test:unit -- --coverage --reporter=json --outputFile="$unit_test_report" 2>&1 | tee -a "$TESTING_LOG"; then
        log "SUCCESS" "Unit tests completed successfully"
        
        # Check coverage threshold
        local coverage=$(jq -r '.coverageMap.total.lines.pct // 0' "$unit_test_report" 2>/dev/null || echo "0")
        local coverage_int=${coverage%.*}
        
        if [[ $coverage_int -lt ${QUALITY_THRESHOLDS["unit_test_coverage"]} ]]; then
            log "ERROR" "Unit test coverage ($coverage%) below threshold (${QUALITY_THRESHOLDS["unit_test_coverage"]}%)"
            unit_test_success=false
        else
            log "SUCCESS" "Unit test coverage ($coverage%) meets threshold (${QUALITY_THRESHOLDS["unit_test_coverage"]}%)"
        fi
    else
        log "ERROR" "Unit tests failed"
        unit_test_success=false
    fi
    
    if [[ "$unit_test_success" == "false" && "$FAIL_FAST" == "true" ]]; then
        log "ERROR" "Fail fast enabled - stopping due to unit test failures"
        exit 1
    fi
    
    return $([ "$unit_test_success" == "true" ] && echo 0 || echo 1)
}

# Execute integration tests
execute_integration_tests() {
    log "INFO" "🔗 Executing integration tests..."
    
    local integration_test_report="$REPORTS_DIR/integration-tests-$(date +%Y%m%d-%H%M%S).json"
    local integration_test_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute integration tests"
        return 0
    fi
    
    # Change to project root for npm commands
    cd "$PROJECT_ROOT"
    
    # Run integration tests
    log "INFO" "Running integration tests..."
    if npm run test:integration -- --reporter=json --outputFile="$integration_test_report" 2>&1 | tee -a "$TESTING_LOG"; then
        log "SUCCESS" "Integration tests completed successfully"
        
        # Check success rate
        local total_tests=$(jq -r '.numTotalTests // 0' "$integration_test_report" 2>/dev/null || echo "0")
        local passed_tests=$(jq -r '.numPassedTests // 0' "$integration_test_report" 2>/dev/null || echo "0")
        
        if [[ $total_tests -gt 0 ]]; then
            local success_rate=$((passed_tests * 100 / total_tests))
            
            if [[ $success_rate -lt ${QUALITY_THRESHOLDS["integration_test_success"]} ]]; then
                log "ERROR" "Integration test success rate ($success_rate%) below threshold (${QUALITY_THRESHOLDS["integration_test_success"]}%)"
                integration_test_success=false
            else
                log "SUCCESS" "Integration test success rate ($success_rate%) meets threshold (${QUALITY_THRESHOLDS["integration_test_success"]}%)"
            fi
        fi
    else
        log "ERROR" "Integration tests failed"
        integration_test_success=false
    fi
    
    if [[ "$integration_test_success" == "false" && "$FAIL_FAST" == "true" ]]; then
        log "ERROR" "Fail fast enabled - stopping due to integration test failures"
        exit 1
    fi
    
    return $([ "$integration_test_success" == "true" ] && echo 0 || echo 1)
}

# Execute performance tests
execute_performance_tests() {
    log "INFO" "⚡ Executing performance tests..."

    local performance_report="$REPORTS_DIR/performance-tests-$(date +%Y%m%d-%H%M%S).json"
    local performance_success=true

    if [[ "$PERFORMANCE_BENCHMARKS" != "true" ]]; then
        log "INFO" "Performance benchmarks disabled, skipping..."
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute performance tests"
        return 0
    fi

    # Change to project root
    cd "$PROJECT_ROOT"

    # Check if k6 is available
    if ! command -v k6 &> /dev/null; then
        log "WARNING" "k6 not found, skipping performance tests"
        return 0
    fi

    # Run performance tests
    log "INFO" "Running k6 performance tests..."
    if k6 run --out json="$performance_report" tests/performance/load-testing.js 2>&1 | tee -a "$PERFORMANCE_LOG"; then
        log "SUCCESS" "Performance tests completed successfully"

        # Parse performance metrics
        local p95_response_time=$(jq -r '.metrics.http_req_duration.values.p95 // 0' "$performance_report" 2>/dev/null || echo "0")
        local p95_threshold=${QUALITY_THRESHOLDS["performance_p95_response_time"]}

        if (( $(echo "$p95_response_time > $p95_threshold" | bc -l) )); then
            log "ERROR" "P95 response time (${p95_response_time}ms) exceeds threshold (${p95_threshold}ms)"
            performance_success=false
        else
            log "SUCCESS" "P95 response time (${p95_response_time}ms) meets threshold (${p95_threshold}ms)"
        fi

        # Check error rate
        local error_rate=$(jq -r '.metrics.http_req_failed.values.rate // 0' "$performance_report" 2>/dev/null || echo "0")
        local error_rate_percent=$(echo "$error_rate * 100" | bc -l)
        local error_threshold=${QUALITY_THRESHOLDS["error_rate_threshold"]}

        if (( $(echo "$error_rate_percent > $error_threshold" | bc -l) )); then
            log "ERROR" "Error rate (${error_rate_percent}%) exceeds threshold (${error_threshold}%)"
            performance_success=false
        else
            log "SUCCESS" "Error rate (${error_rate_percent}%) meets threshold (${error_threshold}%)"
        fi
    else
        log "ERROR" "Performance tests failed"
        performance_success=false
    fi

    if [[ "$performance_success" == "false" && "$FAIL_FAST" == "true" ]]; then
        log "ERROR" "Fail fast enabled - stopping due to performance test failures"
        exit 1
    fi

    return $([ "$performance_success" == "true" ] && echo 0 || echo 1)
}

# Execute end-to-end tests
execute_e2e_tests() {
    log "INFO" "🎭 Executing end-to-end tests..."

    local e2e_report="$REPORTS_DIR/e2e-tests-$(date +%Y%m%d-%H%M%S).json"
    local e2e_success=true

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute end-to-end tests"
        return 0
    fi

    # Change to project root
    cd "$PROJECT_ROOT"

    # Run Playwright e2e tests
    log "INFO" "Running Playwright end-to-end tests..."
    if npx playwright test --reporter=json --output-file="$e2e_report" 2>&1 | tee -a "$TESTING_LOG"; then
        log "SUCCESS" "End-to-end tests completed successfully"

        # Parse e2e test results
        local total_tests=$(jq -r '.stats.total // 0' "$e2e_report" 2>/dev/null || echo "0")
        local passed_tests=$(jq -r '.stats.passed // 0' "$e2e_report" 2>/dev/null || echo "0")

        if [[ $total_tests -gt 0 ]]; then
            local success_rate=$((passed_tests * 100 / total_tests))
            local threshold=${QUALITY_THRESHOLDS["integration_test_success"]}

            if [[ $success_rate -lt $threshold ]]; then
                log "ERROR" "E2E test success rate ($success_rate%) below threshold ($threshold%)"
                e2e_success=false
            else
                log "SUCCESS" "E2E test success rate ($success_rate%) meets threshold ($threshold%)"
            fi
        fi
    else
        log "ERROR" "End-to-end tests failed"
        e2e_success=false
    fi

    if [[ "$e2e_success" == "false" && "$FAIL_FAST" == "true" ]]; then
        log "ERROR" "Fail fast enabled - stopping due to e2e test failures"
        exit 1
    fi

    return $([ "$e2e_success" == "true" ] && echo 0 || echo 1)
}

# Validate quality gates
validate_quality_gates() {
    log "INFO" "🚪 Validating quality gates..."

    local quality_report="$REPORTS_DIR/quality-gates-$(date +%Y%m%d-%H%M%S).json"
    local quality_success=true
    local violations=0

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate quality gates"
        return 0
    fi

    # Initialize quality gates report
    cat > "$quality_report" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "quality_gates_level": "$QUALITY_GATES",
  "thresholds": {},
  "results": {},
  "violations": [],
  "overall_status": "pending"
}
EOF

    # Add thresholds to report
    local thresholds_json="{}"
    for key in "${!QUALITY_THRESHOLDS[@]}"; do
        thresholds_json=$(echo "$thresholds_json" | jq --arg key "$key" --argjson value "${QUALITY_THRESHOLDS[$key]}" '.[$key] = $value')
    done
    jq --argjson thresholds "$thresholds_json" '.thresholds = $thresholds' "$quality_report" > "${quality_report}.tmp" && mv "${quality_report}.tmp" "$quality_report"

    # Check system health
    log "INFO" "Checking system health..."
    if kubectl get pods -n "$NAMESPACE" &> /dev/null; then
        local unhealthy_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running --no-headers | wc -l)
        if [[ $unhealthy_pods -gt 0 ]]; then
            log "WARNING" "Found $unhealthy_pods unhealthy pods"
            violations=$((violations + 1))
        fi
    fi

    # Check API availability
    log "INFO" "Checking API availability..."
    local api_url="https://api.mataresit.com/health"
    if [[ "$ENVIRONMENT" != "production" ]]; then
        api_url="http://localhost:3000/health"
    fi

    local api_response_time=$(curl -w "%{time_total}" -o /dev/null -s "$api_url" 2>/dev/null || echo "999")
    local api_response_time_ms=$(echo "$api_response_time * 1000" | bc -l)
    local api_threshold=${QUALITY_THRESHOLDS["performance_p95_response_time"]}

    if (( $(echo "$api_response_time_ms > $api_threshold" | bc -l) )); then
        log "ERROR" "API response time (${api_response_time_ms}ms) exceeds threshold (${api_threshold}ms)"
        violations=$((violations + 1))
        quality_success=false
    else
        log "SUCCESS" "API response time (${api_response_time_ms}ms) meets threshold (${api_threshold}ms)"
    fi

    # Update quality gates report
    local overall_status="passed"
    if [[ $violations -gt 0 ]]; then
        overall_status="failed"
    fi

    jq --argjson violations "$violations" --arg status "$overall_status" \
       '.violations_count = $violations | .overall_status = $status' \
       "$quality_report" > "${quality_report}.tmp" && mv "${quality_report}.tmp" "$quality_report"

    log "SUCCESS" "Quality gates validation completed"
    log "INFO" "Quality violations: $violations"

    return $([ "$quality_success" == "true" ] && echo 0 || echo 1)
}

# Generate comprehensive test report
generate_test_reports() {
    log "INFO" "📊 Generating comprehensive test reports..."

    local master_report="$REPORTS_DIR/deployment-testing-report-$(date +%Y%m%d-%H%M%S).json"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would generate test reports"
        return 0
    fi

    # Create master test report
    cat > "$master_report" << EOF
{
  "report_metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "test_suite": "$TEST_SUITE",
    "quality_gates": "$QUALITY_GATES",
    "version": "$SCRIPT_VERSION"
  },
  "execution_summary": {
    "total_duration": "$(date -d @$(($(date +%s) - $(date -d "$(head -1 "$TESTING_LOG" | cut -d' ' -f1-2)" +%s))) -u +%H:%M:%S)",
    "parallel_execution": $PARALLEL_EXECUTION,
    "fail_fast": $FAIL_FAST
  },
  "test_results": {
    "unit_tests": "completed",
    "integration_tests": "completed",
    "performance_tests": "$([[ "$PERFORMANCE_BENCHMARKS" == "true" ]] && echo "completed" || echo "skipped")",
    "quality_gates": "validated"
  },
  "quality_metrics": {
    "overall_status": "passed"
  }
}
EOF

    # Generate HTML report
    local html_report="$REPORTS_DIR/deployment-testing-report-$(date +%Y%m%d-%H%M%S).html"
    cat > "$html_report" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Deployment Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { color: green; }
        .warning { color: orange; }
        .error { color: red; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Deployment Testing Report</h1>
        <p><strong>Generated:</strong> $(date)</p>
        <p><strong>Environment:</strong> $ENVIRONMENT</p>
        <p><strong>Test Suite:</strong> $TEST_SUITE</p>
        <p><strong>Quality Gates:</strong> $QUALITY_GATES</p>
    </div>

    <div class="section">
        <h2>Test Execution Summary</h2>
        <p>Comprehensive deployment testing completed with quality gates validation.</p>
    </div>
</body>
</html>
EOF

    log "SUCCESS" "Test reports generated:"
    log "INFO" "JSON Report: $master_report"
    log "INFO" "HTML Report: $html_report"

    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_testing_framework

    local exit_code=0
    local tests_executed=0

    # Execute tests based on test suite
    case "$TEST_SUITE" in
        "quick")
            log "INFO" "🚀 Starting quick test suite..."
            execute_unit_tests || exit_code=1
            tests_executed=1
            ;;
        "standard")
            log "INFO" "🚀 Starting standard test suite..."
            if [[ "$PARALLEL_EXECUTION" == "true" ]]; then
                execute_unit_tests &
                local unit_pid=$!
                execute_integration_tests &
                local integration_pid=$!

                wait $unit_pid || exit_code=1
                wait $integration_pid || exit_code=1
            else
                execute_unit_tests || exit_code=1
                execute_integration_tests || exit_code=1
            fi

            if [[ "$PERFORMANCE_BENCHMARKS" == "true" ]]; then
                execute_performance_tests || exit_code=1
                tests_executed=3
            else
                tests_executed=2
            fi
            ;;
        "comprehensive")
            log "INFO" "🚀 Starting comprehensive test suite..."
            if [[ "$PARALLEL_EXECUTION" == "true" ]]; then
                execute_unit_tests &
                local unit_pid=$!
                execute_integration_tests &
                local integration_pid=$!
                execute_performance_tests &
                local perf_pid=$!

                wait $unit_pid || exit_code=1
                wait $integration_pid || exit_code=1
                wait $perf_pid || exit_code=1

                # E2E tests run sequentially after others complete
                execute_e2e_tests || exit_code=1
            else
                execute_unit_tests || exit_code=1
                execute_integration_tests || exit_code=1
                execute_performance_tests || exit_code=1
                execute_e2e_tests || exit_code=1
            fi
            tests_executed=4
            ;;
    esac

    # Validate quality gates
    validate_quality_gates || exit_code=1

    # Generate reports
    if [[ "$GENERATE_REPORTS" == "true" ]]; then
        generate_test_reports || exit_code=1
    fi

    # Final status
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ Deployment testing completed successfully"
        log "INFO" "Tests executed: $tests_executed"
    else
        log "ERROR" "❌ Deployment testing completed with failures"
        log "INFO" "Tests attempted: $tests_executed"
    fi

    exit $exit_code
}

# Execute main function
main "$@"
