#!/bin/bash

# Deployment Wrapper Script for Paperless Maverick
# Simplified interface for common deployment scenarios
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly MASTER_DEPLOY_SCRIPT="$SCRIPT_DIR/master-deploy.sh"
readonly STATUS_SCRIPT="$SCRIPT_DIR/deployment-status.sh"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if master deploy script exists
check_prerequisites() {
    if [[ ! -f "$MASTER_DEPLOY_SCRIPT" ]]; then
        error "Master deployment script not found: $MASTER_DEPLOY_SCRIPT"
        exit 1
    fi
    
    if [[ ! -x "$MASTER_DEPLOY_SCRIPT" ]]; then
        error "Master deployment script is not executable: $MASTER_DEPLOY_SCRIPT"
        exit 1
    fi
}

# Show deployment scenarios
show_scenarios() {
    cat << EOF
${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}
${BLUE}║                    Paperless Maverick Deployment Scenarios                  ║${NC}
${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}

${YELLOW}Available Deployment Scenarios:${NC}

${GREEN}1. Production Deployment${NC}
   Full production deployment with all safety checks
   Command: $0 production [image-tag]

${GREEN}2. Staging Deployment${NC}
   Deploy to staging environment for testing
   Command: $0 staging [image-tag]

${GREEN}3. Hotfix Deployment${NC}
   Emergency deployment with minimal checks
   Command: $0 hotfix <image-tag>

${GREEN}4. Feature Flag Update${NC}
   Update only feature flag configurations
   Command: $0 feature-flags [--embedding-rollout N] [--queue-rollout N] [--batch-rollout N]

${GREEN}5. Monitoring Update${NC}
   Update only monitoring infrastructure
   Command: $0 monitoring

${GREEN}6. Validation Only${NC}
   Validate deployment configuration without deploying
   Command: $0 validate

${GREEN}7. Rollback${NC}
   Rollback to previous deployment
   Command: $0 rollback

${GREEN}8. Status Check${NC}
   Check current deployment status
   Command: $0 status [--watch]

${GREEN}9. Dry Run${NC}
   Simulate deployment without making changes
   Command: $0 dry-run [scenario] [options]

${YELLOW}Examples:${NC}
  $0 production v1.2.3              # Deploy version 1.2.3 to production
  $0 staging                        # Deploy latest to staging
  $0 hotfix v1.2.4-hotfix          # Emergency hotfix deployment
  $0 feature-flags --embedding-rollout 25  # Update embedding rollout to 25%
  $0 status --watch                 # Watch deployment status in real-time
  $0 dry-run production v1.2.3      # Simulate production deployment

EOF
}

# Production deployment
deploy_production() {
    local image_tag="${1:-latest}"
    
    log "🚀 Starting production deployment with image tag: $image_tag"
    
    # Confirmation prompt
    echo -e "${YELLOW}⚠️  You are about to deploy to PRODUCTION environment${NC}"
    echo -e "Image tag: $image_tag"
    echo -e "This will affect live users and data."
    echo
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^(yes|YES)$ ]]; then
        log "Deployment cancelled by user"
        exit 0
    fi
    
    # Execute production deployment
    "$MASTER_DEPLOY_SCRIPT" \
        --environment production \
        --image-tag "$image_tag" \
        --staged
}

# Staging deployment
deploy_staging() {
    local image_tag="${1:-latest}"
    
    log "🧪 Starting staging deployment with image tag: $image_tag"
    
    "$MASTER_DEPLOY_SCRIPT" \
        --environment staging \
        --image-tag "$image_tag" \
        --namespace paperless-maverick-staging
}

# Hotfix deployment
deploy_hotfix() {
    local image_tag="$1"
    
    if [[ -z "$image_tag" ]]; then
        error "Image tag is required for hotfix deployment"
        exit 1
    fi
    
    log "🚨 Starting HOTFIX deployment with image tag: $image_tag"
    
    # Emergency deployment confirmation
    echo -e "${RED}⚠️  EMERGENCY HOTFIX DEPLOYMENT${NC}"
    echo -e "Image tag: $image_tag"
    echo -e "This will skip some safety checks for faster deployment."
    echo
    read -p "Confirm emergency hotfix deployment? (HOTFIX/cancel): " -r
    if [[ ! $REPLY =~ ^(HOTFIX)$ ]]; then
        log "Hotfix deployment cancelled"
        exit 0
    fi
    
    # Execute hotfix deployment
    "$MASTER_DEPLOY_SCRIPT" \
        --environment production \
        --image-tag "$image_tag" \
        --force \
        --skip-tests
}

# Feature flags deployment
deploy_feature_flags() {
    local embedding_rollout=""
    local queue_rollout=""
    local batch_rollout=""
    
    # Parse feature flag arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --embedding-rollout)
                embedding_rollout="$2"
                shift 2
                ;;
            --queue-rollout)
                queue_rollout="$2"
                shift 2
                ;;
            --batch-rollout)
                batch_rollout="$2"
                shift 2
                ;;
            *)
                error "Unknown feature flag option: $1"
                exit 1
                ;;
        esac
    done
    
    log "🎛️  Updating feature flag configurations"
    
    local args=("--feature-flags-only")
    
    if [[ -n "$embedding_rollout" ]]; then
        args+=("--embedding-rollout" "$embedding_rollout")
        log "Setting embedding monitoring rollout to: $embedding_rollout%"
    fi
    
    if [[ -n "$queue_rollout" ]]; then
        args+=("--queue-rollout" "$queue_rollout")
        log "Setting queue processing rollout to: $queue_rollout%"
    fi
    
    if [[ -n "$batch_rollout" ]]; then
        args+=("--batch-rollout" "$batch_rollout")
        log "Setting batch optimization rollout to: $batch_rollout%"
    fi
    
    "$MASTER_DEPLOY_SCRIPT" "${args[@]}"
}

# Monitoring deployment
deploy_monitoring() {
    log "📊 Updating monitoring infrastructure"
    
    "$MASTER_DEPLOY_SCRIPT" --monitoring-only
}

# Validation only
validate_deployment() {
    log "✅ Validating deployment configuration"
    
    "$MASTER_DEPLOY_SCRIPT" --validate-only
}

# Rollback deployment
rollback_deployment() {
    log "🔄 Initiating deployment rollback"
    
    echo -e "${YELLOW}⚠️  You are about to rollback the current deployment${NC}"
    echo -e "This will revert to the previous version."
    echo
    read -p "Are you sure you want to rollback? (yes/no): " -r
    if [[ ! $REPLY =~ ^(yes|YES)$ ]]; then
        log "Rollback cancelled by user"
        exit 0
    fi
    
    "$MASTER_DEPLOY_SCRIPT" --rollback
}

# Check deployment status
check_status() {
    local watch_mode=false
    
    if [[ "${1:-}" == "--watch" ]]; then
        watch_mode=true
    fi
    
    if [[ ! -f "$STATUS_SCRIPT" ]]; then
        error "Status script not found: $STATUS_SCRIPT"
        exit 1
    fi
    
    if [[ "$watch_mode" == "true" ]]; then
        log "👀 Watching deployment status (Press Ctrl+C to exit)"
        "$STATUS_SCRIPT" --watch
    else
        log "📊 Checking deployment status"
        "$STATUS_SCRIPT"
    fi
}

# Dry run deployment
dry_run_deployment() {
    local scenario="$1"
    shift
    
    log "🧪 Performing dry run for scenario: $scenario"
    
    case "$scenario" in
        "production")
            local image_tag="${1:-latest}"
            "$MASTER_DEPLOY_SCRIPT" \
                --environment production \
                --image-tag "$image_tag" \
                --dry-run
            ;;
        "staging")
            local image_tag="${1:-latest}"
            "$MASTER_DEPLOY_SCRIPT" \
                --environment staging \
                --image-tag "$image_tag" \
                --namespace paperless-maverick-staging \
                --dry-run
            ;;
        "feature-flags")
            "$MASTER_DEPLOY_SCRIPT" \
                --feature-flags-only \
                --dry-run \
                "$@"
            ;;
        "monitoring")
            "$MASTER_DEPLOY_SCRIPT" \
                --monitoring-only \
                --dry-run
            ;;
        *)
            error "Unknown dry run scenario: $scenario"
            exit 1
            ;;
    esac
}

# Show help
show_help() {
    cat << EOF
Deployment Wrapper Script for Paperless Maverick

USAGE:
    $0 <scenario> [options]

SCENARIOS:
    production [image-tag]     Deploy to production (default: latest)
    staging [image-tag]        Deploy to staging (default: latest)
    hotfix <image-tag>         Emergency hotfix deployment
    feature-flags [options]    Update feature flag configurations
    monitoring                 Update monitoring infrastructure
    validate                   Validate deployment configuration
    rollback                   Rollback to previous deployment
    status [--watch]           Check deployment status
    dry-run <scenario> [opts]  Simulate deployment
    scenarios                  Show all available scenarios
    help                       Show this help message

FEATURE FLAG OPTIONS:
    --embedding-rollout N      Set embedding monitoring rollout percentage (0-100)
    --queue-rollout N          Set queue processing rollout percentage (0-100)
    --batch-rollout N          Set batch optimization rollout percentage (0-100)

EXAMPLES:
    $0 production v1.2.3
    $0 staging
    $0 hotfix v1.2.4-hotfix
    $0 feature-flags --embedding-rollout 25
    $0 status --watch
    $0 dry-run production v1.2.3

EOF
}

# Main function
main() {
    check_prerequisites
    
    if [[ $# -eq 0 ]]; then
        show_scenarios
        exit 0
    fi
    
    local scenario="$1"
    shift
    
    case "$scenario" in
        "production")
            deploy_production "$@"
            ;;
        "staging")
            deploy_staging "$@"
            ;;
        "hotfix")
            deploy_hotfix "$@"
            ;;
        "feature-flags")
            deploy_feature_flags "$@"
            ;;
        "monitoring")
            deploy_monitoring "$@"
            ;;
        "validate")
            validate_deployment "$@"
            ;;
        "rollback")
            rollback_deployment "$@"
            ;;
        "status")
            check_status "$@"
            ;;
        "dry-run")
            if [[ $# -eq 0 ]]; then
                error "Dry run requires a scenario"
                exit 1
            fi
            dry_run_deployment "$@"
            ;;
        "scenarios")
            show_scenarios
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            error "Unknown scenario: $scenario"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
