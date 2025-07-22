#!/bin/bash
# Worker Entrypoint Script
# Production-ready entrypoint for embedding queue workers with comprehensive initialization

set -euo pipefail

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
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
WORKER_TYPE="${WORKER_TYPE:-embedding-queue}"
WORKER_ID="${WORKER_ID:-$(hostname)}"
LOG_LEVEL="${LOG_LEVEL:-info}"
HEALTH_CHECK_PORT="${HEALTH_CHECK_PORT:-8080}"
METRICS_PORT="${METRICS_PORT:-9091}"
NODE_ENV="${NODE_ENV:-production}"

# Directories
LOG_DIR="/app/logs"
CONFIG_DIR="/app/config"
TMP_DIR="/app/tmp"

# Create necessary directories
mkdir -p "$LOG_DIR" "$CONFIG_DIR" "$TMP_DIR"

# Trap signals for graceful shutdown
cleanup() {
    log "Received shutdown signal, initiating graceful shutdown..."
    
    # Stop accepting new jobs
    if [ -n "${WORKER_PID:-}" ]; then
        log "Stopping worker process (PID: $WORKER_PID)..."
        kill -TERM "$WORKER_PID" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local timeout=30
        while [ $timeout -gt 0 ] && kill -0 "$WORKER_PID" 2>/dev/null; do
            sleep 1
            timeout=$((timeout - 1))
        done
        
        # Force kill if still running
        if kill -0 "$WORKER_PID" 2>/dev/null; then
            warning "Worker didn't shutdown gracefully, forcing termination..."
            kill -KILL "$WORKER_PID" 2>/dev/null || true
        fi
    fi
    
    # Cleanup temporary files
    rm -rf "$TMP_DIR"/*
    
    success "Graceful shutdown completed"
    exit 0
}

trap cleanup SIGTERM SIGINT SIGQUIT

# Validate environment
validate_environment() {
    log "Validating environment configuration..."
    
    local required_vars=(
        "SUPABASE_URL"
        "SUPABASE_SERVICE_ROLE_KEY"
        "GEMINI_API_KEY"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
    
    # Validate URLs
    if [[ ! "$SUPABASE_URL" =~ ^https?:// ]]; then
        error "SUPABASE_URL must be a valid HTTP/HTTPS URL"
        exit 1
    fi
    
    success "Environment validation passed"
}

# Check database connectivity
check_database() {
    log "Checking database connectivity..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s --max-time 10 \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
            "$SUPABASE_URL/rest/v1/embedding_queue?select=id&limit=1" > /dev/null; then
            success "Database connectivity verified"
            return 0
        fi
        
        warning "Database connection attempt $attempt/$max_attempts failed, retrying in 5 seconds..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    error "Failed to connect to database after $max_attempts attempts"
    exit 1
}

# Check AI API connectivity
check_ai_apis() {
    log "Checking AI API connectivity..."
    
    # Check Gemini API
    if ! curl -f -s --max-time 10 \
        -H "Authorization: Bearer $GEMINI_API_KEY" \
        "https://generativelanguage.googleapis.com/v1/models" > /dev/null; then
        warning "Gemini API connectivity check failed"
    else
        success "Gemini API connectivity verified"
    fi
    
    # Check OpenAI API if configured
    if [ -n "${OPENAI_API_KEY:-}" ]; then
        if ! curl -f -s --max-time 10 \
            -H "Authorization: Bearer $OPENAI_API_KEY" \
            "https://api.openai.com/v1/models" > /dev/null; then
            warning "OpenAI API connectivity check failed"
        else
            success "OpenAI API connectivity verified"
        fi
    fi
}

# Initialize worker configuration
initialize_worker() {
    log "Initializing worker configuration..."
    
    # Create worker configuration file
    cat > "$CONFIG_DIR/worker-config.json" << EOF
{
  "workerId": "$WORKER_ID",
  "workerType": "$WORKER_TYPE",
  "environment": "$NODE_ENV",
  "logLevel": "$LOG_LEVEL",
  "healthCheck": {
    "port": $HEALTH_CHECK_PORT,
    "path": "/health"
  },
  "metrics": {
    "port": $METRICS_PORT,
    "path": "/metrics"
  },
  "queue": {
    "pollInterval": ${QUEUE_POLL_INTERVAL:-5000},
    "maxConcurrentJobs": ${MAX_CONCURRENT_JOBS:-3},
    "batchSize": ${BATCH_SIZE:-5},
    "heartbeatInterval": ${HEARTBEAT_INTERVAL:-30000},
    "maxProcessingTime": ${MAX_PROCESSING_TIME:-600000}
  },
  "rateLimiting": {
    "maxRequestsPerMinute": ${MAX_REQUESTS_PER_MINUTE:-60},
    "maxTokensPerMinute": ${MAX_TOKENS_PER_MINUTE:-100000},
    "backoffMultiplier": ${BACKOFF_MULTIPLIER:-2},
    "maxBackoffMs": ${MAX_BACKOFF_MS:-30000}
  },
  "monitoring": {
    "enablePerformanceMonitoring": ${ENABLE_PERFORMANCE_MONITORING:-true},
    "enableDetailedLogging": ${ENABLE_DETAILED_LOGGING:-true},
    "metricsCollectionInterval": ${METRICS_COLLECTION_INTERVAL:-10000}
  }
}
EOF
    
    success "Worker configuration initialized"
}

# Start health check server
start_health_server() {
    log "Starting health check server on port $HEALTH_CHECK_PORT..."
    
    # Create simple health check server
    cat > "$TMP_DIR/health-server.js" << 'EOF'
const http = require('http');
const fs = require('fs');

const port = process.env.HEALTH_CHECK_PORT || 8080;
let isReady = false;
let isStarted = false;
let lastJobTime = Date.now();

// Health status
let healthStatus = {
    status: 'starting',
    timestamp: new Date().toISOString(),
    uptime: 0,
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
};

// Update health status periodically
setInterval(() => {
    healthStatus = {
        ...healthStatus,
        status: isReady ? 'healthy' : 'starting',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
}, 5000);

const server = http.createServer((req, res) => {
    const url = req.url;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (url === '/health') {
        res.statusCode = isReady ? 200 : 503;
        res.end(JSON.stringify(healthStatus));
    } else if (url === '/ready') {
        res.statusCode = isReady ? 200 : 503;
        res.end(JSON.stringify({ ready: isReady }));
    } else if (url === '/startup') {
        res.statusCode = isStarted ? 200 : 503;
        res.end(JSON.stringify({ started: isStarted }));
    } else if (url === '/metrics') {
        // Basic metrics
        const metrics = `
# HELP worker_uptime_seconds Worker uptime in seconds
# TYPE worker_uptime_seconds counter
worker_uptime_seconds ${process.uptime()}

# HELP worker_memory_usage_bytes Worker memory usage in bytes
# TYPE worker_memory_usage_bytes gauge
worker_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}
worker_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}
worker_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}

# HELP worker_last_job_timestamp Last job processing timestamp
# TYPE worker_last_job_timestamp gauge
worker_last_job_timestamp ${lastJobTime}
        `;
        res.setHeader('Content-Type', 'text/plain');
        res.statusCode = 200;
        res.end(metrics.trim());
    } else if (url === '/shutdown' && req.method === 'POST') {
        res.statusCode = 200;
        res.end(JSON.stringify({ message: 'Shutdown initiated' }));
        process.kill(process.pid, 'SIGTERM');
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Health server listening on port ${port}`);
    isStarted = true;
    
    // Mark as ready after a short delay
    setTimeout(() => {
        isReady = true;
    }, 5000);
});

// Handle shutdown
process.on('SIGTERM', () => {
    console.log('Health server shutting down...');
    server.close(() => {
        process.exit(0);
    });
});
EOF
    
    # Start health server in background
    node "$TMP_DIR/health-server.js" &
    HEALTH_SERVER_PID=$!
    
    # Wait for health server to start
    sleep 2
    
    if kill -0 "$HEALTH_SERVER_PID" 2>/dev/null; then
        success "Health check server started (PID: $HEALTH_SERVER_PID)"
    else
        error "Failed to start health check server"
        exit 1
    fi
}

# Start the main worker process
start_worker() {
    log "Starting $WORKER_TYPE worker (ID: $WORKER_ID)..."
    
    # Set Node.js options for production
    export NODE_OPTIONS="--max-old-space-size=1024 --enable-source-maps"
    
    # Start the worker
    if [ "$WORKER_TYPE" = "embedding-queue" ]; then
        node dist/workers/embedding-queue-worker.js &
        WORKER_PID=$!
    else
        error "Unknown worker type: $WORKER_TYPE"
        exit 1
    fi
    
    # Wait a moment and check if worker started successfully
    sleep 3
    
    if kill -0 "$WORKER_PID" 2>/dev/null; then
        success "Worker started successfully (PID: $WORKER_PID)"
    else
        error "Worker failed to start"
        exit 1
    fi
}

# Monitor worker process
monitor_worker() {
    log "Monitoring worker process..."
    
    while true; do
        if ! kill -0 "$WORKER_PID" 2>/dev/null; then
            error "Worker process died unexpectedly"
            exit 1
        fi
        
        # Check memory usage
        if command -v ps > /dev/null; then
            local memory_mb=$(ps -o rss= -p "$WORKER_PID" 2>/dev/null | awk '{print int($1/1024)}' || echo "0")
            if [ "$memory_mb" -gt 1536 ]; then  # 1.5GB threshold
                warning "Worker memory usage is high: ${memory_mb}MB"
            fi
        fi
        
        sleep 30
    done
}

# Main execution
main() {
    log "Starting Paperless Maverick Worker"
    log "Worker Type: $WORKER_TYPE"
    log "Worker ID: $WORKER_ID"
    log "Environment: $NODE_ENV"
    log "Log Level: $LOG_LEVEL"
    
    # Initialization steps
    validate_environment
    check_database
    check_ai_apis
    initialize_worker
    start_health_server
    start_worker
    
    success "Worker initialization completed successfully"
    
    # Monitor the worker process
    monitor_worker
}

# Run main function
main "$@"
