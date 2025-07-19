#!/bin/bash

# Alerting System Test Runner
# Comprehensive test execution script for the alerting system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_ENV=${TEST_ENV:-"development"}
SUPABASE_URL=${SUPABASE_URL:-"http://127.0.0.1:54331"}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"}

# Test directories
UNIT_TESTS_DIR="tests/alerting/unit"
INTEGRATION_TESTS_DIR="tests/alerting/integration"
E2E_TESTS_DIR="tests/alerting/e2e"
PERFORMANCE_TESTS_DIR="tests/alerting/performance"
DATABASE_TESTS_DIR="tests/alerting/database"

# Flags
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_E2E=false
RUN_PERFORMANCE=false
RUN_DATABASE=true
VERBOSE=false
COVERAGE=false
PARALLEL=false

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Alerting System Test Suite${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

print_section() {
    echo -e "${YELLOW}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

show_help() {
    echo "Alerting System Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --unit           Run unit tests only"
    echo "  -i, --integration    Run integration tests only"
    echo "  -e, --e2e           Run end-to-end tests only"
    echo "  -p, --performance   Run performance tests only"
    echo "  -d, --database      Run database tests only"
    echo "  -a, --all           Run all tests (default)"
    echo "  -c, --coverage      Generate coverage report"
    echo "  --parallel          Run tests in parallel"
    echo "  -v, --verbose       Verbose output"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  TEST_ENV            Test environment (development|staging|production)"
    echo "  SUPABASE_URL        Supabase project URL"
    echo "  SUPABASE_ANON_KEY   Supabase anonymous key"
    echo ""
    echo "Examples:"
    echo "  $0                  # Run all tests except E2E and performance"
    echo "  $0 -u -c            # Run unit tests with coverage"
    echo "  $0 -e               # Run E2E tests only"
    echo "  $0 -p               # Run performance tests only"
    echo "  $0 --all --parallel # Run all tests in parallel"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--unit)
                RUN_UNIT=true
                RUN_INTEGRATION=false
                RUN_E2E=false
                RUN_PERFORMANCE=false
                RUN_DATABASE=false
                shift
                ;;
            -i|--integration)
                RUN_UNIT=false
                RUN_INTEGRATION=true
                RUN_E2E=false
                RUN_PERFORMANCE=false
                RUN_DATABASE=false
                shift
                ;;
            -e|--e2e)
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_E2E=true
                RUN_PERFORMANCE=false
                RUN_DATABASE=false
                shift
                ;;
            -p|--performance)
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_E2E=false
                RUN_PERFORMANCE=true
                RUN_DATABASE=false
                shift
                ;;
            -d|--database)
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_E2E=false
                RUN_PERFORMANCE=false
                RUN_DATABASE=true
                shift
                ;;
            -a|--all)
                RUN_UNIT=true
                RUN_INTEGRATION=true
                RUN_E2E=true
                RUN_PERFORMANCE=true
                RUN_DATABASE=true
                shift
                ;;
            -c|--coverage)
                COVERAGE=true
                shift
                ;;
            --parallel)
                PARALLEL=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

check_prerequisites() {
    print_section "Checking Prerequisites"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm --version)"
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run from project root."
        exit 1
    fi
    
    # Check Supabase connection
    if [ "$TEST_ENV" = "development" ]; then
        print_section "Checking Supabase Connection"
        if curl -s "$SUPABASE_URL/rest/v1/" > /dev/null; then
            print_success "Supabase connection OK"
        else
            print_warning "Cannot connect to Supabase at $SUPABASE_URL"
            print_warning "Make sure Supabase is running locally or update SUPABASE_URL"
        fi
    fi
    
    echo ""
}

setup_test_environment() {
    print_section "Setting Up Test Environment"
    
    # Export environment variables
    export VITE_SUPABASE_URL="$SUPABASE_URL"
    export VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
    export NODE_ENV="test"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_section "Installing Dependencies"
        npm install
    fi
    
    print_success "Test environment ready"
    echo ""
}

run_unit_tests() {
    if [ "$RUN_UNIT" = true ]; then
        print_section "Running Unit Tests"
        
        local cmd="npm run test:unit:alerting"
        if [ "$COVERAGE" = true ]; then
            cmd="$cmd -- --coverage"
        fi
        if [ "$VERBOSE" = true ]; then
            cmd="$cmd -- --verbose"
        fi
        
        if eval $cmd; then
            print_success "Unit tests passed"
        else
            print_error "Unit tests failed"
            return 1
        fi
        echo ""
    fi
}

run_integration_tests() {
    if [ "$RUN_INTEGRATION" = true ]; then
        print_section "Running Integration Tests"
        
        local cmd="npm run test:integration:alerting"
        if [ "$VERBOSE" = true ]; then
            cmd="$cmd -- --verbose"
        fi
        
        if eval $cmd; then
            print_success "Integration tests passed"
        else
            print_error "Integration tests failed"
            return 1
        fi
        echo ""
    fi
}

run_database_tests() {
    if [ "$RUN_DATABASE" = true ]; then
        print_section "Running Database Tests"
        
        # Check if pgTAP is available
        if command -v pg_prove &> /dev/null; then
            print_section "Running pgTAP tests"
            if pg_prove -d "$SUPABASE_URL" tests/alerting/database/*.sql; then
                print_success "Database tests passed"
            else
                print_error "Database tests failed"
                return 1
            fi
        else
            print_warning "pgTAP not available, skipping SQL tests"
        fi
        
        # Run TypeScript database tests
        local cmd="npm run test:database:alerting"
        if [ "$VERBOSE" = true ]; then
            cmd="$cmd -- --verbose"
        fi
        
        if eval $cmd; then
            print_success "Database integration tests passed"
        else
            print_error "Database integration tests failed"
            return 1
        fi
        echo ""
    fi
}

run_e2e_tests() {
    if [ "$RUN_E2E" = true ]; then
        print_section "Running End-to-End Tests"
        
        # Check if Playwright is installed
        if ! command -v npx playwright &> /dev/null; then
            print_warning "Playwright not found, installing..."
            npx playwright install
        fi
        
        local cmd="npm run test:e2e:alerting"
        if [ "$VERBOSE" = true ]; then
            cmd="$cmd -- --verbose"
        fi
        
        if eval $cmd; then
            print_success "E2E tests passed"
        else
            print_error "E2E tests failed"
            return 1
        fi
        echo ""
    fi
}

run_performance_tests() {
    if [ "$RUN_PERFORMANCE" = true ]; then
        print_section "Running Performance Tests"
        
        print_warning "Performance tests may take several minutes..."
        
        local cmd="npm run test:performance:alerting"
        if [ "$VERBOSE" = true ]; then
            cmd="$cmd -- --verbose"
        fi
        
        if eval $cmd; then
            print_success "Performance tests completed"
        else
            print_error "Performance tests failed"
            return 1
        fi
        echo ""
    fi
}

generate_report() {
    print_section "Generating Test Report"
    
    local report_file="test-results/alerting-test-report-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p test-results
    
    cat > "$report_file" << EOF
# Alerting System Test Report

**Date:** $(date)
**Environment:** $TEST_ENV
**Supabase URL:** $SUPABASE_URL

## Test Configuration
- Unit Tests: $RUN_UNIT
- Integration Tests: $RUN_INTEGRATION
- Database Tests: $RUN_DATABASE
- E2E Tests: $RUN_E2E
- Performance Tests: $RUN_PERFORMANCE
- Coverage: $COVERAGE
- Parallel: $PARALLEL

## Results
EOF
    
    if [ "$COVERAGE" = true ] && [ -f "coverage/lcov-report/index.html" ]; then
        echo "- Coverage Report: coverage/lcov-report/index.html" >> "$report_file"
    fi
    
    print_success "Test report generated: $report_file"
    echo ""
}

cleanup() {
    print_section "Cleaning Up"
    
    # Clean up any test data or processes
    # This would be implemented based on specific cleanup needs
    
    print_success "Cleanup completed"
}

main() {
    print_header
    
    parse_args "$@"
    
    check_prerequisites
    setup_test_environment
    
    local exit_code=0
    
    # Run tests in specified order
    run_unit_tests || exit_code=1
    run_database_tests || exit_code=1
    run_integration_tests || exit_code=1
    run_e2e_tests || exit_code=1
    run_performance_tests || exit_code=1
    
    generate_report
    cleanup
    
    if [ $exit_code -eq 0 ]; then
        print_success "All tests completed successfully!"
    else
        print_error "Some tests failed. Check the output above for details."
    fi
    
    exit $exit_code
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function with all arguments
main "$@"
