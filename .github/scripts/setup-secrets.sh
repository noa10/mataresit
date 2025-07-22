#!/bin/bash

# GitHub Secrets Setup Script
# Automates the creation of GitHub repository secrets for CI/CD pipeline

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

# Help function
show_help() {
    cat << EOF
GitHub Secrets Setup Script

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --repo REPO             GitHub repository (owner/repo)
    --env-file FILE         Environment file to read secrets from
    --dry-run              Show what would be created without creating
    --update               Update existing secrets
    --list                 List current repository secrets

EXAMPLES:
    $0 --repo owner/repo --env-file .env.production
    $0 --repo owner/repo --list
    $0 --repo owner/repo --env-file .env.production --dry-run

REQUIRED TOOLS:
    - gh (GitHub CLI)
    - jq (JSON processor)

ENVIRONMENT FILE FORMAT:
    The environment file should contain key=value pairs:
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_ANON_KEY=your_anon_key
    # etc...

EOF
}

# Parse command line arguments
REPO=""
ENV_FILE=""
DRY_RUN=false
UPDATE=false
LIST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --repo)
            REPO="$2"
            shift 2
            ;;
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --update)
            UPDATE=true
            shift
            ;;
        --list)
            LIST=true
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
    if ! command -v gh &> /dev/null; then
        error "GitHub CLI (gh) is required but not installed"
        error "Install from: https://cli.github.com/"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        error "jq is required but not installed"
        error "Install from: https://stedolan.github.io/jq/"
        exit 1
    fi
    
    # Check GitHub authentication
    if ! gh auth status &> /dev/null; then
        error "GitHub CLI is not authenticated"
        error "Run: gh auth login"
        exit 1
    fi
    
    success "Prerequisites validation completed"
}

# List current secrets
list_secrets() {
    log "Listing current repository secrets for $REPO..."
    
    if ! gh secret list --repo "$REPO" 2>/dev/null; then
        error "Failed to list secrets. Check repository access."
        exit 1
    fi
}

# Load environment file
load_env_file() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        error "Environment file not found: $file"
        exit 1
    fi
    
    log "Loading environment variables from $file"
    
    # Read environment file and export variables
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue
        
        # Remove quotes from value
        value=$(echo "$value" | sed 's/^["'\'']//' | sed 's/["'\'']$//')
        
        # Export variable
        export "$key"="$value"
        
        # Add to secrets array
        SECRETS+=("$key")
        
    done < "$file"
    
    log "Loaded ${#SECRETS[@]} secrets from environment file"
}

# Create or update secret
create_secret() {
    local key="$1"
    local value="$2"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create secret $key"
        return
    fi
    
    if gh secret set "$key" --body "$value" --repo "$REPO" 2>/dev/null; then
        success "Created/updated secret: $key"
    else
        error "Failed to create secret: $key"
        return 1
    fi
}

# Main secret creation function
create_secrets() {
    log "Creating GitHub repository secrets for $REPO..."
    
    local failed_secrets=()
    local created_count=0
    
    for secret_key in "${SECRETS[@]}"; do
        local secret_value="${!secret_key}"
        
        if [[ -z "$secret_value" ]]; then
            warning "Skipping empty secret: $secret_key"
            continue
        fi
        
        if create_secret "$secret_key" "$secret_value"; then
            ((created_count++))
        else
            failed_secrets+=("$secret_key")
        fi
    done
    
    log "Summary:"
    log "  Created/Updated: $created_count secrets"
    log "  Failed: ${#failed_secrets[@]} secrets"
    
    if [[ ${#failed_secrets[@]} -gt 0 ]]; then
        error "Failed to create the following secrets:"
        for secret in "${failed_secrets[@]}"; do
            error "  - $secret"
        done
        exit 1
    fi
    
    success "All secrets created successfully"
}

# Generate secrets template
generate_template() {
    cat > secrets-template.env << 'EOF'
# Production Environment Secrets
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI/ML API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Security Keys
API_KEY_ENCRYPTION_KEY=your_32_byte_encryption_key_here
JWT_SECRET=your_jwt_secret_here

# Monitoring
SENTRY_DSN=your_sentry_dsn_here
GRAFANA_ADMIN_PASSWORD=your_grafana_password_here

# Notifications
SLACK_WEBHOOK_URL=your_slack_webhook_url_here
CRITICAL_ALERTS_WEBHOOK_URL=your_critical_alerts_webhook_here
SECURITY_SLACK_WEBHOOK_URL=your_security_webhook_here

# Kubernetes Configuration (base64 encoded)
PRODUCTION_KUBECONFIG=base64_encoded_kubeconfig_here
STAGING_KUBECONFIG=base64_encoded_staging_kubeconfig_here

# Approvers (comma-separated usernames)
PRODUCTION_APPROVERS=user1,user2,user3
EMERGENCY_APPROVERS=user1,user2

# Security Tools
SNYK_TOKEN=your_snyk_token_here
GITLEAKS_LICENSE=your_gitleaks_license_here

# Staging Environment Secrets
STAGING_SUPABASE_URL=https://your-staging-project.supabase.co
STAGING_SUPABASE_ANON_KEY=your_staging_anon_key_here
STAGING_SUPABASE_SERVICE_ROLE_KEY=your_staging_service_role_key_here
STAGING_GEMINI_API_KEY=your_staging_gemini_key_here
STAGING_OPENAI_API_KEY=your_staging_openai_key_here
STAGING_API_KEY_ENCRYPTION_KEY=your_staging_encryption_key_here
STAGING_JWT_SECRET=your_staging_jwt_secret_here

# Test Environment Secrets
TEST_SUPABASE_URL=https://your-test-project.supabase.co
TEST_SUPABASE_ANON_KEY=your_test_anon_key_here
TEST_SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key_here
TEST_GEMINI_API_KEY=your_test_gemini_key_here
EOF

    log "Generated secrets template: secrets-template.env"
    log "Edit this file with your actual values and use --env-file secrets-template.env"
}

# Main execution
main() {
    log "GitHub Secrets Setup Script"
    log "============================"
    
    # Validate prerequisites
    validate_prerequisites
    
    # Handle list operation
    if [[ "$LIST" == "true" ]]; then
        if [[ -z "$REPO" ]]; then
            error "Repository is required for listing secrets"
            exit 1
        fi
        list_secrets
        exit 0
    fi
    
    # Validate required parameters
    if [[ -z "$REPO" ]]; then
        error "Repository is required (use --repo owner/repo)"
        exit 1
    fi
    
    if [[ -z "$ENV_FILE" ]]; then
        log "No environment file specified. Generating template..."
        generate_template
        exit 0
    fi
    
    # Initialize secrets array
    SECRETS=()
    
    # Load environment file
    load_env_file "$ENV_FILE"
    
    # Create secrets
    create_secrets
    
    success "GitHub secrets setup completed successfully"
    log "Repository: $REPO"
    log "Secrets created: ${#SECRETS[@]}"
}

# Run main function
main "$@"
