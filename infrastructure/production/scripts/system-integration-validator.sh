#!/bin/bash

# System Integration Validator
# Comprehensive validation of all deployment system components and their integration
# This script validates the complete production deployment system integration

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="system-integration-validator"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly SCRIPTS_DIR="$INFRASTRUCTURE_DIR/scripts"

# Log directories
readonly LOG_DIR="$PROJECT_ROOT/logs/integration"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/integration"
readonly VALIDATION_DIR="$PROJECT_ROOT/validation/integration"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$VALIDATION_DIR"

# Log files
readonly INTEGRATION_LOG="$LOG_DIR/system-integration-$(date +%Y%m%d-%H%M%S).log"
readonly VALIDATION_REPORT="$REPORTS_DIR/integration-validation-$(date +%Y%m%d-%H%M%S).json"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
VALIDATION_SCOPE="comprehensive"
INCLUDE_PERFORMANCE_TESTS="true"
INCLUDE_SECURITY_TESTS="true"
INCLUDE_MONITORING_TESTS="true"
DRY_RUN="false"
VERBOSE="false"

# Component validation results
declare -A COMPONENT_STATUS=(
    ["deployment_scripts"]=0
    ["configuration_files"]=0
    ["kubernetes_manifests"]=0
    ["monitoring_system"]=0
    ["security_system"]=0
    ["testing_system"]=0
    ["documentation"]=0
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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$INTEGRATION_LOG"
    
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

System Integration Validator - Comprehensive validation of deployment system integration

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --scope SCOPE          Validation scope: quick|standard|comprehensive (default: comprehensive)
    --no-performance       Skip performance tests
    --no-security          Skip security tests
    --no-monitoring        Skip monitoring tests
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --help                 Show this help message

VALIDATION SCOPES:
    quick          - Essential integration validation
    standard       - Standard integration validation with basic tests
    comprehensive  - Complete integration validation with all tests

EXAMPLES:
    # Comprehensive system integration validation
    $0 --environment production --scope comprehensive

    # Quick validation without performance tests
    $0 --scope quick --no-performance --verbose

    # Standard validation for staging
    $0 --environment staging --scope standard

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
            --scope)
                VALIDATION_SCOPE="$2"
                shift 2
                ;;
            --no-performance)
                INCLUDE_PERFORMANCE_TESTS="false"
                shift
                ;;
            --no-security)
                INCLUDE_SECURITY_TESTS="false"
                shift
                ;;
            --no-monitoring)
                INCLUDE_MONITORING_TESTS="false"
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

# Initialize integration validator
initialize_validator() {
    log "INFO" "🔗 Initializing System Integration Validator v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Validation Scope: $VALIDATION_SCOPE"
    log "INFO" "Include Performance Tests: $INCLUDE_PERFORMANCE_TESTS"
    log "INFO" "Include Security Tests: $INCLUDE_SECURITY_TESTS"
    log "INFO" "Include Monitoring Tests: $INCLUDE_MONITORING_TESTS"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Validate parameters
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$VALIDATION_SCOPE" =~ ^(quick|standard|comprehensive)$ ]]; then
        log "ERROR" "Invalid validation scope: $VALIDATION_SCOPE"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("kubectl" "jq" "curl" "yq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    log "SUCCESS" "System integration validator initialized successfully"
}

# Validate deployment scripts
validate_deployment_scripts() {
    log "INFO" "📜 Validating deployment scripts..."
    
    local scripts_valid=true
    local required_scripts=(
        "master-deploy.sh"
        "deploy-application.sh"
        "deploy-monitoring.sh"
        "deployment-testing-master.sh"
        "deployment-security-compliance.sh"
        "deployment-validation-framework.sh"
        "production-deployment-finalizer.sh"
    )
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate deployment scripts"
        COMPONENT_STATUS["deployment_scripts"]=1
        return 0
    fi
    
    for script in "${required_scripts[@]}"; do
        local script_path="$SCRIPTS_DIR/$script"
        
        if [[ -f "$script_path" ]]; then
            # Check if script is executable
            if [[ -x "$script_path" ]]; then
                log "SUCCESS" "Script validated: $script"
            else
                log "WARNING" "Script not executable: $script"
                chmod +x "$script_path"
                log "INFO" "Made script executable: $script"
            fi
            
            # Basic syntax validation
            if bash -n "$script_path" 2>/dev/null; then
                log "SUCCESS" "Script syntax valid: $script"
            else
                log "ERROR" "Script syntax invalid: $script"
                scripts_valid=false
            fi
        else
            log "ERROR" "Required script missing: $script"
            scripts_valid=false
        fi
    done
    
    COMPONENT_STATUS["deployment_scripts"]=$([ "$scripts_valid" == "true" ] && echo 1 || echo 0)
    
    if [[ "$scripts_valid" == "true" ]]; then
        log "SUCCESS" "Deployment scripts validation completed successfully"
        return 0
    else
        log "ERROR" "Deployment scripts validation failed"
        return 1
    fi
}

# Validate configuration files
validate_configuration_files() {
    log "INFO" "⚙️  Validating configuration files..."
    
    local configs_valid=true
    local required_configs=(
        "deployment-config.yaml"
        "monitoring-config.yaml"
        "security-compliance-config.yaml"
        "deployment-testing-config.yaml"
        "validation-config.yaml"
    )
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate configuration files"
        COMPONENT_STATUS["configuration_files"]=1
        return 0
    fi
    
    for config in "${required_configs[@]}"; do
        local config_path="$CONFIG_DIR/$config"
        
        if [[ -f "$config_path" ]]; then
            # Validate YAML syntax
            if yq eval '.' "$config_path" >/dev/null 2>&1; then
                log "SUCCESS" "Configuration valid: $config"
            else
                log "ERROR" "Configuration syntax invalid: $config"
                configs_valid=false
            fi
        else
            log "ERROR" "Required configuration missing: $config"
            configs_valid=false
        fi
    done
    
    COMPONENT_STATUS["configuration_files"]=$([ "$configs_valid" == "true" ] && echo 1 || echo 0)
    
    if [[ "$configs_valid" == "true" ]]; then
        log "SUCCESS" "Configuration files validation completed successfully"
        return 0
    else
        log "ERROR" "Configuration files validation failed"
        return 1
    fi
}

# Validate Kubernetes manifests
validate_kubernetes_manifests() {
    log "INFO" "☸️  Validating Kubernetes manifests..."
    
    local manifests_valid=true
    local manifest_dir="$INFRASTRUCTURE_DIR/kubernetes"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate Kubernetes manifests"
        COMPONENT_STATUS["kubernetes_manifests"]=1
        return 0
    fi
    
    if [[ ! -d "$manifest_dir" ]]; then
        log "ERROR" "Kubernetes manifests directory not found: $manifest_dir"
        COMPONENT_STATUS["kubernetes_manifests"]=0
        return 1
    fi
    
    # Find all YAML files in the kubernetes directory
    local manifest_files
    manifest_files=$(find "$manifest_dir" -name "*.yaml" -o -name "*.yml")
    
    if [[ -z "$manifest_files" ]]; then
        log "ERROR" "No Kubernetes manifest files found"
        manifests_valid=false
    else
        while IFS= read -r manifest; do
            # Validate YAML syntax
            if yq eval '.' "$manifest" >/dev/null 2>&1; then
                # Validate Kubernetes manifest
                if kubectl apply --dry-run=client -f "$manifest" >/dev/null 2>&1; then
                    log "SUCCESS" "Manifest valid: $(basename "$manifest")"
                else
                    log "ERROR" "Manifest Kubernetes validation failed: $(basename "$manifest")"
                    manifests_valid=false
                fi
            else
                log "ERROR" "Manifest YAML syntax invalid: $(basename "$manifest")"
                manifests_valid=false
            fi
        done <<< "$manifest_files"
    fi
    
    COMPONENT_STATUS["kubernetes_manifests"]=$([ "$manifests_valid" == "true" ] && echo 1 || echo 0)
    
    if [[ "$manifests_valid" == "true" ]]; then
        log "SUCCESS" "Kubernetes manifests validation completed successfully"
        return 0
    else
        log "ERROR" "Kubernetes manifests validation failed"
        return 1
    fi
}

# Validate monitoring system integration
validate_monitoring_system() {
    log "INFO" "📊 Validating monitoring system integration..."
    
    if [[ "$INCLUDE_MONITORING_TESTS" != "true" ]]; then
        log "INFO" "Monitoring tests skipped by user request"
        COMPONENT_STATUS["monitoring_system"]=1
        return 0
    fi
    
    local monitoring_valid=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate monitoring system"
        COMPONENT_STATUS["monitoring_system"]=1
        return 0
    fi
    
    # Check if monitoring script exists and is executable
    local monitoring_script="$SCRIPTS_DIR/deploy-monitoring.sh"
    if [[ -x "$monitoring_script" ]]; then
        log "SUCCESS" "Monitoring deployment script found and executable"
    else
        log "ERROR" "Monitoring deployment script not found or not executable"
        monitoring_valid=false
    fi
    
    # Check monitoring configuration
    local monitoring_config="$CONFIG_DIR/monitoring-config.yaml"
    if [[ -f "$monitoring_config" ]]; then
        if yq eval '.monitoring.prometheus.enabled' "$monitoring_config" >/dev/null 2>&1; then
            log "SUCCESS" "Monitoring configuration valid"
        else
            log "ERROR" "Monitoring configuration invalid"
            monitoring_valid=false
        fi
    else
        log "ERROR" "Monitoring configuration not found"
        monitoring_valid=false
    fi
    
    COMPONENT_STATUS["monitoring_system"]=$([ "$monitoring_valid" == "true" ] && echo 1 || echo 0)
    
    if [[ "$monitoring_valid" == "true" ]]; then
        log "SUCCESS" "Monitoring system validation completed successfully"
        return 0
    else
        log "ERROR" "Monitoring system validation failed"
        return 1
    fi
}

# Validate security system integration
validate_security_system() {
    log "INFO" "🔒 Validating security system integration..."
    
    if [[ "$INCLUDE_SECURITY_TESTS" != "true" ]]; then
        log "INFO" "Security tests skipped by user request"
        COMPONENT_STATUS["security_system"]=1
        return 0
    fi
    
    local security_valid=true
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate security system"
        COMPONENT_STATUS["security_system"]=1
        return 0
    fi
    
    # Check security scripts
    local security_scripts=(
        "deployment-security-scanner.sh"
        "security-policy-enforcer.sh"
        "vulnerability-assessment.sh"
        "deployment-security-compliance.sh"
    )
    
    for script in "${security_scripts[@]}"; do
        local script_path="$SCRIPTS_DIR/$script"
        if [[ -x "$script_path" ]]; then
            log "SUCCESS" "Security script found: $script"
        else
            log "ERROR" "Security script missing or not executable: $script"
            security_valid=false
        fi
    done
    
    # Check security configuration
    local security_config="$CONFIG_DIR/security-compliance-config.yaml"
    if [[ -f "$security_config" ]]; then
        if yq eval '.security.vulnerability_scanning.enabled' "$security_config" >/dev/null 2>&1; then
            log "SUCCESS" "Security configuration valid"
        else
            log "ERROR" "Security configuration invalid"
            security_valid=false
        fi
    else
        log "ERROR" "Security configuration not found"
        security_valid=false
    fi
    
    COMPONENT_STATUS["security_system"]=$([ "$security_valid" == "true" ] && echo 1 || echo 0)
    
    if [[ "$security_valid" == "true" ]]; then
        log "SUCCESS" "Security system validation completed successfully"
        return 0
    else
        log "ERROR" "Security system validation failed"
        return 1
    fi
}

# Generate integration validation report
generate_integration_report() {
    log "INFO" "📊 Generating integration validation report..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would generate integration report"
        return 0
    fi
    
    # Calculate overall success rate
    local total_components=${#COMPONENT_STATUS[@]}
    local successful_components=0
    
    for status in "${COMPONENT_STATUS[@]}"; do
        if [[ $status -eq 1 ]]; then
            successful_components=$((successful_components + 1))
        fi
    done
    
    local success_rate=$((successful_components * 100 / total_components))
    local overall_status="passed"
    
    if [[ $success_rate -lt 100 ]]; then
        overall_status="failed"
    fi
    
    # Create comprehensive integration report
    cat > "$VALIDATION_REPORT" << EOF
{
  "report_metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "validation_scope": "$VALIDATION_SCOPE",
    "version": "$SCRIPT_VERSION"
  },
  "validation_configuration": {
    "performance_tests": $INCLUDE_PERFORMANCE_TESTS,
    "security_tests": $INCLUDE_SECURITY_TESTS,
    "monitoring_tests": $INCLUDE_MONITORING_TESTS
  },
  "component_validation": {
    "deployment_scripts": ${COMPONENT_STATUS["deployment_scripts"]},
    "configuration_files": ${COMPONENT_STATUS["configuration_files"]},
    "kubernetes_manifests": ${COMPONENT_STATUS["kubernetes_manifests"]},
    "monitoring_system": ${COMPONENT_STATUS["monitoring_system"]},
    "security_system": ${COMPONENT_STATUS["security_system"]},
    "testing_system": ${COMPONENT_STATUS["testing_system"]},
    "documentation": ${COMPONENT_STATUS["documentation"]}
  },
  "validation_summary": {
    "total_components": $total_components,
    "successful_components": $successful_components,
    "success_rate_percent": $success_rate,
    "overall_status": "$overall_status"
  },
  "recommendations": [
    "Address any failed component validations",
    "Ensure all scripts are executable and syntactically correct",
    "Validate configuration files regularly",
    "Keep Kubernetes manifests up to date",
    "Maintain monitoring and security system integration"
  ]
}
EOF
    
    log "SUCCESS" "Integration validation report generated: $VALIDATION_REPORT"
    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_validator
    
    local exit_code=0
    local validations_completed=0
    
    log "INFO" "🚀 Starting system integration validation..."
    
    # Execute validations based on scope
    case "$VALIDATION_SCOPE" in
        "quick")
            log "INFO" "Executing quick integration validation..."
            validate_deployment_scripts || exit_code=1
            validate_configuration_files || exit_code=1
            validations_completed=2
            ;;
        "standard")
            log "INFO" "Executing standard integration validation..."
            validate_deployment_scripts || exit_code=1
            validate_configuration_files || exit_code=1
            validate_kubernetes_manifests || exit_code=1
            validate_monitoring_system || exit_code=1
            validations_completed=4
            ;;
        "comprehensive")
            log "INFO" "Executing comprehensive integration validation..."
            validate_deployment_scripts || exit_code=1
            validate_configuration_files || exit_code=1
            validate_kubernetes_manifests || exit_code=1
            validate_monitoring_system || exit_code=1
            validate_security_system || exit_code=1
            validations_completed=5
            ;;
    esac
    
    # Generate integration report
    generate_integration_report || exit_code=1
    
    # Final status
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ System integration validation completed successfully"
        log "INFO" "Validations completed: $validations_completed"
        log "INFO" "Integration report: $VALIDATION_REPORT"
    else
        log "ERROR" "❌ System integration validation completed with issues"
        log "INFO" "Validations attempted: $validations_completed"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"
