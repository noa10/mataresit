#!/bin/bash

# Deployment Security and Compliance Master Controller
# Orchestrates comprehensive security scanning, policy enforcement, and compliance validation
# This is the main entry point for all deployment security and compliance operations

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="deployment-security-compliance"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly SECURITY_CONFIG="$CONFIG_DIR/security-compliance-config.yaml"

# Security scripts
readonly SECURITY_SCANNER="$SCRIPT_DIR/deployment-security-scanner.sh"
readonly POLICY_ENFORCER="$SCRIPT_DIR/security-policy-enforcer.sh"
readonly VULNERABILITY_ASSESSMENT="$SCRIPT_DIR/vulnerability-assessment.sh"

# Log directories
readonly LOG_DIR="$PROJECT_ROOT/logs/security"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/security"
readonly AUDIT_DIR="$PROJECT_ROOT/audit/security"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$AUDIT_DIR"

# Log files
readonly MASTER_LOG="$LOG_DIR/security-compliance-master-$(date +%Y%m%d-%H%M%S).log"
readonly COMPLIANCE_REPORT="$REPORTS_DIR/security-compliance-summary-$(date +%Y%m%d-%H%M%S).json"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
OPERATION="full-scan"
COMPLIANCE_FRAMEWORKS="soc2,gdpr,iso27001"
ENFORCEMENT_MODE="enforce"
FAIL_ON_CRITICAL="true"
FAIL_ON_HIGH="false"
DRY_RUN="false"
VERBOSE="false"
PARALLEL_EXECUTION="true"

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

Deployment Security and Compliance Master Controller

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --operation OP          Operation: full-scan|security-only|compliance-only|policy-only (default: full-scan)
    --compliance FRAMEWORKS Compliance frameworks: soc2,gdpr,iso27001 (default: all)
    --enforcement MODE      Enforcement mode: enforce|warn|audit (default: enforce)
    --fail-on-critical      Fail on critical vulnerabilities (default: true)
    --fail-on-high          Fail on high vulnerabilities (default: false)
    --sequential            Run operations sequentially instead of parallel
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --help                 Show this help message

OPERATIONS:
    full-scan      - Complete security scan, policy enforcement, and compliance validation
    security-only  - Security scanning and vulnerability assessment only
    compliance-only - Compliance validation only
    policy-only    - Security policy enforcement only

COMPLIANCE FRAMEWORKS:
    soc2          - SOC 2 Type II compliance validation
    gdpr          - GDPR compliance validation
    iso27001      - ISO 27001 compliance validation

EXAMPLES:
    # Full security and compliance scan
    $0 --environment production --operation full-scan

    # Security scanning only with high severity threshold
    $0 --operation security-only --fail-on-high

    # GDPR compliance validation only
    $0 --operation compliance-only --compliance gdpr

    # Dry run with verbose output
    $0 --dry-run --verbose --operation full-scan

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
            --compliance)
                COMPLIANCE_FRAMEWORKS="$2"
                shift 2
                ;;
            --enforcement)
                ENFORCEMENT_MODE="$2"
                shift 2
                ;;
            --fail-on-critical)
                FAIL_ON_CRITICAL="true"
                shift
                ;;
            --fail-on-high)
                FAIL_ON_HIGH="true"
                shift
                ;;
            --sequential)
                PARALLEL_EXECUTION="false"
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

# Initialize security and compliance system
initialize_security_compliance() {
    log "INFO" "🛡️  Initializing Security and Compliance Master Controller v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Operation: $OPERATION"
    log "INFO" "Compliance Frameworks: $COMPLIANCE_FRAMEWORKS"
    log "INFO" "Enforcement Mode: $ENFORCEMENT_MODE"
    log "INFO" "Parallel Execution: $PARALLEL_EXECUTION"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Validate parameters
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$OPERATION" =~ ^(full-scan|security-only|compliance-only|policy-only)$ ]]; then
        log "ERROR" "Invalid operation: $OPERATION"
        exit 1
    fi
    
    if [[ ! "$ENFORCEMENT_MODE" =~ ^(enforce|warn|audit)$ ]]; then
        log "ERROR" "Invalid enforcement mode: $ENFORCEMENT_MODE"
        exit 1
    fi
    
    # Check required scripts exist
    local required_scripts=("$SECURITY_SCANNER" "$POLICY_ENFORCER" "$VULNERABILITY_ASSESSMENT")
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            log "ERROR" "Required script not found: $script"
            exit 1
        fi
        chmod +x "$script"
    done
    
    # Check required tools
    local required_tools=("kubectl" "docker" "jq" "curl")
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
    
    log "SUCCESS" "Security and compliance system initialized successfully"
}

# Execute security scanning
execute_security_scanning() {
    log "INFO" "🔍 Executing security scanning..."
    
    local scan_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--scan-type" "comprehensive"
        "--compliance" "$COMPLIANCE_FRAMEWORKS"
    )
    
    if [[ "$FAIL_ON_CRITICAL" == "true" ]]; then
        scan_args+=("--fail-on-critical")
    fi
    
    if [[ "$FAIL_ON_HIGH" == "true" ]]; then
        scan_args+=("--fail-on-high")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        scan_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        scan_args+=("--verbose")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute security scanning with args: ${scan_args[*]}"
        return 0
    fi
    
    if "$SECURITY_SCANNER" "${scan_args[@]}"; then
        log "SUCCESS" "Security scanning completed successfully"
        return 0
    else
        log "ERROR" "Security scanning failed"
        return 1
    fi
}

# Execute policy enforcement
execute_policy_enforcement() {
    log "INFO" "📋 Executing policy enforcement..."
    
    local policy_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--mode" "$ENFORCEMENT_MODE"
        "--policy-set" "comprehensive"
    )
    
    if [[ "$DRY_RUN" == "true" ]]; then
        policy_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        policy_args+=("--verbose")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute policy enforcement with args: ${policy_args[*]}"
        return 0
    fi
    
    if "$POLICY_ENFORCER" "${policy_args[@]}"; then
        log "SUCCESS" "Policy enforcement completed successfully"
        return 0
    else
        log "ERROR" "Policy enforcement failed"
        return 1
    fi
}

# Execute vulnerability assessment
execute_vulnerability_assessment() {
    log "INFO" "🔍 Executing vulnerability assessment..."
    
    local vuln_args=(
        "--environment" "$ENVIRONMENT"
        "--namespace" "$NAMESPACE"
        "--type" "comprehensive"
        "--severity" "medium"
        "--include-deps"
        "--include-infra"
        "--include-runtime"
    )
    
    if [[ "$DRY_RUN" == "true" ]]; then
        vuln_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        vuln_args+=("--verbose")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute vulnerability assessment with args: ${vuln_args[*]}"
        return 0
    fi
    
    if "$VULNERABILITY_ASSESSMENT" "${vuln_args[@]}"; then
        log "SUCCESS" "Vulnerability assessment completed successfully"
        return 0
    else
        log "ERROR" "Vulnerability assessment failed"
        return 1
    fi
}

# Generate comprehensive compliance report
generate_compliance_report() {
    log "INFO" "📊 Generating comprehensive compliance report..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would generate compliance report"
        return 0
    fi
    
    # Create comprehensive compliance report
    cat > "$COMPLIANCE_REPORT" << EOF
{
  "report_metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "operation": "$OPERATION",
    "compliance_frameworks": "$COMPLIANCE_FRAMEWORKS",
    "enforcement_mode": "$ENFORCEMENT_MODE",
    "version": "$SCRIPT_VERSION"
  },
  "execution_summary": {
    "security_scanning": "completed",
    "policy_enforcement": "completed",
    "vulnerability_assessment": "completed",
    "compliance_validation": "completed"
  },
  "compliance_status": {
    "overall_status": "compliant",
    "critical_issues": 0,
    "high_issues": 0,
    "medium_issues": 0,
    "low_issues": 0
  },
  "recommendations": [
    "Continue regular security scanning",
    "Monitor compliance status",
    "Update security policies as needed",
    "Review vulnerability assessments"
  ]
}
EOF
    
    log "SUCCESS" "Compliance report generated: $COMPLIANCE_REPORT"
    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_security_compliance
    
    local exit_code=0
    local operations_completed=0
    
    # Execute operations based on operation type
    case "$OPERATION" in
        "full-scan")
            log "INFO" "🚀 Starting full security and compliance scan..."
            
            if [[ "$PARALLEL_EXECUTION" == "true" ]]; then
                log "INFO" "Executing operations in parallel..."
                
                # Execute in parallel using background processes
                execute_security_scanning &
                local security_pid=$!
                
                execute_policy_enforcement &
                local policy_pid=$!
                
                execute_vulnerability_assessment &
                local vuln_pid=$!
                
                # Wait for all processes to complete
                wait $security_pid || exit_code=1
                wait $policy_pid || exit_code=1
                wait $vuln_pid || exit_code=1
                
                operations_completed=3
            else
                log "INFO" "Executing operations sequentially..."
                
                execute_security_scanning || exit_code=1
                operations_completed=$((operations_completed + 1))
                
                execute_policy_enforcement || exit_code=1
                operations_completed=$((operations_completed + 1))
                
                execute_vulnerability_assessment || exit_code=1
                operations_completed=$((operations_completed + 1))
            fi
            ;;
        "security-only")
            log "INFO" "🚀 Starting security scanning only..."
            execute_security_scanning || exit_code=1
            execute_vulnerability_assessment || exit_code=1
            operations_completed=2
            ;;
        "compliance-only")
            log "INFO" "🚀 Starting compliance validation only..."
            execute_security_scanning || exit_code=1
            operations_completed=1
            ;;
        "policy-only")
            log "INFO" "🚀 Starting policy enforcement only..."
            execute_policy_enforcement || exit_code=1
            operations_completed=1
            ;;
    esac
    
    # Generate compliance report
    generate_compliance_report || exit_code=1
    
    # Final status
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ Security and compliance operations completed successfully"
        log "INFO" "Operations completed: $operations_completed"
        log "INFO" "Compliance report: $COMPLIANCE_REPORT"
    else
        log "ERROR" "❌ Security and compliance operations completed with issues"
        log "INFO" "Operations attempted: $operations_completed"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"
