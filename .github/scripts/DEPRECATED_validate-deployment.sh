#!/bin/bash

# DEPRECATED: Kubernetes Deployment Validation Script
# This script is deprecated and replaced with Vercel + Supabase validation

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

# Show deprecation notice and redirect
show_deprecation_notice() {
    echo
    warning "⚠️  DEPRECATED SCRIPT"
    warning "==================="
    echo
    warning "This Kubernetes deployment validation script is DEPRECATED."
    warning "The project has migrated to Vercel + Supabase serverless architecture."
    echo
    log "🔄 Use the new validation script instead:"
    log "   .github/scripts/vercel-supabase-validator.sh"
    echo
    log "📚 Migration information:"
    log "   .github/docs/DEPLOYMENT_MIGRATION_GUIDE.md"
    echo
    log "🚀 New deployment workflows:"
    log "   .github/workflows/ci.yml"
    log "   .github/workflows/supabase-deploy.yml"
    log "   .github/workflows/monitoring.yml"
    echo
    
    # Try to redirect to new script if it exists
    local new_script=".github/scripts/vercel-supabase-validator.sh"
    if [[ -f "$new_script" ]]; then
        log "🔄 Attempting to redirect to new validation script..."
        echo
        
        # Map old parameters to new ones
        local new_args=()
        
        # Parse old arguments and convert
        while [[ $# -gt 0 ]]; do
            case $1 in
                --environment)
                    new_args+=("--environment" "$2")
                    shift 2
                    ;;
                --check-type)
                    new_args+=("--check-type" "$2")
                    shift 2
                    ;;
                --timeout)
                    new_args+=("--timeout" "$2")
                    shift 2
                    ;;
                --namespace|--image-tag)
                    # Skip Kubernetes-specific arguments
                    warning "Ignoring Kubernetes-specific argument: $1"
                    shift 2
                    ;;
                --help|-h)
                    new_args+=("--help")
                    shift
                    ;;
                *)
                    warning "Unknown argument: $1"
                    shift
                    ;;
            esac
        done
        
        log "Executing: $new_script ${new_args[*]}"
        exec "$new_script" "${new_args[@]}"
    else
        error "New validation script not found: $new_script"
        error "Please use the updated deployment workflows instead"
        echo
        log "Available workflows:"
        log "  - CI/CD: .github/workflows/ci.yml"
        log "  - Supabase: .github/workflows/supabase-deploy.yml"
        log "  - Monitoring: .github/workflows/monitoring.yml"
        exit 1
    fi
}

# Main execution
main() {
    log "Kubernetes Deployment Validation Script (DEPRECATED)"
    log "===================================================="
    
    show_deprecation_notice "$@"
}

# Run main function
main "$@"
