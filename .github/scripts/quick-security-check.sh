#!/bin/bash

# Quick Security Configuration Check
# A simple script to verify basic security scanning setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a git repository"
        exit 1
    fi
    success "Git repository detected"
}

# Check if GitHub CLI is available
check_github_cli() {
    if ! command -v gh &> /dev/null; then
        warning "GitHub CLI (gh) not found"
        warning "Install from: https://cli.github.com/"
        warning "Some checks will be skipped"
        return 1
    fi
    
    if ! gh auth status &> /dev/null; then
        warning "GitHub CLI not authenticated"
        warning "Run: gh auth login"
        warning "Some checks will be skipped"
        return 1
    fi
    
    success "GitHub CLI is available and authenticated"
    return 0
}

# Check workflow files
check_workflows() {
    log "Checking workflow files..."
    
    local workflows_dir=".github/workflows"
    local required_workflows=("ci.yml" "security-scan.yml")
    local missing_workflows=()
    
    if [[ ! -d "$workflows_dir" ]]; then
        error "Workflows directory not found: $workflows_dir"
        return 1
    fi
    
    for workflow in "${required_workflows[@]}"; do
        if [[ -f "$workflows_dir/$workflow" ]]; then
            success "Workflow found: $workflow"
        else
            missing_workflows+=("$workflow")
        fi
    done
    
    if [[ ${#missing_workflows[@]} -gt 0 ]]; then
        error "Missing required workflows:"
        for workflow in "${missing_workflows[@]}"; do
            error "  - $workflow"
        done
        return 1
    fi
    
    success "All required workflows are present"
    return 0
}

# Check for security configuration files
check_security_files() {
    log "Checking security configuration files..."
    
    local security_files=(
        ".github/docs/SECURITY_SCANNING_SETUP.md"
        ".github/scripts/setup-secrets.sh"
        ".github/scripts/validate-security-setup.sh"
    )
    
    local missing_files=()
    
    for file in "${security_files[@]}"; do
        if [[ -f "$file" ]]; then
            success "Security file found: $file"
        else
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        warning "Missing security configuration files:"
        for file in "${missing_files[@]}"; do
            warning "  - $file"
        done
        warning "These files provide setup and troubleshooting guidance"
    fi
    
    return 0
}

# Check package.json for security scripts
check_package_json() {
    log "Checking package.json for security-related scripts..."
    
    if [[ ! -f "package.json" ]]; then
        warning "package.json not found"
        return 1
    fi
    
    # Check for audit script
    if grep -q '"audit"' package.json; then
        success "npm audit script found"
    else
        warning "Consider adding npm audit script to package.json"
    fi
    
    # Check for test scripts
    if grep -q '"test"' package.json; then
        success "Test scripts found"
    else
        warning "No test scripts found in package.json"
    fi
    
    return 0
}

# Check for common security files
check_security_best_practices() {
    log "Checking security best practices..."
    
    # Check for .gitignore
    if [[ -f ".gitignore" ]]; then
        success ".gitignore file found"
        
        # Check for common secret patterns in .gitignore
        local secret_patterns=("*.env" "*.key" "*.pem" ".env.*")
        local missing_patterns=()
        
        for pattern in "${secret_patterns[@]}"; do
            if grep -q "$pattern" .gitignore; then
                success ".gitignore includes: $pattern"
            else
                missing_patterns+=("$pattern")
            fi
        done
        
        if [[ ${#missing_patterns[@]} -gt 0 ]]; then
            warning "Consider adding these patterns to .gitignore:"
            for pattern in "${missing_patterns[@]}"; do
                warning "  - $pattern"
            done
        fi
    else
        warning ".gitignore file not found"
    fi
    
    # Check for security policy
    if [[ -f "SECURITY.md" ]] || [[ -f ".github/SECURITY.md" ]]; then
        success "Security policy found"
    else
        warning "Consider adding a SECURITY.md file"
    fi
    
    return 0
}

# Check GitHub repository secrets (if GitHub CLI is available)
check_github_secrets() {
    if ! check_github_cli; then
        return 0
    fi
    
    log "Checking GitHub repository secrets..."
    
    # Get repository name
    local repo
    if ! repo=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null); then
        warning "Could not determine repository name"
        return 1
    fi
    
    log "Repository: $repo"
    
    # Check for required secrets
    local required_secrets=("SNYK_TOKEN" "SUPABASE_URL" "VERCEL_TOKEN")
    local configured_secrets
    
    if ! configured_secrets=$(gh secret list --json name -q '.[].name' 2>/dev/null); then
        warning "Could not list repository secrets"
        return 1
    fi
    
    local missing_secrets=()
    
    for secret in "${required_secrets[@]}"; do
        if echo "$configured_secrets" | grep -q "^$secret$"; then
            success "Secret configured: $secret"
        else
            missing_secrets+=("$secret")
        fi
    done
    
    if [[ ${#missing_secrets[@]} -gt 0 ]]; then
        warning "Missing recommended secrets:"
        for secret in "${missing_secrets[@]}"; do
            warning "  - $secret"
        done
        warning "See .github/docs/SECURITY_SCANNING_SETUP.md for setup instructions"
    fi
    
    return 0
}

# Generate summary report
generate_summary() {
    log "Security Configuration Summary"
    log "============================="
    
    echo
    log "✅ Completed checks:"
    log "  - Git repository validation"
    log "  - Workflow files verification"
    log "  - Security configuration files"
    log "  - Package.json security scripts"
    log "  - Security best practices"
    log "  - GitHub secrets (if available)"
    
    echo
    log "📚 Next steps:"
    log "  1. Review any warnings above"
    log "  2. Set up missing secrets using .github/scripts/setup-secrets.sh"
    log "  3. Run full validation: .github/scripts/validate-security-setup.sh"
    log "  4. Read setup guide: .github/docs/SECURITY_SCANNING_SETUP.md"
    
    echo
    log "🔒 Security scanning should work with minimal configuration"
    log "   Most tools (CodeQL, TruffleHog) work out of the box"
    log "   Only Snyk requires an API token for full functionality"
}

# Main execution
main() {
    echo -e "${BLUE}🔒 Quick Security Configuration Check${NC}"
    echo -e "${BLUE}====================================${NC}"
    echo
    
    # Run checks
    check_git_repo
    check_workflows
    check_security_files
    check_package_json
    check_security_best_practices
    check_github_secrets
    
    echo
    generate_summary
    
    echo
    success "Quick security check completed!"
    log "For detailed validation, run: .github/scripts/validate-security-setup.sh --repo OWNER/REPO --all"
}

# Run main function
main "$@"
