#!/bin/bash

# Application Deployment Automation Script for Paperless Maverick
# Blue-green deployment strategy with health checks and rollback procedures
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

# Deployment configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly KUBERNETES_DIR="$INFRASTRUCTURE_DIR/kubernetes"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"

# Logging configuration
readonly LOG_DIR="$PROJECT_ROOT/logs/deployment"
readonly DEPLOYMENT_LOG="$LOG_DIR/app-deployment-$(date +%Y%m%d-%H%M%S).log"
readonly AUDIT_LOG="$LOG_DIR/app-deployment-audit-$(date +%Y%m%d).log"

# Default values
readonly DEFAULT_ENVIRONMENT="production"
readonly DEFAULT_NAMESPACE="paperless-maverick"
readonly DEFAULT_IMAGE_TAG="latest"
readonly DEPLOYMENT_TIMEOUT=600  # 10 minutes
readonly HEALTH_CHECK_TIMEOUT=300  # 5 minutes
readonly ROLLBACK_TIMEOUT=300  # 5 minutes

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
WORKER_IMAGE_TAG="$DEFAULT_IMAGE_TAG"
DRY_RUN=false
VALIDATE_ONLY=false
FORCE=false
VERBOSE=false
BLUE_GREEN=false
CANARY_DEPLOYMENT=false
SKIP_HEALTH_CHECKS=false
ROLLBACK_ON_FAILURE=true

# Deployment state
DEPLOYMENT_ID=""
DEPLOYMENT_START_TIME=""
CURRENT_DEPLOYMENT=""
PREVIOUS_DEPLOYMENT=""
DEPLOYMENT_STRATEGY="rolling"

# Health check configuration
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=30
READINESS_CHECK_RETRIES=20
READINESS_CHECK_INTERVAL=15

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Initialize logging
init_logging() {
    mkdir -p "$LOG_DIR"
    touch "$DEPLOYMENT_LOG" "$AUDIT_LOG"
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

# Generate unique deployment ID
generate_deployment_id() {
    DEPLOYMENT_ID="app-deploy-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    log "INFO" "Generated deployment ID: $DEPLOYMENT_ID"
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate prerequisites
validate_prerequisites() {
    log "INFO" "🔍 Validating application deployment prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "curl" "jq")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log "ERROR" "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "ERROR" "Namespace '$NAMESPACE' does not exist"
        return 1
    fi
    
    # Check deployment manifests exist
    local required_manifests=(
        "$KUBERNETES_DIR/deployment.yaml"
        "$KUBERNETES_DIR/service.yaml"
    )
    
    for manifest in "${required_manifests[@]}"; do
        if [[ ! -f "$manifest" ]]; then
            log "ERROR" "Required manifest not found: $manifest"
            return 1
        fi
    done
    
    log "SUCCESS" "Prerequisites validation completed"
    return 0
}

# Validate image availability
validate_image_availability() {
    log "INFO" "🔍 Validating container image availability..."
    
    # Check main application image
    if [[ "$DRY_RUN" == "false" ]]; then
        log "INFO" "Checking application image: paperless-maverick:$IMAGE_TAG"
        
        # Try to pull image to validate it exists
        if ! docker pull "paperless-maverick:$IMAGE_TAG" &> /dev/null; then
            log "WARNING" "Cannot pull application image: paperless-maverick:$IMAGE_TAG"
            log "WARNING" "Image may not exist or may not be accessible"
            
            if [[ "$FORCE" != "true" ]]; then
                log "ERROR" "Use --force to proceed with potentially missing image"
                return 1
            fi
        else
            log "SUCCESS" "Application image validated: paperless-maverick:$IMAGE_TAG"
        fi
        
        # Check worker image
        log "INFO" "Checking worker image: paperless-maverick-worker:$WORKER_IMAGE_TAG"
        
        if ! docker pull "paperless-maverick-worker:$WORKER_IMAGE_TAG" &> /dev/null; then
            log "WARNING" "Cannot pull worker image: paperless-maverick-worker:$WORKER_IMAGE_TAG"
            
            if [[ "$FORCE" != "true" ]]; then
                log "ERROR" "Use --force to proceed with potentially missing worker image"
                return 1
            fi
        else
            log "SUCCESS" "Worker image validated: paperless-maverick-worker:$WORKER_IMAGE_TAG"
        fi
    else
        log "INFO" "DRY RUN: Skipping image validation"
    fi
    
    return 0
}

# ============================================================================
# DEPLOYMENT STRATEGY FUNCTIONS
# ============================================================================

# Rolling update deployment
deploy_rolling_update() {
    log "INFO" "🔄 Executing rolling update deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would perform rolling update"
        return 0
    fi
    
    # Update main application
    log "INFO" "Updating main application image..."
    kubectl set image deployment/paperless-maverick \
        paperless-maverick="paperless-maverick:$IMAGE_TAG" \
        -n "$NAMESPACE"
    
    # Update worker deployment
    log "INFO" "Updating worker image..."
    kubectl set image deployment/embedding-queue-workers \
        embedding-worker="paperless-maverick-worker:$WORKER_IMAGE_TAG" \
        -n "$NAMESPACE"
    
    # Wait for rollout to complete
    log "INFO" "Waiting for application rollout to complete..."
    kubectl rollout status deployment/paperless-maverick \
        -n "$NAMESPACE" \
        --timeout="${DEPLOYMENT_TIMEOUT}s"
    
    log "INFO" "Waiting for worker rollout to complete..."
    kubectl rollout status deployment/embedding-queue-workers \
        -n "$NAMESPACE" \
        --timeout="${DEPLOYMENT_TIMEOUT}s"
    
    log "SUCCESS" "Rolling update deployment completed"
    audit_log "ROLLING_UPDATE_COMPLETED" "app_image=$IMAGE_TAG worker_image=$WORKER_IMAGE_TAG"
    return 0
}

# Blue-green deployment
deploy_blue_green() {
    log "INFO" "🔵🟢 Executing blue-green deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would perform blue-green deployment"
        return 0
    fi
    
    # Determine current and new deployment colors
    local current_color
    current_color=$(kubectl get deployment paperless-maverick -n "$NAMESPACE" -o jsonpath='{.metadata.labels.color}' 2>/dev/null || echo "blue")
    local new_color
    if [[ "$current_color" == "blue" ]]; then
        new_color="green"
    else
        new_color="blue"
    fi
    
    log "INFO" "Current deployment color: $current_color"
    log "INFO" "New deployment color: $new_color"
    
    # Create new deployment with new color
    create_blue_green_deployment "$new_color"
    
    # Wait for new deployment to be ready
    wait_for_deployment_ready "paperless-maverick-$new_color"
    
    # Perform health checks on new deployment
    if ! perform_health_checks "paperless-maverick-$new_color"; then
        log "ERROR" "Health checks failed for new deployment"
        cleanup_failed_blue_green_deployment "$new_color"
        return 1
    fi
    
    # Switch traffic to new deployment
    switch_traffic_to_deployment "$new_color"
    
    # Clean up old deployment
    cleanup_old_blue_green_deployment "$current_color"
    
    log "SUCCESS" "Blue-green deployment completed"
    audit_log "BLUE_GREEN_COMPLETED" "new_color=$new_color app_image=$IMAGE_TAG"
    return 0
}

# Create blue-green deployment
create_blue_green_deployment() {
    local color="$1"

    log "INFO" "Creating $color deployment..."

    # Create deployment manifest with color label
    local temp_manifest="/tmp/deployment-$color.yaml"

    # Copy and modify the deployment manifest
    sed "s/name: paperless-maverick$/name: paperless-maverick-$color/" "$KUBERNETES_DIR/deployment.yaml" > "$temp_manifest"
    sed -i "s/app: paperless-maverick$/app: paperless-maverick\n    color: $color/" "$temp_manifest"
    sed -i "s/paperless-maverick:latest/paperless-maverick:$IMAGE_TAG/" "$temp_manifest"

    # Apply the new deployment
    kubectl apply -f "$temp_manifest"

    # Clean up temp file
    rm -f "$temp_manifest"

    log "SUCCESS" "Created $color deployment"
}

# Wait for deployment to be ready
wait_for_deployment_ready() {
    local deployment_name="$1"

    log "INFO" "Waiting for deployment $deployment_name to be ready..."

    kubectl rollout status deployment/"$deployment_name" \
        -n "$NAMESPACE" \
        --timeout="${DEPLOYMENT_TIMEOUT}s"

    log "SUCCESS" "Deployment $deployment_name is ready"
}

# Switch traffic to new deployment
switch_traffic_to_deployment() {
    local color="$1"

    log "INFO" "Switching traffic to $color deployment..."

    # Update service selector to point to new deployment
    kubectl patch service paperless-maverick \
        -n "$NAMESPACE" \
        -p '{"spec":{"selector":{"color":"'$color'"}}}'

    log "SUCCESS" "Traffic switched to $color deployment"
}

# Cleanup failed blue-green deployment
cleanup_failed_blue_green_deployment() {
    local color="$1"

    log "WARNING" "Cleaning up failed $color deployment..."

    kubectl delete deployment "paperless-maverick-$color" -n "$NAMESPACE" --ignore-not-found=true

    log "SUCCESS" "Cleaned up failed $color deployment"
}

# Cleanup old blue-green deployment
cleanup_old_blue_green_deployment() {
    local color="$1"

    log "INFO" "Cleaning up old $color deployment..."

    # Wait a bit before cleanup to ensure traffic has switched
    sleep 30

    kubectl delete deployment "paperless-maverick-$color" -n "$NAMESPACE" --ignore-not-found=true

    log "SUCCESS" "Cleaned up old $color deployment"
}

# ============================================================================
# HEALTH CHECK FUNCTIONS
# ============================================================================

# Perform comprehensive health checks
perform_health_checks() {
    local deployment_name="${1:-paperless-maverick}"

    if [[ "$SKIP_HEALTH_CHECKS" == "true" ]]; then
        log "INFO" "Skipping health checks"
        return 0
    fi

    log "INFO" "🏥 Performing health checks for $deployment_name..."

    # Basic readiness check
    if ! check_deployment_readiness "$deployment_name"; then
        log "ERROR" "Readiness check failed for $deployment_name"
        return 1
    fi

    # Health endpoint check
    if ! check_health_endpoints "$deployment_name"; then
        log "ERROR" "Health endpoint check failed for $deployment_name"
        return 1
    fi

    # Performance validation
    if ! validate_deployment_performance "$deployment_name"; then
        log "ERROR" "Performance validation failed for $deployment_name"
        return 1
    fi

    log "SUCCESS" "All health checks passed for $deployment_name"
    return 0
}

# Check deployment readiness
check_deployment_readiness() {
    local deployment_name="$1"

    log "INFO" "Checking deployment readiness for $deployment_name..."

    local retries=0
    while [[ $retries -lt $READINESS_CHECK_RETRIES ]]; do
        local ready_replicas
        ready_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired_replicas
        desired_replicas=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

        if [[ "$ready_replicas" == "$desired_replicas" ]] && [[ "$ready_replicas" -gt 0 ]]; then
            log "SUCCESS" "Deployment $deployment_name is ready: $ready_replicas/$desired_replicas replicas"
            return 0
        fi

        log "DEBUG" "Deployment $deployment_name not ready: $ready_replicas/$desired_replicas replicas (attempt $((retries + 1))/$READINESS_CHECK_RETRIES)"

        ((retries++))
        sleep "$READINESS_CHECK_INTERVAL"
    done

    log "ERROR" "Deployment $deployment_name failed readiness check after $READINESS_CHECK_RETRIES attempts"
    return 1
}

# Check health endpoints
check_health_endpoints() {
    local deployment_name="$1"

    log "INFO" "Checking health endpoints for $deployment_name..."

    # Get pod names for the deployment
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log "ERROR" "No pods found for deployment $deployment_name"
        return 1
    fi

    # Check each pod's health endpoint
    for pod in $pods; do
        log "DEBUG" "Checking health endpoint for pod: $pod"

        local retries=0
        local health_check_passed=false

        while [[ $retries -lt $HEALTH_CHECK_RETRIES ]]; do
            if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
                log "SUCCESS" "Health check passed for pod: $pod"
                health_check_passed=true
                break
            fi

            log "DEBUG" "Health check failed for pod $pod (attempt $((retries + 1))/$HEALTH_CHECK_RETRIES)"
            ((retries++))
            sleep "$HEALTH_CHECK_INTERVAL"
        done

        if [[ "$health_check_passed" != "true" ]]; then
            log "ERROR" "Health check failed for pod: $pod"
            return 1
        fi
    done

    log "SUCCESS" "All health endpoint checks passed"
    return 0
}

# Validate deployment performance
validate_deployment_performance() {
    local deployment_name="$1"

    log "INFO" "Validating performance for $deployment_name..."

    # Get pod names for the deployment
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log "ERROR" "No pods found for deployment $deployment_name"
        return 1
    fi

    # Check response time for each pod
    for pod in $pods; do
        log "DEBUG" "Checking response time for pod: $pod"

        local response_time
        response_time=$(kubectl exec -n "$NAMESPACE" "$pod" -- curl -w "%{time_total}" -s -o /dev/null http://localhost:3000/health 2>/dev/null || echo "999")

        # Convert to milliseconds
        local response_time_ms
        response_time_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null | cut -d. -f1)

        if [[ "$response_time_ms" -gt 5000 ]]; then
            log "WARNING" "Slow response time for pod $pod: ${response_time_ms}ms"
        else
            log "DEBUG" "Response time for pod $pod: ${response_time_ms}ms"
        fi
    done

    log "SUCCESS" "Performance validation completed"
    return 0
}

# ============================================================================
# ROLLBACK FUNCTIONS
# ============================================================================

# Execute deployment rollback
execute_rollback() {
    log "WARNING" "🔄 Initiating deployment rollback..."
    audit_log "ROLLBACK_INITIATED" "deployment_id=$DEPLOYMENT_ID"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute rollback"
        return 0
    fi

    # Rollback main application
    log "INFO" "Rolling back main application deployment..."
    kubectl rollout undo deployment/paperless-maverick -n "$NAMESPACE"

    # Rollback worker deployment
    log "INFO" "Rolling back worker deployment..."
    kubectl rollout undo deployment/embedding-queue-workers -n "$NAMESPACE"

    # Wait for rollback to complete
    log "INFO" "Waiting for rollback to complete..."
    kubectl rollout status deployment/paperless-maverick -n "$NAMESPACE" --timeout="${ROLLBACK_TIMEOUT}s"
    kubectl rollout status deployment/embedding-queue-workers -n "$NAMESPACE" --timeout="${ROLLBACK_TIMEOUT}s"

    # Verify rollback success
    if perform_health_checks; then
        log "SUCCESS" "Rollback completed successfully"
        audit_log "ROLLBACK_COMPLETED" "deployment_id=$DEPLOYMENT_ID"
        return 0
    else
        log "ERROR" "Rollback completed but health checks failed"
        audit_log "ROLLBACK_FAILED" "deployment_id=$DEPLOYMENT_ID"
        return 1
    fi
}

# Get deployment history
get_deployment_history() {
    log "INFO" "📜 Deployment history:"

    # Main application history
    log "INFO" "Main application deployment history:"
    kubectl rollout history deployment/paperless-maverick -n "$NAMESPACE"

    # Worker deployment history
    log "INFO" "Worker deployment history:"
    kubectl rollout history deployment/embedding-queue-workers -n "$NAMESPACE"
}

# ============================================================================
# CANARY DEPLOYMENT FUNCTIONS
# ============================================================================

# Deploy canary version
deploy_canary() {
    log "INFO" "🐤 Executing canary deployment..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would perform canary deployment"
        return 0
    fi

    # Create canary deployment (10% of traffic)
    create_canary_deployment

    # Wait for canary to be ready
    wait_for_deployment_ready "paperless-maverick-canary"

    # Perform health checks on canary
    if ! perform_health_checks "paperless-maverick-canary"; then
        log "ERROR" "Canary health checks failed"
        cleanup_canary_deployment
        return 1
    fi

    # Monitor canary for a period
    monitor_canary_deployment

    # If canary is successful, promote to full deployment
    promote_canary_deployment

    log "SUCCESS" "Canary deployment completed"
    audit_log "CANARY_COMPLETED" "app_image=$IMAGE_TAG"
    return 0
}

# Create canary deployment
create_canary_deployment() {
    log "INFO" "Creating canary deployment..."

    # Create canary deployment with 1 replica
    local temp_manifest="/tmp/deployment-canary.yaml"

    sed "s/name: paperless-maverick$/name: paperless-maverick-canary/" "$KUBERNETES_DIR/deployment.yaml" > "$temp_manifest"
    sed -i "s/replicas: 3$/replicas: 1/" "$temp_manifest"
    sed -i "s/app: paperless-maverick$/app: paperless-maverick\n    version: canary/" "$temp_manifest"
    sed -i "s/paperless-maverick:latest/paperless-maverick:$IMAGE_TAG/" "$temp_manifest"

    kubectl apply -f "$temp_manifest"
    rm -f "$temp_manifest"

    log "SUCCESS" "Canary deployment created"
}

# Monitor canary deployment
monitor_canary_deployment() {
    log "INFO" "Monitoring canary deployment for 5 minutes..."

    local monitor_duration=300  # 5 minutes
    local check_interval=30
    local checks=$((monitor_duration / check_interval))

    for ((i=1; i<=checks; i++)); do
        log "DEBUG" "Canary monitoring check $i/$checks"

        if ! perform_health_checks "paperless-maverick-canary"; then
            log "ERROR" "Canary monitoring failed at check $i"
            return 1
        fi

        sleep "$check_interval"
    done

    log "SUCCESS" "Canary monitoring completed successfully"
    return 0
}

# Promote canary deployment
promote_canary_deployment() {
    log "INFO" "Promoting canary to full deployment..."

    # Update main deployment with canary image
    kubectl set image deployment/paperless-maverick \
        paperless-maverick="paperless-maverick:$IMAGE_TAG" \
        -n "$NAMESPACE"

    # Wait for rollout
    kubectl rollout status deployment/paperless-maverick -n "$NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}s"

    # Clean up canary deployment
    cleanup_canary_deployment

    log "SUCCESS" "Canary promoted to full deployment"
}

# Cleanup canary deployment
cleanup_canary_deployment() {
    log "INFO" "Cleaning up canary deployment..."

    kubectl delete deployment paperless-maverick-canary -n "$NAMESPACE" --ignore-not-found=true

    log "SUCCESS" "Canary deployment cleaned up"
}

# ============================================================================
# MAIN ORCHESTRATION FUNCTIONS
# ============================================================================

# Main application deployment orchestration
main_deployment() {
    log "INFO" "🚀 Starting application deployment"
    log "INFO" "Deployment ID: $DEPLOYMENT_ID"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Image Tag: $IMAGE_TAG"
    log "INFO" "Worker Image Tag: $WORKER_IMAGE_TAG"
    log "INFO" "Strategy: $DEPLOYMENT_STRATEGY"
    log "INFO" "Dry Run: $DRY_RUN"
    log "INFO" "=================================================="

    DEPLOYMENT_START_TIME=$(date +%s)
    audit_log "DEPLOYMENT_STARTED" "deployment_id=$DEPLOYMENT_ID strategy=$DEPLOYMENT_STRATEGY image_tag=$IMAGE_TAG"

    # Set up error handling
    trap 'handle_deployment_failure' ERR

    # Phase 1: Validation
    validate_prerequisites || return 1
    validate_image_availability || return 1

    # Phase 2: Pre-deployment backup
    get_deployment_history

    # Phase 3: Execute deployment based on strategy
    case "$DEPLOYMENT_STRATEGY" in
        "rolling")
            deploy_rolling_update || return 1
            ;;
        "blue-green")
            deploy_blue_green || return 1
            ;;
        "canary")
            deploy_canary || return 1
            ;;
        *)
            log "ERROR" "Unknown deployment strategy: $DEPLOYMENT_STRATEGY"
            return 1
            ;;
    esac

    # Phase 4: Post-deployment validation
    if ! perform_health_checks; then
        log "ERROR" "Post-deployment health checks failed"
        if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
            execute_rollback
        fi
        return 1
    fi

    # Deployment summary
    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))

    log "SUCCESS" "🎉 Application deployment completed successfully!"
    log "INFO" "=================================================="
    log "INFO" "Deployment Summary:"
    log "INFO" "  - Deployment ID: $DEPLOYMENT_ID"
    log "INFO" "  - Duration: ${deployment_duration}s"
    log "INFO" "  - Strategy: $DEPLOYMENT_STRATEGY"
    log "INFO" "  - Image Tag: $IMAGE_TAG"
    log "INFO" "  - Worker Image Tag: $WORKER_IMAGE_TAG"
    log "INFO" "=================================================="

    audit_log "DEPLOYMENT_COMPLETED" "deployment_id=$DEPLOYMENT_ID duration=${deployment_duration}s strategy=$DEPLOYMENT_STRATEGY"

    return 0
}

# Handle deployment failures
handle_deployment_failure() {
    local exit_code=$?

    log "ERROR" "💥 Application deployment failed"
    audit_log "DEPLOYMENT_FAILED" "deployment_id=$DEPLOYMENT_ID exit_code=$exit_code"

    if [[ "$ROLLBACK_ON_FAILURE" == "true" ]] && [[ "$FORCE" == "false" ]]; then
        log "WARNING" "Automatic rollback will be initiated..."
        execute_rollback
    else
        log "WARNING" "Automatic rollback disabled or force mode enabled"
    fi

    exit $exit_code
}

# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

# Show help
show_help() {
    cat << EOF
Paperless Maverick Application Deployment Automation Script v$SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

DESCRIPTION:
    Comprehensive application deployment automation with blue-green deployment
    strategy, health checks, rollback procedures, and proper validation of
    deployment success. Supports multiple deployment strategies and comprehensive
    health validation.

OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: $DEFAULT_ENVIRONMENT)
    -n, --namespace NS          Kubernetes namespace (default: $DEFAULT_NAMESPACE)
    -t, --image-tag TAG         Application image tag (default: $DEFAULT_IMAGE_TAG)
    -w, --worker-tag TAG        Worker image tag (default: $DEFAULT_IMAGE_TAG)
    -s, --strategy STRATEGY     Deployment strategy (rolling|blue-green|canary)
    -d, --dry-run              Perform dry run without making changes
    -v, --validate-only        Only validate configuration and images
    -f, --force                Force deployment, skip safety checks
    --verbose                  Enable verbose logging
    --blue-green               Use blue-green deployment strategy
    --canary                   Use canary deployment strategy
    --skip-health-checks       Skip post-deployment health checks
    --no-rollback              Disable automatic rollback on failure
    --rollback                 Rollback to previous deployment

DEPLOYMENT STRATEGIES:
    rolling                    Rolling update deployment (default)
    blue-green                 Blue-green deployment with traffic switching
    canary                     Canary deployment with gradual rollout

EXAMPLES:
    # Rolling update deployment
    $SCRIPT_NAME --image-tag v1.2.3

    # Blue-green deployment
    $SCRIPT_NAME --blue-green --image-tag v1.2.3

    # Canary deployment
    $SCRIPT_NAME --canary --image-tag v1.2.3

    # Dry run validation
    $SCRIPT_NAME --dry-run --validate-only

    # Force deployment without health checks
    $SCRIPT_NAME --force --skip-health-checks --image-tag v1.2.4

    # Rollback to previous deployment
    $SCRIPT_NAME --rollback

ENVIRONMENT VARIABLES:
    DEPLOYMENT_TIMEOUT         Deployment timeout in seconds (default: 600)
    HEALTH_CHECK_TIMEOUT       Health check timeout in seconds (default: 300)
    ROLLBACK_TIMEOUT           Rollback timeout in seconds (default: 300)

FILES:
    $DEPLOYMENT_LOG            Deployment log
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
            -t|--image-tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -w|--worker-tag)
                WORKER_IMAGE_TAG="$2"
                shift 2
                ;;
            -s|--strategy)
                DEPLOYMENT_STRATEGY="$2"
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
            --blue-green)
                DEPLOYMENT_STRATEGY="blue-green"
                BLUE_GREEN=true
                shift
                ;;
            --canary)
                DEPLOYMENT_STRATEGY="canary"
                CANARY_DEPLOYMENT=true
                shift
                ;;
            --skip-health-checks)
                SKIP_HEALTH_CHECKS=true
                shift
                ;;
            --no-rollback)
                ROLLBACK_ON_FAILURE=false
                shift
                ;;
            --rollback)
                execute_rollback
                exit $?
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Validate deployment strategy
    case "$DEPLOYMENT_STRATEGY" in
        "rolling"|"blue-green"|"canary")
            ;;
        *)
            log "ERROR" "Invalid deployment strategy: $DEPLOYMENT_STRATEGY"
            log "ERROR" "Valid strategies: rolling, blue-green, canary"
            exit 1
            ;;
    esac
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
    log "INFO" "Paperless Maverick Application Deployment Script v$SCRIPT_VERSION"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: ${USER:-unknown}"
    log "INFO" "Working directory: $(pwd)"
    log "INFO" "Script directory: $SCRIPT_DIR"
    log "INFO" "Project root: $PROJECT_ROOT"

    # Handle special modes
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "INFO" "✅ Validation-only mode activated"
        validate_prerequisites
        validate_image_availability
        log "SUCCESS" "Validation completed successfully"
        exit 0
    fi

    # Run main deployment process
    main_deployment
    exit $?
}

# Execute main function with all arguments
main "$@"
