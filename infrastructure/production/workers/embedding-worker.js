#!/usr/bin/env node

/**
 * Production Embedding Queue Worker
 * Processes embedding generation requests from the queue system
 */

const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  workerId: process.env.WORKER_ID || `worker-${Math.random().toString(36).substr(2, 9)}`,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  queuePollInterval: parseInt(process.env.QUEUE_POLL_INTERVAL) || 5000,
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 3,
  healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT) || 8080,
  metricsPort: parseInt(process.env.METRICS_PORT) || 9091,
  logLevel: process.env.LOG_LEVEL || 'info',
  retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY) || 5000,
  batchSize: parseInt(process.env.BATCH_SIZE) || 10,
  maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60,
  maxTokensPerMinute: parseInt(process.env.MAX_TOKENS_PER_MINUTE) || 100000,
  backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER) || 1.5,
  maxBackoffMs: parseInt(process.env.MAX_BACKOFF_MS) || 30000
};

// Validate required configuration
if (!config.supabaseUrl || !config.supabaseServiceKey || !config.geminiApiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// Worker state
const workerState = {
  isRunning: false,
  isHealthy: true,
  currentJobs: 0,
  totalProcessed: 0,
  totalErrors: 0,
  lastHeartbeat: new Date(),
  startTime: new Date(),
  metrics: {
    requestsPerMinute: 0,
    tokensPerMinute: 0,
    averageProcessingTime: 0,
    successRate: 0
  }
};

// Rate limiting
const rateLimiter = {
  requests: [],
  tokens: [],
  
  canMakeRequest() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old entries
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    this.tokens = this.tokens.filter(entry => entry.time > oneMinuteAgo);
    
    const currentRequests = this.requests.length;
    const currentTokens = this.tokens.reduce((sum, entry) => sum + entry.count, 0);
    
    return currentRequests < config.maxRequestsPerMinute && 
           currentTokens < config.maxTokensPerMinute;
  },
  
  recordRequest(tokenCount = 0) {
    const now = Date.now();
    this.requests.push(now);
    if (tokenCount > 0) {
      this.tokens.push({ time: now, count: tokenCount });
    }
  }
};

// Logging utility
function log(level, message, data = {}) {
  if (config.logLevel === 'debug' || 
      (config.logLevel === 'info' && ['info', 'warn', 'error'].includes(level)) ||
      (config.logLevel === 'warn' && ['warn', 'error'].includes(level)) ||
      (config.logLevel === 'error' && level === 'error')) {
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      workerId: config.workerId,
      message,
      ...data
    };
    
    console.log(JSON.stringify(logEntry));
  }
}

// Health check server
function createHealthCheckServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    if (req.url === '/health') {
      const health = {
        status: workerState.isHealthy ? 'healthy' : 'unhealthy',
        workerId: config.workerId,
        uptime: Date.now() - workerState.startTime.getTime(),
        currentJobs: workerState.currentJobs,
        totalProcessed: workerState.totalProcessed,
        totalErrors: workerState.totalErrors,
        lastHeartbeat: workerState.lastHeartbeat.toISOString(),
        metrics: workerState.metrics
      };
      
      res.statusCode = workerState.isHealthy ? 200 : 503;
      res.end(JSON.stringify(health, null, 2));
      
    } else if (req.url === '/ready') {
      const ready = workerState.isRunning && workerState.currentJobs < config.maxConcurrentJobs;
      res.statusCode = ready ? 200 : 503;
      res.end(JSON.stringify({ 
        status: ready ? 'ready' : 'not-ready',
        workerId: config.workerId,
        currentJobs: workerState.currentJobs,
        maxJobs: config.maxConcurrentJobs
      }));
      
    } else if (req.url === '/metrics') {
      // Prometheus metrics format
      const metrics = [
        `# HELP embedding_worker_jobs_current Current number of jobs being processed`,
        `# TYPE embedding_worker_jobs_current gauge`,
        `embedding_worker_jobs_current{worker_id="${config.workerId}"} ${workerState.currentJobs}`,
        ``,
        `# HELP embedding_worker_jobs_total Total number of jobs processed`,
        `# TYPE embedding_worker_jobs_total counter`,
        `embedding_worker_jobs_total{worker_id="${config.workerId}"} ${workerState.totalProcessed}`,
        ``,
        `# HELP embedding_worker_errors_total Total number of errors`,
        `# TYPE embedding_worker_errors_total counter`,
        `embedding_worker_errors_total{worker_id="${config.workerId}"} ${workerState.totalErrors}`,
        ``,
        `# HELP embedding_worker_success_rate Success rate of job processing`,
        `# TYPE embedding_worker_success_rate gauge`,
        `embedding_worker_success_rate{worker_id="${config.workerId}"} ${workerState.metrics.successRate}`,
        ``
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/plain');
      res.end(metrics);
      
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
  
  server.listen(config.healthCheckPort, () => {
    log('info', `Health check server listening on port ${config.healthCheckPort}`);
  });
  
  return server;
}

// Main worker function
async function processEmbeddingQueue() {
  if (!workerState.isRunning) return;
  
  try {
    // Check rate limits
    if (!rateLimiter.canMakeRequest()) {
      log('debug', 'Rate limit reached, waiting...');
      return;
    }
    
    // Get jobs from queue
    const { data: jobs, error } = await supabase
      .from('embedding_queue_workers')
      .select('*')
      .eq('status', 'pending')
      .limit(config.batchSize)
      .order('created_at', { ascending: true });
    
    if (error) {
      log('error', 'Failed to fetch jobs from queue', { error: error.message });
      workerState.totalErrors++;
      return;
    }
    
    if (!jobs || jobs.length === 0) {
      log('debug', 'No jobs in queue');
      return;
    }
    
    log('info', `Processing ${jobs.length} jobs from queue`);
    
    // Process jobs concurrently
    const promises = jobs.slice(0, config.maxConcurrentJobs - workerState.currentJobs)
      .map(job => processJob(job));
    
    await Promise.allSettled(promises);
    
  } catch (error) {
    log('error', 'Error in queue processing', { error: error.message });
    workerState.totalErrors++;
    workerState.isHealthy = false;
    
    // Recover after a delay
    setTimeout(() => {
      workerState.isHealthy = true;
    }, 30000);
  }
}

// Process individual job
async function processJob(job) {
  const startTime = performance.now();
  workerState.currentJobs++;
  
  try {
    log('info', `Processing job ${job.id}`, { receiptId: job.receipt_id });
    
    // Mark job as processing
    await supabase
      .from('embedding_queue_workers')
      .update({ 
        status: 'processing', 
        worker_id: config.workerId,
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);
    
    // Simulate embedding generation (replace with actual implementation)
    await generateEmbedding(job);
    
    // Mark job as completed
    await supabase
      .from('embedding_queue_workers')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        processing_time_ms: Math.round(performance.now() - startTime)
      })
      .eq('id', job.id);
    
    workerState.totalProcessed++;
    rateLimiter.recordRequest(1000); // Estimate token usage
    
    log('info', `Job ${job.id} completed successfully`);
    
  } catch (error) {
    log('error', `Job ${job.id} failed`, { error: error.message });
    
    // Mark job as failed
    await supabase
      .from('embedding_queue_workers')
      .update({ 
        status: 'failed',
        error_message: error.message,
        failed_at: new Date().toISOString()
      })
      .eq('id', job.id);
    
    workerState.totalErrors++;
  } finally {
    workerState.currentJobs--;
    
    // Update metrics
    const processingTime = performance.now() - startTime;
    workerState.metrics.averageProcessingTime = 
      (workerState.metrics.averageProcessingTime + processingTime) / 2;
    
    workerState.metrics.successRate = 
      workerState.totalProcessed / (workerState.totalProcessed + workerState.totalErrors);
  }
}

// Placeholder for embedding generation
async function generateEmbedding(job) {
  // This would contain the actual embedding generation logic
  // For now, simulate processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
}

// Graceful shutdown
function gracefulShutdown() {
  log('info', 'Received shutdown signal, stopping worker...');
  workerState.isRunning = false;
  
  // Wait for current jobs to complete
  const checkJobs = setInterval(() => {
    if (workerState.currentJobs === 0) {
      clearInterval(checkJobs);
      log('info', 'Worker stopped gracefully');
      process.exit(0);
    }
  }, 1000);
  
  // Force exit after 30 seconds
  setTimeout(() => {
    log('warn', 'Force stopping worker');
    process.exit(1);
  }, 30000);
}

// Main execution
async function main() {
  log('info', `Starting embedding worker ${config.workerId}`);
  
  // Create health check server
  createHealthCheckServer();
  
  // Start worker
  workerState.isRunning = true;
  workerState.startTime = new Date();
  
  // Main processing loop
  const processLoop = setInterval(async () => {
    workerState.lastHeartbeat = new Date();
    await processEmbeddingQueue();
  }, config.queuePollInterval);
  
  // Handle shutdown signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  log('info', `Worker ${config.workerId} started successfully`);
}

// Start the worker
main().catch(error => {
  log('error', 'Failed to start worker', { error: error.message });
  process.exit(1);
});
