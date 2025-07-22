#!/bin/bash
# Worker Deployment Script
# Comprehensive deployment script for embedding queue workers with validation and monitoring

set -euo pipefail

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
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFESTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="${NAMESPACE:-paperless-maverick}"
ENVIRONMENT="${ENVIRONMENT:-production}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_VALIDATION="${SKIP_VALIDATION:-false}"
TIMEOUT="${TIMEOUT:-600}"

# Help function
show_help() {
    cat << EOF
Worker Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --namespace NAMESPACE   Kubernetes namespace (default: paperless-maverick)
    --environment ENV       Environment (production/staging/development)
    --dry-run              Validate manifests without applying
    --skip-validation      Skip pre-deployment validation
    --timeout SECONDS      Deployment timeout in seconds (default: 600)
    --force                Force deployment even if validation fails

EXAMPLES:
    $0 --environment production
    $0 --dry-run --namespace staging
    $0 --skip-validation --force

EOF
}

# Parse command line arguments
FORCE=false

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
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
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
    log "Validating prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        error "kubectl is not connected to a cluster"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        warning "Namespace $NAMESPACE does not exist, creating..."
        if [[ "$DRY_RUN" != "true" ]]; then
            kubectl create namespace "$NAMESPACE"
        fi
    fi
    
    success "Prerequisites validation completed"
}

# Validate manifest files
validate_manifests() {
    if [[ "$SKIP_VALIDATION" == "true" ]]; then
        warning "Skipping manifest validation"
        return 0
    fi
    
    log "Validating Kubernetes manifests..."
    
    local manifest_files=(
        "embedding-queue-worker-deployment.yaml"
        "embedding-worker-hpa.yaml"
        "embedding-worker-configmap.yaml"
        "worker-health-monitoring.yaml"
        "worker-restart-controller.yaml"
    )
    
    local validation_failed=false
    
    for manifest in "${manifest_files[@]}"; do
        local manifest_path="$MANIFESTS_DIR/$manifest"
        
        if [[ ! -f "$manifest_path" ]]; then
            error "Manifest file not found: $manifest"
            validation_failed=true
            continue
        fi
        
        # Validate YAML syntax
        if ! kubectl apply --dry-run=client -f "$manifest_path" &> /dev/null; then
            error "Manifest validation failed: $manifest"
            validation_failed=true
        else
            success "Validated manifest: $manifest"
        fi
    done
    
    if [[ "$validation_failed" == "true" && "$FORCE" != "true" ]]; then
        error "Manifest validation failed. Use --force to proceed anyway."
        exit 1
    fi
    
    success "Manifest validation completed"
}

# Check cluster resources
check_cluster_resources() {
    log "Checking cluster resources..."
    
    # Check node resources
    local total_cpu=$(kubectl top nodes --no-headers 2>/dev/null | awk '{sum += $2} END {print sum}' || echo "0")
    local total_memory=$(kubectl top nodes --no-headers 2>/dev/null | awk '{sum += $4} END {print sum}' || echo "0")
    
    log "Cluster resources - CPU: ${total_cpu}m, Memory: ${total_memory}Mi"
    
    # Check if metrics server is available
    if ! kubectl top nodes &> /dev/null; then
        warning "Metrics server not available, resource monitoring will be limited"
    fi
    
    # Check storage classes
    local storage_classes=$(kubectl get storageclass --no-headers 2>/dev/null | wc -l || echo "0")
    if [[ "$storage_classes" -eq 0 ]]; then
        warning "No storage classes found, persistent volumes may not work"
    fi
    
    success "Cluster resource check completed"
}

# Deploy secrets and configmaps
deploy_config() {
    log "Deploying configuration and secrets..."
    
    # Check if secrets exist
    local required_secrets=("supabase-secrets" "ai-secrets")
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            error "Required secret '$secret' not found in namespace '$NAMESPACE'"
            error "Please create the secret before deploying workers"
            exit 1
        fi
    done
    
    # Deploy ConfigMap
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would deploy ConfigMap"
        kubectl apply --dry-run=client -f "$MANIFESTS_DIR/embedding-worker-configmap.yaml"
    else
        kubectl apply -f "$MANIFESTS_DIR/embedding-worker-configmap.yaml"
        success "ConfigMap deployed"
    fi
}

# Deploy worker infrastructure
deploy_workers() {
    log "Deploying worker infrastructure..."
    
    local deployment_files=(
        "embedding-worker-configmap.yaml"
        "embedding-queue-worker-deployment.yaml"
        "embedding-worker-hpa.yaml"
        "worker-health-monitoring.yaml"
        "worker-restart-controller.yaml"
    )
    
    for file in "${deployment_files[@]}"; do
        log "Deploying $file..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log "DRY RUN: Would deploy $file"
            kubectl apply --dry-run=client -f "$MANIFESTS_DIR/$file"
        else
            kubectl apply -f "$MANIFESTS_DIR/$file"
            success "Deployed $file"
        fi
    done
}

# Wait for deployment to be ready
wait_for_deployment() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Skipping deployment wait"
        return 0
    fi
    
    log "Waiting for worker deployment to be ready..."
    
    # Wait for deployment rollout
    if kubectl rollout status deployment/embedding-queue-workers -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
        success "Worker deployment is ready"
    else
        error "Worker deployment failed to become ready within ${TIMEOUT} seconds"
        return 1
    fi
    
    # Wait for HPA to be ready
    local hpa_ready=false
    local attempts=0
    local max_attempts=30
    
    while [[ "$hpa_ready" != "true" && $attempts -lt $max_attempts ]]; do
        if kubectl get hpa embedding-queue-workers-hpa -n "$NAMESPACE" &> /dev/null; then
            local current_replicas=$(kubectl get hpa embedding-queue-workers-hpa -n "$NAMESPACE" -o jsonpath='{.status.currentReplicas}' 2>/dev/null || echo "0")
            if [[ "$current_replicas" -gt 0 ]]; then
                hpa_ready=true
                success "HPA is ready with $current_replicas replicas"
            fi
        fi
        
        if [[ "$hpa_ready" != "true" ]]; then
            sleep 10
            attempts=$((attempts + 1))
        fi
    done
    
    if [[ "$hpa_ready" != "true" ]]; then
        warning "HPA did not become ready within expected time"
    fi
}

# Validate deployment
validate_deployment() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Skipping deployment validation"
        return 0
    fi
    
    log "Validating deployment..."
    
    # Check pod status
    local ready_pods=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    local total_pods=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker --no-headers 2>/dev/null | wc -l || echo "0")
    
    log "Worker pods: $ready_pods/$total_pods ready"
    
    if [[ "$ready_pods" -eq 0 ]]; then
        error "No worker pods are running"
        return 1
    fi
    
    # Check health endpoints
    local healthy_pods=0
    for pod in $(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
        if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:8080/health &> /dev/null; then
            healthy_pods=$((healthy_pods + 1))
        fi
    done
    
    log "Healthy worker pods: $healthy_pods/$total_pods"
    
    if [[ "$healthy_pods" -eq 0 ]]; then
        error "No worker pods are healthy"
        return 1
    fi
    
    # Check services
    if kubectl get service embedding-queue-workers-service -n "$NAMESPACE" &> /dev/null; then
        success "Worker service is available"
    else
        warning "Worker service not found"
    fi
    
    # Check monitoring
    if kubectl get servicemonitor embedding-queue-workers-monitor -n "$NAMESPACE" &> /dev/null; then
        success "ServiceMonitor is configured"
    else
        warning "ServiceMonitor not found, metrics collection may not work"
    fi
    
    success "Deployment validation completed"
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."
    
    local report_file="/tmp/worker-deployment-report-$(date +%Y%m%d_%H%M%S).json"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "dry_run": true,
  "status": "validation_completed",
  "message": "Dry run completed successfully"
}
EOF
    else
        local pod_count=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker --no-headers 2>/dev/null | wc -l || echo "0")
        local ready_count=$(kubectl get pods -n "$NAMESPACE" -l app=embedding-queue-worker --no-headers 2>/dev/null | grep -c "Running" || echo "0")
        
        cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "dry_run": false,
  "status": "deployment_completed",
  "pods": {
    "total": $pod_count,
    "ready": $ready_count
  },
  "services": {
    "worker_service": $(kubectl get service embedding-queue-workers-service -n "$NAMESPACE" &> /dev/null && echo "true" || echo "false"),
    "health_monitor": $(kubectl get service worker-health-monitor-service -n "$NAMESPACE" &> /dev/null && echo "true" || echo "false")
  },
  "monitoring": {
    "service_monitor": $(kubectl get servicemonitor embedding-queue-workers-monitor -n "$NAMESPACE" &> /dev/null && echo "true" || echo "false"),
    "prometheus_rules": $(kubectl get prometheusrule embedding-worker-rules -n "$NAMESPACE" &> /dev/null && echo "true" || echo "false")
  }
}
EOF
    fi
    
    log "Deployment report generated: $report_file"
    cat "$report_file"
}

# Main execution
main() {
    log "Worker Deployment Script"
    log "Environment: $ENVIRONMENT"
    log "Namespace: $NAMESPACE"
    log "Dry Run: $DRY_RUN"
    log "======================================="
    
    # Validate prerequisites
    validate_prerequisites
    
    # Validate manifests
    validate_manifests
    
    # Check cluster resources
    check_cluster_resources
    
    # Deploy configuration
    deploy_config
    
    # Deploy workers
    deploy_workers
    
    # Wait for deployment
    wait_for_deployment
    
    # Validate deployment
    validate_deployment
    
    # Generate report
    generate_report
    
    if [[ "$DRY_RUN" == "true" ]]; then
        success "Dry run completed successfully"
    else
        success "Worker deployment completed successfully"
    fi
}

# Error handling
trap 'error "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"
