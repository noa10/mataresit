#!/bin/bash

# Monitoring Infrastructure Deployment Automation Script
# Deploys Prometheus, Grafana, AlertManager, and monitoring configurations
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

# Monitoring configuration
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure/production"
readonly MONITORING_DIR="$INFRASTRUCTURE_DIR/monitoring"
readonly KUBERNETES_DIR="$INFRASTRUCTURE_DIR/kubernetes"

# Logging configuration
readonly LOG_DIR="$PROJECT_ROOT/logs/monitoring"
readonly MONITORING_LOG="$LOG_DIR/monitoring-deployment-$(date +%Y%m%d-%H%M%S).log"
readonly AUDIT_LOG="$LOG_DIR/monitoring-audit-$(date +%Y%m%d).log"

# Default values
readonly DEFAULT_ENVIRONMENT="production"
readonly DEFAULT_NAMESPACE="paperless-maverick"
readonly MONITORING_NAMESPACE="monitoring"
readonly DEPLOYMENT_TIMEOUT=600  # 10 minutes
readonly HEALTH_CHECK_TIMEOUT=300  # 5 minutes

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
DRY_RUN=false
VALIDATE_ONLY=false
FORCE=false
VERBOSE=false
SKIP_PROMETHEUS=false
SKIP_GRAFANA=false
SKIP_ALERTMANAGER=false
SKIP_DASHBOARDS=false
UPDATE_EXISTING=false

# Deployment state
DEPLOYMENT_ID=""
DEPLOYMENT_START_TIME=""
DEPLOYED_COMPONENTS=()
FAILED_COMPONENTS=()

# Monitoring components
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
ALERTMANAGER_ENABLED=true
BLACKBOX_EXPORTER_ENABLED=true

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Initialize logging
init_logging() {
    mkdir -p "$LOG_DIR"
    touch "$MONITORING_LOG" "$AUDIT_LOG"
}

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} $message" | tee -a "$MONITORING_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅${NC} $message" | tee -a "$MONITORING_LOG"
            ;;
        "WARNING")
            echo -e "${YELLOW}[$timestamp] ⚠️${NC} $message" | tee -a "$MONITORING_LOG"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌${NC} $message" | tee -a "$MONITORING_LOG"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[$timestamp] 🔍${NC} $message" | tee -a "$MONITORING_LOG"
            fi
            ;;
        "AUDIT")
            echo "[$timestamp] $message" >> "$AUDIT_LOG"
            ;;
    esac
}

# Audit logging
audit_log() {
    local action="$1"
    local details="$2"
    local user="${USER:-unknown}"
    local deployment_id="${DEPLOYMENT_ID:-unknown}"
    
    log "AUDIT" "DEPLOYMENT_ID=$deployment_id USER=$user ACTION=$action DETAILS=$details"
}

# Generate unique deployment ID
generate_deployment_id() {
    DEPLOYMENT_ID="monitoring-deploy-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    log "INFO" "Generated deployment ID: $DEPLOYMENT_ID"
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Validate prerequisites
validate_prerequisites() {
    log "INFO" "🔍 Validating monitoring deployment prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "curl" "jq" "yq")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log "ERROR" "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        return 1
    fi
    
    # Check monitoring directory exists
    if [[ ! -d "$MONITORING_DIR" ]]; then
        log "ERROR" "Monitoring directory not found: $MONITORING_DIR"
        return 1
    fi
    
    # Check required monitoring files
    local required_files=(
        "$MONITORING_DIR/prometheus/prometheus.yml"
        "$MONITORING_DIR/prometheus/rules/embedding-alerts.yml"
        "$MONITORING_DIR/grafana/dashboards/production-overview-dashboard.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log "ERROR" "Required monitoring file not found: $file"
            return 1
        fi
    done
    
    log "SUCCESS" "Prerequisites validation completed"
    return 0
}

# Validate monitoring configuration
validate_monitoring_config() {
    log "INFO" "🔍 Validating monitoring configuration..."
    
    # Validate Prometheus configuration
    if [[ "$SKIP_PROMETHEUS" != "true" ]]; then
        log "DEBUG" "Validating Prometheus configuration..."
        
        # Check Prometheus config syntax (if promtool is available)
        if command -v promtool &> /dev/null; then
            if promtool check config "$MONITORING_DIR/prometheus/prometheus.yml"; then
                log "SUCCESS" "Prometheus configuration is valid"
            else
                log "ERROR" "Prometheus configuration validation failed"
                return 1
            fi
        else
            log "DEBUG" "promtool not available, skipping Prometheus config validation"
        fi
        
        # Validate alert rules
        if [[ -f "$MONITORING_DIR/prometheus/rules/embedding-alerts.yml" ]]; then
            if yq eval '.' "$MONITORING_DIR/prometheus/rules/embedding-alerts.yml" &> /dev/null; then
                log "SUCCESS" "Alert rules configuration is valid YAML"
            else
                log "ERROR" "Alert rules configuration is invalid YAML"
                return 1
            fi
        fi
    fi
    
    # Validate Grafana dashboards
    if [[ "$SKIP_GRAFANA" != "true" ]] && [[ "$SKIP_DASHBOARDS" != "true" ]]; then
        log "DEBUG" "Validating Grafana dashboards..."
        
        local dashboard_files=(
            "$MONITORING_DIR/grafana/dashboards/production-overview-dashboard.json"
            "$MONITORING_DIR/grafana/dashboards/embedding-performance-dashboard.json"
            "$MONITORING_DIR/grafana/dashboards/worker-health-dashboard.json"
        )
        
        for dashboard in "${dashboard_files[@]}"; do
            if [[ -f "$dashboard" ]]; then
                if jq empty "$dashboard" &> /dev/null; then
                    log "SUCCESS" "Dashboard $(basename "$dashboard") is valid JSON"
                else
                    log "ERROR" "Dashboard $(basename "$dashboard") is invalid JSON"
                    return 1
                fi
            else
                log "WARNING" "Dashboard not found: $(basename "$dashboard")"
            fi
        done
    fi
    
    log "SUCCESS" "Monitoring configuration validation completed"
    return 0
}

# ============================================================================
# NAMESPACE AND RBAC FUNCTIONS
# ============================================================================

# Create monitoring namespace
create_monitoring_namespace() {
    log "INFO" "📁 Creating monitoring namespace..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would create monitoring namespace"
        return 0
    fi
    
    # Check if namespace exists
    if kubectl get namespace "$MONITORING_NAMESPACE" &> /dev/null; then
        log "INFO" "Monitoring namespace already exists: $MONITORING_NAMESPACE"
        return 0
    fi
    
    # Create namespace
    kubectl create namespace "$MONITORING_NAMESPACE"
    
    # Label namespace
    kubectl label namespace "$MONITORING_NAMESPACE" \
        name="$MONITORING_NAMESPACE" \
        purpose="monitoring" \
        environment="$ENVIRONMENT"
    
    log "SUCCESS" "Created monitoring namespace: $MONITORING_NAMESPACE"
    audit_log "NAMESPACE_CREATED" "namespace=$MONITORING_NAMESPACE"
    return 0
}

# Setup monitoring RBAC
setup_monitoring_rbac() {
    log "INFO" "🔐 Setting up monitoring RBAC..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would setup monitoring RBAC"
        return 0
    fi
    
    # Create service account for Prometheus
    kubectl create serviceaccount prometheus -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Create cluster role for Prometheus
    cat << EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
- apiGroups: [""]
  resources:
  - nodes
  - nodes/proxy
  - services
  - endpoints
  - pods
  verbs: ["get", "list", "watch"]
- apiGroups:
  - extensions
  resources:
  - ingresses
  verbs: ["get", "list", "watch"]
- nonResourceURLs: ["/metrics"]
  verbs: ["get"]
EOF
    
    # Create cluster role binding
    kubectl create clusterrolebinding prometheus \
        --clusterrole=prometheus \
        --serviceaccount="$MONITORING_NAMESPACE:prometheus" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "SUCCESS" "Monitoring RBAC setup completed"
    audit_log "RBAC_CONFIGURED" "namespace=$MONITORING_NAMESPACE"
    return 0
}

# ============================================================================
# PROMETHEUS DEPLOYMENT FUNCTIONS
# ============================================================================

# Deploy Prometheus configuration
deploy_prometheus_config() {
    log "INFO" "⚙️ Deploying Prometheus configuration..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would deploy Prometheus configuration"
        return 0
    fi

    # Create ConfigMap for Prometheus configuration
    kubectl create configmap prometheus-config \
        --from-file="$MONITORING_DIR/prometheus/prometheus.yml" \
        -n "$MONITORING_NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Create ConfigMap for alert rules
    if [[ -d "$MONITORING_DIR/prometheus/rules" ]]; then
        kubectl create configmap prometheus-rules \
            --from-file="$MONITORING_DIR/prometheus/rules/" \
            -n "$MONITORING_NAMESPACE" \
            --dry-run=client -o yaml | kubectl apply -f -
    fi

    log "SUCCESS" "Prometheus configuration deployed"
    DEPLOYED_COMPONENTS+=("prometheus-config")
    return 0
}

# Deploy Prometheus server
deploy_prometheus_server() {
    if [[ "$SKIP_PROMETHEUS" == "true" ]]; then
        log "INFO" "Skipping Prometheus server deployment"
        return 0
    fi

    log "INFO" "🔍 Deploying Prometheus server..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would deploy Prometheus server"
        return 0
    fi

    # Create Prometheus deployment
    cat << EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: $MONITORING_NAMESPACE
  labels:
    app: prometheus
    component: server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
      component: server
  template:
    metadata:
      labels:
        app: prometheus
        component: server
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:v2.45.0
        args:
          - '--config.file=/etc/prometheus/prometheus.yml'
          - '--storage.tsdb.path=/prometheus/'
          - '--web.console.libraries=/etc/prometheus/console_libraries'
          - '--web.console.templates=/etc/prometheus/consoles'
          - '--storage.tsdb.retention.time=15d'
          - '--web.enable-lifecycle'
          - '--web.enable-admin-api'
        ports:
        - containerPort: 9090
          name: web
        volumeMounts:
        - name: prometheus-config
          mountPath: /etc/prometheus/prometheus.yml
          subPath: prometheus.yml
        - name: prometheus-rules
          mountPath: /etc/prometheus/rules
        - name: prometheus-storage
          mountPath: /prometheus
        resources:
          requests:
            memory: "2Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /-/healthy
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /-/ready
            port: 9090
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: prometheus-config
        configMap:
          name: prometheus-config
      - name: prometheus-rules
        configMap:
          name: prometheus-rules
      - name: prometheus-storage
        persistentVolumeClaim:
          claimName: prometheus-storage
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-storage
  namespace: $MONITORING_NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: $MONITORING_NAMESPACE
  labels:
    app: prometheus
    component: server
spec:
  type: ClusterIP
  ports:
  - port: 9090
    targetPort: 9090
    name: web
  selector:
    app: prometheus
    component: server
EOF

    # Wait for Prometheus to be ready
    log "INFO" "Waiting for Prometheus to be ready..."
    kubectl rollout status deployment/prometheus -n "$MONITORING_NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}s"

    log "SUCCESS" "Prometheus server deployed successfully"
    DEPLOYED_COMPONENTS+=("prometheus-server")
    audit_log "PROMETHEUS_DEPLOYED" "namespace=$MONITORING_NAMESPACE"
    return 0
}

# ============================================================================
# GRAFANA DEPLOYMENT FUNCTIONS
# ============================================================================

# Deploy Grafana
deploy_grafana() {
    if [[ "$SKIP_GRAFANA" == "true" ]]; then
        log "INFO" "Skipping Grafana deployment"
        return 0
    fi

    log "INFO" "📊 Deploying Grafana..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would deploy Grafana"
        return 0
    fi

    # Create Grafana configuration
    cat << EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-config
  namespace: $MONITORING_NAMESPACE
data:
  grafana.ini: |
    [analytics]
    check_for_updates = true
    [grafana_net]
    url = https://grafana.net
    [log]
    mode = console
    [paths]
    data = /var/lib/grafana/data
    logs = /var/log/grafana
    plugins = /var/lib/grafana/plugins
    provisioning = /etc/grafana/provisioning
    [security]
    admin_user = admin
    admin_password = \${GRAFANA_ADMIN_PASSWORD}
  datasources.yml: |
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      access: proxy
      url: http://prometheus:9090
      isDefault: true
      editable: true
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: $MONITORING_NAMESPACE
  labels:
    app: grafana
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:10.0.0
        ports:
        - containerPort: 3000
          name: web
        env:
        - name: GRAFANA_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-secrets
              key: admin-password
        volumeMounts:
        - name: grafana-config
          mountPath: /etc/grafana/grafana.ini
          subPath: grafana.ini
        - name: grafana-datasources
          mountPath: /etc/grafana/provisioning/datasources/datasources.yml
          subPath: datasources.yml
        - name: grafana-storage
          mountPath: /var/lib/grafana
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: grafana-config
        configMap:
          name: grafana-config
      - name: grafana-datasources
        configMap:
          name: grafana-config
      - name: grafana-storage
        persistentVolumeClaim:
          claimName: grafana-storage
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: grafana-storage
  namespace: $MONITORING_NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: $MONITORING_NAMESPACE
  labels:
    app: grafana
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
    name: web
  selector:
    app: grafana
EOF

    # Create Grafana secrets
    create_grafana_secrets

    # Wait for Grafana to be ready
    log "INFO" "Waiting for Grafana to be ready..."
    kubectl rollout status deployment/grafana -n "$MONITORING_NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}s"

    log "SUCCESS" "Grafana deployed successfully"
    DEPLOYED_COMPONENTS+=("grafana")
    audit_log "GRAFANA_DEPLOYED" "namespace=$MONITORING_NAMESPACE"
    return 0
}

# Create Grafana secrets
create_grafana_secrets() {
    log "DEBUG" "Creating Grafana secrets..."

    # Generate admin password if not provided
    local admin_password="${GRAFANA_ADMIN_PASSWORD:-$(openssl rand -base64 32)}"

    # Create secret
    kubectl create secret generic grafana-secrets \
        --from-literal=admin-password="$admin_password" \
        -n "$MONITORING_NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    log "INFO" "Grafana admin password: $admin_password"
    log "SUCCESS" "Grafana secrets created"
}

# ============================================================================
# ALERTMANAGER DEPLOYMENT FUNCTIONS
# ============================================================================

# Deploy AlertManager
deploy_alertmanager() {
    if [[ "$SKIP_ALERTMANAGER" == "true" ]]; then
        log "INFO" "Skipping AlertManager deployment"
        return 0
    fi

    log "INFO" "🚨 Deploying AlertManager..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would deploy AlertManager"
        return 0
    fi

    # Create AlertManager configuration
    cat << EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: $MONITORING_NAMESPACE
data:
  alertmanager.yml: |
    global:
      smtp_smarthost: 'localhost:587'
      smtp_from: 'alertmanager@paperless-maverick.com'

    route:
      group_by: ['alertname']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'web.hook'
      routes:
      - match:
          severity: critical
        receiver: 'critical-alerts'
      - match:
          severity: warning
        receiver: 'warning-alerts'

    receivers:
    - name: 'web.hook'
      webhook_configs:
      - url: 'http://localhost:5001/'

    - name: 'critical-alerts'
      slack_configs:
      - api_url: '\${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: 'Critical Alert: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

    - name: 'warning-alerts'
      slack_configs:
      - api_url: '\${SLACK_WEBHOOK_URL}'
        channel: '#alerts-warning'
        title: 'Warning: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

    inhibit_rules:
    - source_match:
        severity: 'critical'
      target_match:
        severity: 'warning'
      equal: ['alertname', 'dev', 'instance']
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager
  namespace: $MONITORING_NAMESPACE
  labels:
    app: alertmanager
spec:
  replicas: 1
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
      - name: alertmanager
        image: prom/alertmanager:v0.25.0
        args:
          - '--config.file=/etc/alertmanager/alertmanager.yml'
          - '--storage.path=/alertmanager'
          - '--web.external-url=http://localhost:9093'
        ports:
        - containerPort: 9093
          name: web
        env:
        - name: SLACK_WEBHOOK_URL
          valueFrom:
            secretKeyRef:
              name: alertmanager-secrets
              key: slack-webhook-url
              optional: true
        volumeMounts:
        - name: alertmanager-config
          mountPath: /etc/alertmanager/alertmanager.yml
          subPath: alertmanager.yml
        - name: alertmanager-storage
          mountPath: /alertmanager
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /-/healthy
            port: 9093
          initialDelaySeconds: 30
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /-/ready
            port: 9093
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: alertmanager-config
        configMap:
          name: alertmanager-config
      - name: alertmanager-storage
        persistentVolumeClaim:
          claimName: alertmanager-storage
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: alertmanager-storage
  namespace: $MONITORING_NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: alertmanager
  namespace: $MONITORING_NAMESPACE
  labels:
    app: alertmanager
spec:
  type: ClusterIP
  ports:
  - port: 9093
    targetPort: 9093
    name: web
  selector:
    app: alertmanager
EOF

    # Create AlertManager secrets
    create_alertmanager_secrets

    # Wait for AlertManager to be ready
    log "INFO" "Waiting for AlertManager to be ready..."
    kubectl rollout status deployment/alertmanager -n "$MONITORING_NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}s"

    log "SUCCESS" "AlertManager deployed successfully"
    DEPLOYED_COMPONENTS+=("alertmanager")
    audit_log "ALERTMANAGER_DEPLOYED" "namespace=$MONITORING_NAMESPACE"
    return 0
}

# Create AlertManager secrets
create_alertmanager_secrets() {
    log "DEBUG" "Creating AlertManager secrets..."

    # Create secret with placeholder values
    kubectl create secret generic alertmanager-secrets \
        --from-literal=slack-webhook-url="${SLACK_WEBHOOK_URL:-https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK}" \
        --from-literal=pagerduty-integration-key="${PAGERDUTY_INTEGRATION_KEY:-your-pagerduty-key}" \
        -n "$MONITORING_NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    log "SUCCESS" "AlertManager secrets created"
}

# ============================================================================
# DASHBOARD IMPORT FUNCTIONS
# ============================================================================

# Import Grafana dashboards
import_grafana_dashboards() {
    if [[ "$SKIP_GRAFANA" == "true" ]] || [[ "$SKIP_DASHBOARDS" == "true" ]]; then
        log "INFO" "Skipping Grafana dashboard import"
        return 0
    fi

    log "INFO" "📈 Importing Grafana dashboards..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would import Grafana dashboards"
        return 0
    fi

    # Wait for Grafana to be fully ready
    wait_for_grafana_ready

    # Import dashboards
    local dashboard_files=(
        "$MONITORING_DIR/grafana/dashboards/production-overview-dashboard.json"
        "$MONITORING_DIR/grafana/dashboards/embedding-performance-dashboard.json"
        "$MONITORING_DIR/grafana/dashboards/worker-health-dashboard.json"
    )

    for dashboard_file in "${dashboard_files[@]}"; do
        if [[ -f "$dashboard_file" ]]; then
            import_single_dashboard "$dashboard_file"
        else
            log "WARNING" "Dashboard file not found: $(basename "$dashboard_file")"
        fi
    done

    log "SUCCESS" "Grafana dashboards imported successfully"
    DEPLOYED_COMPONENTS+=("grafana-dashboards")
    return 0
}

# Wait for Grafana to be ready
wait_for_grafana_ready() {
    log "DEBUG" "Waiting for Grafana to be ready for API calls..."

    local retries=30
    local interval=10

    for ((i=1; i<=retries; i++)); do
        if kubectl exec -n "$MONITORING_NAMESPACE" deployment/grafana -- \
            curl -f -s http://localhost:3000/api/health &> /dev/null; then
            log "SUCCESS" "Grafana is ready for API calls"
            return 0
        fi

        log "DEBUG" "Grafana not ready yet (attempt $i/$retries)"
        sleep "$interval"
    done

    log "ERROR" "Grafana failed to become ready for API calls"
    return 1
}

# Import single dashboard
import_single_dashboard() {
    local dashboard_file="$1"
    local dashboard_name=$(basename "$dashboard_file" .json)

    log "DEBUG" "Importing dashboard: $dashboard_name"

    # Get Grafana admin credentials
    local admin_password
    admin_password=$(kubectl get secret grafana-secrets -n "$MONITORING_NAMESPACE" -o jsonpath='{.data.admin-password}' | base64 -d)

    # Import dashboard via API
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/grafana -- \
        curl -X POST \
        -H "Content-Type: application/json" \
        -u "admin:$admin_password" \
        -d @"/tmp/$dashboard_name.json" \
        http://localhost:3000/api/dashboards/db &> /dev/null; then
        log "SUCCESS" "Imported dashboard: $dashboard_name"
    else
        log "ERROR" "Failed to import dashboard: $dashboard_name"
        FAILED_COMPONENTS+=("dashboard-$dashboard_name")
    fi
}

# ============================================================================
# HEALTH VALIDATION FUNCTIONS
# ============================================================================

# Validate monitoring deployment health
validate_monitoring_health() {
    log "INFO" "🏥 Validating monitoring deployment health..."

    local health_checks_passed=0
    local health_checks_failed=0

    # Check Prometheus health
    if [[ "$SKIP_PROMETHEUS" != "true" ]]; then
        if check_prometheus_health; then
            ((health_checks_passed++))
        else
            ((health_checks_failed++))
        fi
    fi

    # Check Grafana health
    if [[ "$SKIP_GRAFANA" != "true" ]]; then
        if check_grafana_health; then
            ((health_checks_passed++))
        else
            ((health_checks_failed++))
        fi
    fi

    # Check AlertManager health
    if [[ "$SKIP_ALERTMANAGER" != "true" ]]; then
        if check_alertmanager_health; then
            ((health_checks_passed++))
        else
            ((health_checks_failed++))
        fi
    fi

    # Summary
    log "INFO" "Health validation summary: $health_checks_passed passed, $health_checks_failed failed"

    if [[ $health_checks_failed -gt 0 ]]; then
        log "ERROR" "Monitoring health validation failed"
        return 1
    else
        log "SUCCESS" "All monitoring health checks passed"
        return 0
    fi
}

# Check Prometheus health
check_prometheus_health() {
    log "DEBUG" "Checking Prometheus health..."

    # Check if deployment is ready
    local ready_replicas
    ready_replicas=$(kubectl get deployment prometheus -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

    if [[ "$ready_replicas" -eq 0 ]]; then
        log "ERROR" "Prometheus deployment is not ready"
        return 1
    fi

    # Check health endpoint
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/prometheus -- \
        curl -f -s http://localhost:9090/-/healthy &> /dev/null; then
        log "SUCCESS" "Prometheus health check passed"
        return 0
    else
        log "ERROR" "Prometheus health check failed"
        return 1
    fi
}

# Check Grafana health
check_grafana_health() {
    log "DEBUG" "Checking Grafana health..."

    # Check if deployment is ready
    local ready_replicas
    ready_replicas=$(kubectl get deployment grafana -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

    if [[ "$ready_replicas" -eq 0 ]]; then
        log "ERROR" "Grafana deployment is not ready"
        return 1
    fi

    # Check health endpoint
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/grafana -- \
        curl -f -s http://localhost:3000/api/health &> /dev/null; then
        log "SUCCESS" "Grafana health check passed"
        return 0
    else
        log "ERROR" "Grafana health check failed"
        return 1
    fi
}

# Check AlertManager health
check_alertmanager_health() {
    log "DEBUG" "Checking AlertManager health..."

    # Check if deployment is ready
    local ready_replicas
    ready_replicas=$(kubectl get deployment alertmanager -n "$MONITORING_NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

    if [[ "$ready_replicas" -eq 0 ]]; then
        log "ERROR" "AlertManager deployment is not ready"
        return 1
    fi

    # Check health endpoint
    if kubectl exec -n "$MONITORING_NAMESPACE" deployment/alertmanager -- \
        curl -f -s http://localhost:9093/-/healthy &> /dev/null; then
        log "SUCCESS" "AlertManager health check passed"
        return 0
    else
        log "ERROR" "AlertManager health check failed"
        return 1
    fi
}

# ============================================================================
# MAIN ORCHESTRATION FUNCTIONS
# ============================================================================

# Main monitoring deployment orchestration
main_monitoring_deployment() {
    log "INFO" "🚀 Starting monitoring infrastructure deployment"
    log "INFO" "Deployment ID: $DEPLOYMENT_ID"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Namespace: $NAMESPACE"
    log "INFO" "Monitoring Namespace: $MONITORING_NAMESPACE"
    log "INFO" "Dry Run: $DRY_RUN"
    log "INFO" "=================================================="

    DEPLOYMENT_START_TIME=$(date +%s)
    audit_log "MONITORING_DEPLOYMENT_STARTED" "deployment_id=$DEPLOYMENT_ID environment=$ENVIRONMENT"

    # Set up error handling
    trap 'handle_deployment_failure' ERR

    # Phase 1: Validation
    validate_prerequisites || return 1
    validate_monitoring_config || return 1

    # Phase 2: Namespace and RBAC setup
    create_monitoring_namespace || return 1
    setup_monitoring_rbac || return 1

    # Phase 3: Deploy monitoring components
    deploy_prometheus_config || return 1
    deploy_prometheus_server || return 1
    deploy_grafana || return 1
    deploy_alertmanager || return 1

    # Phase 4: Import dashboards
    import_grafana_dashboards || return 1

    # Phase 5: Health validation
    validate_monitoring_health || return 1

    # Deployment summary
    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))

    log "SUCCESS" "🎉 Monitoring infrastructure deployment completed successfully!"
    log "INFO" "=================================================="
    log "INFO" "Deployment Summary:"
    log "INFO" "  - Deployment ID: $DEPLOYMENT_ID"
    log "INFO" "  - Duration: ${deployment_duration}s"
    log "INFO" "  - Environment: $ENVIRONMENT"
    log "INFO" "  - Monitoring Namespace: $MONITORING_NAMESPACE"
    log "INFO" "  - Deployed Components: ${#DEPLOYED_COMPONENTS[@]}"
    log "INFO" "  - Failed Components: ${#FAILED_COMPONENTS[@]}"
    log "INFO" "=================================================="

    if [[ ${#DEPLOYED_COMPONENTS[@]} -gt 0 ]]; then
        log "INFO" "Successfully Deployed Components:"
        for component in "${DEPLOYED_COMPONENTS[@]}"; do
            log "INFO" "  ✅ $component"
        done
    fi

    if [[ ${#FAILED_COMPONENTS[@]} -gt 0 ]]; then
        log "WARNING" "Failed Components:"
        for component in "${FAILED_COMPONENTS[@]}"; do
            log "WARNING" "  ❌ $component"
        done
    fi

    # Access information
    log "INFO" "=================================================="
    log "INFO" "Access Information:"
    log "INFO" "  - Prometheus: kubectl port-forward -n $MONITORING_NAMESPACE svc/prometheus 9090:9090"
    log "INFO" "  - Grafana: kubectl port-forward -n $MONITORING_NAMESPACE svc/grafana 3000:3000"
    log "INFO" "  - AlertManager: kubectl port-forward -n $MONITORING_NAMESPACE svc/alertmanager 9093:9093"
    log "INFO" "=================================================="

    audit_log "MONITORING_DEPLOYMENT_COMPLETED" "deployment_id=$DEPLOYMENT_ID duration=${deployment_duration}s deployed=${#DEPLOYED_COMPONENTS[@]} failed=${#FAILED_COMPONENTS[@]}"

    return 0
}

# Handle deployment failures
handle_deployment_failure() {
    local exit_code=$?

    log "ERROR" "💥 Monitoring deployment failed"
    audit_log "MONITORING_DEPLOYMENT_FAILED" "deployment_id=$DEPLOYMENT_ID exit_code=$exit_code"

    if [[ ${#DEPLOYED_COMPONENTS[@]} -gt 0 ]]; then
        log "WARNING" "Some components were deployed before failure occurred"
        log "INFO" "Consider cleaning up or using --force to continue"
    fi

    exit $exit_code
}

# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

# Show help
show_help() {
    cat << EOF
Monitoring Infrastructure Deployment Automation Script v$SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

DESCRIPTION:
    Comprehensive monitoring infrastructure deployment automation including
    Prometheus, Grafana, AlertManager, and dashboard configuration with
    validation and health checks. Provides complete observability stack
    for production environments.

OPTIONS:
    -h, --help                  Show this help message
    -e, --environment ENV       Target environment (default: $DEFAULT_ENVIRONMENT)
    -n, --namespace NS          Application namespace (default: $DEFAULT_NAMESPACE)
    -m, --monitoring-ns NS      Monitoring namespace (default: $MONITORING_NAMESPACE)
    -d, --dry-run              Perform dry run without making changes
    -v, --validate-only        Only validate configuration
    -f, --force                Force deployment, skip safety checks
    --verbose                  Enable verbose logging
    --skip-prometheus          Skip Prometheus deployment
    --skip-grafana             Skip Grafana deployment
    --skip-alertmanager        Skip AlertManager deployment
    --skip-dashboards          Skip dashboard import
    --update-existing          Update existing monitoring components

MONITORING COMPONENTS:
    prometheus                 Metrics collection and storage server
    grafana                    Visualization and dashboard platform
    alertmanager               Alert routing and notification management
    dashboards                 Pre-configured monitoring dashboards

EXAMPLES:
    # Full monitoring stack deployment
    $SCRIPT_NAME --environment production

    # Deploy only Prometheus and Grafana
    $SCRIPT_NAME --skip-alertmanager

    # Dry run validation
    $SCRIPT_NAME --dry-run --validate-only

    # Update existing monitoring stack
    $SCRIPT_NAME --update-existing --environment production

    # Skip dashboard import
    $SCRIPT_NAME --skip-dashboards --verbose

ENVIRONMENT VARIABLES:
    GRAFANA_ADMIN_PASSWORD     Grafana admin password (auto-generated if not set)
    SLACK_WEBHOOK_URL          Slack webhook URL for alerts
    PAGERDUTY_INTEGRATION_KEY  PagerDuty integration key for critical alerts

FILES:
    $MONITORING_LOG            Deployment log
    $AUDIT_LOG                 Audit log

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
            -m|--monitoring-ns)
                MONITORING_NAMESPACE="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--validate-only)
                VALIDATE_ONLY=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --skip-prometheus)
                SKIP_PROMETHEUS=true
                PROMETHEUS_ENABLED=false
                shift
                ;;
            --skip-grafana)
                SKIP_GRAFANA=true
                GRAFANA_ENABLED=false
                shift
                ;;
            --skip-alertmanager)
                SKIP_ALERTMANAGER=true
                ALERTMANAGER_ENABLED=false
                shift
                ;;
            --skip-dashboards)
                SKIP_DASHBOARDS=true
                shift
                ;;
            --update-existing)
                UPDATE_EXISTING=true
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
    # Initialize logging
    init_logging

    # Parse command line arguments
    parse_arguments "$@"

    # Generate deployment ID
    generate_deployment_id

    # Log startup information
    log "INFO" "Monitoring Infrastructure Deployment Script v$SCRIPT_VERSION"
    log "INFO" "Started at: $(date)"
    log "INFO" "User: ${USER:-unknown}"
    log "INFO" "Working directory: $(pwd)"
    log "INFO" "Script directory: $SCRIPT_DIR"
    log "INFO" "Project root: $PROJECT_ROOT"
    log "INFO" "Monitoring directory: $MONITORING_DIR"

    # Handle special modes
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "INFO" "✅ Validation-only mode activated"
        validate_prerequisites
        validate_monitoring_config
        log "SUCCESS" "Validation completed successfully"
        exit 0
    fi

    # Run main monitoring deployment process
    main_monitoring_deployment
    exit $?
}

# Execute main function with all arguments
main "$@"
