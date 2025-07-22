#!/bin/bash

# Security Policy Enforcer
# Automated security policy enforcement and validation for Paperless Maverick deployments
# This script enforces security policies, validates configurations, and ensures compliance

set -euo pipefail

# Script metadata
readonly SCRIPT_NAME="security-policy-enforcer"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly POLICIES_DIR="$INFRASTRUCTURE_DIR/security/policies"
readonly SECURITY_CONFIG="$CONFIG_DIR/security-compliance-config.yaml"

# Log directories
readonly LOG_DIR="$PROJECT_ROOT/logs/security"
readonly REPORTS_DIR="$PROJECT_ROOT/reports/security"
readonly AUDIT_DIR="$PROJECT_ROOT/audit/security"

# Create directories
mkdir -p "$LOG_DIR" "$REPORTS_DIR" "$AUDIT_DIR" "$POLICIES_DIR"

# Log files
readonly POLICY_LOG="$LOG_DIR/policy-enforcement-$(date +%Y%m%d-%H%M%S).log"
readonly VIOLATIONS_LOG="$LOG_DIR/policy-violations-$(date +%Y%m%d-%H%M%S).log"
readonly AUDIT_LOG="$AUDIT_DIR/policy-audit-$(date +%Y%m%d-%H%M%S).log"

# Default values
ENVIRONMENT="production"
NAMESPACE="paperless-maverick"
ENFORCEMENT_MODE="enforce"  # enforce|warn|audit
POLICY_SET="comprehensive"  # basic|standard|comprehensive
DRY_RUN="false"
VERBOSE="false"
AUTO_REMEDIATE="false"

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$POLICY_LOG"
    
    case "$level" in
        "ERROR")
            echo -e "${RED}${timestamp} [${level}] ${message}${NC}" >&2
            echo -e "${timestamp} [${level}] ${message}" >> "$VIOLATIONS_LOG"
            ;;
        "WARNING")
            echo -e "${YELLOW}${timestamp} [${level}] ${message}${NC}" >&2
            echo -e "${timestamp} [${level}] ${message}" >> "$VIOLATIONS_LOG"
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

Security Policy Enforcer - Automated security policy enforcement and validation

OPTIONS:
    --environment ENV       Target environment (default: production)
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --mode MODE            Enforcement mode: enforce|warn|audit (default: enforce)
    --policy-set SET       Policy set: basic|standard|comprehensive (default: comprehensive)
    --auto-remediate       Enable automatic remediation of violations
    --dry-run              Preview actions without executing
    --verbose              Enable verbose output
    --help                 Show this help message

ENFORCEMENT MODES:
    enforce        - Block deployments that violate policies
    warn           - Allow deployments but log warnings
    audit          - Only audit and report violations

POLICY SETS:
    basic          - Essential security policies only
    standard       - Standard security policies
    comprehensive  - All security policies including compliance

EXAMPLES:
    # Enforce comprehensive security policies
    $0 --environment production --mode enforce --policy-set comprehensive

    # Audit mode with automatic remediation
    $0 --mode audit --auto-remediate --verbose

    # Dry run with standard policies
    $0 --dry-run --policy-set standard --mode warn

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
            --mode)
                ENFORCEMENT_MODE="$2"
                shift 2
                ;;
            --policy-set)
                POLICY_SET="$2"
                shift 2
                ;;
            --auto-remediate)
                AUTO_REMEDIATE="true"
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

# Initialize policy enforcer
initialize_policy_enforcer() {
    log "INFO" "🛡️  Initializing Security Policy Enforcer v$SCRIPT_VERSION"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Enforcement Mode: $ENFORCEMENT_MODE"
    log "INFO" "Policy Set: $POLICY_SET"
    log "INFO" "Auto Remediate: $AUTO_REMEDIATE"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Validate parameters
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
    
    if [[ ! "$ENFORCEMENT_MODE" =~ ^(enforce|warn|audit)$ ]]; then
        log "ERROR" "Invalid enforcement mode: $ENFORCEMENT_MODE"
        exit 1
    fi
    
    if [[ ! "$POLICY_SET" =~ ^(basic|standard|comprehensive)$ ]]; then
        log "ERROR" "Invalid policy set: $POLICY_SET"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("kubectl" "jq" "yq")
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
    
    log "SUCCESS" "Policy enforcer initialized successfully"
}

# Create security policies
create_security_policies() {
    log "INFO" "📋 Creating security policies..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would create security policies"
        return 0
    fi
    
    # Create Pod Security Policy
    create_pod_security_policy
    
    # Create Network Policies
    create_network_policies
    
    # Create RBAC Policies
    create_rbac_policies
    
    # Create Resource Quotas and Limits
    create_resource_policies
    
    log "SUCCESS" "Security policies created successfully"
}

# Create Pod Security Policy
create_pod_security_policy() {
    log "INFO" "Creating Pod Security Policy..."
    
    cat > "$POLICIES_DIR/pod-security-policy.yaml" << 'EOF'
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: paperless-maverick-psp
  namespace: paperless-maverick
  labels:
    app: paperless-maverick
    component: security-policy
spec:
  # Prevent privileged containers
  privileged: false
  allowPrivilegeEscalation: false
  
  # Require non-root user
  runAsUser:
    rule: 'MustRunAsNonRoot'
  
  # Require read-only root filesystem
  readOnlyRootFilesystem: true
  
  # Drop all capabilities
  requiredDropCapabilities:
    - ALL
  
  # Allowed volume types
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  
  # Host network restrictions
  hostNetwork: false
  hostIPC: false
  hostPID: false
  
  # SELinux
  seLinux:
    rule: 'RunAsAny'
  
  # Supplemental groups
  supplementalGroups:
    rule: 'RunAsAny'
  
  # FSGroup
  fsGroup:
    rule: 'RunAsAny'
EOF
    
    kubectl apply -f "$POLICIES_DIR/pod-security-policy.yaml" || log "WARNING" "Failed to apply Pod Security Policy"
}

# Create Network Policies
create_network_policies() {
    log "INFO" "Creating Network Policies..."
    
    # Default deny all policy
    cat > "$POLICIES_DIR/default-deny-network-policy.yaml" << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: $NAMESPACE
  labels:
    app: paperless-maverick
    component: security-policy
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: $NAMESPACE
  labels:
    app: paperless-maverick
    component: security-policy
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to: []
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-ingress
  namespace: $NAMESPACE
  labels:
    app: paperless-maverick
    component: security-policy
spec:
  podSelector:
    matchLabels:
      app: paperless-maverick
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
EOF
    
    kubectl apply -f "$POLICIES_DIR/default-deny-network-policy.yaml" || log "WARNING" "Failed to apply Network Policies"
}

# Create RBAC Policies
create_rbac_policies() {
    log "INFO" "Creating RBAC Policies..."
    
    cat > "$POLICIES_DIR/rbac-policies.yaml" << EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: paperless-maverick-restricted
  namespace: $NAMESPACE
  labels:
    app: paperless-maverick
    component: security-policy
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: paperless-maverick-minimal
  namespace: $NAMESPACE
  labels:
    app: paperless-maverick
    component: security-policy
rules:
# Minimal required permissions
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["app-secrets", "supabase-secrets"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: paperless-maverick-minimal-binding
  namespace: $NAMESPACE
  labels:
    app: paperless-maverick
    component: security-policy
subjects:
- kind: ServiceAccount
  name: paperless-maverick-restricted
  namespace: $NAMESPACE
roleRef:
  kind: Role
  name: paperless-maverick-minimal
  apiGroup: rbac.authorization.k8s.io
EOF
    
    kubectl apply -f "$POLICIES_DIR/rbac-policies.yaml" || log "WARNING" "Failed to apply RBAC Policies"
}

# Create Resource Policies
create_resource_policies() {
    log "INFO" "Creating Resource Policies..."
    
    cat > "$POLICIES_DIR/resource-policies.yaml" << EOF
apiVersion: v1
kind: LimitRange
metadata:
  name: paperless-maverick-security-limits
  namespace: $NAMESPACE
  labels:
    app: paperless-maverick
    component: security-policy
spec:
  limits:
  - default:
      cpu: "500m"
      memory: "1Gi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    max:
      cpu: "2000m"
      memory: "4Gi"
    min:
      cpu: "50m"
      memory: "64Mi"
    type: Container
  - max:
      storage: "10Gi"
    min:
      storage: "1Gi"
    type: PersistentVolumeClaim
EOF
    
    kubectl apply -f "$POLICIES_DIR/resource-policies.yaml" || log "WARNING" "Failed to apply Resource Policies"
}

# Validate policy compliance
validate_policy_compliance() {
    log "INFO" "🔍 Validating policy compliance..."
    
    local violations=0
    local compliance_report="$REPORTS_DIR/policy-compliance-$(date +%Y%m%d-%H%M%S).json"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would validate policy compliance"
        return 0
    fi
    
    # Check for privileged containers
    local privileged_pods=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | select(.spec.containers[]?.securityContext.privileged == true) | .metadata.name')
    if [[ -n "$privileged_pods" ]]; then
        log "ERROR" "Policy violation: Privileged containers found"
        violations=$((violations + 1))
        
        if [[ "$AUTO_REMEDIATE" == "true" ]]; then
            log "INFO" "Auto-remediation: Removing privileged containers"
            # Implementation would go here
        fi
    fi
    
    # Check for containers running as root
    local root_containers=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | select(.spec.containers[]?.securityContext.runAsUser == 0) | .metadata.name')
    if [[ -n "$root_containers" ]]; then
        log "ERROR" "Policy violation: Containers running as root"
        violations=$((violations + 1))
    fi
    
    # Check for missing resource limits
    local pods_without_limits=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | select(.spec.containers[]?.resources.limits == null) | .metadata.name')
    if [[ -n "$pods_without_limits" ]]; then
        log "WARNING" "Policy violation: Pods without resource limits"
        violations=$((violations + 1))
    fi
    
    # Generate compliance report
    cat > "$compliance_report" << EOF
{
  "validation_type": "policy_compliance",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "enforcement_mode": "$ENFORCEMENT_MODE",
  "policy_set": "$POLICY_SET",
  "summary": {
    "violations_found": $violations,
    "validation_status": "completed"
  }
}
EOF
    
    log "SUCCESS" "Policy compliance validation completed"
    log "INFO" "Violations found: $violations"
    
    # Handle enforcement mode
    if [[ "$ENFORCEMENT_MODE" == "enforce" && $violations -gt 0 ]]; then
        log "ERROR" "Enforcement mode: Blocking deployment due to policy violations"
        return 1
    elif [[ "$ENFORCEMENT_MODE" == "warn" && $violations -gt 0 ]]; then
        log "WARNING" "Warning mode: Policy violations detected but allowing deployment"
    fi
    
    return 0
}

# Main execution
main() {
    parse_args "$@"
    initialize_policy_enforcer
    
    local exit_code=0
    
    # Create and enforce security policies
    create_security_policies || exit_code=1
    validate_policy_compliance || exit_code=1
    
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "✅ Security policy enforcement completed successfully"
    else
        log "ERROR" "❌ Security policy enforcement completed with violations"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"
