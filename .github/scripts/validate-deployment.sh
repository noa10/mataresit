#!/bin/bash

# Deployment Validation Script
# Validates deployment readiness and post-deployment health

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
NAMESPACE="paperless-maverick"
TIMEOUT=300
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_DELAY=10

# Help function
show_help() {
    cat << EOF
Deployment Validation Script

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --namespace NS          Kubernetes namespace (default: paperless-maverick)
    --timeout SECONDS       Timeout for operations (default: 300)
    --environment ENV       Environment (production/staging)
    --check-type TYPE       Type of validation (pre/post/health/all)
    --image-tag TAG         Expected image tag to validate

VALIDATION TYPES:
    pre                     Pre-deployment validation
    post                    Post-deployment validation
    health                  Health check validation
    all                     All validation types

EXAMPLES:
    $0 --check-type pre --image-tag v1.2.3
    $0 --check-type post --namespace paperless-maverick-staging
    $0 --check-type health --environment production

EOF
}

# Parse command line arguments
CHECK_TYPE="all"
ENVIRONMENT="production"
IMAGE_TAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --check-type)
            CHECK_TYPE="$2"
            shift 2
            ;;
        --image-tag)
            IMAGE_TAG="$2"
            shift 2
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
    log "Validating prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    success "Prerequisites validation completed"
}

# Pre-deployment validation
pre_deployment_validation() {
    log "Running pre-deployment validation..."
    
    # Validate Kubernetes manifests
    log "Validating Kubernetes manifests..."
    local manifest_dir="infrastructure/production/kubernetes"
    
    if [[ -d "$manifest_dir" ]]; then
        for manifest in "$manifest_dir"/*.yaml; do
            if [[ -f "$manifest" ]]; then
                log "Validating $manifest..."
                if ! kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
                    error "Invalid manifest: $manifest"
                    return 1
                fi
            fi
        done
    else
        warning "Kubernetes manifests directory not found: $manifest_dir"
    fi
    
    # Check resource quotas
    log "Checking resource quotas..."
    if kubectl get resourcequota -n "$NAMESPACE" &> /dev/null; then
        kubectl describe resourcequota -n "$NAMESPACE"
    fi
    
    # Validate image availability
    if [[ -n "$IMAGE_TAG" ]]; then
        log "Validating image availability: $IMAGE_TAG"
        # This would typically check if the image exists in the registry
        # For now, we'll just log the expected image
        log "Expected image: ghcr.io/paperless-maverick:$IMAGE_TAG"
    fi
    
    success "Pre-deployment validation completed"
}

# Post-deployment validation
post_deployment_validation() {
    log "Running post-deployment validation..."
    
    # Wait for deployments to be ready
    log "Waiting for deployments to be ready..."
    
    if ! kubectl rollout status deployment/paperless-maverick -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
        error "Application deployment failed to become ready"
        return 1
    fi
    
    if ! kubectl rollout status deployment/embedding-queue-workers -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
        error "Worker deployment failed to become ready"
        return 1
    fi
    
    # Wait for pods to be ready
    log "Waiting for pods to be ready..."
    
    if ! kubectl wait --for=condition=ready pod -l app=paperless-maverick -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
        error "Application pods failed to become ready"
        return 1
    fi
    
    if ! kubectl wait --for=condition=ready pod -l app=embedding-queue-worker -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
        error "Worker pods failed to become ready"
        return 1
    fi
    
    # Check deployment status
    log "Checking deployment status..."
    kubectl get deployments -n "$NAMESPACE"
    kubectl get pods -n "$NAMESPACE"
    kubectl get services -n "$NAMESPACE"
    
    success "Post-deployment validation completed"
}

# Health check validation
health_check_validation() {
    log "Running health check validation..."
    
    local retry_count=0
    local health_passed=false
    
    while [[ $retry_count -lt $HEALTH_CHECK_RETRIES ]]; do
        log "Health check attempt $((retry_count + 1))/$HEALTH_CHECK_RETRIES"
        
        # Test application health
        local app_pod=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        
        if [[ -n "$app_pod" ]]; then
            log "Testing application health endpoint..."
            if kubectl exec -n "$NAMESPACE" "$app_pod" -- curl -f http://localhost:3000/health &> /dev/null; then
                success "Application health check passed"
            else
                warning "Application health check failed"
                ((retry_count++))
                sleep $HEALTH_CHECK_DELAY
                continue
            fi
            
            log "Testing application readiness endpoint..."
            if kubectl exec -n "$NAMESPACE" "$app_pod" -- curl -f http://localhost:3000/ready &> /dev/null; then
                success "Application readiness check passed"
            else
                warning "Application readiness check failed"
                ((retry_count++))
                sleep $HEALTH_CHECK_DELAY
                continue
            fi
        else
            warning "No application pods found"
            ((retry_count++))
            sleep $HEALTH_CHECK_DELAY
            continue
        fi
        
        # Test worker health
        local worker_pod=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        
        if [[ -n "$worker_pod" ]]; then
            log "Testing worker health..."
            if kubectl exec -n "$NAMESPACE" "$worker_pod" -- node health-check.js &> /dev/null; then
                success "Worker health check passed"
                health_passed=true
                break
            else
                warning "Worker health check failed"
                ((retry_count++))
                sleep $HEALTH_CHECK_DELAY
                continue
            fi
        else
            warning "No worker pods found"
            ((retry_count++))
            sleep $HEALTH_CHECK_DELAY
            continue
        fi
    done
    
    if [[ "$health_passed" != "true" ]]; then
        error "Health check validation failed after $HEALTH_CHECK_RETRIES attempts"
        return 1
    fi
    
    success "Health check validation completed"
}

# Performance validation
performance_validation() {
    log "Running performance validation..."
    
    # Check resource usage
    log "Checking resource usage..."
    kubectl top pods -n "$NAMESPACE" 2>/dev/null || warning "Metrics server not available"
    
    # Check HPA status
    log "Checking HPA status..."
    if kubectl get hpa -n "$NAMESPACE" &> /dev/null; then
        kubectl get hpa -n "$NAMESPACE"
        kubectl describe hpa -n "$NAMESPACE"
    else
        warning "No HPA found in namespace $NAMESPACE"
    fi
    
    # Check service endpoints
    log "Checking service endpoints..."
    kubectl get endpoints -n "$NAMESPACE"
    
    success "Performance validation completed"
}

# Generate validation report
generate_report() {
    local validation_status="$1"
    
    cat > validation-report.json << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "check_type": "$CHECK_TYPE",
  "image_tag": "$IMAGE_TAG",
  "status": "$validation_status",
  "deployment_info": {
    "app_replicas": $(kubectl get deployment paperless-maverick -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0"),
    "worker_replicas": $(kubectl get deployment embedding-queue-workers -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0"),
    "total_pods": $(kubectl get pods -n "$NAMESPACE" --no-headers | wc -l)
  }
}
EOF
    
    log "Validation report generated: validation-report.json"
}

# Main execution
main() {
    log "Deployment Validation Script"
    log "Environment: $ENVIRONMENT"
    log "Namespace: $NAMESPACE"
    log "Check Type: $CHECK_TYPE"
    log "============================="
    
    # Validate prerequisites
    validate_prerequisites
    
    local validation_failed=false
    
    # Run validations based on check type
    case "$CHECK_TYPE" in
        "pre")
            pre_deployment_validation || validation_failed=true
            ;;
        "post")
            post_deployment_validation || validation_failed=true
            ;;
        "health")
            health_check_validation || validation_failed=true
            ;;
        "all")
            pre_deployment_validation || validation_failed=true
            post_deployment_validation || validation_failed=true
            health_check_validation || validation_failed=true
            performance_validation || validation_failed=true
            ;;
        *)
            error "Invalid check type: $CHECK_TYPE"
            exit 1
            ;;
    esac
    
    # Generate report
    if [[ "$validation_failed" == "true" ]]; then
        generate_report "failed"
        error "Deployment validation failed"
        exit 1
    else
        generate_report "passed"
        success "Deployment validation completed successfully"
    fi
}

# Run main function
main "$@"
