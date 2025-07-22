#!/bin/bash

# Setup Production Secrets Script
# Creates Kubernetes secrets from environment variables or files

set -e

# Configuration
NAMESPACE="paperless-maverick"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../env/.env.production"

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

# Help function
show_help() {
    cat << EOF
Setup Production Secrets Script

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --dry-run              Show what would be created without creating
    --from-env             Create secrets from environment variables
    --from-file FILE       Create secrets from specified file
    --update               Update existing secrets
    --delete               Delete all secrets
    --namespace NS         Target namespace (default: paperless-maverick)

EXAMPLES:
    $0 --from-env          # Create secrets from environment variables
    $0 --from-file .env    # Create secrets from .env file
    $0 --update            # Update existing secrets
    $0 --delete            # Delete all secrets

REQUIRED ENVIRONMENT VARIABLES:
    SUPABASE_URL
    SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY
    GEMINI_API_KEY
    API_KEY_ENCRYPTION_KEY

OPTIONAL ENVIRONMENT VARIABLES:
    OPENAI_API_KEY
    SENTRY_DSN
    RESEND_API_KEY
    SLACK_WEBHOOK_URL
    PAGERDUTY_INTEGRATION_KEY
    GRAFANA_ADMIN_PASSWORD
    JWT_SECRET

EOF
}

# Parse command line arguments
DRY_RUN=false
FROM_ENV=false
FROM_FILE=""
UPDATE=false
DELETE=false

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
        --from-env)
            FROM_ENV=true
            shift
            ;;
        --from-file)
            FROM_FILE="$2"
            shift 2
            ;;
        --update)
            UPDATE=true
            shift
            ;;
        --delete)
            DELETE=true
            shift
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Load environment variables from file
load_env_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        log "Loading environment variables from $file"
        set -a  # automatically export all variables
        source "$file"
        set +a
    else
        error "Environment file not found: $file"
        exit 1
    fi
}

# Validate required environment variables
validate_env_vars() {
    local required_vars=(
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "GEMINI_API_KEY"
        "API_KEY_ENCRYPTION_KEY"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            error "  - $var"
        done
        exit 1
    fi
    
    success "All required environment variables are set"
}

# Create or update Supabase secrets
create_supabase_secrets() {
    log "Creating Supabase secrets..."
    
    local cmd="kubectl create secret generic supabase-secrets"
    cmd="$cmd --from-literal=url=\"$SUPABASE_URL\""
    cmd="$cmd --from-literal=anon-key=\"$SUPABASE_ANON_KEY\""
    cmd="$cmd --from-literal=service-role-key=\"$SUPABASE_SERVICE_ROLE_KEY\""
    cmd="$cmd --namespace=$NAMESPACE"
    
    if [[ "$UPDATE" == "true" ]]; then
        cmd="$cmd --dry-run=client -o yaml | kubectl apply -f -"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: $cmd"
    else
        eval "$cmd" || {
            if [[ "$UPDATE" == "false" ]]; then
                warning "Supabase secrets may already exist, use --update to update them"
            fi
        }
    fi
}

# Create or update AI secrets
create_ai_secrets() {
    log "Creating AI secrets..."
    
    local cmd="kubectl create secret generic ai-secrets"
    cmd="$cmd --from-literal=gemini-api-key=\"$GEMINI_API_KEY\""
    
    if [[ -n "$OPENAI_API_KEY" ]]; then
        cmd="$cmd --from-literal=openai-api-key=\"$OPENAI_API_KEY\""
    fi
    
    cmd="$cmd --namespace=$NAMESPACE"
    
    if [[ "$UPDATE" == "true" ]]; then
        cmd="$cmd --dry-run=client -o yaml | kubectl apply -f -"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: $cmd"
    else
        eval "$cmd" || {
            if [[ "$UPDATE" == "false" ]]; then
                warning "AI secrets may already exist, use --update to update them"
            fi
        }
    fi
}

# Create or update security secrets
create_security_secrets() {
    log "Creating security secrets..."
    
    local cmd="kubectl create secret generic security-secrets"
    cmd="$cmd --from-literal=api-key-encryption-key=\"$API_KEY_ENCRYPTION_KEY\""
    
    if [[ -n "$JWT_SECRET" ]]; then
        cmd="$cmd --from-literal=jwt-secret=\"$JWT_SECRET\""
    fi
    
    cmd="$cmd --namespace=$NAMESPACE"
    
    if [[ "$UPDATE" == "true" ]]; then
        cmd="$cmd --dry-run=client -o yaml | kubectl apply -f -"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: $cmd"
    else
        eval "$cmd" || {
            if [[ "$UPDATE" == "false" ]]; then
                warning "Security secrets may already exist, use --update to update them"
            fi
        }
    fi
}

# Create or update monitoring secrets
create_monitoring_secrets() {
    log "Creating monitoring secrets..."
    
    local cmd="kubectl create secret generic monitoring-secrets"
    
    if [[ -n "$SENTRY_DSN" ]]; then
        cmd="$cmd --from-literal=sentry-dsn=\"$SENTRY_DSN\""
    fi
    
    if [[ -n "$GRAFANA_ADMIN_PASSWORD" ]]; then
        cmd="$cmd --from-literal=grafana-admin-password=\"$GRAFANA_ADMIN_PASSWORD\""
    else
        # Generate random password if not provided
        local random_password=$(openssl rand -base64 32)
        cmd="$cmd --from-literal=grafana-admin-password=\"$random_password\""
        log "Generated random Grafana admin password"
    fi
    
    cmd="$cmd --namespace=$NAMESPACE"
    
    if [[ "$UPDATE" == "true" ]]; then
        cmd="$cmd --dry-run=client -o yaml | kubectl apply -f -"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: $cmd"
    else
        eval "$cmd" || {
            if [[ "$UPDATE" == "false" ]]; then
                warning "Monitoring secrets may already exist, use --update to update them"
            fi
        }
    fi
}

# Create or update notification secrets
create_notification_secrets() {
    log "Creating notification secrets..."
    
    local has_secrets=false
    local cmd="kubectl create secret generic notification-secrets"
    
    if [[ -n "$RESEND_API_KEY" ]]; then
        cmd="$cmd --from-literal=resend-api-key=\"$RESEND_API_KEY\""
        has_secrets=true
    fi
    
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        cmd="$cmd --from-literal=slack-webhook-url=\"$SLACK_WEBHOOK_URL\""
        has_secrets=true
    fi
    
    if [[ -n "$PAGERDUTY_INTEGRATION_KEY" ]]; then
        cmd="$cmd --from-literal=pagerduty-integration-key=\"$PAGERDUTY_INTEGRATION_KEY\""
        has_secrets=true
    fi
    
    if [[ "$has_secrets" == "false" ]]; then
        log "No notification secrets to create"
        return
    fi
    
    cmd="$cmd --namespace=$NAMESPACE"
    
    if [[ "$UPDATE" == "true" ]]; then
        cmd="$cmd --dry-run=client -o yaml | kubectl apply -f -"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: $cmd"
    else
        eval "$cmd" || {
            if [[ "$UPDATE" == "false" ]]; then
                warning "Notification secrets may already exist, use --update to update them"
            fi
        }
    fi
}

# Delete all secrets
delete_secrets() {
    log "Deleting all secrets..."
    
    local secrets=(
        "supabase-secrets"
        "ai-secrets"
        "security-secrets"
        "monitoring-secrets"
        "notification-secrets"
    )
    
    for secret in "${secrets[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            log "DRY RUN: kubectl delete secret $secret -n $NAMESPACE"
        else
            kubectl delete secret "$secret" -n "$NAMESPACE" --ignore-not-found=true
        fi
    done
    
    success "All secrets deleted"
}

# Main execution
main() {
    log "Setting up production secrets for namespace: $NAMESPACE"
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    if [[ "$DELETE" == "true" ]]; then
        delete_secrets
        exit 0
    fi
    
    # Load environment variables
    if [[ "$FROM_ENV" == "true" ]]; then
        log "Using environment variables"
    elif [[ -n "$FROM_FILE" ]]; then
        load_env_file "$FROM_FILE"
    elif [[ -f "$ENV_FILE" ]]; then
        load_env_file "$ENV_FILE"
    else
        log "Using current environment variables"
    fi
    
    # Validate environment variables
    validate_env_vars
    
    # Create secrets
    create_supabase_secrets
    create_ai_secrets
    create_security_secrets
    create_monitoring_secrets
    create_notification_secrets
    
    success "Production secrets setup completed"
    
    # Display created secrets
    if [[ "$DRY_RUN" == "false" ]]; then
        log "Created secrets:"
        kubectl get secrets -n "$NAMESPACE" | grep -E "(supabase|ai|security|monitoring|notification)-secrets" || true
    fi
}

main "$@"
