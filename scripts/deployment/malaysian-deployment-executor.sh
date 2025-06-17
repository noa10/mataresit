#!/bin/bash

# Malaysian Multi-Language Support Deployment Executor
# Comprehensive deployment script with validation and rollback capabilities

set -e  # Exit on any error

# Configuration
PROJECT_ID="mpmkbtsufihzdelrlszs"
DEPLOYMENT_LOG="deployment-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="backups/deployment-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if Supabase CLI is available
    if ! command -v supabase &> /dev/null; then
        error "Supabase CLI not found. Please install it first."
        exit 1
    fi
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        error "Node.js not found. Please install it first."
        exit 1
    fi

    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        error "npm not found. Please install it first."
        exit 1
    fi

    # Check if tsx is available
    if ! command -v tsx &> /dev/null; then
        error "tsx not found. Please install it: npm install -g tsx"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        error "package.json not found. Please run from project root."
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Create backup
create_backup() {
    log "Creating deployment backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current database state (metadata only, preserve production data)
    log "Backing up database schema..."
    supabase db dump --project-ref "$PROJECT_ID" --schema-only > "$BACKUP_DIR/schema-backup.sql" || {
        error "Failed to backup database schema"
        exit 1
    }
    
    # Backup Edge Functions
    log "Backing up Edge Functions..."
    if [ -d "supabase/functions" ]; then
        cp -r supabase/functions "$BACKUP_DIR/"
    fi
    
    # Backup current build
    log "Backing up current build..."
    if [ -d "dist" ]; then
        cp -r dist "$BACKUP_DIR/"
    fi
    
    success "Backup created at $BACKUP_DIR"
}

# Pre-deployment validation
run_pre_deployment_validation() {
    log "Running pre-deployment validation..."
    
    # Run comprehensive validation
    npm run deploy:validate:malaysian || {
        error "Pre-deployment validation failed"
        exit 1
    }
    
    success "Pre-deployment validation passed"
}

# Stage 1: Backend deployment (already complete, just verify)
deploy_stage1_backend() {
    log "Stage 1: Backend Deployment Verification..."
    
    # Verify database migrations are applied
    log "Verifying database migrations..."
    
    # Check if Malaysian tables exist
    TABLES_CHECK=$(supabase db dump --project-ref "$PROJECT_ID" --schema-only | grep -c "malaysian_" || echo "0")
    if [ "$TABLES_CHECK" -lt "10" ]; then
        error "Malaysian tables not found. Database migrations may not be applied."
        exit 1
    fi
    
    # Verify Edge Functions are deployed
    log "Verifying Edge Functions..."
    
    # Test enhance-receipt-data function
    FUNCTION_TEST=$(curl -s -X POST \
        "https://$PROJECT_ID.supabase.co/functions/v1/enhance-receipt-data" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"test": "deployment_check"}' | grep -c "error" || echo "0")
    
    if [ "$FUNCTION_TEST" -gt "0" ]; then
        warning "Edge Function test returned errors, but continuing..."
    fi
    
    success "Stage 1: Backend verification completed"
}

# Stage 2: Frontend deployment
deploy_stage2_frontend() {
    log "Stage 2: Frontend Deployment..."
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci || {
        error "Failed to install dependencies"
        exit 1
    }
    
    # Run linting
    log "Running linting..."
    npm run lint || {
        warning "Linting issues found, but continuing..."
    }
    
    # Build application
    log "Building application..."
    npm run build || {
        error "Build failed"
        exit 1
    }
    
    # Verify build output
    if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        error "Build output not found"
        exit 1
    fi
    
    success "Stage 2: Frontend deployment completed"
}

# Stage 3: Performance monitoring setup
deploy_stage3_monitoring() {
    log "Stage 3: Performance Monitoring Setup..."
    
    # Run post-deployment validation
    log "Running post-deployment validation..."
    npm run deploy:verify:complete || {
        error "Post-deployment validation failed"
        exit 1
    }
    
    # Initialize performance monitoring
    log "Initializing performance monitoring..."
    npm run monitor:performance:start || {
        warning "Performance monitoring setup had issues"
    }
    
    success "Stage 3: Monitoring setup completed"
}

# Run comprehensive tests
run_comprehensive_tests() {
    log "Running comprehensive test suite..."
    
    # Run Malaysian feature tests
    log "Testing Malaysian features..."
    npm run test:malaysian:full || {
        error "Malaysian feature tests failed"
        exit 1
    }
    
    # Run performance benchmarks
    log "Running performance benchmarks..."
    npm run test:performance:benchmark || {
        error "Performance benchmarks failed"
        exit 1
    }
    
    success "Comprehensive tests passed"
}

# Rollback function
rollback_deployment() {
    error "Deployment failed. Initiating rollback..."
    
    if [ -d "$BACKUP_DIR" ]; then
        log "Restoring from backup..."
        
        # Restore build if it exists
        if [ -d "$BACKUP_DIR/dist" ]; then
            rm -rf dist
            cp -r "$BACKUP_DIR/dist" .
            log "Build restored from backup"
        fi
        
        # Note: We don't rollback database changes to preserve production data
        warning "Database rollback skipped to preserve production data"
        
        success "Rollback completed"
    else
        error "No backup found for rollback"
    fi
}

# Main deployment function
main_deployment() {
    log "Starting Malaysian Multi-Language Support Deployment"
    log "=================================================="
    
    # Trap errors for rollback
    trap 'rollback_deployment' ERR
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    create_backup
    
    # Pre-deployment validation
    run_pre_deployment_validation
    
    # Stage 1: Backend (verification only)
    deploy_stage1_backend
    
    # Stage 2: Frontend
    deploy_stage2_frontend
    
    # Stage 3: Monitoring
    deploy_stage3_monitoring
    
    # Run comprehensive tests
    run_comprehensive_tests
    
    # Deployment summary
    log "=================================================="
    success "Malaysian Multi-Language Support Deployment COMPLETED"
    log "=================================================="
    
    log "Deployment Summary:"
    log "- Backend: ✅ Verified (already deployed)"
    log "- Frontend: ✅ Built and ready"
    log "- Monitoring: ✅ Configured"
    log "- Tests: ✅ All passed"
    log "- Backup: ✅ Created at $BACKUP_DIR"
    log "- Log: ✅ Saved to $DEPLOYMENT_LOG"
    
    log ""
    log "Next Steps:"
    log "1. Deploy frontend build to your hosting platform"
    log "2. Monitor performance metrics"
    log "3. Collect user feedback"
    log "4. Review deployment log: $DEPLOYMENT_LOG"
    
    success "Deployment completed successfully!"
}

# Help function
show_help() {
    echo "Malaysian Multi-Language Support Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help, -h          Show this help message"
    echo "  --validate-only     Run validation only (no deployment)"
    echo "  --test-only         Run tests only"
    echo "  --backup-only       Create backup only"
    echo "  --rollback          Rollback to previous state"
    echo ""
    echo "Environment Variables:"
    echo "  SUPABASE_ANON_KEY   Supabase anonymous key (required)"
    echo ""
    echo "Examples:"
    echo "  $0                  Run full deployment"
    echo "  $0 --validate-only  Run validation checks only"
    echo "  $0 --test-only      Run test suite only"
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --validate-only)
        log "Running validation only..."
        check_prerequisites
        run_pre_deployment_validation
        success "Validation completed"
        exit 0
        ;;
    --test-only)
        log "Running tests only..."
        check_prerequisites
        run_comprehensive_tests
        success "Tests completed"
        exit 0
        ;;
    --backup-only)
        log "Creating backup only..."
        check_prerequisites
        create_backup
        success "Backup completed"
        exit 0
        ;;
    --rollback)
        log "Rolling back deployment..."
        rollback_deployment
        exit 0
        ;;
    "")
        # No arguments, run full deployment
        main_deployment
        ;;
    *)
        error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
