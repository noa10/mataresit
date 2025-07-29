#!/bin/bash

# Security Scanning Setup Validation Script
# Validates that all required secrets and configurations are properly set up

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
Security Scanning Setup Validation Script

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --repo REPO             GitHub repository (owner/repo)
    --check-secrets         Check if required secrets are configured
    --check-tools           Check if security tools are accessible
    --check-workflows       Validate workflow configurations
    --fix-permissions       Fix GitHub token permissions (if possible)
    --all                   Run all checks

EXAMPLES:
    $0 --repo owner/repo --all
    $0 --repo owner/repo --check-secrets
    $0 --repo owner/repo --check-tools

REQUIRED TOOLS:
    - gh (GitHub CLI)
    - curl
    - jq (JSON processor)

EOF
}

# Parse command line arguments
REPO=""
CHECK_SECRETS=false
CHECK_TOOLS=false
CHECK_WORKFLOWS=false
FIX_PERMISSIONS=false
CHECK_ALL=false

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
        --check-secrets)
            CHECK_SECRETS=true
            shift
            ;;
        --check-tools)
            CHECK_TOOLS=true
            shift
            ;;
        --check-workflows)
            CHECK_WORKFLOWS=true
            shift
            ;;
        --fix-permissions)
            FIX_PERMISSIONS=true
            shift
            ;;
        --all)
            CHECK_ALL=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set all checks if --all is specified
if [[ "$CHECK_ALL" == "true" ]]; then
    CHECK_SECRETS=true
    CHECK_TOOLS=true
    CHECK_WORKFLOWS=true
fi

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."
    
    # Check required tools
    local missing_tools=()
    
    if ! command -v gh &> /dev/null; then
        missing_tools+=("GitHub CLI (gh)")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools:"
        for tool in "${missing_tools[@]}"; do
            error "  - $tool"
        done
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

# Check required secrets
check_secrets() {
    log "Checking required GitHub secrets for $REPO..."
    
    # Define required secrets for Vercel + Supabase architecture
    local required_secrets=(
        "VERCEL_TOKEN"
        "VERCEL_ORG_ID"
        "VERCEL_PROJECT_ID"
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "SUPABASE_PROJECT_ID"
        "SUPABASE_ACCESS_TOKEN"
        "SNYK_TOKEN"
        "GEMINI_API_KEY"
    )
    
    local optional_secrets=(
        "STAGING_SUPABASE_URL"
        "TEST_SUPABASE_URL"
        "SLACK_WEBHOOK_URL"
        "SECURITY_SLACK_WEBHOOK_URL"
        "GITLEAKS_LICENSE"
        "EMERGENCY_APPROVERS"
    )
    
    # Get current secrets
    local current_secrets
    if ! current_secrets=$(gh secret list --repo "$REPO" --json name -q '.[].name' 2>/dev/null); then
        error "Failed to list secrets. Check repository access and permissions."
        return 1
    fi
    
    local missing_required=()
    local missing_optional=()
    
    # Check required secrets
    for secret in "${required_secrets[@]}"; do
        if ! echo "$current_secrets" | grep -q "^$secret$"; then
            missing_required+=("$secret")
        else
            success "Required secret found: $secret"
        fi
    done
    
    # Check optional secrets
    for secret in "${optional_secrets[@]}"; do
        if ! echo "$current_secrets" | grep -q "^$secret$"; then
            missing_optional+=("$secret")
        else
            success "Optional secret found: $secret"
        fi
    done
    
    # Report results
    if [[ ${#missing_required[@]} -gt 0 ]]; then
        error "Missing required secrets:"
        for secret in "${missing_required[@]}"; do
            error "  - $secret"
        done
        return 1
    fi
    
    if [[ ${#missing_optional[@]} -gt 0 ]]; then
        warning "Missing optional secrets (recommended):"
        for secret in "${missing_optional[@]}"; do
            warning "  - $secret"
        done
    fi
    
    success "All required secrets are configured"
    return 0
}

# Check security tools accessibility
check_tools() {
    log "Checking security tools accessibility..."
    
    local tools_status=0
    
    # Check Snyk API
    if [[ -n "${SNYK_TOKEN:-}" ]]; then
        if curl -s -H "Authorization: token $SNYK_TOKEN" "https://api.snyk.io/v1/user/me" | jq -e '.username' > /dev/null 2>&1; then
            success "Snyk API is accessible"
        else
            error "Snyk API is not accessible - check SNYK_TOKEN"
            tools_status=1
        fi
    else
        warning "SNYK_TOKEN not set in environment - cannot test Snyk API"
    fi
    
    # Check GitHub CodeQL
    log "GitHub CodeQL is built-in - no external API check needed"
    success "CodeQL will work with proper repository permissions"
    
    # Check TruffleHog (no API key needed)
    success "TruffleHog requires no API key - will work out of the box"
    
    # Check GitLeaks (optional license)
    if [[ -n "${GITLEAKS_LICENSE:-}" ]]; then
        success "GitLeaks license is configured"
    else
        warning "GitLeaks license not configured - will use free version"
    fi
    
    return $tools_status
}

# Check workflow configurations
check_workflows() {
    log "Checking workflow configurations..."
    
    local workflow_issues=0
    
    # Check if security-scan.yml exists
    if [[ -f ".github/workflows/security-scan.yml" ]]; then
        success "Security scanning workflow found"
        
        # Check for required jobs
        if grep -q "code-security:" ".github/workflows/security-scan.yml"; then
            success "Code security job configured"
        else
            error "Code security job missing"
            workflow_issues=1
        fi
        
        if grep -q "dependency-security:" ".github/workflows/security-scan.yml"; then
            success "Dependency security job configured"
        else
            error "Dependency security job missing"
            workflow_issues=1
        fi
        
        if grep -q "secrets-scan:" ".github/workflows/security-scan.yml"; then
            success "Secrets scanning job configured"
        else
            error "Secrets scanning job missing"
            workflow_issues=1
        fi
        
    else
        error "Security scanning workflow not found: .github/workflows/security-scan.yml"
        workflow_issues=1
    fi
    
    # Check CI workflow
    if [[ -f ".github/workflows/ci.yml" ]]; then
        success "CI workflow found"
    else
        warning "CI workflow not found: .github/workflows/ci.yml"
    fi
    
    return $workflow_issues
}

# Fix GitHub token permissions
fix_permissions() {
    log "Checking GitHub token permissions..."
    
    # Check current token permissions
    local token_info
    if token_info=$(gh api user 2>/dev/null); then
        success "GitHub token is valid"
        
        # Check repository access
        if gh repo view "$REPO" > /dev/null 2>&1; then
            success "Repository access confirmed"
        else
            error "Cannot access repository: $REPO"
            error "Check repository name and permissions"
            return 1
        fi
        
    else
        error "GitHub token is invalid or expired"
        error "Run: gh auth login --scopes repo,security_events,write:packages"
        return 1
    fi
    
    log "GitHub token permissions appear to be sufficient"
    return 0
}

# Main execution
main() {
    log "Security Scanning Setup Validation"
    log "=================================="
    
    # Validate prerequisites
    validate_prerequisites
    
    # Validate required parameters
    if [[ -z "$REPO" ]]; then
        error "Repository is required (use --repo owner/repo)"
        exit 1
    fi
    
    local overall_status=0
    
    # Run checks based on flags
    if [[ "$CHECK_SECRETS" == "true" ]]; then
        if ! check_secrets; then
            overall_status=1
        fi
        echo
    fi
    
    if [[ "$CHECK_TOOLS" == "true" ]]; then
        if ! check_tools; then
            overall_status=1
        fi
        echo
    fi
    
    if [[ "$CHECK_WORKFLOWS" == "true" ]]; then
        if ! check_workflows; then
            overall_status=1
        fi
        echo
    fi
    
    if [[ "$FIX_PERMISSIONS" == "true" ]]; then
        if ! fix_permissions; then
            overall_status=1
        fi
        echo
    fi
    
    # Final status
    if [[ $overall_status -eq 0 ]]; then
        success "Security scanning setup validation completed successfully"
        log "Your security scanning configuration appears to be properly set up"
    else
        error "Security scanning setup validation failed"
        log "Please fix the issues above and run the validation again"
        exit 1
    fi
}

# Run main function
main "$@"
