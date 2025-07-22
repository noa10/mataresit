#!/bin/bash

# Infrastructure Provisioning Script for Paperless Maverick
# Comprehensive automation for Kubernetes resources, secrets, and environment setup
# Version: 1.0.0

set -euo pipefail

# ============================================================================
# CONFIGURATION AND CONSTANTS
# ============================================================================

# Script metadata
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Infrastructure configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly KUBERNETES_DIR="$INFRASTRUCTURE_DIR/kubernetes"
readonly TERRAFORM_DIR="$INFRASTRUCTURE_DIR/terraform"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly ENV_DIR="$INFRASTRUCTURE_DIR/env"

# Logging configuration
readonly LOG_DIR="$PROJECT_ROOT/logs/infrastructure"
readonly PROVISION_LOG="$LOG_DIR/provision-$(date +%Y%m%d-%H%M%S).log"
readonly AUDIT_LOG="$LOG_DIR/provision-audit-$(date +%Y%m%d).log"

# Default values
readonly DEFAULT_ENVIRONMENT="production"
readonly DEFAULT_NAMESPACE="paperless-maverick"
readonly PROVISION_TIMEOUT=1800  # 30 minutes

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# ============================================================================
# GLOBAL VARIABLES
# ============================================================================

# Command line options
ENVIRONMENT="$DEFAULT_ENVIRONMENT"
NAMESPACE="$DEFAULT_NAMESPACE"
DRY_RUN=false
VALIDATE_ONLY=false
FORCE=false
VERBOSE=false
SKIP_SECRETS=false
SKIP_TERRAFORM=false
SKIP_MONITORING=false
UPDATE_EXISTING=false

# Provisioning state
PROVISION_ID=""
PROVISION_START_TIME=""
PROVISIONED_RESOURCES=()
FAILED_RESOURCES=()

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Initialize logging
init_logging() {
    mkdir -p "$LOG_DIR"
    touch "$PROVISION_LOG" "$AUDIT_LOG"
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$PROVISION_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$PROVISION_LOG"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$PROVISION_LOG"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$PROVISION_LOG"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[$timestamp] 🔍${NC} $message" | tee -a "$PROVISION_LOG"
            fi
            ;;
        "AUDIT")
            echo "[$timestamp] $message" >> "$AUDIT_LOG"
            ;;
    esac
}

# Audit logging
audit_log() {
    local action="$1"
    local details="$2"
    local user="${USER:-unknown}"
    local provision_id="${PROVISION_ID:-unknown}"
    
    log "AUDIT" "PROVISION_ID=$provision_id USER=$user ACTION=$action DETAILS=$details"
}

# Generate unique provision ID
generate_provision_id() {
    PROVISION_ID="provision-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    log "INFO" "Generated provision ID: $PROVISION_ID"
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate prerequisites
validate_prerequisites() {
    log "INFO" "🔍 Validating infrastructure provisioning prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "jq" "yq")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    # Check optional tools
    if [[ "$SKIP_TERRAFORM" != "true" ]] && ! command -v "terraform" &> /dev/null; then
        log "WARNING" "Terraform not found - Terraform provisioning will be skipped"
        SKIP_TERRAFORM=true
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log "ERROR" "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    # Check required directories
    local required_dirs=("$KUBERNETES_DIR" "$CONFIG_DIR")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log "ERROR" "Required directory not found: $dir"
            return 1
        fi
    done
    
    log "SUCCESS" "Prerequisites validation completed"
    return 0
}

# Validate environment configuration
validate_environment_config() {
    log "INFO" "🔍 Validating environment configuration..."
    
    # Check environment-specific configuration
    local env_config_file="$CONFIG_DIR/deployment-config.yaml"
    if [[ ! -f "$env_config_file" ]]; then
        log "ERROR" "Environment config file not found: $env_config_file"
        return 1
    fi
    
    # Validate Kubernetes manifests
    local manifest_files=(
        "$KUBERNETES_DIR/namespace.yaml"
        "$KUBERNETES_DIR/configmap.yaml"
        "$KUBERNETES_DIR/deployment.yaml"
        "$KUBERNETES_DIR/service.yaml"
        "$KUBERNETES_DIR/hpa.yaml"
    )
    
    for manifest in "${manifest_files[@]}"; do
        if [[ -f "$manifest" ]]; then
            if ! kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
                log "ERROR" "Invalid Kubernetes manifest: $manifest"
                return 1
            fi
            log "DEBUG" "Validated manifest: $(basename "$manifest")"
        else
            log "WARNING" "Manifest not found: $manifest"
        fi
    done
    
    # Validate worker manifests
    local worker_manifest_dir="$KUBERNETES_DIR/workers"
    if [[ -d "$worker_manifest_dir" ]]; then
        local worker_manifests=(
            "$worker_manifest_dir/embedding-worker-configmap.yaml"
            "$worker_manifest_dir/embedding-queue-worker-deployment.yaml"
            "$worker_manifest_dir/embedding-worker-hpa.yaml"
        )
        
        for manifest in "${worker_manifests[@]}"; do
            if [[ -f "$manifest" ]]; then
                if ! kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
                    log "ERROR" "Invalid worker manifest: $manifest"
                    return 1
                fi
                log "DEBUG" "Validated worker manifest: $(basename "$manifest")"
            fi
        done
    fi
    
    log "SUCCESS" "Environment configuration validation completed"
    return 0
}

# ============================================================================
# PROVISIONING FUNCTIONS
# ============================================================================

# Provision namespace and RBAC
provision_namespace() {
    log "INFO" "🏗️  Provisioning namespace and RBAC..."
    
    local namespace_manifest="$KUBERNETES_DIR/namespace.yaml"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would provision namespace"
        return 0
    fi
    
    # Create or update namespace
    if [[ -f "$namespace_manifest" ]]; then
        log "INFO" "Applying namespace manifest..."
        kubectl apply -f "$namespace_manifest"
        PROVISIONED_RESOURCES+=("namespace:$NAMESPACE")
    else
        # Create namespace if manifest doesn't exist
        log "INFO" "Creating namespace: $NAMESPACE"
        kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
        PROVISIONED_RESOURCES+=("namespace:$NAMESPACE")
    fi
    
    # Apply RBAC if exists
    local rbac_manifest="$KUBERNETES_DIR/rbac.yaml"
    if [[ -f "$rbac_manifest" ]]; then
        log "INFO" "Applying RBAC configuration..."
        kubectl apply -f "$rbac_manifest"
        PROVISIONED_RESOURCES+=("rbac:paperless-maverick")
    fi
    
    log "SUCCESS" "Namespace and RBAC provisioning completed"
    audit_log "NAMESPACE_PROVISIONED" "namespace=$NAMESPACE"
    return 0
}

# Provision configuration maps
provision_configmaps() {
    log "INFO" "🗂️  Provisioning configuration maps..."
    
    local configmap_manifest="$KUBERNETES_DIR/configmap.yaml"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would provision configmaps"
        return 0
    fi
    
    if [[ -f "$configmap_manifest" ]]; then
        log "INFO" "Applying configmap manifest..."
        kubectl apply -f "$configmap_manifest"
        PROVISIONED_RESOURCES+=("configmap:paperless-maverick-config")
        PROVISIONED_RESOURCES+=("configmap:embedding-worker-config")
    else
        log "ERROR" "Configmap manifest not found: $configmap_manifest"
        return 1
    fi
    
    # Apply worker configmaps
    local worker_configmap="$KUBERNETES_DIR/workers/embedding-worker-configmap.yaml"
    if [[ -f "$worker_configmap" ]]; then
        log "INFO" "Applying worker configmap..."
        kubectl apply -f "$worker_configmap"
        PROVISIONED_RESOURCES+=("configmap:embedding-worker-config-extended")
    fi
    
    log "SUCCESS" "Configuration maps provisioning completed"
    audit_log "CONFIGMAPS_PROVISIONED" "count=${#PROVISIONED_RESOURCES[@]}"
    return 0
}

# Provision secrets
provision_secrets() {
    if [[ "$SKIP_SECRETS" == "true" ]]; then
        log "INFO" "Skipping secrets provisioning"
        return 0
    fi

    log "INFO" "🔐 Provisioning secrets..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would provision secrets"
        return 0
    fi

    # Check if secrets setup script exists
    local secrets_script="$SCRIPT_DIR/setup-secrets.sh"
    if [[ ! -f "$secrets_script" ]]; then
        log "ERROR" "Secrets setup script not found: $secrets_script"
        return 1
    fi

    # Check for environment file
    local env_file="$ENV_DIR/.env.$ENVIRONMENT"
    local secrets_args=()

    if [[ -f "$env_file" ]]; then
        secrets_args+=("--from-file" "$env_file")
        log "INFO" "Using environment file: $env_file"
    else
        secrets_args+=("--from-env")
        log "INFO" "Using current environment variables"
    fi

    # Add update flag if updating existing
    if [[ "$UPDATE_EXISTING" == "true" ]]; then
        secrets_args+=("--update")
    fi

    # Add namespace
    secrets_args+=("--namespace" "$NAMESPACE")

    # Execute secrets setup
    log "INFO" "Executing secrets setup script..."
    if "$secrets_script" "${secrets_args[@]}"; then
        log "SUCCESS" "Secrets provisioning completed"
        PROVISIONED_RESOURCES+=("secrets:supabase-secrets")
        PROVISIONED_RESOURCES+=("secrets:ai-secrets")
        PROVISIONED_RESOURCES+=("secrets:security-secrets")
        PROVISIONED_RESOURCES+=("secrets:monitoring-secrets")
        PROVISIONED_RESOURCES+=("secrets:notification-secrets")
        audit_log "SECRETS_PROVISIONED" "namespace=$NAMESPACE"
    else
        log "ERROR" "Secrets provisioning failed"
        FAILED_RESOURCES+=("secrets:all")
        return 1
    fi

    return 0
}

# Provision core application resources
provision_core_resources() {
    log "INFO" "🚀 Provisioning core application resources..."

    local core_manifests=(
        "$KUBERNETES_DIR/deployment.yaml"
        "$KUBERNETES_DIR/service.yaml"
        "$KUBERNETES_DIR/hpa.yaml"
    )

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would provision core resources"
        return 0
    fi

    for manifest in "${core_manifests[@]}"; do
        if [[ -f "$manifest" ]]; then
            local resource_name=$(basename "$manifest" .yaml)
            log "INFO" "Applying $resource_name manifest..."

            if kubectl apply -f "$manifest"; then
                log "SUCCESS" "Applied $resource_name"
                PROVISIONED_RESOURCES+=("$resource_name:paperless-maverick")
            else
                log "ERROR" "Failed to apply $resource_name"
                FAILED_RESOURCES+=("$resource_name:paperless-maverick")
                return 1
            fi
        else
            log "WARNING" "Core manifest not found: $manifest"
        fi
    done

    log "SUCCESS" "Core application resources provisioning completed"
    audit_log "CORE_RESOURCES_PROVISIONED" "count=${#PROVISIONED_RESOURCES[@]}"
    return 0
}

# Provision worker resources
provision_worker_resources() {
    log "INFO" "👷 Provisioning worker resources..."

    local worker_manifest_dir="$KUBERNETES_DIR/workers"
    if [[ ! -d "$worker_manifest_dir" ]]; then
        log "WARNING" "Worker manifest directory not found: $worker_manifest_dir"
        return 0
    fi

    local worker_manifests=(
        "$worker_manifest_dir/embedding-queue-worker-deployment.yaml"
        "$worker_manifest_dir/embedding-worker-hpa.yaml"
        "$worker_manifest_dir/worker-health-monitoring.yaml"
    )

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would provision worker resources"
        return 0
    fi

    for manifest in "${worker_manifests[@]}"; do
        if [[ -f "$manifest" ]]; then
            local resource_name=$(basename "$manifest" .yaml)
            log "INFO" "Applying worker $resource_name..."

            if kubectl apply -f "$manifest"; then
                log "SUCCESS" "Applied worker $resource_name"
                PROVISIONED_RESOURCES+=("worker-$resource_name:embedding-queue-workers")
            else
                log "ERROR" "Failed to apply worker $resource_name"
                FAILED_RESOURCES+=("worker-$resource_name:embedding-queue-workers")
                return 1
            fi
        else
            log "WARNING" "Worker manifest not found: $manifest"
        fi
    done

    log "SUCCESS" "Worker resources provisioning completed"
    audit_log "WORKER_RESOURCES_PROVISIONED" "count=${#PROVISIONED_RESOURCES[@]}"
    return 0
}

# Provision monitoring resources
provision_monitoring_resources() {
    if [[ "$SKIP_MONITORING" == "true" ]]; then
        log "INFO" "Skipping monitoring resources provisioning"
        return 0
    fi

    log "INFO" "📊 Provisioning monitoring resources..."

    local monitoring_manifest_dir="$INFRASTRUCTURE_DIR/monitoring"
    if [[ ! -d "$monitoring_manifest_dir" ]]; then
        log "WARNING" "Monitoring manifest directory not found: $monitoring_manifest_dir"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would provision monitoring resources"
        return 0
    fi

    # Apply monitoring manifests
    local monitoring_manifests=(
        "$monitoring_manifest_dir/prometheus-config.yaml"
        "$monitoring_manifest_dir/prometheus-deployment.yaml"
        "$monitoring_manifest_dir/grafana-config.yaml"
        "$monitoring_manifest_dir/grafana-deployment.yaml"
        "$monitoring_manifest_dir/alertmanager-config.yaml"
    )

    for manifest in "${monitoring_manifests[@]}"; do
        if [[ -f "$manifest" ]]; then
            local resource_name=$(basename "$manifest" .yaml)
            log "INFO" "Applying monitoring $resource_name..."

            if kubectl apply -f "$manifest"; then
                log "SUCCESS" "Applied monitoring $resource_name"
                PROVISIONED_RESOURCES+=("monitoring-$resource_name")
            else
                log "WARNING" "Failed to apply monitoring $resource_name (may not be critical)"
                FAILED_RESOURCES+=("monitoring-$resource_name")
            fi
        fi
    done

    log "SUCCESS" "Monitoring resources provisioning completed"
    audit_log "MONITORING_RESOURCES_PROVISIONED" "count=${#PROVISIONED_RESOURCES[@]}"
    return 0
}

# Provision with Terraform
provision_with_terraform() {
    if [[ "$SKIP_TERRAFORM" == "true" ]]; then
        log "INFO" "Skipping Terraform provisioning"
        return 0
    fi

    log "INFO" "🏗️  Provisioning with Terraform..."

    if [[ ! -d "$TERRAFORM_DIR" ]]; then
        log "WARNING" "Terraform directory not found: $TERRAFORM_DIR"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would run terraform plan"
        return 0
    fi

    # Change to Terraform directory
    local current_dir=$(pwd)
    cd "$TERRAFORM_DIR"

    # Initialize Terraform
    log "INFO" "Initializing Terraform..."
    if terraform init; then
        log "SUCCESS" "Terraform initialized"
    else
        log "ERROR" "Terraform initialization failed"
        cd "$current_dir"
        return 1
    fi

    # Plan Terraform changes
    log "INFO" "Planning Terraform changes..."
    if terraform plan -out=tfplan; then
        log "SUCCESS" "Terraform plan completed"
    else
        log "ERROR" "Terraform plan failed"
        cd "$current_dir"
        return 1
    fi

    # Apply Terraform changes
    log "INFO" "Applying Terraform changes..."
    if terraform apply tfplan; then
        log "SUCCESS" "Terraform apply completed"
        PROVISIONED_RESOURCES+=("terraform:infrastructure")
        audit_log "TERRAFORM_PROVISIONED" "directory=$TERRAFORM_DIR"
    else
        log "ERROR" "Terraform apply failed"
        FAILED_RESOURCES+=("terraform:infrastructure")
        cd "$current_dir"
        return 1
    fi

    cd "$current_dir"
    return 0
}

# ============================================================================
# VALIDATION AND VERIFICATION FUNCTIONS
# ============================================================================

# Validate provisioned resources
validate_provisioned_resources() {
    log "INFO" "✅ Validating provisioned resources..."

    # Check namespace
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "ERROR" "Namespace $NAMESPACE not found"
        return 1
    fi

    # Check core deployments
    local core_deployments=("paperless-maverick")
    for deployment in "${core_deployments[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            local ready_replicas
            ready_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local desired_replicas
            desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

            log "INFO" "Deployment $deployment: $ready_replicas/$desired_replicas replicas ready"
        else
            log "WARNING" "Deployment $deployment not found"
        fi
    done

    # Check worker deployments
    if kubectl get deployment "embedding-queue-workers" -n "$NAMESPACE" &> /dev/null; then
        local ready_replicas
        ready_replicas=$(kubectl get deployment "embedding-queue-workers" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired_replicas
        desired_replicas=$(kubectl get deployment "embedding-queue-workers" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

        log "INFO" "Worker deployment: $ready_replicas/$desired_replicas replicas ready"
    else
        log "WARNING" "Worker deployment not found"
    fi

    # Check services
    local services=("paperless-maverick")
    for service in "${services[@]}"; do
        if kubectl get service "$service" -n "$NAMESPACE" &> /dev/null; then
            log "SUCCESS" "Service $service is available"
        else
            log "WARNING" "Service $service not found"
        fi
    done

    # Check secrets
    local required_secrets=("supabase-secrets" "ai-secrets" "security-secrets")
    for secret in "${required_secrets[@]}"; do
        if kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            log "SUCCESS" "Secret $secret is available"
        else
            log "WARNING" "Secret $secret not found"
        fi
    done

    log "SUCCESS" "Resource validation completed"
    return 0
}

# ============================================================================
# MAIN ORCHESTRATION FUNCTIONS
# ============================================================================

# Main infrastructure provisioning orchestration
main_provisioning() {
    log "INFO" "🚀 Starting infrastructure provisioning"
    log "INFO" "Provision ID: $PROVISION_ID"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Dry Run: $DRY_RUN"
    log "INFO" "=================================================="

    PROVISION_START_TIME=$(date +%s)
    audit_log "PROVISIONING_STARTED" "provision_id=$PROVISION_ID environment=$ENVIRONMENT namespace=$NAMESPACE"

    # Set up error handling
    trap 'handle_provisioning_failure' ERR

    # Phase 1: Validation
    validate_prerequisites || return 1
    validate_environment_config || return 1

    # Phase 2: Terraform provisioning (if enabled)
    provision_with_terraform || return 1

    # Phase 3: Namespace and RBAC
    provision_namespace || return 1

    # Phase 4: Configuration maps
    provision_configmaps || return 1

    # Phase 5: Secrets
    provision_secrets || return 1

    # Phase 6: Core application resources
    provision_core_resources || return 1

    # Phase 7: Worker resources
    provision_worker_resources || return 1

    # Phase 8: Monitoring resources
    provision_monitoring_resources || return 1

    # Phase 9: Validation
    validate_provisioned_resources || return 1

    # Provisioning summary
    local provision_end_time=$(date +%s)
    local provision_duration=$((provision_end_time - PROVISION_START_TIME))

    log "SUCCESS" "🎉 Infrastructure provisioning completed successfully!"
    log "INFO" "=================================================="
    log "INFO" "Provisioning Summary:"
    log "INFO" "  - Provision ID: $PROVISION_ID"
    log "INFO" "  - Duration: ${provision_duration}s"
    log "INFO" "  - Environment: $ENVIRONMENT"
    log "INFO" "  - Namespace: $NAMESPACE"
    log "INFO" "  - Provisioned Resources: ${#PROVISIONED_RESOURCES[@]}"
    log "INFO" "  - Failed Resources: ${#FAILED_RESOURCES[@]}"
    log "INFO" "=================================================="

    if [[ ${#PROVISIONED_RESOURCES[@]} -gt 0 ]]; then
        log "INFO" "Provisioned Resources:"
        for resource in "${PROVISIONED_RESOURCES[@]}"; do
            log "INFO" "  ✅ $resource"
        done
    fi

    if [[ ${#FAILED_RESOURCES[@]} -gt 0 ]]; then
        log "WARNING" "Failed Resources:"
        for resource in "${FAILED_RESOURCES[@]}"; do
            log "WARNING" "  ❌ $resource"
        done
    fi

    audit_log "PROVISIONING_COMPLETED" "provision_id=$PROVISION_ID duration=${provision_duration}s provisioned=${#PROVISIONED_RESOURCES[@]} failed=${#FAILED_RESOURCES[@]}"

    return 0
}

# Handle provisioning failures
handle_provisioning_failure() {
    local exit_code=$?

    log "ERROR" "💥 Infrastructure provisioning failed"
    audit_log "PROVISIONING_FAILED" "provision_id=$PROVISION_ID exit_code=$exit_code"

    if [[ "$FORCE" == "false" ]] && [[ ${#PROVISIONED_RESOURCES[@]} -gt 0 ]]; then
        log "WARNING" "Some resources were provisioned before failure occurred"
        log "INFO" "Consider cleaning up or using --force to continue"
    fi

    exit $exit_code
}

# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

# Show help
show_help() {
    cat << EOF
Paperless Maverick Infrastructure Provisioning Script v$SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

DESCRIPTION:
    Comprehensive infrastructure provisioning automation including Kubernetes
    resources, secrets management, configuration deployment, and environment
    setup with proper validation and error handling.

OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: $DEFAULT_ENVIRONMENT)
    -n, --namespace NS          Kubernetes namespace (default: $DEFAULT_NAMESPACE)
    -d, --dry-run              Perform dry run without making changes
    -v, --validate-only        Only validate configuration
    -f, --force                Force provisioning, skip safety checks
    --verbose                  Enable verbose logging
    --skip-secrets             Skip secrets provisioning
    --skip-terraform           Skip Terraform provisioning
    --skip-monitoring          Skip monitoring resources provisioning
    --update-existing          Update existing resources

EXAMPLES:
    # Full infrastructure provisioning
    $SCRIPT_NAME --environment production

    # Dry run validation
    $SCRIPT_NAME --dry-run --validate-only

    # Skip secrets and monitoring
    $SCRIPT_NAME --skip-secrets --skip-monitoring

    # Update existing resources
    $SCRIPT_NAME --update-existing --environment staging

    # Force provisioning with verbose output
    $SCRIPT_NAME --force --verbose

ENVIRONMENT VARIABLES:
    KUBECONFIG                 Kubernetes configuration file
    TERRAFORM_LOG              Terraform log level
    PROVISION_TIMEOUT          Provisioning timeout in seconds

FILES:
    $PROVISION_LOG             Provisioning log
    $AUDIT_LOG                 Audit log

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
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--validate-only)
                VALIDATE_ONLY=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --skip-secrets)
                SKIP_SECRETS=true
                shift
                ;;
            --skip-terraform)
                SKIP_TERRAFORM=true
                shift
                ;;
            --skip-monitoring)
                SKIP_MONITORING=true
                shift
                ;;
            --update-existing)
                UPDATE_EXISTING=true
                shift
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Main function
main() {
    # Initialize logging
    init_logging

    # Parse command line arguments
    parse_arguments "$@"

    # Generate provision ID
    generate_provision_id

    # Log startup information
    log "INFO" "Paperless Maverick Infrastructure Provisioning Script v$SCRIPT_VERSION"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: ${USER:-unknown}"
    log "INFO" "Working directory: $(pwd)"
    log "INFO" "Script directory: $SCRIPT_DIR"
    log "INFO" "Project root: $PROJECT_ROOT"
    log "INFO" "Infrastructure directory: $INFRASTRUCTURE_DIR"

    # Handle special modes
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "INFO" "✅ Validation-only mode activated"
        validate_prerequisites
        validate_environment_config
        log "SUCCESS" "Validation completed successfully"
        exit 0
    fi

    # Run main provisioning process
    main_provisioning
    exit $?
}

# Execute main function with all arguments
main "$@"
