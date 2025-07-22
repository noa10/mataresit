#!/bin/bash

# Infrastructure Configuration Validation Script
# Validates Kubernetes manifests, Terraform configurations, and environment setup
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly VALIDATION_LOG="$PROJECT_ROOT/logs/infrastructure/validation-$(date +%Y%m%d-%H%M%S).log"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
VERBOSE=false
QUICK_CHECK=false

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0
VALIDATION_PASSED=0

# Initialize logging
init_logging() {
    mkdir -p "$(dirname "$VALIDATION_LOG")"
    touch "$VALIDATION_LOG"
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
            ((VALIDATION_PASSED++))
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$VALIDATION_LOG"
            ((VALIDATION_WARNINGS++))
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$VALIDATION_LOG"
            ((VALIDATION_ERRORS++))
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${BLUE}[$timestamp] 🔍${NC} $message" | tee -a "$VALIDATION_LOG"
            fi
            ;;
    esac
}

# Validate Kubernetes manifests
validate_kubernetes_manifests() {
    log "INFO" "🔍 Validating Kubernetes manifests..."
    
    local kubernetes_dir="$INFRASTRUCTURE_DIR/kubernetes"
    if [[ ! -d "$kubernetes_dir" ]]; then
        log "ERROR" "Kubernetes directory not found: $kubernetes_dir"
        return 1
    fi
    
    # Core manifests
    local core_manifests=(
        "$kubernetes_dir/namespace.yaml"
        "$kubernetes_dir/configmap.yaml"
        "$kubernetes_dir/deployment.yaml"
        "$kubernetes_dir/service.yaml"
        "$kubernetes_dir/hpa.yaml"
    )
    
    for manifest in "${core_manifests[@]}"; do
        if [[ -f "$manifest" ]]; then
            local filename=$(basename "$manifest")
            log "DEBUG" "Validating manifest: $filename"
            
            # Validate YAML syntax
            if ! yq eval '.' "$manifest" &> /dev/null; then
                log "ERROR" "Invalid YAML syntax in: $filename"
                continue
            fi
            
            # Validate with kubectl
            if kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
                log "SUCCESS" "Valid Kubernetes manifest: $filename"
            else
                log "ERROR" "Invalid Kubernetes manifest: $filename"
            fi
        else
            log "WARNING" "Core manifest not found: $(basename "$manifest")"
        fi
    done
    
    # Worker manifests
    local worker_dir="$kubernetes_dir/workers"
    if [[ -d "$worker_dir" ]]; then
        local worker_manifests=(
            "$worker_dir/embedding-worker-configmap.yaml"
            "$worker_dir/embedding-queue-worker-deployment.yaml"
            "$worker_dir/embedding-worker-hpa.yaml"
        )
        
        for manifest in "${worker_manifests[@]}"; do
            if [[ -f "$manifest" ]]; then
                local filename=$(basename "$manifest")
                log "DEBUG" "Validating worker manifest: $filename"
                
                if kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
                    log "SUCCESS" "Valid worker manifest: $filename"
                else
                    log "ERROR" "Invalid worker manifest: $filename"
                fi
            fi
        done
    fi
    
    return 0
}

# Validate Terraform configuration
validate_terraform_config() {
    log "INFO" "🔍 Validating Terraform configuration..."
    
    local terraform_dir="$INFRASTRUCTURE_DIR/terraform"
    if [[ ! -d "$terraform_dir" ]]; then
        log "WARNING" "Terraform directory not found: $terraform_dir"
        return 0
    fi
    
    if ! command -v terraform &> /dev/null; then
        log "WARNING" "Terraform not installed - skipping Terraform validation"
        return 0
    fi
    
    # Change to Terraform directory
    local current_dir=$(pwd)
    cd "$terraform_dir"
    
    # Validate Terraform syntax
    log "DEBUG" "Validating Terraform syntax..."
    if terraform validate; then
        log "SUCCESS" "Terraform configuration is valid"
    else
        log "ERROR" "Terraform configuration validation failed"
        cd "$current_dir"
        return 1
    fi
    
    # Format check
    if terraform fmt -check; then
        log "SUCCESS" "Terraform formatting is correct"
    else
        log "WARNING" "Terraform files need formatting (run: terraform fmt)"
    fi
    
    cd "$current_dir"
    return 0
}

# Validate environment configuration
validate_environment_config() {
    log "INFO" "🔍 Validating environment configuration..."
    
    # Check deployment configuration
    local deployment_config="$INFRASTRUCTURE_DIR/config/deployment-config.yaml"
    if [[ -f "$deployment_config" ]]; then
        if yq eval '.' "$deployment_config" &> /dev/null; then
            log "SUCCESS" "Deployment configuration is valid YAML"
            
            # Check environment-specific settings
            local env_exists
            env_exists=$(yq eval ".environments.$ENVIRONMENT" "$deployment_config" 2>/dev/null)
            if [[ "$env_exists" != "null" ]]; then
                log "SUCCESS" "Environment '$ENVIRONMENT' configuration found"
            else
                log "ERROR" "Environment '$ENVIRONMENT' not configured"
            fi
        else
            log "ERROR" "Invalid YAML in deployment configuration"
        fi
    else
        log "WARNING" "Deployment configuration not found: $deployment_config"
    fi
    
    # Check environment variables file
    local env_file="$INFRASTRUCTURE_DIR/env/.env.$ENVIRONMENT"
    if [[ -f "$env_file" ]]; then
        log "SUCCESS" "Environment file found: .env.$ENVIRONMENT"
        
        # Check for required variables
        local required_vars=(
            "SUPABASE_URL"
            "SUPABASE_ANON_KEY"
            "SUPABASE_SERVICE_ROLE_KEY"
            "GEMINI_API_KEY"
        )
        
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" "$env_file"; then
                log "DEBUG" "Required variable found: $var"
            else
                log "WARNING" "Required variable missing in env file: $var"
            fi
        done
    else
        log "WARNING" "Environment file not found: .env.$ENVIRONMENT"
    fi
    
    return 0
}

# Validate secrets configuration
validate_secrets_config() {
    log "INFO" "🔍 Validating secrets configuration..."
    
    local secrets_manifest="$INFRASTRUCTURE_DIR/kubernetes/secrets.yaml"
    if [[ -f "$secrets_manifest" ]]; then
        if yq eval '.' "$secrets_manifest" &> /dev/null; then
            log "SUCCESS" "Secrets manifest is valid YAML"
            
            # Check for required secret types
            local required_secrets=(
                "supabase-secrets"
                "ai-secrets"
                "security-secrets"
            )
            
            for secret in "${required_secrets[@]}"; do
                if grep -q "name: $secret" "$secrets_manifest"; then
                    log "DEBUG" "Secret template found: $secret"
                else
                    log "WARNING" "Secret template missing: $secret"
                fi
            done
        else
            log "ERROR" "Invalid YAML in secrets manifest"
        fi
    else
        log "WARNING" "Secrets manifest not found"
    fi
    
    # Check secrets setup script
    local secrets_script="$SCRIPT_DIR/setup-secrets.sh"
    if [[ -f "$secrets_script" ]] && [[ -x "$secrets_script" ]]; then
        log "SUCCESS" "Secrets setup script is available and executable"
    else
        log "ERROR" "Secrets setup script not found or not executable"
    fi
    
    return 0
}

# Validate monitoring configuration
validate_monitoring_config() {
    log "INFO" "🔍 Validating monitoring configuration..."
    
    local monitoring_dir="$INFRASTRUCTURE_DIR/monitoring"
    if [[ ! -d "$monitoring_dir" ]]; then
        log "WARNING" "Monitoring directory not found: $monitoring_dir"
        return 0
    fi
    
    # Check monitoring manifests
    local monitoring_manifests=(
        "$monitoring_dir/prometheus-config.yaml"
        "$monitoring_dir/grafana-config.yaml"
    )
    
    for manifest in "${monitoring_manifests[@]}"; do
        if [[ -f "$manifest" ]]; then
            local filename=$(basename "$manifest")
            if yq eval '.' "$manifest" &> /dev/null; then
                log "SUCCESS" "Valid monitoring config: $filename"
            else
                log "ERROR" "Invalid YAML in monitoring config: $filename"
            fi
        else
            log "WARNING" "Monitoring config not found: $(basename "$manifest")"
        fi
    done
    
    return 0
}

# Validate cluster connectivity
validate_cluster_connectivity() {
    if [[ "$QUICK_CHECK" == "true" ]]; then
        log "INFO" "Skipping cluster connectivity check (quick mode)"
        return 0
    fi
    
    log "INFO" "🔍 Validating cluster connectivity..."
    
    # Check kubectl connectivity
    if kubectl cluster-info &> /dev/null; then
        log "SUCCESS" "Kubernetes cluster is accessible"
        
        # Check namespace
        if kubectl get namespace "$NAMESPACE" &> /dev/null; then
            log "SUCCESS" "Namespace '$NAMESPACE' exists"
        else
            log "WARNING" "Namespace '$NAMESPACE' does not exist (will be created)"
        fi
        
        # Check RBAC permissions
        if kubectl auth can-i create deployments -n "$NAMESPACE" &> /dev/null; then
            log "SUCCESS" "Sufficient RBAC permissions"
        else
            log "WARNING" "May have insufficient RBAC permissions"
        fi
    else
        log "ERROR" "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    return 0
}

# Generate validation report
generate_validation_report() {
    log "INFO" "📊 Generating validation report..."
    
    local report_file="$PROJECT_ROOT/logs/infrastructure/validation-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "validation_summary": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "namespace": "$NAMESPACE",
        "total_checks": $((VALIDATION_PASSED + VALIDATION_WARNINGS + VALIDATION_ERRORS)),
        "passed": $VALIDATION_PASSED,
        "warnings": $VALIDATION_WARNINGS,
        "errors": $VALIDATION_ERRORS,
        "success_rate": $(echo "scale=2; $VALIDATION_PASSED * 100 / ($VALIDATION_PASSED + $VALIDATION_WARNINGS + $VALIDATION_ERRORS)" | bc -l 2>/dev/null || echo "0")
    },
    "validation_categories": {
        "kubernetes_manifests": true,
        "terraform_config": true,
        "environment_config": true,
        "secrets_config": true,
        "monitoring_config": true,
        "cluster_connectivity": $([ "$QUICK_CHECK" == "true" ] && echo "false" || echo "true")
    }
}
EOF
    
    log "SUCCESS" "Validation report generated: $report_file"
}

# Show help
show_help() {
    cat << EOF
Infrastructure Configuration Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -e, --environment ENV   Target environment (default: production)
    -n, --namespace NS      Kubernetes namespace (default: paperless-maverick)
    -v, --verbose           Enable verbose logging
    -q, --quick             Quick validation (skip cluster connectivity)

EXAMPLES:
    $0                      # Full validation
    $0 --quick              # Quick validation without cluster checks
    $0 --verbose            # Verbose validation with debug info

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
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quick)
                QUICK_CHECK=true
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
    
    log "INFO" "🔍 Starting infrastructure configuration validation"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Quick check: $QUICK_CHECK"
    log "INFO" "=================================================="
    
    # Run validation checks
    validate_kubernetes_manifests
    validate_terraform_config
    validate_environment_config
    validate_secrets_config
    validate_monitoring_config
    validate_cluster_connectivity
    
    # Generate report
    generate_validation_report
    
    # Summary
    log "INFO" "=================================================="
    log "INFO" "Validation Summary:"
    log "INFO" "  - Total Checks: $((VALIDATION_PASSED + VALIDATION_WARNINGS + VALIDATION_ERRORS))"
    log "INFO" "  - Passed: $VALIDATION_PASSED"
    log "INFO" "  - Warnings: $VALIDATION_WARNINGS"
    log "INFO" "  - Errors: $VALIDATION_ERRORS"
    log "INFO" "=================================================="
    
    if [[ $VALIDATION_ERRORS -gt 0 ]]; then
        log "ERROR" "Validation failed with $VALIDATION_ERRORS errors"
        exit 1
    elif [[ $VALIDATION_WARNINGS -gt 0 ]]; then
        log "WARNING" "Validation completed with $VALIDATION_WARNINGS warnings"
        exit 0
    else
        log "SUCCESS" "All validations passed successfully"
        exit 0
    fi
}

# Execute main function
main "$@"
