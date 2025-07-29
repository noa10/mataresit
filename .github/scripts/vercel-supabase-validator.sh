#!/bin/bash

# Vercel + Supabase Deployment Validator
# Validates deployment readiness and health for the new serverless architecture

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
Vercel + Supabase Deployment Validator

This script validates deployment readiness and health for the Vercel + Supabase architecture.

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --environment ENV       Environment to validate (production|staging|development)
    --check-type TYPE       Type of validation (pre|post|health|all)
    --domain DOMAIN         Domain to validate (overrides environment default)
    --timeout SECONDS       Timeout for health checks (default: 30)
    --verbose              Enable verbose output
    --json                 Output results in JSON format

CHECK TYPES:
    pre                    Pre-deployment validation (configuration, secrets)
    post                   Post-deployment validation (deployment success)
    health                 Health checks (endpoints, services)
    all                    All validation types

EXAMPLES:
    $0 --environment production --check-type health
    $0 --environment staging --check-type all --verbose
    $0 --domain custom.domain.com --check-type post

EOF
}

# Parse command line arguments
ENVIRONMENT="production"
CHECK_TYPE="all"
DOMAIN=""
TIMEOUT=30
VERBOSE=false
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --check-type)
            CHECK_TYPE="$2"
            shift 2
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set domain based on environment if not provided
if [[ -z "$DOMAIN" ]]; then
    case "$ENVIRONMENT" in
        "production")
            DOMAIN="mataresit.com"
            ;;
        "staging")
            DOMAIN="staging.mataresit.com"
            ;;
        "development")
            DOMAIN="dev.mataresit.com"
            ;;
        *)
            error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
fi

# Validation results storage
declare -A VALIDATION_RESULTS

# Pre-deployment validation
pre_deployment_validation() {
    log "Running pre-deployment validation for $ENVIRONMENT..."
    
    local validation_passed=true
    
    # Check required environment variables
    log "Checking environment configuration..."
    
    local required_vars=()
    case "$ENVIRONMENT" in
        "production")
            required_vars=("VERCEL_TOKEN" "SUPABASE_URL" "SUPABASE_ANON_KEY")
            ;;
        "staging")
            required_vars=("VERCEL_TOKEN" "STAGING_SUPABASE_URL" "STAGING_SUPABASE_ANON_KEY")
            ;;
        *)
            required_vars=("VERCEL_TOKEN")
            ;;
    esac
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            warning "Environment variable not set: $var"
            validation_passed=false
        else
            if [[ "$VERBOSE" == "true" ]]; then
                success "Environment variable configured: $var"
            fi
        fi
    done
    
    # Check build configuration
    log "Checking build configuration..."
    
    if [[ -f "package.json" ]]; then
        if grep -q '"build"' package.json; then
            success "Build script found in package.json"
        else
            error "Build script not found in package.json"
            validation_passed=false
        fi
    else
        error "package.json not found"
        validation_passed=false
    fi
    
    if [[ -f "vite.config.ts" ]] || [[ -f "vite.config.js" ]]; then
        success "Vite configuration found"
    else
        warning "Vite configuration not found"
    fi
    
    # Check Supabase configuration
    log "Checking Supabase configuration..."
    
    if [[ -d "supabase" ]]; then
        success "Supabase directory found"
        
        if [[ -f "supabase/config.toml" ]]; then
            success "Supabase configuration found"
        else
            warning "Supabase config.toml not found"
        fi
        
        if [[ -d "supabase/migrations" ]]; then
            local migration_count=$(find supabase/migrations -name "*.sql" | wc -l)
            log "Found $migration_count database migrations"
        fi
        
        if [[ -d "supabase/functions" ]]; then
            local function_count=$(find supabase/functions -name "index.ts" | wc -l)
            log "Found $function_count Edge Functions"
        fi
    else
        warning "Supabase directory not found"
    fi
    
    VALIDATION_RESULTS["pre_deployment"]=$([ "$validation_passed" == "true" ] && echo "PASSED" || echo "FAILED")
    
    if [[ "$validation_passed" == "true" ]]; then
        success "Pre-deployment validation passed"
        return 0
    else
        error "Pre-deployment validation failed"
        return 1
    fi
}

# Post-deployment validation
post_deployment_validation() {
    log "Running post-deployment validation for $ENVIRONMENT..."
    
    local validation_passed=true
    
    # Check domain accessibility
    log "Checking domain accessibility: https://$DOMAIN"
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" --max-time "$TIMEOUT" || echo "000")
    
    if [[ "$response_code" =~ ^(200|301|302)$ ]]; then
        success "Domain is accessible (HTTP $response_code)"
    else
        error "Domain is not accessible (HTTP $response_code)"
        validation_passed=false
    fi
    
    # Check SSL certificate
    log "Checking SSL certificate..."
    
    if curl -s --max-time "$TIMEOUT" "https://$DOMAIN" > /dev/null 2>&1; then
        success "SSL certificate is valid"
    else
        error "SSL certificate validation failed"
        validation_passed=false
    fi
    
    # Check specific application routes
    log "Checking application routes..."
    
    local routes=("/" "/pricing" "/login")
    for route in "${routes[@]}"; do
        local route_response
        route_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN$route" --max-time "$TIMEOUT" || echo "000")
        
        if [[ "$route_response" =~ ^(200|301|302)$ ]]; then
            if [[ "$VERBOSE" == "true" ]]; then
                success "Route accessible: $route (HTTP $route_response)"
            fi
        else
            warning "Route may have issues: $route (HTTP $route_response)"
        fi
    done
    
    # Check for Vercel deployment headers
    log "Checking Vercel deployment headers..."
    
    local headers
    headers=$(curl -s -I "https://$DOMAIN" --max-time "$TIMEOUT" || echo "")
    
    if echo "$headers" | grep -i "server.*vercel" > /dev/null; then
        success "Deployed on Vercel"
    else
        warning "Vercel deployment headers not detected"
    fi
    
    VALIDATION_RESULTS["post_deployment"]=$([ "$validation_passed" == "true" ] && echo "PASSED" || echo "FAILED")
    
    if [[ "$validation_passed" == "true" ]]; then
        success "Post-deployment validation passed"
        return 0
    else
        error "Post-deployment validation failed"
        return 1
    fi
}

# Health check validation
health_check_validation() {
    log "Running health check validation for $ENVIRONMENT..."
    
    local validation_passed=true
    
    # Check Supabase health
    log "Checking Supabase health..."
    
    local supabase_url=""
    case "$ENVIRONMENT" in
        "production")
            supabase_url="${SUPABASE_URL:-}"
            ;;
        "staging")
            supabase_url="${STAGING_SUPABASE_URL:-}"
            ;;
        *)
            supabase_url="${TEST_SUPABASE_URL:-}"
            ;;
    esac
    
    if [[ -n "$supabase_url" ]]; then
        local supabase_health
        supabase_health=$(curl -s -o /dev/null -w "%{http_code}" "$supabase_url/health" --max-time "$TIMEOUT" || echo "000")
        
        if [[ "$supabase_health" == "200" ]]; then
            success "Supabase health check passed"
        else
            error "Supabase health check failed (HTTP $supabase_health)"
            validation_passed=false
        fi
        
        # Test database connectivity
        log "Testing database connectivity..."
        local db_response
        db_response=$(curl -s -o /dev/null -w "%{http_code}" "$supabase_url/rest/v1/receipts?select=id&limit=1" \
            -H "Authorization: Bearer ${SUPABASE_ANON_KEY:-}" \
            -H "apikey: ${SUPABASE_ANON_KEY:-}" \
            --max-time "$TIMEOUT" || echo "000")
        
        if [[ "$db_response" =~ ^(200|404)$ ]]; then
            success "Database connectivity test passed"
        else
            warning "Database connectivity test failed (HTTP $db_response)"
        fi
    else
        warning "Supabase URL not configured for $ENVIRONMENT"
    fi
    
    # Check Edge Functions
    log "Checking Edge Functions..."
    
    if [[ -n "$supabase_url" ]]; then
        local functions=("process-receipt" "stripe-webhook" "manage-api-keys")
        
        for func in "${functions[@]}"; do
            local func_response
            func_response=$(curl -s -o /dev/null -w "%{http_code}" \
                -X POST "$supabase_url/functions/v1/$func" \
                -H "Authorization: Bearer ${SUPABASE_ANON_KEY:-}" \
                -H "Content-Type: application/json" \
                -d '{"test": true}' \
                --max-time "$TIMEOUT" || echo "000")
            
            if [[ "$func_response" =~ ^(200|400|401)$ ]]; then
                if [[ "$VERBOSE" == "true" ]]; then
                    success "Edge Function responding: $func (HTTP $func_response)"
                fi
            else
                warning "Edge Function may not be deployed: $func (HTTP $func_response)"
            fi
        done
    fi
    
    # Check performance
    log "Checking performance metrics..."
    
    local start_time=$(date +%s%N)
    curl -s "https://$DOMAIN" --max-time "$TIMEOUT" > /dev/null || true
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))
    
    if [[ $response_time -lt 2000 ]]; then
        success "Response time: ${response_time}ms (good)"
    elif [[ $response_time -lt 5000 ]]; then
        warning "Response time: ${response_time}ms (acceptable)"
    else
        warning "Response time: ${response_time}ms (slow)"
    fi
    
    VALIDATION_RESULTS["health_check"]=$([ "$validation_passed" == "true" ] && echo "PASSED" || echo "FAILED")
    
    if [[ "$validation_passed" == "true" ]]; then
        success "Health check validation passed"
        return 0
    else
        error "Health check validation failed"
        return 1
    fi
}

# Generate validation report
generate_report() {
    local overall_status="$1"
    
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        # JSON output
        cat << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "domain": "$DOMAIN",
  "overall_status": "$overall_status",
  "validation_results": {
    "pre_deployment": "${VALIDATION_RESULTS[pre_deployment]:-SKIPPED}",
    "post_deployment": "${VALIDATION_RESULTS[post_deployment]:-SKIPPED}",
    "health_check": "${VALIDATION_RESULTS[health_check]:-SKIPPED}"
  }
}
EOF
    else
        # Human-readable output
        echo
        log "🎯 Validation Report"
        log "==================="
        log "Environment: $ENVIRONMENT"
        log "Domain: $DOMAIN"
        log "Timestamp: $(date)"
        echo
        log "Results:"
        log "  Pre-deployment: ${VALIDATION_RESULTS[pre_deployment]:-SKIPPED}"
        log "  Post-deployment: ${VALIDATION_RESULTS[post_deployment]:-SKIPPED}"
        log "  Health checks: ${VALIDATION_RESULTS[health_check]:-SKIPPED}"
        echo
        log "Overall Status: $overall_status"
    fi
}

# Main execution
main() {
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        log "Vercel + Supabase Deployment Validator"
        log "======================================"
        log "Environment: $ENVIRONMENT"
        log "Domain: $DOMAIN"
        log "Check Type: $CHECK_TYPE"
        echo
    fi
    
    local overall_passed=true
    
    # Run validations based on check type
    case "$CHECK_TYPE" in
        "pre")
            pre_deployment_validation || overall_passed=false
            ;;
        "post")
            post_deployment_validation || overall_passed=false
            ;;
        "health")
            health_check_validation || overall_passed=false
            ;;
        "all")
            pre_deployment_validation || overall_passed=false
            post_deployment_validation || overall_passed=false
            health_check_validation || overall_passed=false
            ;;
        *)
            error "Invalid check type: $CHECK_TYPE"
            exit 1
            ;;
    esac
    
    # Generate report
    local status=$([ "$overall_passed" == "true" ] && echo "PASSED" || echo "FAILED")
    generate_report "$status"
    
    # Exit with appropriate code
    if [[ "$overall_passed" == "true" ]]; then
        if [[ "$JSON_OUTPUT" != "true" ]]; then
            success "All validations passed"
        fi
        exit 0
    else
        if [[ "$JSON_OUTPUT" != "true" ]]; then
            error "Some validations failed"
        fi
        exit 1
    fi
}

# Run main function
main "$@"
