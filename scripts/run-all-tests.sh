#!/bin/bash

# Master test runner for AI Vision Embedding Enhancement
# Runs all validation tests in the correct order

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DENO_PERMISSIONS="--allow-env --allow-net --allow-read --allow-write"
LOG_FILE="test-results-$(date +%Y%m%d-%H%M%S).log"

# Helper functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Test execution function
run_test() {
    local test_name="$1"
    local test_script="$2"
    local required="$3"
    
    print_info "Running $test_name..."
    echo "$(date): Starting $test_name" >> "$LOG_FILE"
    
    if deno run $DENO_PERMISSIONS "$SCRIPT_DIR/$test_script" >> "$LOG_FILE" 2>&1; then
        print_success "$test_name PASSED"
        echo "$(date): $test_name PASSED" >> "$LOG_FILE"
        return 0
    else
        if [[ "$required" == "required" ]]; then
            print_error "$test_name FAILED (REQUIRED)"
            echo "$(date): $test_name FAILED (REQUIRED)" >> "$LOG_FILE"
            return 1
        else
            print_warning "$test_name FAILED (OPTIONAL)"
            echo "$(date): $test_name FAILED (OPTIONAL)" >> "$LOG_FILE"
            return 0
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if Deno is installed
    if ! command -v deno &> /dev/null; then
        print_error "Deno is not installed. Please install Deno first."
        echo "Visit: https://deno.land/manual/getting_started/installation"
        exit 1
    fi
    print_success "Deno is installed"
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]]; then
        print_error "SUPABASE_URL environment variable is not set"
        exit 1
    fi
    print_success "SUPABASE_URL is set"
    
    if [[ -z "$SUPABASE_SERVICE_KEY" ]]; then
        print_error "SUPABASE_SERVICE_KEY environment variable is not set"
        exit 1
    fi
    print_success "SUPABASE_SERVICE_KEY is set"
    
    # Check if test scripts exist
    local test_scripts=(
        "test-enhanced-content-extraction.ts"
        "test-complete-solution.ts"
        "benchmark-embedding-performance.ts"
        "test-end-to-end-workflow.ts"
        "generate-validation-report.ts"
    )
    
    for script in "${test_scripts[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
            print_error "Test script not found: $script"
            exit 1
        fi
    done
    print_success "All test scripts are available"
    
    # Create log file
    echo "Test execution started at $(date)" > "$LOG_FILE"
    print_info "Logging to $LOG_FILE"
}

# Main test execution
run_all_tests() {
    print_header "Running Complete Test Suite"
    
    local total_tests=0
    local passed_tests=0
    local failed_required=0
    
    # Test 1: Enhanced Content Extraction (Required)
    total_tests=$((total_tests + 1))
    if run_test "Enhanced Content Extraction" "test-enhanced-content-extraction.ts" "required"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_required=$((failed_required + 1))
    fi
    
    # Test 2: Complete Solution Test (Required)
    total_tests=$((total_tests + 1))
    if run_test "Complete Solution Test" "test-complete-solution.ts" "required"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_required=$((failed_required + 1))
    fi
    
    # Test 3: Performance Benchmark (Optional)
    total_tests=$((total_tests + 1))
    if run_test "Performance Benchmark" "benchmark-embedding-performance.ts" "optional"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # Test 4: End-to-End Workflow (Required)
    total_tests=$((total_tests + 1))
    if run_test "End-to-End Workflow" "test-end-to-end-workflow.ts" "required"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_required=$((failed_required + 1))
    fi
    
    # Test 5: Generate Final Validation Report (Required)
    total_tests=$((total_tests + 1))
    if run_test "Validation Report Generation" "generate-validation-report.ts" "required"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_required=$((failed_required + 1))
    fi
    
    # Summary
    print_header "Test Execution Summary"
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $((total_tests - passed_tests))"
    echo "Required Tests Failed: $failed_required"
    
    local success_rate=$((passed_tests * 100 / total_tests))
    echo "Success Rate: $success_rate%"
    
    # Final assessment
    if [[ $failed_required -eq 0 && $success_rate -ge 80 ]]; then
        print_success "ALL TESTS PASSED - Solution is ready for production!"
        echo "$(date): ALL TESTS PASSED" >> "$LOG_FILE"
        return 0
    elif [[ $failed_required -eq 0 ]]; then
        print_warning "Tests passed but with some optional failures"
        echo "$(date): Tests passed with optional failures" >> "$LOG_FILE"
        return 0
    else
        print_error "CRITICAL TESTS FAILED - Solution needs fixes before deployment"
        echo "$(date): CRITICAL TESTS FAILED" >> "$LOG_FILE"
        return 1
    fi
}

# Show test results
show_results() {
    print_header "Test Results Summary"
    
    if [[ -f "validation-report.md" ]]; then
        print_info "Detailed validation report generated: validation-report.md"
        
        # Show key metrics from the report
        if grep -q "Overall Status:" validation-report.md; then
            local status=$(grep "Overall Status:" validation-report.md | cut -d' ' -f3)
            local score=$(grep "Overall Score:" validation-report.md | cut -d' ' -f3)
            
            echo "Overall Status: $status"
            echo "Overall Score: $score"
            
            if [[ "$status" == "PASSED" ]]; then
                print_success "Solution validation completed successfully!"
            elif [[ "$status" == "PARTIAL" ]]; then
                print_warning "Solution partially validated - review issues"
            else
                print_error "Solution validation failed - significant issues found"
            fi
        fi
    fi
    
    print_info "Full test log available in: $LOG_FILE"
    
    echo ""
    echo "Next steps:"
    echo "1. Review the validation report (validation-report.md)"
    echo "2. Check the test log for detailed results ($LOG_FILE)"
    echo "3. Address any failed tests before deployment"
    echo "4. Run migration tools if needed"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                echo "AI Vision Embedding Enhancement - Test Runner"
                echo ""
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --help, -h     Show this help message"
                echo "  --quick        Run only essential tests (faster)"
                echo "  --full         Run all tests including performance benchmarks"
                echo ""
                echo "Environment Variables Required:"
                echo "  SUPABASE_URL              Your Supabase project URL"
                echo "  SUPABASE_SERVICE_KEY      Your Supabase service key"
                echo ""
                echo "This script runs the complete test suite to validate the"
                echo "AI vision embedding enhancement solution."
                exit 0
                ;;
            --quick)
                QUICK_MODE=true
                shift
                ;;
            --full)
                FULL_MODE=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Main execution
main() {
    parse_args "$@"
    
    print_header "AI Vision Embedding Enhancement - Test Suite"
    echo "Starting comprehensive validation at $(date)"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Run tests
    if run_all_tests; then
        echo ""
        show_results
        echo ""
        print_success "Test suite completed successfully!"
        exit 0
    else
        echo ""
        show_results
        echo ""
        print_error "Test suite failed - review results and fix issues"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
