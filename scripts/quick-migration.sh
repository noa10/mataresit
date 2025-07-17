#!/bin/bash

# Quick Migration Script for Receipt Embeddings
# Provides a simple interface for common migration tasks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DENO_PERMISSIONS="--allow-env --allow-net --allow-read"

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
    
    # Check if scripts exist
    local scripts=(
        "analyze-embedding-migration-needs.ts"
        "migrate-receipt-embeddings.ts"
        "monitor-migration-progress.ts"
    )
    
    for script in "${scripts[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
            print_error "Script not found: $script"
            exit 1
        fi
    done
    print_success "All migration scripts are available"
}

# Run analysis
run_analysis() {
    print_header "Running Migration Analysis"
    print_info "Analyzing current embedding status..."
    
    deno run $DENO_PERMISSIONS "$SCRIPT_DIR/analyze-embedding-migration-needs.ts"
    
    echo ""
    print_info "Analysis complete. Review the output above to understand migration needs."
}

# Run dry run migration
run_dry_run() {
    local priority=${1:-"high"}
    
    print_header "Running Dry Run Migration"
    print_info "Testing migration for $priority priority receipts..."
    print_warning "This is a dry run - no actual changes will be made"
    
    deno run $DENO_PERMISSIONS "$SCRIPT_DIR/migrate-receipt-embeddings.ts" \
        --priority "$priority" \
        --batch-size 10 \
        --dry-run
    
    echo ""
    print_info "Dry run complete. Review the output above."
    print_info "If everything looks good, run the actual migration."
}

# Run actual migration
run_migration() {
    local priority=${1:-"all"}
    local batch_size=${2:-25}
    
    print_header "Running Actual Migration"
    print_warning "This will make actual changes to your database!"
    
    # Confirmation prompt
    echo -e "${YELLOW}Are you sure you want to proceed with the migration?${NC}"
    echo "Priority: $priority"
    echo "Batch size: $batch_size"
    echo ""
    read -p "Type 'yes' to continue: " confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        print_info "Migration cancelled by user"
        exit 0
    fi
    
    print_info "Starting migration for $priority priority receipts..."
    
    deno run $DENO_PERMISSIONS "$SCRIPT_DIR/migrate-receipt-embeddings.ts" \
        --priority "$priority" \
        --batch-size "$batch_size" \
        --max-retries 3 \
        --delay 1000
    
    echo ""
    print_success "Migration completed!"
}

# Monitor migration progress
monitor_progress() {
    print_header "Monitoring Migration Progress"
    print_info "Starting real-time monitoring..."
    print_info "Press Ctrl+C to exit monitoring"
    
    deno run $DENO_PERMISSIONS "$SCRIPT_DIR/monitor-migration-progress.ts"
}

# Generate report
generate_report() {
    print_header "Generating Migration Report"
    
    deno run $DENO_PERMISSIONS "$SCRIPT_DIR/monitor-migration-progress.ts" --report
}

# Show help
show_help() {
    echo "Quick Migration Script for Receipt Embeddings"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  check       Check prerequisites and environment"
    echo "  analyze     Analyze current embedding status"
    echo "  dry-run     Run migration dry run (no changes)"
    echo "  migrate     Run actual migration"
    echo "  monitor     Monitor migration progress in real-time"
    echo "  report      Generate one-time migration report"
    echo "  help        Show this help message"
    echo ""
    echo "Migration Commands:"
    echo "  dry-run [priority]           Test migration (priority: high, medium, low, all)"
    echo "  migrate [priority] [batch]   Run migration (priority: high, medium, low, all; batch: number)"
    echo ""
    echo "Examples:"
    echo "  $0 check                     # Check prerequisites"
    echo "  $0 analyze                   # Analyze migration needs"
    echo "  $0 dry-run high              # Test high-priority migration"
    echo "  $0 migrate high 10           # Migrate high-priority with batch size 10"
    echo "  $0 migrate all 50            # Migrate all receipts with batch size 50"
    echo "  $0 monitor                   # Monitor progress"
    echo "  $0 report                    # Generate report"
    echo ""
    echo "Environment Variables Required:"
    echo "  SUPABASE_URL                 # Your Supabase project URL"
    echo "  SUPABASE_SERVICE_KEY         # Your Supabase service key"
}

# Main script logic
main() {
    local command=${1:-"help"}
    
    case $command in
        "check")
            check_prerequisites
            print_success "All prerequisites met!"
            ;;
        "analyze")
            check_prerequisites
            run_analysis
            ;;
        "dry-run")
            check_prerequisites
            run_dry_run "${2:-high}"
            ;;
        "migrate")
            check_prerequisites
            run_migration "${2:-all}" "${3:-25}"
            ;;
        "monitor")
            check_prerequisites
            monitor_progress
            ;;
        "report")
            check_prerequisites
            generate_report
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
