#!/bin/bash

# Workflow Performance Monitor
# Analyzes GitHub Actions workflow performance and provides optimization recommendations

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
Workflow Performance Monitor

Analyzes GitHub Actions workflow performance and provides optimization recommendations.

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h              Show this help message
    --repo REPO             GitHub repository (owner/repo)
    --workflow WORKFLOW     Workflow file name (e.g., ci.yml)
    --days DAYS             Number of days to analyze (default: 7)
    --format FORMAT         Output format (table|json|csv) (default: table)
    --threshold SECONDS     Performance threshold in seconds (default: 600)
    --export FILE           Export results to file

EXAMPLES:
    $0 --repo owner/repo --workflow ci.yml
    $0 --repo owner/repo --days 30 --format json
    $0 --repo owner/repo --threshold 300 --export performance-report.json

REQUIRED TOOLS:
    - gh (GitHub CLI)
    - jq (JSON processor)

EOF
}

# Parse command line arguments
REPO=""
WORKFLOW=""
DAYS=7
FORMAT="table"
THRESHOLD=600
EXPORT_FILE=""

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
        --workflow)
            WORKFLOW="$2"
            shift 2
            ;;
        --days)
            DAYS="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --threshold)
            THRESHOLD="$2"
            shift 2
            ;;
        --export)
            EXPORT_FILE="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate prerequisites
validate_prerequisites() {
    local missing_tools=()
    
    if ! command -v gh &> /dev/null; then
        missing_tools+=("GitHub CLI (gh)")
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
}

# Get workflow runs data
get_workflow_data() {
    log "Fetching workflow data for $REPO..."
    
    local since_date=$(date -d "$DAYS days ago" -u +"%Y-%m-%dT%H:%M:%SZ")
    
    if [[ -n "$WORKFLOW" ]]; then
        gh api repos/"$REPO"/actions/workflows/"$WORKFLOW"/runs \
            --paginate \
            --jq ".workflow_runs[] | select(.created_at >= \"$since_date\")" \
            > workflow_runs.json
    else
        gh api repos/"$REPO"/actions/runs \
            --paginate \
            --jq ".workflow_runs[] | select(.created_at >= \"$since_date\")" \
            > workflow_runs.json
    fi
    
    if [[ ! -s workflow_runs.json ]]; then
        error "No workflow runs found for the specified criteria"
        exit 1
    fi
    
    success "Found $(jq length workflow_runs.json) workflow runs"
}

# Analyze performance metrics
analyze_performance() {
    log "Analyzing workflow performance..."
    
    # Calculate performance metrics
    jq -r '
    [.[] | select(.conclusion != null) | {
        id: .id,
        name: .name,
        status: .status,
        conclusion: .conclusion,
        created_at: .created_at,
        updated_at: .updated_at,
        duration: (((.updated_at | fromdateiso8601) - (.created_at | fromdateiso8601)) / 60),
        branch: .head_branch,
        event: .event,
        run_number: .run_number
    }] | 
    {
        total_runs: length,
        successful_runs: [.[] | select(.conclusion == "success")] | length,
        failed_runs: [.[] | select(.conclusion == "failure")] | length,
        cancelled_runs: [.[] | select(.conclusion == "cancelled")] | length,
        avg_duration: ([.[] | .duration] | add / length),
        min_duration: ([.[] | .duration] | min),
        max_duration: ([.[] | .duration] | max),
        success_rate: (([.[] | select(.conclusion == "success")] | length) / length * 100),
        runs: .
    }' workflow_runs.json > performance_analysis.json
    
    success "Performance analysis completed"
}

# Generate recommendations
generate_recommendations() {
    log "Generating optimization recommendations..."
    
    local avg_duration=$(jq -r '.avg_duration' performance_analysis.json)
    local success_rate=$(jq -r '.success_rate' performance_analysis.json)
    local max_duration=$(jq -r '.max_duration' performance_analysis.json)
    
    # Performance recommendations
    local recommendations=()
    
    if (( $(echo "$avg_duration > $(($THRESHOLD / 60))" | bc -l) )); then
        recommendations+=("⚠️ Average duration (${avg_duration}min) exceeds threshold ($(($THRESHOLD / 60))min)")
        recommendations+=("💡 Consider implementing job parallelization")
        recommendations+=("💡 Add dependency caching to reduce setup time")
        recommendations+=("💡 Optimize build processes and remove unnecessary steps")
    fi
    
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        recommendations+=("⚠️ Success rate (${success_rate}%) is below 95%")
        recommendations+=("💡 Add retry logic for flaky operations")
        recommendations+=("💡 Implement better error handling")
        recommendations+=("💡 Review and fix common failure patterns")
    fi
    
    if (( $(echo "$max_duration > $(($THRESHOLD * 2 / 60))" | bc -l) )); then
        recommendations+=("⚠️ Maximum duration (${max_duration}min) is very high")
        recommendations+=("💡 Add timeout limits to prevent runaway jobs")
        recommendations+=("💡 Investigate and optimize slow-running jobs")
    fi
    
    # Cache hit rate analysis (if available)
    local cache_misses=$(jq -r '[.runs[] | select(.name | contains("cache miss"))] | length' performance_analysis.json 2>/dev/null || echo "0")
    if [[ "$cache_misses" -gt 0 ]]; then
        recommendations+=("💡 Improve caching strategy - detected cache misses")
    fi
    
    # Save recommendations
    printf '%s\n' "${recommendations[@]}" > recommendations.txt
    
    success "Generated $(echo "${recommendations[@]}" | wc -w) recommendations"
}

# Format output
format_output() {
    case "$FORMAT" in
        "table")
            format_table_output
            ;;
        "json")
            format_json_output
            ;;
        "csv")
            format_csv_output
            ;;
        *)
            error "Invalid format: $FORMAT"
            exit 1
            ;;
    esac
}

# Format table output
format_table_output() {
    log "📊 Workflow Performance Report"
    log "=============================="
    
    echo
    log "📈 Summary Statistics"
    printf "%-20s %s\n" "Repository:" "$REPO"
    printf "%-20s %s\n" "Workflow:" "${WORKFLOW:-All workflows}"
    printf "%-20s %s days\n" "Analysis Period:" "$DAYS"
    printf "%-20s %s\n" "Total Runs:" "$(jq -r '.total_runs' performance_analysis.json)"
    printf "%-20s %s\n" "Successful Runs:" "$(jq -r '.successful_runs' performance_analysis.json)"
    printf "%-20s %s\n" "Failed Runs:" "$(jq -r '.failed_runs' performance_analysis.json)"
    printf "%-20s %.1f%%\n" "Success Rate:" "$(jq -r '.success_rate' performance_analysis.json)"
    
    echo
    log "⏱️ Performance Metrics"
    printf "%-20s %.1f minutes\n" "Average Duration:" "$(jq -r '.avg_duration' performance_analysis.json)"
    printf "%-20s %.1f minutes\n" "Minimum Duration:" "$(jq -r '.min_duration' performance_analysis.json)"
    printf "%-20s %.1f minutes\n" "Maximum Duration:" "$(jq -r '.max_duration' performance_analysis.json)"
    printf "%-20s %d seconds\n" "Threshold:" "$THRESHOLD"
    
    echo
    log "💡 Optimization Recommendations"
    if [[ -f recommendations.txt ]] && [[ -s recommendations.txt ]]; then
        cat recommendations.txt
    else
        success "No specific recommendations - performance looks good!"
    fi
    
    echo
    log "🔍 Recent Workflow Runs"
    echo "Run #    | Status    | Duration | Branch      | Event"
    echo "---------|-----------|----------|-------------|----------"
    jq -r '.runs[:10] | .[] | "\(.run_number | tostring | .[0:8]) | \(.conclusion | .[0:9]) | \(.duration | tostring | .[0:8])min | \(.branch | .[0:11]) | \(.event)"' performance_analysis.json
}

# Format JSON output
format_json_output() {
    jq '{
        repository: "'$REPO'",
        workflow: "'${WORKFLOW:-All workflows}'",
        analysis_period_days: '$DAYS',
        threshold_seconds: '$THRESHOLD',
        generated_at: now | strftime("%Y-%m-%dT%H:%M:%SZ"),
        performance_metrics: {
            total_runs: .total_runs,
            successful_runs: .successful_runs,
            failed_runs: .failed_runs,
            cancelled_runs: .cancelled_runs,
            success_rate: .success_rate,
            avg_duration_minutes: .avg_duration,
            min_duration_minutes: .min_duration,
            max_duration_minutes: .max_duration
        },
        recommendations: [
            if .avg_duration > ('$THRESHOLD' / 60) then "Average duration exceeds threshold" else empty end,
            if .success_rate < 95 then "Success rate below 95%" else empty end,
            if .max_duration > ('$THRESHOLD' * 2 / 60) then "Maximum duration very high" else empty end
        ],
        recent_runs: .runs[:10]
    }' performance_analysis.json
}

# Format CSV output
format_csv_output() {
    echo "run_number,status,conclusion,duration_minutes,branch,event,created_at"
    jq -r '.runs[] | [.run_number, .status, .conclusion, .duration, .branch, .event, .created_at] | @csv' performance_analysis.json
}

# Export results
export_results() {
    if [[ -n "$EXPORT_FILE" ]]; then
        log "Exporting results to $EXPORT_FILE..."
        
        case "$FORMAT" in
            "json")
                format_json_output > "$EXPORT_FILE"
                ;;
            "csv")
                format_csv_output > "$EXPORT_FILE"
                ;;
            *)
                error "Export only supported for JSON and CSV formats"
                exit 1
                ;;
        esac
        
        success "Results exported to $EXPORT_FILE"
    fi
}

# Cleanup temporary files
cleanup() {
    rm -f workflow_runs.json performance_analysis.json recommendations.txt
}

# Main execution
main() {
    log "Workflow Performance Monitor"
    log "============================"
    
    # Validate prerequisites
    validate_prerequisites
    
    # Validate required parameters
    if [[ -z "$REPO" ]]; then
        error "Repository is required (use --repo owner/repo)"
        exit 1
    fi
    
    # Get workflow data
    get_workflow_data
    
    # Analyze performance
    analyze_performance
    
    # Generate recommendations
    generate_recommendations
    
    # Format and display output
    format_output
    
    # Export results if requested
    export_results
    
    # Cleanup
    cleanup
    
    success "Performance analysis completed"
}

# Trap cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"
