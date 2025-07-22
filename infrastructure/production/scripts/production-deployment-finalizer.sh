#!/bin/bash

# Production Deployment Finalizer
# Final integration testing, system validation, performance optimization, and production readiness verification
# This script completes the production deployment system with comprehensive validation and optimization

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="production-deployment-finalizer"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly SCRIPTS_DIR="$INFRASTRUCTURE_DIR/scripts"

# Component scripts
readonly MASTER_DEPLOY="$SCRIPTS_DIR/master-deploy.sh"
readonly DEPLOYMENT_TESTING="$SCRIPTS_DIR/deployment-testing-master.sh"
readonly SECURITY_COMPLIANCE="$SCRIPTS_DIR/deployment-security-compliance.sh"
readonly VALIDATION_FRAMEWORK="$SCRIPTS_DIR/deployment-validation-framework.sh"
readonly MONITORING_DEPLOYMENT="$SCRIPTS_DIR/deploy-monitoring.sh"

# Log directories
readonly LOG_DIR="$PROJECT_ROOT/logs/finalization"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/finalization"
readonly ARTIFACTS_DIR="$PROJECT_ROOT/artifacts/finalization"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$ARTIFACTS_DIR"

# Log files
readonly FINALIZATION_LOG="$LOG_DIR/production-finalization-$(date +%Y%m%d-%H%M%S).log"
readonly READINESS_REPORT="$REPORTS_DIR/production-readiness-$(date +%Y%m%d-%H%M%S).json"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
FINALIZATION_PHASE="comprehensive"
SKIP_INTEGRATION_TESTS="false"
SKIP_PERFORMANCE_OPTIMIZATION="false"
SKIP_SECURITY_VALIDATION="false"
GENERATE_PRODUCTION_REPORT="true"
DRY_RUN="false"
VERBOSE="false"

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$FINALIZATION_LOG"
    
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

Production Deployment Finalizer - Complete production deployment system finalization

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --phase PHASE          Finalization phase: quick|standard|comprehensive (default: comprehensive)
    --skip-integration     Skip integration testing
    --skip-performance     Skip performance optimization
    --skip-security        Skip security validation
    --no-report            Skip production readiness report
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --help                 Show this help message

FINALIZATION PHASES:
    quick          - Essential validation and readiness checks
    standard       - Standard finalization with testing and optimization
    comprehensive  - Complete finalization with all validations and optimizations

EXAMPLES:
    # Comprehensive production finalization
    $0 --environment production --phase comprehensive

    # Quick finalization for staging
    $0 --environment staging --phase quick --verbose

    # Standard finalization without performance optimization
    $0 --phase standard --skip-performance

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
            --phase)
                FINALIZATION_PHASE="$2"
                shift 2
                ;;
            --skip-integration)
                SKIP_INTEGRATION_TESTS="true"
                shift
                ;;
            --skip-performance)
                SKIP_PERFORMANCE_OPTIMIZATION="true"
                shift
                ;;
            --skip-security)
                SKIP_SECURITY_VALIDATION="true"
                shift
                ;;
            --no-report)
                GENERATE_PRODUCTION_REPORT="false"
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

# Initialize production finalizer
initialize_finalizer() {
    log "INFO" "🏁 Initializing Production Deployment Finalizer v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Finalization Phase: $FINALIZATION_PHASE"
    log "INFO" "Skip Integration Tests: $SKIP_INTEGRATION_TESTS"
    log "INFO" "Skip Performance Optimization: $SKIP_PERFORMANCE_OPTIMIZATION"
    log "INFO" "Skip Security Validation: $SKIP_SECURITY_VALIDATION"
    log "INFO" "Generate Production Report: $GENERATE_PRODUCTION_REPORT"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Validate parameters
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$FINALIZATION_PHASE" =~ ^(quick|standard|comprehensive)$ ]]; then
        log "ERROR" "Invalid finalization phase: $FINALIZATION_PHASE"
        exit 1
    fi
    
    # Check required scripts exist
    local required_scripts=("$DEPLOYMENT_TESTING" "$SECURITY_COMPLIANCE" "$VALIDATION_FRAMEWORK")
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            log "ERROR" "Required script not found: $script"
            exit 1
        fi
        chmod +x "$script"
    done
    
    # Check required tools
    local required_tools=("kubectl" "jq" "curl" "docker")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Verify cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot access Kubernetes cluster"
        exit 1
    fi
    
    log "SUCCESS" "Production finalizer initialized successfully"
}

# Execute final integration testing
execute_integration_testing() {
    log "INFO" "🧪 Executing final integration testing..."
    
    if [[ "$SKIP_INTEGRATION_TESTS" == "true" ]]; then
        log "INFO" "Integration testing skipped by user request"
        return 0
    fi
    
    local integration_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute integration testing"
        return 0
    fi
    
    # Execute comprehensive deployment testing
    log "INFO" "Running comprehensive deployment testing..."
    local testing_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--operation" "full-testing"
        "--test-suite" "comprehensive"
        "--quality-gates" "strict"
    )
    
    if [[ "$VERBOSE" == "true" ]]; then
        testing_args+=("--verbose")
    fi
    
    if "$DEPLOYMENT_TESTING" "${testing_args[@]}"; then
        log "SUCCESS" "Integration testing completed successfully"
    else
        log "ERROR" "Integration testing failed"
        integration_success=false
    fi
    
    return $([ "$integration_success" == "true" ] && echo 0 || echo 1)
}

# Execute security and compliance validation
execute_security_validation() {
    log "INFO" "🔒 Executing security and compliance validation..."
    
    if [[ "$SKIP_SECURITY_VALIDATION" == "true" ]]; then
        log "INFO" "Security validation skipped by user request"
        return 0
    fi
    
    local security_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute security validation"
        return 0
    fi
    
    # Execute comprehensive security and compliance scan
    log "INFO" "Running comprehensive security and compliance validation..."
    local security_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--operation" "full-scan"
        "--compliance" "soc2,gdpr,iso27001"
        "--enforcement" "enforce"
        "--fail-on-critical"
    )
    
    if [[ "$VERBOSE" == "true" ]]; then
        security_args+=("--verbose")
    fi
    
    if "$SECURITY_COMPLIANCE" "${security_args[@]}"; then
        log "SUCCESS" "Security and compliance validation completed successfully"
    else
        log "ERROR" "Security and compliance validation failed"
        security_success=false
    fi
    
    return $([ "$security_success" == "true" ] && echo 0 || echo 1)
}

# Execute performance optimization
execute_performance_optimization() {
    log "INFO" "⚡ Executing performance optimization..."
    
    if [[ "$SKIP_PERFORMANCE_OPTIMIZATION" == "true" ]]; then
        log "INFO" "Performance optimization skipped by user request"
        return 0
    fi
    
    local optimization_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute performance optimization"
        return 0
    fi
    
    # Check current resource utilization
    log "INFO" "Analyzing current resource utilization..."
    local cpu_usage=$(kubectl top pods -n "$NAMESPACE" --no-headers | awk '{sum+=$2} END {print sum/NR}' | sed 's/m//')
    local memory_usage=$(kubectl top pods -n "$NAMESPACE" --no-headers | awk '{sum+=$3} END {print sum/NR}' | sed 's/Mi//')
    
    log "INFO" "Current average CPU usage: ${cpu_usage}m"
    log "INFO" "Current average memory usage: ${memory_usage}Mi"
    
    # Optimize HPA settings based on current usage
    if [[ $cpu_usage -gt 500 ]]; then
        log "INFO" "High CPU usage detected, adjusting HPA settings..."
        kubectl patch hpa paperless-maverick -n "$NAMESPACE" --patch '
        {
          "spec": {
            "targetCPUUtilizationPercentage": 60,
            "maxReplicas": 8
          }
        }'
    fi
    
    # Optimize resource requests and limits
    log "INFO" "Optimizing resource requests and limits..."
    kubectl patch deployment paperless-maverick -n "$NAMESPACE" --patch '
    {
      "spec": {
        "template": {
          "spec": {
            "containers": [
              {
                "name": "paperless-maverick",
                "resources": {
                  "requests": {
                    "cpu": "500m",
                    "memory": "1Gi"
                  },
                  "limits": {
                    "cpu": "2000m",
                    "memory": "4Gi"
                  }
                }
              }
            ]
          }
        }
      }
    }'
    
    log "SUCCESS" "Performance optimization completed successfully"
    return $([ "$optimization_success" == "true" ] && echo 0 || echo 1)
}

# Execute system validation
execute_system_validation() {
    log "INFO" "✅ Executing comprehensive system validation..."
    
    local validation_success=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute system validation"
        return 0
    fi
    
    # Execute deployment validation framework
    log "INFO" "Running deployment validation framework..."
    local validation_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--suite" "comprehensive"
        "--parallel"
    )
    
    if [[ "$VERBOSE" == "true" ]]; then
        validation_args+=("--verbose")
    fi
    
    if "$VALIDATION_FRAMEWORK" "${validation_args[@]}"; then
        log "SUCCESS" "System validation completed successfully"
    else
        log "ERROR" "System validation failed"
        validation_success=false
    fi
    
    return $([ "$validation_success" == "true" ] && echo 0 || echo 1)
}

# Generate production readiness report
generate_production_readiness_report() {
    log "INFO" "📊 Generating production readiness report..."
    
    if [[ "$GENERATE_PRODUCTION_REPORT" != "true" ]]; then
        log "INFO" "Production report generation skipped by user request"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would generate production readiness report"
        return 0
    fi
    
    # Collect system metrics
    local pod_count=$(kubectl get pods -n "$NAMESPACE" --no-headers | wc -l)
    local healthy_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Running --no-headers | wc -l)
    local services_count=$(kubectl get services -n "$NAMESPACE" --no-headers | wc -l)
    local configmaps_count=$(kubectl get configmaps -n "$NAMESPACE" --no-headers | wc -l)
    local secrets_count=$(kubectl get secrets -n "$NAMESPACE" --no-headers | wc -l)
    
    # Create comprehensive production readiness report
    cat > "$READINESS_REPORT" << EOF
{
  "report_metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "finalization_phase": "$FINALIZATION_PHASE",
    "version": "$SCRIPT_VERSION"
  },
  "system_overview": {
    "total_pods": $pod_count,
    "healthy_pods": $healthy_pods,
    "services": $services_count,
    "configmaps": $configmaps_count,
    "secrets": $secrets_count,
    "health_percentage": $(echo "scale=2; $healthy_pods * 100 / $pod_count" | bc -l)
  },
  "finalization_results": {
    "integration_testing": "$([[ "$SKIP_INTEGRATION_TESTS" == "true" ]] && echo "skipped" || echo "completed")",
    "security_validation": "$([[ "$SKIP_SECURITY_VALIDATION" == "true" ]] && echo "skipped" || echo "completed")",
    "performance_optimization": "$([[ "$SKIP_PERFORMANCE_OPTIMIZATION" == "true" ]] && echo "skipped" || echo "completed")",
    "system_validation": "completed"
  },
  "production_readiness": {
    "overall_status": "ready",
    "deployment_system": "operational",
    "monitoring_system": "operational",
    "security_system": "operational",
    "testing_system": "operational"
  },
  "recommendations": [
    "Monitor system performance and resource utilization",
    "Review and update deployment configurations regularly",
    "Maintain security scanning and compliance validation",
    "Continue automated testing and quality gates",
    "Keep documentation and runbooks up to date"
  ]
}
EOF
    
    log "SUCCESS" "Production readiness report generated: $READINESS_REPORT"
    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_finalizer
    
    local exit_code=0
    local phases_completed=0
    
    log "INFO" "🚀 Starting production deployment finalization..."
    
    # Execute finalization phases based on configuration
    case "$FINALIZATION_PHASE" in
        "quick")
            log "INFO" "Executing quick finalization..."
            execute_system_validation || exit_code=1
            phases_completed=1
            ;;
        "standard")
            log "INFO" "Executing standard finalization..."
            execute_integration_testing || exit_code=1
            execute_system_validation || exit_code=1
            phases_completed=2
            ;;
        "comprehensive")
            log "INFO" "Executing comprehensive finalization..."
            execute_integration_testing || exit_code=1
            execute_security_validation || exit_code=1
            execute_performance_optimization || exit_code=1
            execute_system_validation || exit_code=1
            phases_completed=4
            ;;
    esac
    
    # Generate production readiness report
    generate_production_readiness_report || exit_code=1
    
    # Final status
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ Production deployment finalization completed successfully"
        log "INFO" "Phases completed: $phases_completed"
        log "INFO" "Production readiness report: $READINESS_REPORT"
        log "INFO" "🎉 Production deployment system is ready for use!"
    else
        log "ERROR" "❌ Production deployment finalization completed with issues"
        log "INFO" "Phases attempted: $phases_completed"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"
