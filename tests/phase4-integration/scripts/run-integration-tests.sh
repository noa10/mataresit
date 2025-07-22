#!/bin/bash

# Phase 4 Integration Tests Runner
# This script runs the complete Phase 4 integration test suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="tests/phase4-integration"
REPORTS_DIR="$TEST_DIR/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🚀 Starting Phase 4 Integration Test Suite${NC}"
echo -e "${BLUE}================================================${NC}"
echo "Timestamp: $(date)"
echo "Test Directory: $TEST_DIR"
echo "Reports Directory: $REPORTS_DIR"
echo ""

# Create reports directory if it doesn't exist
mkdir -p "$REPORTS_DIR"

# Function to run a test suite and capture results
run_test_suite() {
    local suite_name="$1"
    local test_command="$2"
    local report_file="$REPORTS_DIR/${suite_name}_${TIMESTAMP}.json"
    
    echo -e "${YELLOW}📋 Running $suite_name tests...${NC}"
    
    if eval "$test_command" > "$REPORTS_DIR/${suite_name}_${TIMESTAMP}.log" 2>&1; then
        echo -e "${GREEN}✅ $suite_name tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $suite_name tests failed${NC}"
        echo "Check log file: $REPORTS_DIR/${suite_name}_${TIMESTAMP}.log"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    
    # Check if vitest is available
    if ! npx vitest --version &> /dev/null; then
        echo -e "${RED}❌ Vitest is not available${NC}"
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$TEST_SUPABASE_URL" ] && [ -z "$VITE_SUPABASE_URL" ]; then
        echo -e "${YELLOW}⚠️  Warning: No Supabase URL configured${NC}"
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
    echo ""
}

# Function to setup test environment
setup_test_environment() {
    echo -e "${YELLOW}🛠️  Setting up test environment...${NC}"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Run test environment setup script if it exists
    if [ -f "$TEST_DIR/scripts/setup-test-environment.js" ]; then
        node "$TEST_DIR/scripts/setup-test-environment.js"
    fi
    
    echo -e "${GREEN}✅ Test environment setup completed${NC}"
    echo ""
}

# Function to cleanup test environment
cleanup_test_environment() {
    echo -e "${YELLOW}🧹 Cleaning up test environment...${NC}"
    
    # Run cleanup script if it exists
    if [ -f "$TEST_DIR/scripts/cleanup-test-environment.js" ]; then
        node "$TEST_DIR/scripts/cleanup-test-environment.js"
    fi
    
    echo -e "${GREEN}✅ Test environment cleanup completed${NC}"
}

# Function to generate comprehensive report
generate_report() {
    echo -e "${YELLOW}📊 Generating comprehensive test report...${NC}"
    
    local report_file="$REPORTS_DIR/comprehensive_report_${TIMESTAMP}.json"
    local html_report="$REPORTS_DIR/comprehensive_report_${TIMESTAMP}.html"
    
    # Run report generation script if it exists
    if [ -f "$TEST_DIR/scripts/generate-reports.js" ]; then
        node "$TEST_DIR/scripts/generate-reports.js" "$TIMESTAMP"
    fi
    
    echo -e "${GREEN}✅ Report generated: $html_report${NC}"
}

# Main execution
main() {
    local exit_code=0
    local failed_suites=()
    
    # Check prerequisites
    check_prerequisites
    
    # Setup test environment
    setup_test_environment
    
    # Trap to ensure cleanup runs even if script fails
    trap cleanup_test_environment EXIT
    
    echo -e "${BLUE}🧪 Running Integration Test Suites${NC}"
    echo -e "${BLUE}===================================${NC}"
    
    # Run integration tests
    if ! run_test_suite "integration" "npm run test:phase4:integration"; then
        failed_suites+=("integration")
        exit_code=1
    fi
    
    # Run performance tests
    if ! run_test_suite "performance" "npm run test:phase4:performance"; then
        failed_suites+=("performance")
        exit_code=1
    fi
    
    # Run production readiness tests
    if ! run_test_suite "production-readiness" "npm run test:phase4:production-readiness"; then
        failed_suites+=("production-readiness")
        exit_code=1
    fi
    
    # Run load tests (optional, can be skipped in CI)
    if [ "$SKIP_LOAD_TESTS" != "true" ]; then
        if ! run_test_suite "load-testing" "npm run test:phase4:load"; then
            failed_suites+=("load-testing")
            exit_code=1
        fi
    else
        echo -e "${YELLOW}⏭️  Skipping load tests (SKIP_LOAD_TESTS=true)${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📋 Test Suite Summary${NC}"
    echo -e "${BLUE}===================${NC}"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}🎉 All test suites passed!${NC}"
    else
        echo -e "${RED}❌ Some test suites failed:${NC}"
        for suite in "${failed_suites[@]}"; do
            echo -e "${RED}  - $suite${NC}"
        done
    fi
    
    # Generate comprehensive report
    generate_report
    
    echo ""
    echo -e "${BLUE}📁 Test artifacts saved to: $REPORTS_DIR${NC}"
    echo -e "${BLUE}🕐 Test execution completed at: $(date)${NC}"
    
    exit $exit_code
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-load-tests)
            export SKIP_LOAD_TESTS=true
            shift
            ;;
        --verbose)
            set -x
            shift
            ;;
        --help)
            echo "Phase 4 Integration Test Runner"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-load-tests    Skip load testing suite"
            echo "  --verbose           Enable verbose output"
            echo "  --help              Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  TEST_SUPABASE_URL              Test Supabase URL"
            echo "  TEST_SUPABASE_ANON_KEY         Test Supabase anonymous key"
            echo "  TEST_SUPABASE_SERVICE_ROLE_KEY Test Supabase service role key"
            echo "  TEST_GEMINI_API_KEY            Test Gemini API key"
            echo "  TEST_OPENROUTER_API_KEY        Test OpenRouter API key"
            echo "  SKIP_LOAD_TESTS               Skip load tests (true/false)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main
