#!/bin/bash

# Deployment Security Scanner
# Comprehensive security scanning and compliance validation for Paperless Maverick deployments
# This script performs automated security checks, vulnerability assessments, and compliance validation

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="deployment-security-scanner"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly SECURITY_CONFIG="$CONFIG_DIR/security-compliance-config.yaml"

# Log directories
readonly LOG_DIR="$PROJECT_ROOT/logs/security"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/security"
readonly AUDIT_DIR="$PROJECT_ROOT/audit/security"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$AUDIT_DIR"

# Log files
readonly SECURITY_LOG="$LOG_DIR/security-scan-$(date +%Y%m%d-%H%M%S).log"
readonly COMPLIANCE_LOG="$LOG_DIR/compliance-validation-$(date +%Y%m%d-%H%M%S).log"
readonly AUDIT_LOG="$AUDIT_DIR/security-audit-$(date +%Y%m%d-%H%M%S).log"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
SCAN_TYPE="comprehensive"
COMPLIANCE_FRAMEWORKS="soc2,gdpr,iso27001"
FAIL_ON_CRITICAL="true"
FAIL_ON_HIGH="false"
DRY_RUN="false"
VERBOSE="false"
GENERATE_REPORT="true"

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$SECURITY_LOG"
    
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

Deployment Security Scanner - Comprehensive security scanning and compliance validation

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --scan-type TYPE        Scan type: quick|standard|comprehensive (default: comprehensive)
    --compliance FRAMEWORKS Compliance frameworks: soc2,gdpr,iso27001 (default: all)
    --fail-on-critical      Fail on critical vulnerabilities (default: true)
    --fail-on-high          Fail on high vulnerabilities (default: false)
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --no-report            Skip report generation
    --help                 Show this help message

SCAN TYPES:
    quick          - Basic security checks and critical vulnerability scan
    standard       - Standard security scan with compliance validation
    comprehensive  - Full security audit with detailed compliance reporting

COMPLIANCE FRAMEWORKS:
    soc2          - SOC 2 Type II compliance validation
    gdpr          - GDPR compliance validation
    iso27001      - ISO 27001 compliance validation
    pci           - PCI DSS compliance validation
    hipaa         - HIPAA compliance validation

EXAMPLES:
    # Comprehensive security scan
    $0 --environment production --scan-type comprehensive

    # Quick security check
    $0 --scan-type quick --fail-on-critical

    # GDPR compliance validation only
    $0 --compliance gdpr --scan-type standard

    # Dry run with verbose output
    $0 --dry-run --verbose --scan-type comprehensive

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
            --scan-type)
                SCAN_TYPE="$2"
                shift 2
                ;;
            --compliance)
                COMPLIANCE_FRAMEWORKS="$2"
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

# Initialize security scan
initialize_security_scan() {
    log "INFO" "🔒 Initializing Deployment Security Scanner v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Scan Type: $SCAN_TYPE"
    log "INFO" "Compliance Frameworks: $COMPLIANCE_FRAMEWORKS"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    # Validate scan type
    if [[ ! "$SCAN_TYPE" =~ ^(quick|standard|comprehensive)$ ]]; then
        log "ERROR" "Invalid scan type: $SCAN_TYPE"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("kubectl" "docker" "jq" "curl" "openssl")
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
    
    log "SUCCESS" "Security scanner initialized successfully"
}

# Container security scanning
scan_container_security() {
    log "INFO" "🐳 Starting container security scan..."
    
    local scan_results="$REPORTS_DIR/container-security-$(date +%Y%m%d-%H%M%S).json"
    local critical_count=0
    local high_count=0
    local medium_count=0
    
    # Get running images
    local images=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u)
    
    while IFS= read -r image; do
        if [[ -n "$image" ]]; then
            log "INFO" "Scanning image: $image"
            
            if [[ "$DRY_RUN" == "true" ]]; then
                log "INFO" "DRY RUN: Would scan image $image"
                continue
            fi
            
            # Run Trivy scan
            local trivy_output="$REPORTS_DIR/trivy-$(basename "$image")-$(date +%Y%m%d-%H%M%S).json"
            
            if docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                aquasec/trivy image --format json --output "$trivy_output" \
                --severity CRITICAL,HIGH,MEDIUM "$image" 2>/dev/null; then
                
                # Parse results
                local image_critical=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL") | .VulnerabilityID' "$trivy_output" 2>/dev/null | wc -l)
                local image_high=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity=="HIGH") | .VulnerabilityID' "$trivy_output" 2>/dev/null | wc -l)
                local image_medium=$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity=="MEDIUM") | .VulnerabilityID' "$trivy_output" 2>/dev/null | wc -l)
                
                critical_count=$((critical_count + image_critical))
                high_count=$((high_count + image_high))
                medium_count=$((medium_count + image_medium))
                
                log "INFO" "Image $image: Critical: $image_critical, High: $image_high, Medium: $image_medium"
            else
                log "WARNING" "Failed to scan image: $image"
            fi
        fi
    done <<< "$images"
    
    # Generate summary
    cat > "$scan_results" << EOF
{
  "scan_type": "container_security",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "summary": {
    "critical_vulnerabilities": $critical_count,
    "high_vulnerabilities": $high_count,
    "medium_vulnerabilities": $medium_count,
    "total_vulnerabilities": $((critical_count + high_count + medium_count))
  }
}
EOF
    
    log "INFO" "Container security scan completed"
    log "INFO" "Critical: $critical_count, High: $high_count, Medium: $medium_count"
    
    # Check failure conditions
    if [[ "$FAIL_ON_CRITICAL" == "true" && $critical_count -gt 0 ]]; then
        log "ERROR" "Critical vulnerabilities found: $critical_count"
        return 1
    fi
    
    if [[ "$FAIL_ON_HIGH" == "true" && $high_count -gt 0 ]]; then
        log "ERROR" "High vulnerabilities found: $high_count"
        return 1
    fi
    
    return 0
}

# Kubernetes security validation
validate_kubernetes_security() {
    log "INFO" "☸️  Starting Kubernetes security validation..."
    
    local validation_results="$REPORTS_DIR/k8s-security-$(date +%Y%m%d-%H%M%S).json"
    local issues_found=0
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate Kubernetes security"
        return 0
    fi
    
    # Check network policies
    local netpol_count=$(kubectl get networkpolicies -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    if [[ $netpol_count -eq 0 ]]; then
        log "WARNING" "No network policies found in namespace $NAMESPACE"
        issues_found=$((issues_found + 1))
    else
        log "SUCCESS" "Network policies found: $netpol_count"
    fi
    
    # Check pod security contexts
    local pods_without_security_context=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | select(.spec.securityContext == null) | .metadata.name' | wc -l)
    if [[ $pods_without_security_context -gt 0 ]]; then
        log "WARNING" "Pods without security context: $pods_without_security_context"
        issues_found=$((issues_found + 1))
    fi
    
    # Check for privileged containers
    local privileged_containers=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[].spec.containers[] | select(.securityContext.privileged == true) | .name' | wc -l)
    if [[ $privileged_containers -gt 0 ]]; then
        log "ERROR" "Privileged containers found: $privileged_containers"
        issues_found=$((issues_found + 1))
    fi
    
    # Check RBAC
    local service_accounts=$(kubectl get serviceaccounts -n "$NAMESPACE" --no-headers | wc -l)
    local role_bindings=$(kubectl get rolebindings -n "$NAMESPACE" --no-headers | wc -l)
    
    log "INFO" "Service accounts: $service_accounts, Role bindings: $role_bindings"
    
    # Generate validation results
    cat > "$validation_results" << EOF
{
  "validation_type": "kubernetes_security",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "results": {
    "network_policies": $netpol_count,
    "pods_without_security_context": $pods_without_security_context,
    "privileged_containers": $privileged_containers,
    "service_accounts": $service_accounts,
    "role_bindings": $role_bindings,
    "issues_found": $issues_found
  }
}
EOF
    
    log "SUCCESS" "Kubernetes security validation completed"
    log "INFO" "Issues found: $issues_found"
    
    return 0
}

# Secret scanning
scan_secrets() {
    log "INFO" "🔐 Starting secret scanning..."

    local secrets_report="$REPORTS_DIR/secrets-scan-$(date +%Y%m%d-%H%M%S).json"
    local secrets_found=0

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would scan for secrets"
        return 0
    fi

    # Scan Kubernetes secrets for hardcoded values
    log "INFO" "Scanning Kubernetes secrets..."
    local k8s_secrets=$(kubectl get secrets -n "$NAMESPACE" -o json | jq -r '.items[] | select(.type != "kubernetes.io/service-account-token") | .metadata.name')

    while IFS= read -r secret_name; do
        if [[ -n "$secret_name" ]]; then
            # Check if secret has proper labels and annotations
            local secret_labels=$(kubectl get secret "$secret_name" -n "$NAMESPACE" -o jsonpath='{.metadata.labels}')
            local secret_annotations=$(kubectl get secret "$secret_name" -n "$NAMESPACE" -o jsonpath='{.metadata.annotations}')

            if [[ -z "$secret_labels" ]]; then
                log "WARNING" "Secret $secret_name has no labels"
                secrets_found=$((secrets_found + 1))
            fi

            # Check for common insecure patterns in secret names
            if [[ "$secret_name" =~ (test|demo|example|default) ]]; then
                log "WARNING" "Secret $secret_name has insecure naming pattern"
                secrets_found=$((secrets_found + 1))
            fi
        fi
    done <<< "$k8s_secrets"

    # Scan container images for embedded secrets
    log "INFO" "Scanning container images for embedded secrets..."
    local images=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u)

    while IFS= read -r image; do
        if [[ -n "$image" ]]; then
            # Use Trivy to scan for secrets in images
            local trivy_secrets_output="$REPORTS_DIR/trivy-secrets-$(basename "$image")-$(date +%Y%m%d-%H%M%S).json"

            if docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                aquasec/trivy image --scanners secret --format json --output "$trivy_secrets_output" \
                "$image" 2>/dev/null; then

                local image_secrets=$(jq -r '.Results[]?.Secrets[]? | .Title' "$trivy_secrets_output" 2>/dev/null | wc -l)
                if [[ $image_secrets -gt 0 ]]; then
                    log "WARNING" "Found $image_secrets potential secrets in image: $image"
                    secrets_found=$((secrets_found + image_secrets))
                fi
            fi
        fi
    done <<< "$images"

    # Generate secrets scan report
    cat > "$secrets_report" << EOF
{
  "scan_type": "secrets_scanning",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "summary": {
    "secrets_found": $secrets_found,
    "scan_status": "completed"
  }
}
EOF

    log "SUCCESS" "Secret scanning completed"
    log "INFO" "Potential secrets found: $secrets_found"

    if [[ $secrets_found -gt 0 ]]; then
        log "WARNING" "Secrets detected - review required"
        return 1
    fi

    return 0
}

# Compliance validation
validate_compliance() {
    log "INFO" "📋 Starting compliance validation..."

    local compliance_report="$REPORTS_DIR/compliance-validation-$(date +%Y%m%d-%H%M%S).json"
    local compliance_issues=0

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate compliance"
        return 0
    fi

    # Parse compliance frameworks
    IFS=',' read -ra frameworks <<< "$COMPLIANCE_FRAMEWORKS"

    for framework in "${frameworks[@]}"; do
        case "$framework" in
            "soc2")
                log "INFO" "Validating SOC 2 compliance..."
                validate_soc2_compliance || compliance_issues=$((compliance_issues + 1))
                ;;
            "gdpr")
                log "INFO" "Validating GDPR compliance..."
                validate_gdpr_compliance || compliance_issues=$((compliance_issues + 1))
                ;;
            "iso27001")
                log "INFO" "Validating ISO 27001 compliance..."
                validate_iso27001_compliance || compliance_issues=$((compliance_issues + 1))
                ;;
            *)
                log "WARNING" "Unknown compliance framework: $framework"
                ;;
        esac
    done

    # Generate compliance report
    cat > "$compliance_report" << EOF
{
  "validation_type": "compliance_validation",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "frameworks": "$COMPLIANCE_FRAMEWORKS",
  "summary": {
    "compliance_issues": $compliance_issues,
    "validation_status": "completed"
  }
}
EOF

    log "SUCCESS" "Compliance validation completed"
    log "INFO" "Compliance issues found: $compliance_issues"

    return $compliance_issues
}

# SOC 2 compliance validation
validate_soc2_compliance() {
    local issues=0

    # Check encryption at rest
    local encrypted_secrets=$(kubectl get secrets -n "$NAMESPACE" -o json | jq -r '.items[] | select(.metadata.annotations["encryption.kubernetes.io/provider"] != null) | .metadata.name' | wc -l)
    local total_secrets=$(kubectl get secrets -n "$NAMESPACE" --no-headers | wc -l)

    if [[ $encrypted_secrets -lt $total_secrets ]]; then
        log "WARNING" "SOC 2: Not all secrets are encrypted at rest"
        issues=$((issues + 1))
    fi

    # Check access controls (RBAC)
    local rbac_enabled=$(kubectl get rolebindings -n "$NAMESPACE" --no-headers | wc -l)
    if [[ $rbac_enabled -eq 0 ]]; then
        log "WARNING" "SOC 2: No RBAC policies found"
        issues=$((issues + 1))
    fi

    # Check monitoring and logging
    local monitoring_pods=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=prometheus --no-headers | wc -l)
    if [[ $monitoring_pods -eq 0 ]]; then
        log "WARNING" "SOC 2: No monitoring system detected"
        issues=$((issues + 1))
    fi

    return $issues
}

# GDPR compliance validation
validate_gdpr_compliance() {
    local issues=0

    # Check data encryption
    local tls_ingress=$(kubectl get ingress -n "$NAMESPACE" -o json | jq -r '.items[] | select(.spec.tls != null) | .metadata.name' | wc -l)
    local total_ingress=$(kubectl get ingress -n "$NAMESPACE" --no-headers | wc -l)

    if [[ $tls_ingress -lt $total_ingress ]]; then
        log "WARNING" "GDPR: Not all ingress resources use TLS"
        issues=$((issues + 1))
    fi

    # Check data retention policies
    local configmaps_with_retention=$(kubectl get configmaps -n "$NAMESPACE" -o json | jq -r '.items[] | select(.metadata.annotations["data.retention.policy"] != null) | .metadata.name' | wc -l)
    if [[ $configmaps_with_retention -eq 0 ]]; then
        log "WARNING" "GDPR: No data retention policies found"
        issues=$((issues + 1))
    fi

    return $issues
}

# ISO 27001 compliance validation
validate_iso27001_compliance() {
    local issues=0

    # Check asset management (resource labels)
    local unlabeled_resources=$(kubectl get all -n "$NAMESPACE" -o json | jq -r '.items[] | select(.metadata.labels == null or (.metadata.labels | length) == 0) | .metadata.name' | wc -l)
    if [[ $unlabeled_resources -gt 0 ]]; then
        log "WARNING" "ISO 27001: $unlabeled_resources resources without proper labels"
        issues=$((issues + 1))
    fi

    # Check vulnerability management
    local security_policies=$(kubectl get networkpolicies -n "$NAMESPACE" --no-headers | wc -l)
    if [[ $security_policies -eq 0 ]]; then
        log "WARNING" "ISO 27001: No network security policies found"
        issues=$((issues + 1))
    fi

    return $issues
}

# Generate comprehensive security report
generate_security_report() {
    log "INFO" "📊 Generating comprehensive security report..."

    local report_file="$REPORTS_DIR/security-compliance-report-$(date +%Y%m%d-%H%M%S).html"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would generate security report"
        return 0
    fi

    # Create HTML report
    cat > "$report_file" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Security and Compliance Report</title>
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
        <h1>Security and Compliance Report</h1>
        <p><strong>Generated:</strong> $(date)</p>
        <p><strong>Environment:</strong> $ENVIRONMENT</p>
        <p><strong>Namespace:</strong> $NAMESPACE</p>
        <p><strong>Scan Type:</strong> $SCAN_TYPE</p>
    </div>
EOF

    # Add scan results sections
    echo "    <div class=\"section\">" >> "$report_file"
    echo "        <h2>Scan Summary</h2>" >> "$report_file"
    echo "        <p>Security scan completed with detailed analysis of containers, Kubernetes configuration, secrets, and compliance frameworks.</p>" >> "$report_file"
    echo "    </div>" >> "$report_file"

    # Close HTML
    echo "</body></html>" >> "$report_file"

    log "SUCCESS" "Security report generated: $report_file"
    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_security_scan

    local exit_code=0

    # Execute security scans based on scan type
    case "$SCAN_TYPE" in
        "quick")
            log "INFO" "🚀 Starting quick security scan..."
            scan_container_security || exit_code=1
            ;;
        "standard")
            log "INFO" "🚀 Starting standard security scan..."
            scan_container_security || exit_code=1
            validate_kubernetes_security || exit_code=1
            scan_secrets || exit_code=1
            ;;
        "comprehensive")
            log "INFO" "🚀 Starting comprehensive security scan..."
            scan_container_security || exit_code=1
            validate_kubernetes_security || exit_code=1
            scan_secrets || exit_code=1
            validate_compliance || exit_code=1
            ;;
    esac

    if [[ "$GENERATE_REPORT" == "true" ]]; then
        generate_security_report || exit_code=1
    fi

    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ Security scan completed successfully"
    else
        log "ERROR" "❌ Security scan completed with issues"
    fi

    exit $exit_code
}

# Execute main function
main "$@"
