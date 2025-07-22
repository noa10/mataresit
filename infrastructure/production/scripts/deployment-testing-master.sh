#!/bin/bash

# Deployment Testing Master Controller
# Orchestrates comprehensive deployment testing with quality gates and performance benchmarks
# This is the main entry point for all deployment testing operations

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="deployment-testing-master"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly TESTING_CONFIG="$CONFIG_DIR/deployment-testing-config.yaml"

# Testing scripts
readonly TESTING_FRAMEWORK="$SCRIPT_DIR/deployment-testing-framework.sh"
readonly QUALITY_GATES_VALIDATOR="$SCRIPT_DIR/quality-gates-validator.sh"
readonly PERFORMANCE_BENCHMARKING="$SCRIPT_DIR/performance-benchmarking.sh"

# Log directories
readonly LOG_DIR="$PROJECT_ROOT/logs/testing"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/testing"
readonly ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/testing"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$ARTIFACTS_DIR"

# Log files
readonly MASTER_LOG="$LOG_DIR/deployment-testing-master-$(date +%Y%m%d-%H%M%S).log"
readonly SUMMARY_REPORT="$REPORTS_DIR/deployment-testing-summary-$(date +%Y%m%d-%H%M%S).json"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
OPERATION="full-testing"
TEST_SUITE="comprehensive"
QUALITY_GATES="strict"
PERFORMANCE_BENCHMARKS="true"
PARALLEL_EXECUTION="true"
FAIL_FAST="false"
DRY_RUN="false"
VERBOSE="false"
GENERATE_REPORTS="true"

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$MASTER_LOG"
    
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

Deployment Testing Master Controller - Orchestrates comprehensive deployment testing

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --operation OP          Operation: full-testing|testing-only|quality-only|performance-only (default: full-testing)
    --test-suite SUITE     Test suite: quick|standard|comprehensive (default: comprehensive)
    --quality-gates LEVEL  Quality gates: relaxed|standard|strict (default: strict)
    --no-performance       Skip performance benchmarks
    --sequential           Run operations sequentially instead of parallel
    --fail-fast            Stop on first test failure
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --no-reports           Skip report generation
    --help                 Show this help message

OPERATIONS:
    full-testing   - Complete testing suite with quality gates and performance benchmarks
    testing-only   - Core testing framework only (unit, integration, e2e)
    quality-only   - Quality gates validation only
    performance-only - Performance benchmarking only

TEST SUITES:
    quick          - Essential tests only (5 minutes)
    standard       - Standard test suite (15 minutes)
    comprehensive  - Full test suite (30 minutes)

QUALITY GATES:
    relaxed        - Relaxed quality thresholds for development
    standard       - Standard quality thresholds for staging
    strict         - Strict quality thresholds for production

EXAMPLES:
    # Full deployment testing with strict quality gates
    $0 --environment production --operation full-testing --quality-gates strict

    # Quick testing for development
    $0 --environment development --test-suite quick --quality-gates relaxed

    # Performance benchmarking only
    $0 --operation performance-only --verbose

    # Sequential execution with fail-fast
    $0 --sequential --fail-fast --test-suite standard

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
            --operation)
                OPERATION="$2"
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

# Initialize deployment testing master
initialize_testing_master() {
    log "INFO" "🧪 Initializing Deployment Testing Master Controller v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Operation: $OPERATION"
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
    
    if [[ ! "$OPERATION" =~ ^(full-testing|testing-only|quality-only|performance-only)$ ]]; then
        log "ERROR" "Invalid operation: $OPERATION"
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
    
    # Check required scripts exist
    local required_scripts=("$TESTING_FRAMEWORK" "$QUALITY_GATES_VALIDATOR" "$PERFORMANCE_BENCHMARKING")
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            log "ERROR" "Required script not found: $script"
            exit 1
        fi
        chmod +x "$script"
    done
    
    # Check required tools
    local required_tools=("npm" "kubectl" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    log "SUCCESS" "Deployment testing master initialized successfully"
}

# Execute core testing framework
execute_testing_framework() {
    log "INFO" "🧪 Executing core testing framework..."
    
    local testing_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--test-suite" "$TEST_SUITE"
        "--quality-gates" "$QUALITY_GATES"
    )
    
    if [[ "$PERFORMANCE_BENCHMARKS" != "true" ]]; then
        testing_args+=("--no-performance")
    fi
    
    if [[ "$PARALLEL_EXECUTION" != "true" ]]; then
        testing_args+=("--sequential")
    fi
    
    if [[ "$FAIL_FAST" == "true" ]]; then
        testing_args+=("--fail-fast")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        testing_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        testing_args+=("--verbose")
    fi
    
    if [[ "$GENERATE_REPORTS" != "true" ]]; then
        testing_args+=("--no-reports")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute testing framework with args: ${testing_args[*]}"
        return 0
    fi
    
    if "$TESTING_FRAMEWORK" "${testing_args[@]}"; then
        log "SUCCESS" "Core testing framework completed successfully"
        return 0
    else
        log "ERROR" "Core testing framework failed"
        return 1
    fi
}

# Execute quality gates validation
execute_quality_gates() {
    log "INFO" "🚪 Executing quality gates validation..."
    
    local quality_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--level" "$QUALITY_GATES"
    )
    
    if [[ "$DRY_RUN" == "true" ]]; then
        quality_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        quality_args+=("--verbose")
    fi
    
    if [[ "$GENERATE_REPORTS" != "true" ]]; then
        quality_args+=("--no-report")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute quality gates validation with args: ${quality_args[*]}"
        return 0
    fi
    
    if "$QUALITY_GATES_VALIDATOR" "${quality_args[@]}"; then
        log "SUCCESS" "Quality gates validation completed successfully"
        return 0
    else
        log "ERROR" "Quality gates validation failed"
        return 1
    fi
}

# Execute performance benchmarking
execute_performance_benchmarking() {
    log "INFO" "⚡ Executing performance benchmarking..."
    
    if [[ "$PERFORMANCE_BENCHMARKS" != "true" ]]; then
        log "INFO" "Performance benchmarking disabled, skipping..."
        return 0
    fi
    
    local perf_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--benchmark-type" "$TEST_SUITE"
    )
    
    # Map test suite to load profile
    case "$TEST_SUITE" in
        "quick")
            perf_args+=("--load-profile" "light" "--duration" "2m")
            ;;
        "standard")
            perf_args+=("--load-profile" "standard" "--duration" "5m")
            ;;
        "comprehensive")
            perf_args+=("--load-profile" "heavy" "--duration" "10m")
            ;;
    esac
    
    if [[ "$DRY_RUN" == "true" ]]; then
        perf_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        perf_args+=("--verbose")
    fi
    
    if [[ "$GENERATE_REPORTS" != "true" ]]; then
        perf_args+=("--no-report")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute performance benchmarking with args: ${perf_args[*]}"
        return 0
    fi
    
    if "$PERFORMANCE_BENCHMARKING" "${perf_args[@]}"; then
        log "SUCCESS" "Performance benchmarking completed successfully"
        return 0
    else
        log "ERROR" "Performance benchmarking failed"
        return 1
    fi
}

# Generate comprehensive summary report
generate_summary_report() {
    log "INFO" "📊 Generating comprehensive summary report..."
    
    if [[ "$GENERATE_REPORTS" != "true" ]]; then
        log "INFO" "Report generation disabled, skipping..."
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would generate summary report"
        return 0
    fi
    
    # Create comprehensive summary report
    cat > "$SUMMARY_REPORT" << EOF
{
  "report_metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "operation": "$OPERATION",
    "test_suite": "$TEST_SUITE",
    "quality_gates": "$QUALITY_GATES",
    "version": "$SCRIPT_VERSION"
  },
  "execution_configuration": {
    "performance_benchmarks": $PERFORMANCE_BENCHMARKS,
    "parallel_execution": $PARALLEL_EXECUTION,
    "fail_fast": $FAIL_FAST,
    "dry_run": $DRY_RUN
  },
  "execution_summary": {
    "total_duration": "$(date -d @$(($(date +%s) - $(date -d "$(head -1 "$MASTER_LOG" | cut -d' ' -f1-2)" +%s))) -u +%H:%M:%S)",
    "operations_completed": 0,
    "overall_status": "completed"
  },
  "component_results": {
    "testing_framework": "completed",
    "quality_gates": "completed",
    "performance_benchmarking": "$([[ "$PERFORMANCE_BENCHMARKS" == "true" ]] && echo "completed" || echo "skipped")"
  },
  "recommendations": [
    "Review test results and address any failures",
    "Monitor performance metrics trends",
    "Update quality thresholds as needed",
    "Continue regular testing practices"
  ]
}
EOF
    
    log "SUCCESS" "Summary report generated: $SUMMARY_REPORT"
    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_testing_master
    
    local exit_code=0
    local operations_completed=0
    
    # Execute operations based on operation type
    case "$OPERATION" in
        "full-testing")
            log "INFO" "🚀 Starting full deployment testing..."
            
            if [[ "$PARALLEL_EXECUTION" == "true" ]]; then
                log "INFO" "Executing operations in parallel..."
                
                # Execute in parallel using background processes
                execute_testing_framework &
                local testing_pid=$!
                
                execute_quality_gates &
                local quality_pid=$!
                
                execute_performance_benchmarking &
                local perf_pid=$!
                
                # Wait for all processes to complete
                wait $testing_pid || exit_code=1
                wait $quality_pid || exit_code=1
                wait $perf_pid || exit_code=1
                
                operations_completed=3
            else
                log "INFO" "Executing operations sequentially..."
                
                execute_testing_framework || exit_code=1
                operations_completed=$((operations_completed + 1))
                
                execute_quality_gates || exit_code=1
                operations_completed=$((operations_completed + 1))
                
                execute_performance_benchmarking || exit_code=1
                operations_completed=$((operations_completed + 1))
            fi
            ;;
        "testing-only")
            log "INFO" "🚀 Starting core testing only..."
            execute_testing_framework || exit_code=1
            operations_completed=1
            ;;
        "quality-only")
            log "INFO" "🚀 Starting quality gates validation only..."
            execute_quality_gates || exit_code=1
            operations_completed=1
            ;;
        "performance-only")
            log "INFO" "🚀 Starting performance benchmarking only..."
            execute_performance_benchmarking || exit_code=1
            operations_completed=1
            ;;
    esac
    
    # Generate summary report
    generate_summary_report || exit_code=1
    
    # Final status
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ Deployment testing operations completed successfully"
        log "INFO" "Operations completed: $operations_completed"
        log "INFO" "Summary report: $SUMMARY_REPORT"
    else
        log "ERROR" "❌ Deployment testing operations completed with issues"
        log "INFO" "Operations attempted: $operations_completed"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"
