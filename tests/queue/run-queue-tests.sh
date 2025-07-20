#!/bin/bash

# Queue System Test Runner
# Comprehensive test suite for the embedding queue system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$TEST_DIR/../.." && pwd)"
RESULTS_DIR="$TEST_DIR/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}🧪 Queue System Test Suite${NC}"
echo -e "${BLUE}============================${NC}"
echo "Test Directory: $TEST_DIR"
echo "Project Root: $PROJECT_ROOT"
echo "Results Directory: $RESULTS_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Function to run tests and capture results
run_test_suite() {
    local test_type="$1"
    local test_command="$2"
    local description="$3"
    
    echo -e "${YELLOW}📋 Running $description...${NC}"
    echo "Command: $test_command"
    echo ""
    
    local log_file="$RESULTS_DIR/${test_type}_${TIMESTAMP}.log"
    local start_time=$(date +%s)
    
    if eval "$test_command" 2>&1 | tee "$log_file"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo -e "${GREEN}✅ $description completed successfully (${duration}s)${NC}"
        echo "$test_type:PASS:${duration}s" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo -e "${RED}❌ $description failed (${duration}s)${NC}"
        echo "$test_type:FAIL:${duration}s" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
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
    if ! npm list vitest &> /dev/null && ! npm list -g vitest &> /dev/null; then
        echo -e "${YELLOW}⚠️  Vitest not found, installing...${NC}"
        cd "$PROJECT_ROOT"
        npm install --save-dev vitest
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
    echo ""
}

# Function to setup test environment
setup_test_environment() {
    echo -e "${YELLOW}🛠️  Setting up test environment...${NC}"
    
    # Set test environment variables
    export NODE_ENV=test
    export VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-"http://127.0.0.1:54331"}
    export VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-"test-key"}
    
    # Create test database if needed (mock for now)
    echo "Environment variables set:"
    echo "  NODE_ENV=$NODE_ENV"
    echo "  VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
    echo "  VITE_SUPABASE_ANON_KEY=***"
    
    echo -e "${GREEN}✅ Test environment setup completed${NC}"
    echo ""
}

# Function to run database migration tests
run_migration_tests() {
    echo -e "${YELLOW}🗄️  Testing database migrations...${NC}"
    
    # Test migration files exist
    local migration_dir="$PROJECT_ROOT/supabase/migrations"
    local required_migrations=(
        "20250719000000_create_embedding_queue_system.sql"
        "20250719000001_enhance_embedding_queue_phase2.sql"
        "20250719000002_implement_queue_management_functions.sql"
    )
    
    for migration in "${required_migrations[@]}"; do
        if [[ -f "$migration_dir/$migration" ]]; then
            echo -e "${GREEN}✅ Migration found: $migration${NC}"
        else
            echo -e "${RED}❌ Migration missing: $migration${NC}"
            return 1
        fi
    done
    
    echo -e "${GREEN}✅ All required migrations found${NC}"
    return 0
}

# Main test execution
main() {
    local exit_code=0
    local total_tests=0
    local passed_tests=0
    
    # Initialize summary file
    echo "Queue System Test Results - $TIMESTAMP" > "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo "========================================" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    
    # Check prerequisites
    check_prerequisites
    
    # Setup test environment
    setup_test_environment
    
    # Test 1: Database Migrations
    echo -e "${BLUE}📊 Test 1: Database Migrations${NC}"
    if run_test_suite "migrations" "run_migration_tests" "Database Migration Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""
    
    # Test 2: Unit Tests for Queue Functions
    echo -e "${BLUE}📊 Test 2: Queue Function Unit Tests${NC}"
    cd "$PROJECT_ROOT"
    if run_test_suite "unit_functions" "npx vitest run tests/queue/unit/queue-functions.test.ts --reporter=verbose" "Queue Function Unit Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""

    # Test 3: Unit Tests for Admin Interface
    echo -e "${BLUE}📊 Test 3: Admin Interface Unit Tests${NC}"
    if run_test_suite "unit_interface" "npx vitest run tests/queue/unit/queue-admin-interface.test.tsx --reporter=verbose" "Admin Interface Unit Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""

    # Test 4: Real-time Functionality Tests
    echo -e "${BLUE}📊 Test 4: Real-time Functionality Tests${NC}"
    if run_test_suite "unit_realtime" "npx vitest run tests/queue/unit/real-time-functionality.test.ts tests/queue/unit/websocket-connections.test.ts tests/queue/unit/live-metrics-streaming.test.ts --reporter=verbose" "Real-time Functionality Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""

    # Test 5: Error Handling Tests
    echo -e "${BLUE}📊 Test 5: Error Handling Tests${NC}"
    if run_test_suite "unit_errors" "npx vitest run tests/queue/unit/error-handling.test.ts tests/queue/unit/retry-mechanisms.test.ts tests/queue/unit/error-monitoring.test.ts --reporter=verbose" "Error Handling Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""

    # Test 6: Security Tests
    echo -e "${BLUE}📊 Test 6: Security Tests${NC}"
    if run_test_suite "unit_security" "npx vitest run tests/queue/unit/security-access-controls.test.ts tests/queue/unit/security-data-protection.test.ts tests/queue/unit/security-api-validation.test.ts --reporter=verbose" "Security Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""

    # Test 7: Enhanced Component Tests
    echo -e "${BLUE}📊 Test 7: Enhanced Component Tests${NC}"
    if run_test_suite "unit_components" "npx vitest run tests/queue/unit/useQueueMetrics-hook.test.ts tests/queue/unit/queue-service-functions.test.ts tests/queue/unit/EmbeddingQueueMetrics-component.test.tsx --reporter=verbose" "Enhanced Component Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""
    
    # Test 8: Integration Tests for Worker Processing
    echo -e "${BLUE}📊 Test 8: Worker Processing Integration Tests${NC}"
    if run_test_suite "integration_worker" "npx vitest run tests/queue/integration/worker-processing.test.ts --reporter=verbose" "Worker Processing Integration Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""

    # Test 9: Performance and Load Tests
    echo -e "${BLUE}📊 Test 9: Performance and Load Tests${NC}"
    if run_test_suite "performance" "node tests/queue/performance/queue-load-test.js" "Performance and Load Tests"; then
        ((passed_tests++))
    fi
    ((total_tests++))
    echo ""
    
    # Generate final report
    echo -e "${BLUE}📈 Test Summary${NC}"
    echo "=============="
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $((total_tests - passed_tests))"
    echo "Success Rate: $(( (passed_tests * 100) / total_tests ))%"
    echo ""
    
    # Add summary to results file
    echo "" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo "FINAL SUMMARY:" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo "Total Tests: $total_tests" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo "Passed: $passed_tests" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo "Failed: $((total_tests - passed_tests))" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    echo "Success Rate: $(( (passed_tests * 100) / total_tests ))%" >> "$RESULTS_DIR/summary_${TIMESTAMP}.txt"
    
    if [[ $passed_tests -eq $total_tests ]]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit_code=0
    else
        echo -e "${RED}⚠️  Some tests failed. Check logs in $RESULTS_DIR${NC}"
        exit_code=1
    fi
    
    echo ""
    echo "Detailed results saved to: $RESULTS_DIR"
    echo "Summary file: $RESULTS_DIR/summary_${TIMESTAMP}.txt"
    
    return $exit_code
}

# Handle command line arguments
case "${1:-all}" in
    "unit")
        echo "Running unit tests only..."
        cd "$PROJECT_ROOT"
        npx vitest run tests/queue/unit/ --reporter=verbose
        ;;
    "integration")
        echo "Running integration tests only..."
        cd "$PROJECT_ROOT"
        npx vitest run tests/queue/integration/ --reporter=verbose
        ;;
    "performance")
        echo "Running performance tests only..."
        node tests/queue/performance/queue-load-test.js
        ;;
    "migrations")
        echo "Running migration tests only..."
        run_migration_tests
        ;;
    "all"|*)
        echo "Running all queue system tests..."
        main
        exit $?
        ;;
esac
