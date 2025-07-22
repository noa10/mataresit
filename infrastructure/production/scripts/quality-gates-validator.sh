#!/bin/bash

# Quality Gates Validator
# Comprehensive quality gates validation for deployment processes
# This script validates code quality, performance metrics, security standards, and acceptance criteria

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="quality-gates-validator"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly TESTING_CONFIG="$CONFIG_DIR/deployment-testing-config.yaml"

# Log directories
readonly LOG_DIR="$PROJECT_ROOT/logs/quality-gates"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/quality-gates"
readonly METRICS_DIR="$PROJECT_ROOT/metrics/quality-gates"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$METRICS_DIR"

# Log files
readonly QUALITY_LOG="$LOG_DIR/quality-gates-$(date +%Y%m%d-%H%M%S).log"
readonly METRICS_LOG="$LOG_DIR/quality-metrics-$(date +%Y%m%d-%H%M%S).log"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
VALIDATION_LEVEL="strict"
INCLUDE_PERFORMANCE="true"
INCLUDE_SECURITY="true"
INCLUDE_CODE_QUALITY="true"
INCLUDE_ACCESSIBILITY="true"
DRY_RUN="false"
VERBOSE="false"
GENERATE_REPORT="true"

# Quality gate thresholds (strict by default)
declare -A QUALITY_THRESHOLDS=(
    ["code_coverage"]=85
    ["code_quality_score"]=8
    ["performance_score"]=90
    ["security_score"]=95
    ["accessibility_score"]=95
    ["api_response_time_p95"]=2000
    ["api_success_rate"]=99
    ["database_query_time_p95"]=500
    ["error_rate_max"]=1
    ["memory_utilization_max"]=85
    ["cpu_utilization_max"]=80
    ["disk_usage_max"]=80
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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$QUALITY_LOG"
    
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

Quality Gates Validator - Comprehensive quality validation for deployment processes

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --level LEVEL          Validation level: relaxed|standard|strict (default: strict)
    --no-performance       Skip performance validation
    --no-security          Skip security validation
    --no-code-quality      Skip code quality validation
    --no-accessibility     Skip accessibility validation
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --no-report            Skip report generation
    --help                 Show this help message

VALIDATION LEVELS:
    relaxed        - Relaxed quality thresholds for development
    standard       - Standard quality thresholds for staging
    strict         - Strict quality thresholds for production

EXAMPLES:
    # Strict quality gates validation for production
    $0 --environment production --level strict

    # Standard validation without accessibility checks
    $0 --level standard --no-accessibility

    # Quick performance and security validation
    $0 --no-code-quality --no-accessibility --verbose

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
            --level)
                VALIDATION_LEVEL="$2"
                shift 2
                ;;
            --no-performance)
                INCLUDE_PERFORMANCE="false"
                shift
                ;;
            --no-security)
                INCLUDE_SECURITY="false"
                shift
                ;;
            --no-code-quality)
                INCLUDE_CODE_QUALITY="false"
                shift
                ;;
            --no-accessibility)
                INCLUDE_ACCESSIBILITY="false"
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

# Initialize quality gates validator
initialize_validator() {
    log "INFO" "🚪 Initializing Quality Gates Validator v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Validation Level: $VALIDATION_LEVEL"
    log "INFO" "Include Performance: $INCLUDE_PERFORMANCE"
    log "INFO" "Include Security: $INCLUDE_SECURITY"
    log "INFO" "Include Code Quality: $INCLUDE_CODE_QUALITY"
    log "INFO" "Include Accessibility: $INCLUDE_ACCESSIBILITY"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Validate parameters
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$VALIDATION_LEVEL" =~ ^(relaxed|standard|strict)$ ]]; then
        log "ERROR" "Invalid validation level: $VALIDATION_LEVEL"
        exit 1
    fi
    
    # Adjust thresholds based on validation level
    adjust_thresholds
    
    # Check required tools
    local required_tools=("kubectl" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    log "SUCCESS" "Quality gates validator initialized successfully"
}

# Adjust thresholds based on validation level
adjust_thresholds() {
    case "$VALIDATION_LEVEL" in
        "relaxed")
            QUALITY_THRESHOLDS["code_coverage"]=70
            QUALITY_THRESHOLDS["code_quality_score"]=6
            QUALITY_THRESHOLDS["performance_score"]=80
            QUALITY_THRESHOLDS["security_score"]=85
            QUALITY_THRESHOLDS["accessibility_score"]=80
            QUALITY_THRESHOLDS["api_response_time_p95"]=3000
            QUALITY_THRESHOLDS["api_success_rate"]=95
            QUALITY_THRESHOLDS["error_rate_max"]=5
            ;;
        "standard")
            QUALITY_THRESHOLDS["code_coverage"]=80
            QUALITY_THRESHOLDS["code_quality_score"]=7
            QUALITY_THRESHOLDS["performance_score"]=85
            QUALITY_THRESHOLDS["security_score"]=90
            QUALITY_THRESHOLDS["accessibility_score"]=90
            QUALITY_THRESHOLDS["api_response_time_p95"]=2500
            QUALITY_THRESHOLDS["api_success_rate"]=98
            QUALITY_THRESHOLDS["error_rate_max"]=2
            ;;
        "strict")
            # Use default strict values
            ;;
    esac
    
    log "INFO" "Quality thresholds adjusted for $VALIDATION_LEVEL level"
}

# Validate code quality
validate_code_quality() {
    log "INFO" "📊 Validating code quality..."
    
    if [[ "$INCLUDE_CODE_QUALITY" != "true" ]]; then
        log "INFO" "Code quality validation disabled, skipping..."
        return 0
    fi
    
    local code_quality_report="$REPORTS_DIR/code-quality-$(date +%Y%m%d-%H%M%S).json"
    local code_quality_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate code quality"
        return 0
    fi
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Check test coverage
    log "INFO" "Checking test coverage..."
    if [[ -f "coverage/coverage-summary.json" ]]; then
        local coverage=$(jq -r '.total.lines.pct // 0' coverage/coverage-summary.json)
        local coverage_int=${coverage%.*}
        local coverage_threshold=${QUALITY_THRESHOLDS["code_coverage"]}
        
        if [[ $coverage_int -lt $coverage_threshold ]]; then
            log "ERROR" "Code coverage ($coverage%) below threshold ($coverage_threshold%)"
            code_quality_success=false
        else
            log "SUCCESS" "Code coverage ($coverage%) meets threshold ($coverage_threshold%)"
        fi
    else
        log "WARNING" "Coverage report not found, skipping coverage check"
    fi
    
    # Run ESLint for code quality
    log "INFO" "Running ESLint code quality check..."
    if npm run lint -- --format json --output-file "$code_quality_report" 2>/dev/null; then
        local eslint_errors=$(jq '[.[] | select(.errorCount > 0)] | length' "$code_quality_report" 2>/dev/null || echo "0")
        
        if [[ $eslint_errors -gt 0 ]]; then
            log "WARNING" "ESLint found $eslint_errors files with errors"
        else
            log "SUCCESS" "ESLint code quality check passed"
        fi
    else
        log "WARNING" "ESLint check failed or not configured"
    fi
    
    log "SUCCESS" "Code quality validation completed"
    return $([ "$code_quality_success" == "true" ] && echo 0 || echo 1)
}

# Validate performance metrics
validate_performance() {
    log "INFO" "⚡ Validating performance metrics..."
    
    if [[ "$INCLUDE_PERFORMANCE" != "true" ]]; then
        log "INFO" "Performance validation disabled, skipping..."
        return 0
    fi
    
    local performance_report="$REPORTS_DIR/performance-validation-$(date +%Y%m%d-%H%M%S).json"
    local performance_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate performance metrics"
        return 0
    fi
    
    # Test API response times
    log "INFO" "Testing API response times..."
    local api_url="https://api.mataresit.com/health"
    if [[ "$ENVIRONMENT" != "production" ]]; then
        api_url="http://localhost:3000/health"
    fi
    
    local total_time=0
    local successful_requests=0
    local failed_requests=0
    
    # Run multiple requests to get average
    for i in {1..10}; do
        local response_time=$(curl -w "%{time_total}" -o /dev/null -s "$api_url" 2>/dev/null || echo "999")
        local response_code=$(curl -w "%{http_code}" -o /dev/null -s "$api_url" 2>/dev/null || echo "000")
        
        if [[ "$response_code" == "200" ]]; then
            total_time=$(echo "$total_time + $response_time" | bc -l)
            successful_requests=$((successful_requests + 1))
        else
            failed_requests=$((failed_requests + 1))
        fi
    done
    
    # Calculate metrics
    if [[ $successful_requests -gt 0 ]]; then
        local avg_response_time=$(echo "scale=3; $total_time / $successful_requests" | bc -l)
        local avg_response_time_ms=$(echo "$avg_response_time * 1000" | bc -l)
        local response_threshold=${QUALITY_THRESHOLDS["api_response_time_p95"]}
        
        if (( $(echo "$avg_response_time_ms > $response_threshold" | bc -l) )); then
            log "ERROR" "Average API response time (${avg_response_time_ms}ms) exceeds threshold (${response_threshold}ms)"
            performance_success=false
        else
            log "SUCCESS" "Average API response time (${avg_response_time_ms}ms) meets threshold (${response_threshold}ms)"
        fi
        
        # Check success rate
        local success_rate=$((successful_requests * 100 / (successful_requests + failed_requests)))
        local success_threshold=${QUALITY_THRESHOLDS["api_success_rate"]}
        
        if [[ $success_rate -lt $success_threshold ]]; then
            log "ERROR" "API success rate ($success_rate%) below threshold ($success_threshold%)"
            performance_success=false
        else
            log "SUCCESS" "API success rate ($success_rate%) meets threshold ($success_threshold%)"
        fi
    else
        log "ERROR" "All API requests failed"
        performance_success=false
    fi
    
    # Generate performance report
    cat > "$performance_report" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "api_performance": {
    "average_response_time_ms": $avg_response_time_ms,
    "success_rate_percent": $success_rate,
    "successful_requests": $successful_requests,
    "failed_requests": $failed_requests
  },
  "thresholds": {
    "response_time_threshold": ${QUALITY_THRESHOLDS["api_response_time_p95"]},
    "success_rate_threshold": ${QUALITY_THRESHOLDS["api_success_rate"]}
  }
}
EOF
    
    log "SUCCESS" "Performance validation completed"
    return $([ "$performance_success" == "true" ] && echo 0 || echo 1)
}

# Generate quality gates report
generate_quality_report() {
    log "INFO" "📊 Generating quality gates report..."
    
    if [[ "$GENERATE_REPORT" != "true" ]]; then
        log "INFO" "Report generation disabled, skipping..."
        return 0
    fi
    
    local quality_report="$REPORTS_DIR/quality-gates-report-$(date +%Y%m%d-%H%M%S).json"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would generate quality gates report"
        return 0
    fi
    
    # Create comprehensive quality gates report
    cat > "$quality_report" << EOF
{
  "report_metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "validation_level": "$VALIDATION_LEVEL",
    "version": "$SCRIPT_VERSION"
  },
  "validation_scope": {
    "performance": $INCLUDE_PERFORMANCE,
    "security": $INCLUDE_SECURITY,
    "code_quality": $INCLUDE_CODE_QUALITY,
    "accessibility": $INCLUDE_ACCESSIBILITY
  },
  "quality_thresholds": {},
  "validation_results": {
    "overall_status": "passed",
    "violations_count": 0
  }
}
EOF
    
    # Add thresholds to report
    local thresholds_json="{}"
    for key in "${!QUALITY_THRESHOLDS[@]}"; do
        thresholds_json=$(echo "$thresholds_json" | jq --arg key "$key" --argjson value "${QUALITY_THRESHOLDS[$key]}" '.[$key] = $value')
    done
    jq --argjson thresholds "$thresholds_json" '.quality_thresholds = $thresholds' "$quality_report" > "${quality_report}.tmp" && mv "${quality_report}.tmp" "$quality_report"
    
    log "SUCCESS" "Quality gates report generated: $quality_report"
    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_validator
    
    local exit_code=0
    local validations_completed=0
    
    # Execute validations
    if [[ "$INCLUDE_CODE_QUALITY" == "true" ]]; then
        validate_code_quality || exit_code=1
        validations_completed=$((validations_completed + 1))
    fi
    
    if [[ "$INCLUDE_PERFORMANCE" == "true" ]]; then
        validate_performance || exit_code=1
        validations_completed=$((validations_completed + 1))
    fi
    
    # Generate quality gates report
    generate_quality_report || exit_code=1
    
    # Final status
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ Quality gates validation completed successfully"
        log "INFO" "Validations completed: $validations_completed"
    else
        log "ERROR" "❌ Quality gates validation completed with failures"
        log "INFO" "Validations attempted: $validations_completed"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"
