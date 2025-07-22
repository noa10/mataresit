#!/bin/bash

# Environment Setup Script for Paperless Maverick
# Configures environment-specific settings and validates setup
# Version: 1.0.0

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly ENV_DIR="$INFRASTRUCTURE_DIR/env"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
ENVIRONMENT="production"
INTERACTIVE=true
FORCE=false
VALIDATE_ONLY=false

# Logging functions
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

# Create environment directory structure
create_env_structure() {
    log "Creating environment directory structure..."
    
    local dirs=(
        "$ENV_DIR"
        "$CONFIG_DIR"
        "$PROJECT_ROOT/logs/infrastructure"
        "$PROJECT_ROOT/backups/infrastructure"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            success "Created directory: $dir"
        else
            log "Directory already exists: $dir"
        fi
    done
}

# Generate environment template
generate_env_template() {
    local env_file="$ENV_DIR/.env.$ENVIRONMENT"
    
    if [[ -f "$env_file" ]] && [[ "$FORCE" != "true" ]]; then
        warning "Environment file already exists: $env_file"
        if [[ "$INTERACTIVE" == "true" ]]; then
            read -p "Overwrite existing file? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "Skipping environment file creation"
                return 0
            fi
        else
            log "Use --force to overwrite existing file"
            return 0
        fi
    fi
    
    log "Generating environment template for: $ENVIRONMENT"
    
    cat > "$env_file" << EOF
# Paperless Maverick Environment Configuration
# Environment: $ENVIRONMENT
# Generated: $(date)

# ============================================================================
# CORE APPLICATION SETTINGS
# ============================================================================

# Node.js Environment
NODE_ENV=$ENVIRONMENT
LOG_LEVEL=info
PORT=3000

# Application Configuration
APP_NAME=paperless-maverick
APP_VERSION=1.0.0
APP_DOMAIN=mataresit.com

# ============================================================================
# SUPABASE CONFIGURATION
# ============================================================================

# Supabase Connection (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ============================================================================
# AI SERVICES CONFIGURATION
# ============================================================================

# Google Gemini API (REQUIRED)
GEMINI_API_KEY=your-gemini-api-key-here

# OpenAI API (OPTIONAL)
OPENAI_API_KEY=your-openai-api-key-here

# ============================================================================
# SECURITY CONFIGURATION
# ============================================================================

# Encryption Keys (REQUIRED)
API_KEY_ENCRYPTION_KEY=your-32-character-encryption-key-here
JWT_SECRET=your-jwt-secret-here

# ============================================================================
# MONITORING AND LOGGING
# ============================================================================

# Sentry Error Tracking (OPTIONAL)
SENTRY_DSN=your-sentry-dsn-here

# Grafana Admin Password (OPTIONAL - will be generated if not provided)
GRAFANA_ADMIN_PASSWORD=your-grafana-password-here

# ============================================================================
# NOTIFICATION SERVICES
# ============================================================================

# Email Service (OPTIONAL)
RESEND_API_KEY=your-resend-api-key-here

# Slack Integration (OPTIONAL)
SLACK_WEBHOOK_URL=your-slack-webhook-url-here

# PagerDuty Integration (OPTIONAL)
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-key-here

# ============================================================================
# FEATURE FLAGS
# ============================================================================

# Feature Rollout Percentages
EMBEDDING_MONITORING_ROLLOUT_PERCENTAGE=10
QUEUE_PROCESSING_ROLLOUT_PERCENTAGE=0
BATCH_OPTIMIZATION_ROLLOUT_PERCENTAGE=0

# Feature Toggles
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_SECURITY_LOGGING=true
ENABLE_EMBEDDING_MONITORING=true
ENABLE_QUEUE_PROCESSING=false
ENABLE_BATCH_OPTIMIZATION=false

# ============================================================================
# PERFORMANCE CONFIGURATION
# ============================================================================

# Database Configuration
DB_POOL_SIZE=10
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=600000

# Cache Configuration
CACHE_TTL_SECONDS=300
CACHE_MAX_SIZE=1000

# Rate Limiting
API_RATE_LIMIT_WINDOW=3600
API_RATE_LIMIT_MAX_REQUESTS=1000

# ============================================================================
# WORKER CONFIGURATION
# ============================================================================

# Queue Configuration
QUEUE_POLL_INTERVAL=5000
MAX_CONCURRENT_JOBS=3
QUEUE_RETRY_ATTEMPTS=3
QUEUE_RETRY_DELAY=5000

# Worker Scaling
MIN_WORKERS=2
MAX_WORKERS=6
WORKER_SCALE_UP_THRESHOLD=80
WORKER_SCALE_DOWN_THRESHOLD=20

# ============================================================================
# CORS CONFIGURATION
# ============================================================================

CORS_ALLOWED_ORIGINS=https://mataresit.com,https://app.mataresit.com
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=X-API-Key,Content-Type,Authorization

# ============================================================================
# BACKUP CONFIGURATION
# ============================================================================

BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *

EOF
    
    success "Environment template created: $env_file"
    
    if [[ "$INTERACTIVE" == "true" ]]; then
        log "Please edit the environment file and set the required values:"
        log "  - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
        log "  - GEMINI_API_KEY"
        log "  - API_KEY_ENCRYPTION_KEY (32 characters)"
        log "  - JWT_SECRET"
        echo
        read -p "Press Enter to continue after editing the file..."
    fi
}

# Validate environment configuration
validate_env_config() {
    local env_file="$ENV_DIR/.env.$ENVIRONMENT"
    
    if [[ ! -f "$env_file" ]]; then
        error "Environment file not found: $env_file"
        return 1
    fi
    
    log "Validating environment configuration..."
    
    # Load environment variables
    set -a
    source "$env_file"
    set +a
    
    # Required variables
    local required_vars=(
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "GEMINI_API_KEY"
        "API_KEY_ENCRYPTION_KEY"
    )
    
    local missing_vars=()
    local placeholder_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        elif [[ "${!var}" =~ your-.*-here ]]; then
            placeholder_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            error "  - $var"
        done
        return 1
    fi
    
    if [[ ${#placeholder_vars[@]} -gt 0 ]]; then
        error "Placeholder values found (need to be replaced):"
        for var in "${placeholder_vars[@]}"; do
            error "  - $var"
        done
        return 1
    fi
    
    # Validate specific formats
    if [[ ! "$SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
        warning "SUPABASE_URL format may be incorrect"
    fi
    
    if [[ ${#API_KEY_ENCRYPTION_KEY} -lt 32 ]]; then
        error "API_KEY_ENCRYPTION_KEY must be at least 32 characters"
        return 1
    fi
    
    success "Environment configuration validation passed"
    return 0
}

# Setup Kubernetes context
setup_k8s_context() {
    log "Setting up Kubernetes context for $ENVIRONMENT..."
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        error "Please ensure kubectl is configured and cluster is accessible"
        return 1
    fi
    
    # Get current context
    local current_context
    current_context=$(kubectl config current-context)
    log "Current Kubernetes context: $current_context"
    
    # Validate context for environment
    case "$ENVIRONMENT" in
        "production")
            if [[ ! "$current_context" =~ prod ]]; then
                warning "Current context may not be production cluster"
                if [[ "$INTERACTIVE" == "true" ]]; then
                    read -p "Continue with current context? (y/N): " -n 1 -r
                    echo
                    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                        error "Please switch to production Kubernetes context"
                        return 1
                    fi
                fi
            fi
            ;;
        "staging")
            if [[ ! "$current_context" =~ staging ]]; then
                warning "Current context may not be staging cluster"
            fi
            ;;
    esac
    
    success "Kubernetes context validated"
    return 0
}

# Generate helper scripts
generate_helper_scripts() {
    log "Generating helper scripts..."
    
    # Create deployment helper
    local deploy_helper="$SCRIPT_DIR/deploy-$ENVIRONMENT.sh"
    cat > "$deploy_helper" << EOF
#!/bin/bash
# Quick deployment script for $ENVIRONMENT environment
# Generated: $(date)

set -e

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Deploying to $ENVIRONMENT environment..."

# Run infrastructure provisioning
"\$SCRIPT_DIR/provision-infrastructure.sh" --environment $ENVIRONMENT "\$@"

echo "✅ Deployment to $ENVIRONMENT completed"
EOF
    
    chmod +x "$deploy_helper"
    success "Created deployment helper: $deploy_helper"
    
    # Create validation helper
    local validate_helper="$SCRIPT_DIR/validate-$ENVIRONMENT.sh"
    cat > "$validate_helper" << EOF
#!/bin/bash
# Quick validation script for $ENVIRONMENT environment
# Generated: $(date)

set -e

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

echo "🔍 Validating $ENVIRONMENT environment..."

# Run infrastructure validation
"\$SCRIPT_DIR/validate-infrastructure.sh" --environment $ENVIRONMENT "\$@"

echo "✅ Validation for $ENVIRONMENT completed"
EOF
    
    chmod +x "$validate_helper"
    success "Created validation helper: $validate_helper"
}

# Show help
show_help() {
    cat << EOF
Environment Setup Script for Paperless Maverick

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -e, --environment ENV   Target environment (default: production)
    -f, --force             Force overwrite existing files
    -v, --validate-only     Only validate existing configuration
    --non-interactive       Run without interactive prompts

EXAMPLES:
    $0                      # Setup production environment interactively
    $0 -e staging           # Setup staging environment
    $0 --validate-only      # Validate existing configuration
    $0 --force              # Force overwrite existing files

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
            -f|--force)
                FORCE=true
                shift
                ;;
            -v|--validate-only)
                VALIDATE_ONLY=true
                shift
                ;;
            --non-interactive)
                INTERACTIVE=false
                shift
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main function
main() {
    parse_arguments "$@"
    
    log "🔧 Setting up environment: $ENVIRONMENT"
    log "Interactive mode: $INTERACTIVE"
    log "Force mode: $FORCE"
    log "=================================================="
    
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "Validation-only mode"
        validate_env_config
        exit $?
    fi
    
    # Setup steps
    create_env_structure
    generate_env_template
    validate_env_config || {
        warning "Environment validation failed"
        log "Please edit the environment file and run validation again"
        exit 1
    }
    setup_k8s_context
    generate_helper_scripts
    
    success "🎉 Environment setup completed for: $ENVIRONMENT"
    log "=================================================="
    log "Next steps:"
    log "1. Review and validate configuration:"
    log "   ./validate-$ENVIRONMENT.sh"
    log "2. Deploy infrastructure:"
    log "   ./deploy-$ENVIRONMENT.sh"
    log "3. Monitor deployment:"
    log "   kubectl get pods -n paperless-maverick"
}

# Execute main function
main "$@"
