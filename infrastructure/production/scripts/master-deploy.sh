#!/bin/bash

# Master Deployment Orchestration Script for Paperless Maverick
# Comprehensive deployment automation with staging, validation, and rollback capabilities
# Version: 1.0.0

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# ============================================================================
# CONFIGURATION AND CONSTANTS
# ============================================================================

# Script metadata
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Deployment configuration
readonly DEFAULT_ENVIRONMENT="production"
readonly DEFAULT_NAMESPACE="paperless-maverick"
readonly DEFAULT_IMAGE_TAG="latest"
readonly DEPLOYMENT_TIMEOUT=600  # 10 minutes
readonly HEALTH_CHECK_TIMEOUT=300  # 5 minutes

# Logging configuration
readonly LOG_DIR="$PROJECT_ROOT/logs/deployment"
readonly DEPLOYMENT_LOG="$LOG_DIR/deployment-$(date +%Y%m%d-%H%M%S).log"
readonly AUDIT_LOG="$LOG_DIR/audit-$(date +%Y%m%d).log"

# Backup configuration
readonly BACKUP_DIR="$PROJECT_ROOT/archive/backups/deployment-$(date +%Y%m%d-%H%M%S)"

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
IMAGE_TAG="$DEFAULT_IMAGE_TAG"
DRY_RUN=false
VALIDATE_ONLY=false
ROLLBACK=false
SKIP_TESTS=false
FORCE=false
VERBOSE=false
STAGED_DEPLOYMENT=false
FEATURE_FLAGS_ONLY=false
MONITORING_ONLY=false

# Deployment state
DEPLOYMENT_ID=""
DEPLOYMENT_START_TIME=""
DEPLOYMENT_PHASES=()
CURRENT_PHASE=""
FAILED_PHASE=""

# Feature flag rollout percentages
EMBEDDING_MONITORING_ROLLOUT=10
QUEUE_PROCESSING_ROLLOUT=0
BATCH_OPTIMIZATION_ROLLOUT=0

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Initialize logging
init_logging() {
    mkdir -p "$LOG_DIR"
    touch "$DEPLOYMENT_LOG" "$AUDIT_LOG"
    
    # Set up log rotation if logrotate is available
    if command -v logrotate &> /dev/null; then
        cat > "/tmp/deployment-logrotate.conf" << EOF
$LOG_DIR/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
}
EOF
        logrotate -f "/tmp/deployment-logrotate.conf" 2>/dev/null || true
    fi
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$DEPLOYMENT_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$DEPLOYMENT_LOG"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$DEPLOYMENT_LOG"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$DEPLOYMENT_LOG"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[$timestamp] 🔍${NC} $message" | tee -a "$DEPLOYMENT_LOG"
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
    local deployment_id="${DEPLOYMENT_ID:-unknown}"
    
    log "AUDIT" "DEPLOYMENT_ID=$deployment_id USER=$user ACTION=$action DETAILS=$details"
}

# Progress tracking
update_deployment_phase() {
    local phase="$1"
    local status="$2"  # STARTED, COMPLETED, FAILED
    
    CURRENT_PHASE="$phase"
    
    case "$status" in
        "STARTED")
            log "INFO" "🚀 Starting phase: $phase"
            audit_log "PHASE_STARTED" "phase=$phase"
            ;;
        "COMPLETED")
            log "SUCCESS" "✅ Completed phase: $phase"
            audit_log "PHASE_COMPLETED" "phase=$phase"
            DEPLOYMENT_PHASES+=("$phase:COMPLETED")
            ;;
        "FAILED")
            log "ERROR" "❌ Failed phase: $phase"
            audit_log "PHASE_FAILED" "phase=$phase"
            FAILED_PHASE="$phase"
            DEPLOYMENT_PHASES+=("$phase:FAILED")
            ;;
    esac
}

# Generate unique deployment ID
generate_deployment_id() {
    DEPLOYMENT_ID="deploy-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    log "INFO" "Generated deployment ID: $DEPLOYMENT_ID"
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate prerequisites
validate_prerequisites() {
    update_deployment_phase "PREREQUISITES_CHECK" "STARTED"
    
    local missing_tools=()
    
    # Check required tools
    local required_tools=("kubectl" "docker" "node" "npm" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log "ERROR" "Missing required tools: ${missing_tools[*]}"
        update_deployment_phase "PREREQUISITES_CHECK" "FAILED"
        return 1
    fi
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        update_deployment_phase "PREREQUISITES_CHECK" "FAILED"
        return 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "ERROR" "Namespace '$NAMESPACE' does not exist"
        update_deployment_phase "PREREQUISITES_CHECK" "FAILED"
        return 1
    fi
    
    # Check project structure
    local required_files=(
        "$PROJECT_ROOT/package.json"
        "$PROJECT_ROOT/infrastructure/production/kubernetes/deployment.yaml"
        "$PROJECT_ROOT/infrastructure/production/kubernetes/configmap.yaml"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log "ERROR" "Required file not found: $file"
            update_deployment_phase "PREREQUISITES_CHECK" "FAILED"
            return 1
        fi
    done
    
    update_deployment_phase "PREREQUISITES_CHECK" "COMPLETED"
    return 0
}

# Validate environment configuration
validate_environment() {
    update_deployment_phase "ENVIRONMENT_VALIDATION" "STARTED"
    
    # Check environment-specific configuration
    local env_config_file="$PROJECT_ROOT/infrastructure/production/env/.env.$ENVIRONMENT"
    if [[ ! -f "$env_config_file" ]]; then
        log "WARNING" "Environment config file not found: $env_config_file"
    fi
    
    # Validate Kubernetes resources
    local manifest_dir="$PROJECT_ROOT/infrastructure/production/kubernetes"
    local manifests=(
        "$manifest_dir/namespace.yaml"
        "$manifest_dir/configmap.yaml"
        "$manifest_dir/deployment.yaml"
        "$manifest_dir/service.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [[ -f "$manifest" ]]; then
            if ! kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
                log "ERROR" "Invalid Kubernetes manifest: $manifest"
                update_deployment_phase "ENVIRONMENT_VALIDATION" "FAILED"
                return 1
            fi
        fi
    done
    
    # Validate secrets exist
    local required_secrets=("supabase-secrets" "ai-secrets" "security-secrets")
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            log "WARNING" "Secret '$secret' not found in namespace '$NAMESPACE'"
        fi
    done
    
    update_deployment_phase "ENVIRONMENT_VALIDATION" "COMPLETED"
    return 0
}

# ============================================================================
# BACKUP AND SAFETY FUNCTIONS
# ============================================================================

# Create deployment backup
create_deployment_backup() {
    update_deployment_phase "BACKUP_CREATION" "STARTED"

    mkdir -p "$BACKUP_DIR"

    # Backup current Kubernetes state
    log "INFO" "Creating Kubernetes state backup..."
    kubectl get all -n "$NAMESPACE" -o yaml > "$BACKUP_DIR/kubernetes-state.yaml" 2>/dev/null || true
    kubectl get configmaps -n "$NAMESPACE" -o yaml > "$BACKUP_DIR/configmaps.yaml" 2>/dev/null || true
    kubectl get secrets -n "$NAMESPACE" -o yaml > "$BACKUP_DIR/secrets.yaml" 2>/dev/null || true

    # Backup current image tags
    log "INFO" "Recording current image versions..."
    kubectl get deployments -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}:{.spec.template.spec.containers[0].image}{"\n"}{end}' > "$BACKUP_DIR/current-images.txt" 2>/dev/null || true

    # Backup current feature flag configuration
    log "INFO" "Backing up feature flag configuration..."
    kubectl get configmap paperless-maverick-config -n "$NAMESPACE" -o yaml > "$BACKUP_DIR/feature-flags.yaml" 2>/dev/null || true

    # Create deployment metadata
    cat > "$BACKUP_DIR/deployment-metadata.json" << EOF
{
    "deployment_id": "$DEPLOYMENT_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "image_tag": "$IMAGE_TAG",
    "user": "${USER:-unknown}",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')"
}
EOF

    log "SUCCESS" "Backup created at: $BACKUP_DIR"
    update_deployment_phase "BACKUP_CREATION" "COMPLETED"
    return 0
}

# ============================================================================
# DEPLOYMENT PHASES
# ============================================================================

# Phase 1: Infrastructure Deployment
deploy_infrastructure() {
    update_deployment_phase "INFRASTRUCTURE_DEPLOYMENT" "STARTED"

    local manifest_dir="$PROJECT_ROOT/infrastructure/production/kubernetes"
    local manifests=(
        "$manifest_dir/namespace.yaml"
        "$manifest_dir/configmap.yaml"
        "$manifest_dir/secrets.yaml"
        "$manifest_dir/deployment.yaml"
        "$manifest_dir/service.yaml"
        "$manifest_dir/hpa.yaml"
    )

    for manifest in "${manifests[@]}"; do
        if [[ -f "$manifest" ]]; then
            log "INFO" "Applying manifest: $(basename "$manifest")"

            if [[ "$DRY_RUN" == "true" ]]; then
                kubectl apply --dry-run=client -f "$manifest"
            else
                kubectl apply -f "$manifest"
            fi
        else
            log "WARNING" "Manifest not found: $manifest"
        fi
    done

    # Deploy worker infrastructure
    local worker_manifest_dir="$PROJECT_ROOT/infrastructure/production/kubernetes/workers"
    if [[ -d "$worker_manifest_dir" ]]; then
        log "INFO" "Deploying worker infrastructure..."

        local worker_manifests=(
            "$worker_manifest_dir/embedding-worker-configmap.yaml"
            "$worker_manifest_dir/embedding-queue-worker-deployment.yaml"
            "$worker_manifest_dir/embedding-worker-hpa.yaml"
            "$worker_manifest_dir/worker-health-monitoring.yaml"
        )

        for manifest in "${worker_manifests[@]}"; do
            if [[ -f "$manifest" ]]; then
                log "INFO" "Applying worker manifest: $(basename "$manifest")"

                if [[ "$DRY_RUN" == "true" ]]; then
                    kubectl apply --dry-run=client -f "$manifest"
                else
                    kubectl apply -f "$manifest"
                fi
            fi
        done
    fi

    update_deployment_phase "INFRASTRUCTURE_DEPLOYMENT" "COMPLETED"
    return 0
}

# Phase 2: Database Migration
deploy_database_migrations() {
    update_deployment_phase "DATABASE_MIGRATION" "STARTED"

    # Call database migration automation script
    local migration_script="$SCRIPT_DIR/migrate-database.sh"
    if [[ -f "$migration_script" ]]; then
        log "INFO" "Running database migrations..."

        if [[ "$DRY_RUN" == "true" ]]; then
            "$migration_script" --dry-run --environment "$ENVIRONMENT"
        else
            "$migration_script" --environment "$ENVIRONMENT"
        fi
    else
        log "WARNING" "Database migration script not found: $migration_script"
    fi

    update_deployment_phase "DATABASE_MIGRATION" "COMPLETED"
    return 0
}

# Phase 3: Application Deployment
deploy_application() {
    update_deployment_phase "APPLICATION_DEPLOYMENT" "STARTED"

    # Update image tag in deployment
    log "INFO" "Updating application image to: $IMAGE_TAG"

    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl set image deployment/paperless-maverick \
            paperless-maverick="paperless-maverick:$IMAGE_TAG" \
            -n "$NAMESPACE"

        # Wait for rollout to complete
        log "INFO" "Waiting for application rollout to complete..."
        kubectl rollout status deployment/paperless-maverick \
            -n "$NAMESPACE" \
            --timeout="${DEPLOYMENT_TIMEOUT}s"
    else
        log "INFO" "DRY RUN: Would update image to $IMAGE_TAG"
    fi

    update_deployment_phase "APPLICATION_DEPLOYMENT" "COMPLETED"
    return 0
}

# Phase 4: Feature Flag Configuration
deploy_feature_flags() {
    update_deployment_phase "FEATURE_FLAG_DEPLOYMENT" "STARTED"

    # Update feature flag configuration
    log "INFO" "Configuring feature flags..."

    if [[ "$DRY_RUN" == "false" ]]; then
        # Update ConfigMap with new feature flag values
        kubectl patch configmap paperless-maverick-config \
            -n "$NAMESPACE" \
            --patch "{\"data\":{\"EMBEDDING_MONITORING_ROLLOUT_PERCENTAGE\":\"$EMBEDDING_MONITORING_ROLLOUT\",\"QUEUE_PROCESSING_ROLLOUT_PERCENTAGE\":\"$QUEUE_PROCESSING_ROLLOUT\",\"BATCH_OPTIMIZATION_ROLLOUT_PERCENTAGE\":\"$BATCH_OPTIMIZATION_ROLLOUT\"}}"

        # Restart deployments to pick up new configuration
        kubectl rollout restart deployment/paperless-maverick -n "$NAMESPACE"
        kubectl rollout restart deployment/embedding-queue-workers -n "$NAMESPACE" 2>/dev/null || true
    else
        log "INFO" "DRY RUN: Would configure feature flags"
    fi

    update_deployment_phase "FEATURE_FLAG_DEPLOYMENT" "COMPLETED"
    return 0
}

# Phase 5: Monitoring Setup
deploy_monitoring() {
    update_deployment_phase "MONITORING_DEPLOYMENT" "STARTED"

    # Call monitoring setup automation script
    local monitoring_script="$SCRIPT_DIR/setup-monitoring.sh"
    if [[ -f "$monitoring_script" ]]; then
        log "INFO" "Setting up monitoring infrastructure..."

        if [[ "$DRY_RUN" == "true" ]]; then
            "$monitoring_script" --dry-run --environment "$ENVIRONMENT"
        else
            "$monitoring_script" --environment "$ENVIRONMENT"
        fi
    else
        log "WARNING" "Monitoring setup script not found: $monitoring_script"
    fi

    update_deployment_phase "MONITORING_DEPLOYMENT" "COMPLETED"
    return 0
}

# ============================================================================
# VALIDATION AND HEALTH CHECKS
# ============================================================================

# Post-deployment validation
validate_deployment() {
    update_deployment_phase "DEPLOYMENT_VALIDATION" "STARTED"

    # Check deployment status
    log "INFO" "Validating deployment status..."

    local deployments=("paperless-maverick")
    if kubectl get deployment embedding-queue-workers -n "$NAMESPACE" &> /dev/null; then
        deployments+=("embedding-queue-workers")
    fi

    for deployment in "${deployments[@]}"; do
        log "INFO" "Checking deployment: $deployment"

        # Check if deployment is ready
        local ready_replicas
        ready_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired_replicas
        desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

        if [[ "$ready_replicas" != "$desired_replicas" ]]; then
            log "ERROR" "Deployment $deployment not ready: $ready_replicas/$desired_replicas replicas"
            update_deployment_phase "DEPLOYMENT_VALIDATION" "FAILED"
            return 1
        fi

        log "SUCCESS" "Deployment $deployment is ready: $ready_replicas/$desired_replicas replicas"
    done

    # Health check endpoints
    log "INFO" "Performing health checks..."

    # Get service endpoint
    local service_ip
    service_ip=$(kubectl get service paperless-maverick -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

    if [[ -n "$service_ip" ]]; then
        # Health check
        local health_url="http://$service_ip:3000/health"
        local max_attempts=30
        local attempt=1

        while [[ $attempt -le $max_attempts ]]; do
            log "DEBUG" "Health check attempt $attempt/$max_attempts"

            if kubectl run health-check-pod --rm -i --restart=Never --image=curlimages/curl -- \
                curl -f -s "$health_url" &> /dev/null; then
                log "SUCCESS" "Health check passed"
                break
            fi

            if [[ $attempt -eq $max_attempts ]]; then
                log "ERROR" "Health check failed after $max_attempts attempts"
                update_deployment_phase "DEPLOYMENT_VALIDATION" "FAILED"
                return 1
            fi

            sleep 10
            ((attempt++))
        done
    else
        log "WARNING" "Could not determine service IP for health checks"
    fi

    update_deployment_phase "DEPLOYMENT_VALIDATION" "COMPLETED"
    return 0
}

# Performance validation
validate_performance() {
    update_deployment_phase "PERFORMANCE_VALIDATION" "STARTED"

    # Call performance validation script
    local perf_script="$SCRIPT_DIR/validate-performance.sh"
    if [[ -f "$perf_script" ]]; then
        log "INFO" "Running performance validation..."

        if [[ "$DRY_RUN" == "true" ]]; then
            "$perf_script" --dry-run --environment "$ENVIRONMENT"
        else
            "$perf_script" --environment "$ENVIRONMENT"
        fi
    else
        log "WARNING" "Performance validation script not found: $perf_script"
    fi

    update_deployment_phase "PERFORMANCE_VALIDATION" "COMPLETED"
    return 0
}

# ============================================================================
# ROLLBACK FUNCTIONS
# ============================================================================

# Execute rollback
execute_rollback() {
    update_deployment_phase "ROLLBACK_EXECUTION" "STARTED"

    log "WARNING" "Initiating deployment rollback..."
    audit_log "ROLLBACK_INITIATED" "deployment_id=$DEPLOYMENT_ID failed_phase=$FAILED_PHASE"

    # Find latest backup
    local latest_backup
    latest_backup=$(find "$PROJECT_ROOT/backups" -name "deployment-*" -type d | sort -r | head -n 1)

    if [[ -z "$latest_backup" ]]; then
        log "ERROR" "No backup found for rollback"
        update_deployment_phase "ROLLBACK_EXECUTION" "FAILED"
        return 1
    fi

    log "INFO" "Using backup: $latest_backup"

    # Rollback deployments
    log "INFO" "Rolling back application deployment..."
    kubectl rollout undo deployment/paperless-maverick -n "$NAMESPACE"

    if kubectl get deployment embedding-queue-workers -n "$NAMESPACE" &> /dev/null; then
        log "INFO" "Rolling back worker deployment..."
        kubectl rollout undo deployment/embedding-queue-workers -n "$NAMESPACE"
    fi

    # Wait for rollback to complete
    log "INFO" "Waiting for rollback to complete..."
    kubectl rollout status deployment/paperless-maverick -n "$NAMESPACE" --timeout=300s

    # Restore feature flag configuration if backup exists
    if [[ -f "$latest_backup/feature-flags.yaml" ]]; then
        log "INFO" "Restoring feature flag configuration..."
        kubectl apply -f "$latest_backup/feature-flags.yaml"
    fi

    log "SUCCESS" "Rollback completed successfully"
    audit_log "ROLLBACK_COMPLETED" "deployment_id=$DEPLOYMENT_ID backup_used=$latest_backup"

    update_deployment_phase "ROLLBACK_EXECUTION" "COMPLETED"
    return 0
}

# ============================================================================
# MAIN ORCHESTRATION FUNCTIONS
# ============================================================================

# Main deployment orchestration
main_deployment() {
    log "INFO" "🚀 Starting Paperless Maverick deployment orchestration"
    log "INFO" "Deployment ID: $DEPLOYMENT_ID"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Image Tag: $IMAGE_TAG"
    log "INFO" "Dry Run: $DRY_RUN"
    log "INFO" "=================================================="

    DEPLOYMENT_START_TIME=$(date +%s)
    audit_log "DEPLOYMENT_STARTED" "deployment_id=$DEPLOYMENT_ID environment=$ENVIRONMENT image_tag=$IMAGE_TAG"

    # Set up error handling
    trap 'handle_deployment_failure' ERR

    # Phase 1: Prerequisites and validation
    validate_prerequisites || return 1
    validate_environment || return 1

    # Phase 2: Create backup
    create_deployment_backup || return 1

    # Phase 3: Deploy infrastructure
    if [[ "$STAGED_DEPLOYMENT" == "true" ]]; then
        log "INFO" "🔄 Staged deployment mode - deploying infrastructure first"
        deploy_infrastructure || return 1

        log "INFO" "⏸️  Infrastructure deployed. Waiting for manual approval to continue..."
        read -p "Continue with application deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "INFO" "Deployment paused by user"
            return 0
        fi
    else
        deploy_infrastructure || return 1
    fi

    # Phase 4: Database migrations
    deploy_database_migrations || return 1

    # Phase 5: Application deployment
    deploy_application || return 1

    # Phase 6: Feature flags (if not feature-flags-only mode)
    if [[ "$FEATURE_FLAGS_ONLY" == "false" ]]; then
        deploy_feature_flags || return 1
    fi

    # Phase 7: Monitoring setup (if not monitoring-only mode)
    if [[ "$MONITORING_ONLY" == "false" ]]; then
        deploy_monitoring || return 1
    fi

    # Phase 8: Validation
    if [[ "$SKIP_TESTS" == "false" ]]; then
        validate_deployment || return 1
        validate_performance || return 1
    fi

    # Deployment summary
    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))

    log "SUCCESS" "🎉 Deployment completed successfully!"
    log "INFO" "=================================================="
    log "INFO" "Deployment Summary:"
    log "INFO" "  - Deployment ID: $DEPLOYMENT_ID"
    log "INFO" "  - Duration: ${deployment_duration}s"
    log "INFO" "  - Environment: $ENVIRONMENT"
    log "INFO" "  - Image Tag: $IMAGE_TAG"
    log "INFO" "  - Phases Completed: ${#DEPLOYMENT_PHASES[@]}"
    log "INFO" "  - Backup Location: $BACKUP_DIR"
    log "INFO" "=================================================="

    audit_log "DEPLOYMENT_COMPLETED" "deployment_id=$DEPLOYMENT_ID duration=${deployment_duration}s phases=${#DEPLOYMENT_PHASES[@]}"

    return 0
}

# Handle deployment failures
handle_deployment_failure() {
    local exit_code=$?

    log "ERROR" "💥 Deployment failed in phase: $CURRENT_PHASE"
    audit_log "DEPLOYMENT_FAILED" "deployment_id=$DEPLOYMENT_ID failed_phase=$CURRENT_PHASE exit_code=$exit_code"

    if [[ "$FORCE" == "false" ]]; then
        log "WARNING" "Automatic rollback will be initiated..."
        execute_rollback
    else
        log "WARNING" "Force mode enabled - skipping automatic rollback"
    fi

    exit $exit_code
}

# Feature flags only deployment
deploy_feature_flags_only() {
    log "INFO" "🎛️  Feature flags only deployment mode"

    validate_prerequisites || return 1
    create_deployment_backup || return 1
    deploy_feature_flags || return 1

    log "SUCCESS" "Feature flags deployment completed"
    return 0
}

# Monitoring only deployment
deploy_monitoring_only() {
    log "INFO" "📊 Monitoring only deployment mode"

    validate_prerequisites || return 1
    create_deployment_backup || return 1
    deploy_monitoring || return 1

    log "SUCCESS" "Monitoring deployment completed"
    return 0
}

# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

# Show help
show_help() {
    cat << EOF
Paperless Maverick Master Deployment Orchestration Script v$SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

DESCRIPTION:
    Comprehensive deployment automation for Paperless Maverick with staging,
    validation, rollback capabilities, and feature flag management.

OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: $DEFAULT_ENVIRONMENT)
    -n, --namespace NS          Kubernetes namespace (default: $DEFAULT_NAMESPACE)
    -t, --image-tag TAG         Docker image tag (default: $DEFAULT_IMAGE_TAG)
    -d, --dry-run              Perform dry run without making changes
    -v, --validate-only        Only validate configuration
    -r, --rollback             Rollback to previous deployment
    -s, --skip-tests           Skip post-deployment tests
    -f, --force                Force deployment, skip rollback on failure
    --verbose                  Enable verbose logging
    --staged                   Staged deployment with manual approval
    --feature-flags-only       Deploy only feature flag changes
    --monitoring-only          Deploy only monitoring changes
    --embedding-rollout PCT    Embedding monitoring rollout percentage (0-100)
    --queue-rollout PCT        Queue processing rollout percentage (0-100)
    --batch-rollout PCT        Batch optimization rollout percentage (0-100)

EXAMPLES:
    # Full production deployment
    $SCRIPT_NAME --environment production --image-tag v1.2.3

    # Dry run validation
    $SCRIPT_NAME --dry-run --validate-only

    # Staged deployment with manual approval
    $SCRIPT_NAME --staged --environment production

    # Feature flags only deployment
    $SCRIPT_NAME --feature-flags-only --embedding-rollout 25

    # Rollback deployment
    $SCRIPT_NAME --rollback

    # Emergency deployment with force mode
    $SCRIPT_NAME --force --skip-tests --image-tag hotfix-v1.2.4

ENVIRONMENT VARIABLES:
    DEPLOYMENT_LOG_LEVEL       Log level (DEBUG, INFO, WARNING, ERROR)
    DEPLOYMENT_TIMEOUT         Deployment timeout in seconds (default: 600)
    HEALTH_CHECK_TIMEOUT       Health check timeout in seconds (default: 300)

FILES:
    $DEPLOYMENT_LOG            Deployment log
    $AUDIT_LOG                 Audit log
    $BACKUP_DIR                Backup directory

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
            -t|--image-tag)
                IMAGE_TAG="$2"
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
            -r|--rollback)
                ROLLBACK=true
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
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
            --staged)
                STAGED_DEPLOYMENT=true
                shift
                ;;
            --feature-flags-only)
                FEATURE_FLAGS_ONLY=true
                shift
                ;;
            --monitoring-only)
                MONITORING_ONLY=true
                shift
                ;;
            --embedding-rollout)
                EMBEDDING_MONITORING_ROLLOUT="$2"
                shift 2
                ;;
            --queue-rollout)
                QUEUE_PROCESSING_ROLLOUT="$2"
                shift 2
                ;;
            --batch-rollout)
                BATCH_OPTIMIZATION_ROLLOUT="$2"
                shift 2
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Validate rollout percentages
    for rollout in "$EMBEDDING_MONITORING_ROLLOUT" "$QUEUE_PROCESSING_ROLLOUT" "$BATCH_OPTIMIZATION_ROLLOUT"; do
        if [[ ! "$rollout" =~ ^[0-9]+$ ]] || [[ "$rollout" -lt 0 ]] || [[ "$rollout" -gt 100 ]]; then
            log "ERROR" "Invalid rollout percentage: $rollout (must be 0-100)"
            exit 1
        fi
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

    # Generate deployment ID
    generate_deployment_id

    # Log startup information
    log "INFO" "Paperless Maverick Master Deployment Script v$SCRIPT_VERSION"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: ${USER:-unknown}"
    log "INFO" "Working directory: $(pwd)"
    log "INFO" "Script directory: $SCRIPT_DIR"
    log "INFO" "Project root: $PROJECT_ROOT"

    # Handle special modes
    if [[ "$ROLLBACK" == "true" ]]; then
        log "INFO" "🔄 Rollback mode activated"
        execute_rollback
        exit $?
    fi

    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "INFO" "✅ Validation-only mode activated"
        validate_prerequisites
        validate_environment
        log "SUCCESS" "Validation completed successfully"
        exit 0
    fi

    if [[ "$FEATURE_FLAGS_ONLY" == "true" ]]; then
        deploy_feature_flags_only
        exit $?
    fi

    if [[ "$MONITORING_ONLY" == "true" ]]; then
        deploy_monitoring_only
        exit $?
    fi

    # Run main deployment
    main_deployment
    exit $?
}

# Execute main function with all arguments
main "$@"
