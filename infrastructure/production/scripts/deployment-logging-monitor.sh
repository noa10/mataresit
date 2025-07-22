#!/bin/bash

# Comprehensive Deployment Logging and Monitoring System for Paperless Maverick
# Provides deployment metrics, error tracking, performance monitoring, and audit trails
# Version: 1.0.0

set -euo pipefail

# ============================================================================
# CONFIGURATION AND CONSTANTS
# ============================================================================

# Script metadata
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Logging and monitoring configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly CONFIG_DIR="$INFRASTRUCTURE_DIR/config"
readonly MONITORING_CONFIG="$CONFIG_DIR/deployment-monitoring-config.yaml"

# Log directories and files
readonly LOG_DIR="$PROJECT_ROOT/logs/deployment"
readonly METRICS_DIR="$PROJECT_ROOT/metrics/deployment"
readonly AUDIT_DIR="$PROJECT_ROOT/audit/deployment"

readonly DEPLOYMENT_LOG="$LOG_DIR/deployment-monitor-$(date +%Y%m%d-%H%M%S).log"
readonly METRICS_LOG="$METRICS_DIR/deployment-metrics-$(date +%Y%m%d-%H%M%S).json"
readonly AUDIT_LOG="$AUDIT_DIR/deployment-audit-$(date +%Y%m%d-%H%M%S).log"
readonly ERROR_LOG="$LOG_DIR/deployment-errors-$(date +%Y%m%d-%H%M%S).log"

# Default values
readonly DEFAULT_ENVIRONMENT="production"
readonly DEFAULT_NAMESPACE="paperless-maverick"
readonly MONITORING_INTERVAL=30  # seconds
readonly METRICS_RETENTION_DAYS=30
readonly LOG_RETENTION_DAYS=90

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# ============================================================================
# GLOBAL VARIABLES
# ============================================================================

# Command line options
ENVIRONMENT="$DEFAULT_ENVIRONMENT"
NAMESPACE="$DEFAULT_NAMESPACE"
MONITORING_MODE="continuous"
METRICS_EXPORT=true
AUDIT_ENABLED=true
VERBOSE=false
DRY_RUN=false

# Monitoring state
MONITORING_SESSION_ID=""
MONITORING_START_TIME=""
DEPLOYMENT_METRICS=()
ERROR_EVENTS=()
AUDIT_EVENTS=()

# Prometheus integration
PROMETHEUS_PUSHGATEWAY_URL="http://prometheus-pushgateway:9091"
PROMETHEUS_JOB_NAME="deployment-monitoring"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Initialize logging and directories
init_monitoring() {
    mkdir -p "$LOG_DIR" "$METRICS_DIR" "$AUDIT_DIR"
    touch "$DEPLOYMENT_LOG" "$METRICS_LOG" "$AUDIT_LOG" "$ERROR_LOG"
    
    # Generate unique monitoring session ID
    MONITORING_SESSION_ID="monitor-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    MONITORING_START_TIME=$(date +%s)
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$DEPLOYMENT_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$DEPLOYMENT_LOG"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$DEPLOYMENT_LOG"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$DEPLOYMENT_LOG" | tee -a "$ERROR_LOG"
            record_error_event "$message"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[$timestamp] 🔍${NC} $message" | tee -a "$DEPLOYMENT_LOG"
            fi
            ;;
        "AUDIT")
            echo "[$timestamp] $message" >> "$AUDIT_LOG"
            record_audit_event "$message"
            ;;
    esac
}

# Record error event
record_error_event() {
    local error_message="$1"
    local error_event="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"session_id\":\"$MONITORING_SESSION_ID\",\"error\":\"$error_message\",\"environment\":\"$ENVIRONMENT\",\"namespace\":\"$NAMESPACE\"}"
    ERROR_EVENTS+=("$error_event")
}

# Record audit event
record_audit_event() {
    local audit_message="$1"
    local audit_event="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"session_id\":\"$MONITORING_SESSION_ID\",\"event\":\"$audit_message\",\"user\":\"${USER:-unknown}\",\"environment\":\"$ENVIRONMENT\",\"namespace\":\"$NAMESPACE\"}"
    AUDIT_EVENTS+=("$audit_event")
}

# ============================================================================
# METRICS COLLECTION FUNCTIONS
# ============================================================================

# Collect deployment metrics
collect_deployment_metrics() {
    log "DEBUG" "Collecting deployment metrics..."
    
    local metrics_timestamp=$(date +%s)
    local metrics_data=""
    
    # Collect Kubernetes deployment metrics
    local deployment_metrics
    deployment_metrics=$(collect_kubernetes_metrics)
    
    # Collect application health metrics
    local health_metrics
    health_metrics=$(collect_health_metrics)
    
    # Collect performance metrics
    local performance_metrics
    performance_metrics=$(collect_performance_metrics)
    
    # Collect resource utilization metrics
    local resource_metrics
    resource_metrics=$(collect_resource_metrics)
    
    # Combine all metrics
    metrics_data="{\"timestamp\":$metrics_timestamp,\"session_id\":\"$MONITORING_SESSION_ID\",\"environment\":\"$ENVIRONMENT\",\"namespace\":\"$NAMESPACE\",\"kubernetes\":$deployment_metrics,\"health\":$health_metrics,\"performance\":$performance_metrics,\"resources\":$resource_metrics}"
    
    # Store metrics
    DEPLOYMENT_METRICS+=("$metrics_data")
    
    # Export to Prometheus if enabled
    if [[ "$METRICS_EXPORT" == "true" ]]; then
        export_metrics_to_prometheus "$metrics_data"
    fi
    
    log "DEBUG" "Deployment metrics collected successfully"
}

# Collect Kubernetes deployment metrics
collect_kubernetes_metrics() {
    local deployments_ready=0
    local deployments_total=0
    local pods_ready=0
    local pods_total=0
    local services_available=0
    local services_total=0
    
    # Get deployment status
    if kubectl get deployments -n "$NAMESPACE" &> /dev/null; then
        local deployment_info
        deployment_info=$(kubectl get deployments -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
        
        deployments_total=$(echo "$deployment_info" | jq '.items | length')
        deployments_ready=$(echo "$deployment_info" | jq '[.items[] | select(.status.readyReplicas == .status.replicas)] | length')
    fi
    
    # Get pod status
    if kubectl get pods -n "$NAMESPACE" &> /dev/null; then
        local pod_info
        pod_info=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
        
        pods_total=$(echo "$pod_info" | jq '.items | length')
        pods_ready=$(echo "$pod_info" | jq '[.items[] | select(.status.phase == "Running")] | length')
    fi
    
    # Get service status
    if kubectl get services -n "$NAMESPACE" &> /dev/null; then
        local service_info
        service_info=$(kubectl get services -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
        
        services_total=$(echo "$service_info" | jq '.items | length')
        services_available=$services_total  # Simplified - services are generally available if they exist
    fi
    
    echo "{\"deployments_ready\":$deployments_ready,\"deployments_total\":$deployments_total,\"pods_ready\":$pods_ready,\"pods_total\":$pods_total,\"services_available\":$services_available,\"services_total\":$services_total}"
}

# Collect application health metrics
collect_health_metrics() {
    local health_score=0
    local endpoints_healthy=0
    local endpoints_total=0
    local response_time_avg=0
    
    # Get application pods
    local app_pods
    app_pods=$(kubectl get pods -n "$NAMESPACE" -l app=paperless-maverick -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$app_pods" ]]; then
        local healthy_endpoints=0
        local total_endpoints=0
        local total_response_time=0
        
        for pod in $app_pods; do
            # Test health endpoint
            ((total_endpoints++))
            local start_time=$(date +%s%3N)
            if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/health &> /dev/null; then
                ((healthy_endpoints++))
                local end_time=$(date +%s%3N)
                local response_time=$((end_time - start_time))
                total_response_time=$((total_response_time + response_time))
            fi
            
            # Test readiness endpoint
            ((total_endpoints++))
            if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s http://localhost:3000/ready &> /dev/null; then
                ((healthy_endpoints++))
            fi
        done
        
        endpoints_healthy=$healthy_endpoints
        endpoints_total=$total_endpoints
        
        if [[ $total_endpoints -gt 0 ]]; then
            health_score=$((healthy_endpoints * 100 / total_endpoints))
        fi
        
        if [[ $healthy_endpoints -gt 0 ]]; then
            response_time_avg=$((total_response_time / healthy_endpoints))
        fi
    fi
    
    echo "{\"health_score\":$health_score,\"endpoints_healthy\":$endpoints_healthy,\"endpoints_total\":$endpoints_total,\"response_time_avg\":$response_time_avg}"
}

# Collect performance metrics
collect_performance_metrics() {
    local cpu_usage=0
    local memory_usage=0
    local disk_usage=0
    local network_io=0
    
    # Get resource usage from kubectl top
    if kubectl top pods -n "$NAMESPACE" &> /dev/null; then
        local resource_usage
        resource_usage=$(kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null || echo "")
        
        if [[ -n "$resource_usage" ]]; then
            # Calculate average CPU usage (in millicores)
            local total_cpu=0
            local pod_count=0
            
            while IFS= read -r line; do
                if [[ -n "$line" ]]; then
                    local cpu=$(echo "$line" | awk '{print $2}' | sed 's/m//')
                    total_cpu=$((total_cpu + cpu))
                    ((pod_count++))
                fi
            done <<< "$resource_usage"
            
            if [[ $pod_count -gt 0 ]]; then
                cpu_usage=$((total_cpu / pod_count))
            fi
            
            # Calculate average memory usage (in MB)
            local total_memory=0
            pod_count=0
            
            while IFS= read -r line; do
                if [[ -n "$line" ]]; then
                    local memory=$(echo "$line" | awk '{print $3}' | sed 's/Mi//')
                    total_memory=$((total_memory + memory))
                    ((pod_count++))
                fi
            done <<< "$resource_usage"
            
            if [[ $pod_count -gt 0 ]]; then
                memory_usage=$((total_memory / pod_count))
            fi
        fi
    fi
    
    echo "{\"cpu_usage\":$cpu_usage,\"memory_usage\":$memory_usage,\"disk_usage\":$disk_usage,\"network_io\":$network_io}"
}

# Collect resource utilization metrics
collect_resource_metrics() {
    local node_count=0
    local node_ready=0
    local cluster_cpu_usage=0
    local cluster_memory_usage=0
    
    # Get node information
    if kubectl get nodes &> /dev/null; then
        local node_info
        node_info=$(kubectl get nodes -o json 2>/dev/null || echo '{"items":[]}')
        
        node_count=$(echo "$node_info" | jq '.items | length')
        node_ready=$(echo "$node_info" | jq '[.items[] | select(.status.conditions[] | select(.type == "Ready" and .status == "True"))] | length')
    fi
    
    # Get cluster resource usage
    if kubectl top nodes &> /dev/null; then
        local node_usage
        node_usage=$(kubectl top nodes --no-headers 2>/dev/null || echo "")
        
        if [[ -n "$node_usage" ]]; then
            # Calculate cluster CPU usage percentage
            local total_cpu_percent=0
            local node_count_usage=0
            
            while IFS= read -r line; do
                if [[ -n "$line" ]]; then
                    local cpu_percent=$(echo "$line" | awk '{print $3}' | sed 's/%//')
                    total_cpu_percent=$((total_cpu_percent + cpu_percent))
                    ((node_count_usage++))
                fi
            done <<< "$node_usage"
            
            if [[ $node_count_usage -gt 0 ]]; then
                cluster_cpu_usage=$((total_cpu_percent / node_count_usage))
            fi
            
            # Calculate cluster memory usage percentage
            local total_memory_percent=0
            node_count_usage=0
            
            while IFS= read -r line; do
                if [[ -n "$line" ]]; then
                    local memory_percent=$(echo "$line" | awk '{print $5}' | sed 's/%//')
                    total_memory_percent=$((total_memory_percent + memory_percent))
                    ((node_count_usage++))
                fi
            done <<< "$node_usage"
            
            if [[ $node_count_usage -gt 0 ]]; then
                cluster_memory_usage=$((total_memory_percent / node_count_usage))
            fi
        fi
    fi
    
    echo "{\"node_count\":$node_count,\"node_ready\":$node_ready,\"cluster_cpu_usage\":$cluster_cpu_usage,\"cluster_memory_usage\":$cluster_memory_usage}"
}

# ============================================================================
# PROMETHEUS INTEGRATION FUNCTIONS
# ============================================================================

# Export metrics to Prometheus Push Gateway
export_metrics_to_prometheus() {
    local metrics_data="$1"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would export metrics to Prometheus"
        return 0
    fi

    log "DEBUG" "Exporting metrics to Prometheus Push Gateway..."

    # Parse metrics data
    local timestamp=$(echo "$metrics_data" | jq -r '.timestamp')
    local kubernetes_metrics=$(echo "$metrics_data" | jq -r '.kubernetes')
    local health_metrics=$(echo "$metrics_data" | jq -r '.health')
    local performance_metrics=$(echo "$metrics_data" | jq -r '.performance')
    local resource_metrics=$(echo "$metrics_data" | jq -r '.resources')

    # Create Prometheus metrics format
    local prometheus_metrics=""

    # Kubernetes metrics
    prometheus_metrics+="deployment_ready_count{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$kubernetes_metrics" | jq -r '.deployments_ready')\n"
    prometheus_metrics+="deployment_total_count{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$kubernetes_metrics" | jq -r '.deployments_total')\n"
    prometheus_metrics+="pod_ready_count{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$kubernetes_metrics" | jq -r '.pods_ready')\n"
    prometheus_metrics+="pod_total_count{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$kubernetes_metrics" | jq -r '.pods_total')\n"

    # Health metrics
    prometheus_metrics+="deployment_health_score{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$health_metrics" | jq -r '.health_score')\n"
    prometheus_metrics+="deployment_endpoints_healthy{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$health_metrics" | jq -r '.endpoints_healthy')\n"
    prometheus_metrics+="deployment_response_time_avg{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$health_metrics" | jq -r '.response_time_avg')\n"

    # Performance metrics
    prometheus_metrics+="deployment_cpu_usage{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$performance_metrics" | jq -r '.cpu_usage')\n"
    prometheus_metrics+="deployment_memory_usage{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $(echo "$performance_metrics" | jq -r '.memory_usage')\n"

    # Resource metrics
    prometheus_metrics+="cluster_node_ready{environment=\"$ENVIRONMENT\"} $(echo "$resource_metrics" | jq -r '.node_ready')\n"
    prometheus_metrics+="cluster_cpu_usage{environment=\"$ENVIRONMENT\"} $(echo "$resource_metrics" | jq -r '.cluster_cpu_usage')\n"
    prometheus_metrics+="cluster_memory_usage{environment=\"$ENVIRONMENT\"} $(echo "$resource_metrics" | jq -r '.cluster_memory_usage')\n"

    # Push metrics to Prometheus Push Gateway
    if curl -s --data-binary "$prometheus_metrics" "$PROMETHEUS_PUSHGATEWAY_URL/metrics/job/$PROMETHEUS_JOB_NAME/instance/$MONITORING_SESSION_ID" &> /dev/null; then
        log "DEBUG" "Metrics exported to Prometheus successfully"
    else
        log "WARNING" "Failed to export metrics to Prometheus Push Gateway"
    fi
}

# Create custom Prometheus recording rules
create_prometheus_recording_rules() {
    log "INFO" "Creating Prometheus recording rules for deployment monitoring..."

    local rules_file="$INFRASTRUCTURE_DIR/monitoring/prometheus/rules/deployment-monitoring-rules.yml"

    cat > "$rules_file" << 'EOF'
groups:
  - name: deployment_monitoring
    interval: 30s
    rules:
      # Deployment health recording rules
      - record: deployment:health_score:avg
        expr: avg(deployment_health_score) by (environment, namespace)

      - record: deployment:availability:ratio
        expr: deployment_ready_count / deployment_total_count

      - record: deployment:pod_availability:ratio
        expr: pod_ready_count / pod_total_count

      # Performance recording rules
      - record: deployment:response_time:p95
        expr: histogram_quantile(0.95, rate(deployment_response_time_avg[5m]))

      - record: deployment:cpu_utilization:avg
        expr: avg(deployment_cpu_usage) by (environment, namespace)

      - record: deployment:memory_utilization:avg
        expr: avg(deployment_memory_usage) by (environment, namespace)

      # Cluster health recording rules
      - record: cluster:node_availability:ratio
        expr: cluster_node_ready / cluster_node_count

      - record: cluster:resource_utilization:avg
        expr: (cluster_cpu_usage + cluster_memory_usage) / 2

      # Deployment frequency and success rate
      - record: deployment:frequency:rate
        expr: rate(deployment_total_count[1h])

      - record: deployment:success_rate:ratio
        expr: rate(deployment_ready_count[1h]) / rate(deployment_total_count[1h])

  - name: deployment_alerts
    rules:
      # Critical deployment alerts
      - alert: DeploymentDown
        expr: deployment:availability:ratio < 0.5
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Deployment availability is critically low"
          description: "Deployment availability is {{ $value | humanizePercentage }} in {{ $labels.environment }}/{{ $labels.namespace }}"

      - alert: DeploymentHealthDegraded
        expr: deployment:health_score:avg < 70
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Deployment health score is degraded"
          description: "Deployment health score is {{ $value }} in {{ $labels.environment }}/{{ $labels.namespace }}"

      - alert: DeploymentHighResponseTime
        expr: deployment:response_time:p95 > 5000
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Deployment response time is high"
          description: "P95 response time is {{ $value }}ms in {{ $labels.environment }}/{{ $labels.namespace }}"

      - alert: DeploymentHighResourceUsage
        expr: deployment:cpu_utilization:avg > 80 or deployment:memory_utilization:avg > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Deployment resource usage is high"
          description: "Resource usage is high in {{ $labels.environment }}/{{ $labels.namespace }}"

      - alert: ClusterNodeDown
        expr: cluster:node_availability:ratio < 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Cluster node is down"
          description: "Node availability is {{ $value | humanizePercentage }} in {{ $labels.environment }}"
EOF

    log "SUCCESS" "Prometheus recording rules created: $rules_file"
}

# ============================================================================
# MONITORING ORCHESTRATION FUNCTIONS
# ============================================================================

# Start continuous monitoring
start_continuous_monitoring() {
    log "INFO" "Starting continuous deployment monitoring..."
    log "INFO" "Monitoring session ID: $MONITORING_SESSION_ID"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Monitoring interval: ${MONITORING_INTERVAL}s"
    log "INFO" "=================================================="

    # Create Prometheus recording rules
    create_prometheus_recording_rules

    # Start monitoring loop
    local iteration=0
    while true; do
        ((iteration++))

        log "DEBUG" "Monitoring iteration $iteration"

        # Collect metrics
        collect_deployment_metrics

        # Check for deployment events
        check_deployment_events

        # Generate periodic reports
        if [[ $((iteration % 10)) -eq 0 ]]; then
            generate_monitoring_report
        fi

        # Clean up old logs and metrics
        if [[ $((iteration % 100)) -eq 0 ]]; then
            cleanup_old_data
        fi

        # Sleep until next iteration
        sleep "$MONITORING_INTERVAL"
    done
}

# Check for deployment events
check_deployment_events() {
    log "DEBUG" "Checking for deployment events..."

    # Check for recent deployments
    local recent_deployments
    recent_deployments=$(kubectl get events -n "$NAMESPACE" --field-selector type=Normal,reason=ScalingReplicaSet --sort-by='.lastTimestamp' -o json 2>/dev/null || echo '{"items":[]}')

    local deployment_count
    deployment_count=$(echo "$recent_deployments" | jq '.items | length')

    if [[ $deployment_count -gt 0 ]]; then
        log "INFO" "Detected $deployment_count recent deployment events"

        # Log deployment events
        echo "$recent_deployments" | jq -r '.items[] | "DEPLOYMENT_EVENT: " + .involvedObject.name + " - " + .message' | while read -r event; do
            log "AUDIT" "$event"
        done
    fi

    # Check for error events
    local error_events
    error_events=$(kubectl get events -n "$NAMESPACE" --field-selector type=Warning --sort-by='.lastTimestamp' -o json 2>/dev/null || echo '{"items":[]}')

    local error_count
    error_count=$(echo "$error_events" | jq '.items | length')

    if [[ $error_count -gt 0 ]]; then
        log "WARNING" "Detected $error_count error events"

        # Log error events
        echo "$error_events" | jq -r '.items[] | "ERROR_EVENT: " + .involvedObject.name + " - " + .message' | while read -r event; do
            log "ERROR" "$event"
        done
    fi
}

# Generate monitoring report
generate_monitoring_report() {
    log "INFO" "Generating monitoring report..."

    local report_file="$METRICS_DIR/monitoring-report-$(date +%Y%m%d-%H%M%S).json"
    local current_time=$(date +%s)
    local monitoring_duration=$((current_time - MONITORING_START_TIME))

    # Calculate summary statistics
    local total_metrics=${#DEPLOYMENT_METRICS[@]}
    local total_errors=${#ERROR_EVENTS[@]}
    local total_audits=${#AUDIT_EVENTS[@]}

    # Get latest metrics
    local latest_metrics=""
    if [[ ${#DEPLOYMENT_METRICS[@]} -gt 0 ]]; then
        latest_metrics="${DEPLOYMENT_METRICS[-1]}"
    else
        latest_metrics="{}"
    fi

    # Create report
    cat > "$report_file" << EOF
{
  "report_metadata": {
    "session_id": "$MONITORING_SESSION_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "monitoring_duration": $monitoring_duration,
    "total_metrics_collected": $total_metrics,
    "total_errors": $total_errors,
    "total_audit_events": $total_audits
  },
  "latest_metrics": $latest_metrics,
  "error_summary": [
$(printf '%s\n' "${ERROR_EVENTS[@]}" | tail -10 | sed 's/$/,/' | sed '$s/,$//')
  ],
  "audit_summary": [
$(printf '%s\n' "${AUDIT_EVENTS[@]}" | tail -10 | sed 's/$/,/' | sed '$s/,$//')
  ]
}
EOF

    log "SUCCESS" "Monitoring report generated: $report_file"

    # Export report metrics to Prometheus
    if [[ "$METRICS_EXPORT" == "true" ]]; then
        local report_metrics=""
        report_metrics+="deployment_monitoring_duration{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $monitoring_duration\n"
        report_metrics+="deployment_metrics_collected{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $total_metrics\n"
        report_metrics+="deployment_errors_total{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $total_errors\n"
        report_metrics+="deployment_audit_events_total{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\"} $total_audits\n"

        curl -s --data-binary "$report_metrics" "$PROMETHEUS_PUSHGATEWAY_URL/metrics/job/$PROMETHEUS_JOB_NAME-report/instance/$MONITORING_SESSION_ID" &> /dev/null || true
    fi
}

# ============================================================================
# AUDIT AND ERROR TRACKING FUNCTIONS
# ============================================================================

# Track deployment lifecycle events
track_deployment_lifecycle() {
    local event_type="$1"
    local deployment_name="$2"
    local details="${3:-}"

    log "AUDIT" "DEPLOYMENT_LIFECYCLE: type=$event_type deployment=$deployment_name details=$details"

    # Export lifecycle event to Prometheus
    if [[ "$METRICS_EXPORT" == "true" ]]; then
        local lifecycle_metric="deployment_lifecycle_events_total{environment=\"$ENVIRONMENT\",namespace=\"$NAMESPACE\",event_type=\"$event_type\",deployment=\"$deployment_name\"} 1"
        curl -s --data-binary "$lifecycle_metric" "$PROMETHEUS_PUSHGATEWAY_URL/metrics/job/$PROMETHEUS_JOB_NAME-lifecycle/instance/$MONITORING_SESSION_ID" &> /dev/null || true
    fi
}

# Track error patterns and trends
analyze_error_patterns() {
    log "DEBUG" "Analyzing error patterns..."

    if [[ ${#ERROR_EVENTS[@]} -eq 0 ]]; then
        log "DEBUG" "No errors to analyze"
        return 0
    fi

    # Count error types
    local error_analysis_file="$METRICS_DIR/error-analysis-$(date +%Y%m%d-%H%M%S).json"

    # Create error analysis
    cat > "$error_analysis_file" << EOF
{
  "analysis_metadata": {
    "session_id": "$MONITORING_SESSION_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "total_errors": ${#ERROR_EVENTS[@]}
  },
  "error_events": [
$(printf '%s\n' "${ERROR_EVENTS[@]}" | sed 's/$/,/' | sed '$s/,$//')
  ]
}
EOF

    log "SUCCESS" "Error analysis generated: $error_analysis_file"
}

# Generate audit trail report
generate_audit_trail() {
    log "INFO" "Generating audit trail report..."

    local audit_report_file="$AUDIT_DIR/audit-trail-$(date +%Y%m%d-%H%M%S).json"

    cat > "$audit_report_file" << EOF
{
  "audit_metadata": {
    "session_id": "$MONITORING_SESSION_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "total_events": ${#AUDIT_EVENTS[@]}
  },
  "audit_events": [
$(printf '%s\n' "${AUDIT_EVENTS[@]}" | sed 's/$/,/' | sed '$s/,$//')
  ]
}
EOF

    log "SUCCESS" "Audit trail report generated: $audit_report_file"
}

# ============================================================================
# CLEANUP AND MAINTENANCE FUNCTIONS
# ============================================================================

# Clean up old logs and metrics
cleanup_old_data() {
    log "DEBUG" "Cleaning up old logs and metrics..."

    # Clean up old log files
    find "$LOG_DIR" -name "*.log" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    find "$METRICS_DIR" -name "*.json" -mtime +$METRICS_RETENTION_DAYS -delete 2>/dev/null || true
    find "$AUDIT_DIR" -name "*.log" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    find "$AUDIT_DIR" -name "*.json" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true

    log "DEBUG" "Old data cleanup completed"
}

# Stop monitoring and generate final report
stop_monitoring() {
    log "INFO" "Stopping deployment monitoring..."

    # Generate final reports
    generate_monitoring_report
    analyze_error_patterns
    generate_audit_trail

    # Calculate final statistics
    local monitoring_end_time=$(date +%s)
    local total_monitoring_duration=$((monitoring_end_time - MONITORING_START_TIME))

    log "INFO" "=================================================="
    log "INFO" "Monitoring Session Summary:"
    log "INFO" "  - Session ID: $MONITORING_SESSION_ID"
    log "INFO" "  - Duration: ${total_monitoring_duration}s"
    log "INFO" "  - Metrics Collected: ${#DEPLOYMENT_METRICS[@]}"
    log "INFO" "  - Errors Detected: ${#ERROR_EVENTS[@]}"
    log "INFO" "  - Audit Events: ${#AUDIT_EVENTS[@]}"
    log "INFO" "=================================================="

    log "SUCCESS" "Deployment monitoring stopped successfully"
}

# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

# Show help
show_help() {
    cat << EOF
Comprehensive Deployment Logging and Monitoring System v$SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

DESCRIPTION:
    Comprehensive logging and monitoring for deployment processes with metrics
    collection, error tracking, performance monitoring, and audit trails.
    Integrates with Prometheus for metrics export and provides real-time
    monitoring of deployment health and performance.

OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: $DEFAULT_ENVIRONMENT)
    -n, --namespace NS          Kubernetes namespace (default: $DEFAULT_NAMESPACE)
    -m, --mode MODE             Monitoring mode (continuous|oneshot|report)
    -i, --interval SECONDS      Monitoring interval in seconds (default: $MONITORING_INTERVAL)
    --no-metrics-export         Disable metrics export to Prometheus
    --no-audit                  Disable audit logging
    -d, --dry-run              Perform dry run without making changes
    -v, --verbose              Enable verbose logging

MONITORING MODES:
    continuous                 Continuous monitoring with periodic reports
    oneshot                    Single metrics collection and report
    report                     Generate report from existing data

EXAMPLES:
    # Start continuous monitoring
    $SCRIPT_NAME --environment production --mode continuous

    # One-shot metrics collection
    $SCRIPT_NAME --mode oneshot --verbose

    # Generate report from existing data
    $SCRIPT_NAME --mode report --environment staging

    # Custom monitoring interval
    $SCRIPT_NAME --mode continuous --interval 60

FILES:
    $DEPLOYMENT_LOG            Deployment monitoring log
    $METRICS_LOG               Metrics collection log
    $AUDIT_LOG                 Audit trail log
    $ERROR_LOG                 Error tracking log

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -m|--mode)
                MONITORING_MODE="$2"
                shift 2
                ;;
            -i|--interval)
                MONITORING_INTERVAL="$2"
                shift 2
                ;;
            --no-metrics-export)
                METRICS_EXPORT=false
                shift
                ;;
            --no-audit)
                AUDIT_ENABLED=false
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

# Main function
main() {
    # Initialize monitoring
    init_monitoring

    # Parse command line arguments
    parse_arguments "$@"

    # Log startup information
    log "INFO" "Comprehensive Deployment Logging and Monitoring System v$SCRIPT_VERSION"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: ${USER:-unknown}"
    log "INFO" "Working directory: $(pwd)"
    log "INFO" "Script directory: $SCRIPT_DIR"
    log "INFO" "Project root: $PROJECT_ROOT"

    # Execute based on monitoring mode
    case "$MONITORING_MODE" in
        "continuous")
            trap 'stop_monitoring; exit 0' SIGINT SIGTERM
            start_continuous_monitoring
            ;;
        "oneshot")
            log "INFO" "Performing one-shot metrics collection..."
            collect_deployment_metrics
            generate_monitoring_report
            analyze_error_patterns
            generate_audit_trail
            log "SUCCESS" "One-shot monitoring completed"
            ;;
        "report")
            log "INFO" "Generating report from existing data..."
            generate_monitoring_report
            analyze_error_patterns
            generate_audit_trail
            log "SUCCESS" "Report generation completed"
            ;;
        *)
            log "ERROR" "Unknown monitoring mode: $MONITORING_MODE"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
