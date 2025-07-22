#!/bin/bash

# Production Deployment Script for Paperless Maverick
# Implements blue-green deployment with validation and rollback capabilities

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
NAMESPACE="paperless-maverick"
DEPLOYMENT_LOG="deployment-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# Help function
show_help() {
    cat << EOF
Production Deployment Script for Paperless Maverick

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --dry-run              Perform a dry run without making changes
    --validate-only        Only validate the deployment configuration
    --rollback             Rollback to the previous deployment
    --environment ENV      Target environment (default: production)
    --image-tag TAG        Docker image tag to deploy (default: latest)
    --skip-tests           Skip post-deployment tests
    --force                Force deployment even if validation fails

EXAMPLES:
    $0                     # Full production deployment
    $0 --dry-run          # Preview deployment changes
    $0 --validate-only    # Validate configuration only
    $0 --rollback         # Rollback to previous version
    $0 --image-tag v1.2.3 # Deploy specific version

EOF
}

# Parse command line arguments
DRY_RUN=false
VALIDATE_ONLY=false
ROLLBACK=false
ENVIRONMENT="production"
IMAGE_TAG="latest"
SKIP_TESTS=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --image-tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate prerequisites
validate_prerequisites() {
    log "Validating deployment prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "terraform")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check Kubernetes connection
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        warning "Namespace $NAMESPACE does not exist, creating..."
        if [[ "$DRY_RUN" == "false" ]]; then
            kubectl apply -f "$INFRASTRUCTURE_DIR/kubernetes/namespace.yaml"
        fi
    fi
    
    # Validate Docker images exist
    if [[ "$DRY_RUN" == "false" && "$VALIDATE_ONLY" == "false" ]]; then
        log "Validating Docker images..."
        if ! docker manifest inspect "paperless-maverick:$IMAGE_TAG" &> /dev/null; then
            error "Docker image paperless-maverick:$IMAGE_TAG not found"
            if [[ "$FORCE" == "false" ]]; then
                exit 1
            fi
        fi
    fi
    
    success "Prerequisites validation completed"
}

# Validate configuration
validate_configuration() {
    log "Validating deployment configuration..."
    
    # Validate Kubernetes manifests
    local manifest_files=(
        "$INFRASTRUCTURE_DIR/kubernetes/namespace.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/configmap.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/deployment.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/service.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/hpa.yaml"
    )
    
    for manifest in "${manifest_files[@]}"; do
        if [[ ! -f "$manifest" ]]; then
            error "Required manifest file not found: $manifest"
            exit 1
        fi
        
        if ! kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
            error "Invalid Kubernetes manifest: $manifest"
            exit 1
        fi
    done
    
    # Validate Terraform configuration
    if [[ -d "$INFRASTRUCTURE_DIR/terraform" ]]; then
        log "Validating Terraform configuration..."
        cd "$INFRASTRUCTURE_DIR/terraform"
        if ! terraform validate &> /dev/null; then
            error "Invalid Terraform configuration"
            exit 1
        fi
        cd - > /dev/null
    fi
    
    success "Configuration validation completed"
}

# Deploy infrastructure
deploy_infrastructure() {
    log "Deploying infrastructure components..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would deploy infrastructure"
        return
    fi
    
    # Apply Kubernetes manifests
    local manifest_files=(
        "$INFRASTRUCTURE_DIR/kubernetes/namespace.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/configmap.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/secrets.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/deployment.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/service.yaml"
        "$INFRASTRUCTURE_DIR/kubernetes/hpa.yaml"
    )
    
    for manifest in "${manifest_files[@]}"; do
        if [[ -f "$manifest" ]]; then
            log "Applying $manifest..."
            kubectl apply -f "$manifest"
        fi
    done
    
    # Wait for deployments to be ready
    log "Waiting for deployments to be ready..."
    kubectl rollout status deployment/paperless-maverick -n "$NAMESPACE" --timeout=600s
    kubectl rollout status deployment/embedding-queue-workers -n "$NAMESPACE" --timeout=600s
    
    success "Infrastructure deployment completed"
}

# Run post-deployment tests
run_post_deployment_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        warning "Skipping post-deployment tests"
        return
    fi
    
    log "Running post-deployment tests..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would run post-deployment tests"
        return
    fi
    
    # Health check tests
    log "Running health check tests..."
    local app_pod=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[0].metadata.name}')
    local worker_pod=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker -o jsonpath='{.items[0].metadata.name}')
    
    if [[ -n "$app_pod" ]]; then
        kubectl exec -n "$NAMESPACE" "$app_pod" -- curl -f http://localhost:3000/health || {
            error "Application health check failed"
            exit 1
        }
    fi
    
    if [[ -n "$worker_pod" ]]; then
        kubectl exec -n "$NAMESPACE" "$worker_pod" -- node health-check.js || {
            error "Worker health check failed"
            exit 1
        }
    fi
    
    # Integration tests
    if [[ -f "$PROJECT_ROOT/scripts/test-complete-solution.ts" ]]; then
        log "Running integration tests..."
        cd "$PROJECT_ROOT"
        npm run test:integration || {
            error "Integration tests failed"
            exit 1
        }
        cd - > /dev/null
    fi
    
    success "Post-deployment tests completed"
}

# Rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would rollback deployment"
        return
    fi
    
    # Rollback deployments
    kubectl rollout undo deployment/paperless-maverick -n "$NAMESPACE"
    kubectl rollout undo deployment/embedding-queue-workers -n "$NAMESPACE"
    
    # Wait for rollback to complete
    kubectl rollout status deployment/paperless-maverick -n "$NAMESPACE" --timeout=300s
    kubectl rollout status deployment/embedding-queue-workers -n "$NAMESPACE" --timeout=300s
    
    success "Rollback completed"
}

# Main deployment function
main_deployment() {
    log "Starting production deployment for Paperless Maverick"
    log "Environment: $ENVIRONMENT"
    log "Image Tag: $IMAGE_TAG"
    log "Namespace: $NAMESPACE"
    log "=================================================="
    
    # Validate prerequisites
    validate_prerequisites
    
    # Validate configuration
    validate_configuration
    
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        success "Validation completed successfully"
        exit 0
    fi
    
    if [[ "$ROLLBACK" == "true" ]]; then
        rollback_deployment
        exit 0
    fi
    
    # Deploy infrastructure
    deploy_infrastructure
    
    # Run post-deployment tests
    run_post_deployment_tests
    
    # Deployment summary
    log "=================================================="
    success "Production deployment completed successfully"
    log "=================================================="
    
    # Display useful information
    log "Useful commands:"
    log "  kubectl get pods -n $NAMESPACE"
    log "  kubectl get services -n $NAMESPACE"
    log "  kubectl logs -f deployment/paperless-maverick -n $NAMESPACE"
    log "  kubectl logs -f deployment/embedding-queue-workers -n $NAMESPACE"
}

# Error handling
trap 'error "Deployment failed at line $LINENO"' ERR

# Main execution
main_deployment
