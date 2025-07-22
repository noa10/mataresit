#!/usr/bin/env node

/**
 * Health Check Script for Embedding Workers
 * Used by Docker health checks and Kubernetes probes
 */

const http = require('http');

const config = {
  healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT) || 8080,
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
  endpoint: process.env.HEALTH_CHECK_ENDPOINT || '/health'
};

function performHealthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: config.healthCheckPort,
      path: config.endpoint,
      method: 'GET',
      timeout: config.timeout
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const healthData = JSON.parse(data);
          
          if (res.statusCode === 200 && healthData.status === 'healthy') {
            console.log('✅ Health check passed');
            console.log(`Worker ID: ${healthData.workerId}`);
            console.log(`Uptime: ${Math.round(healthData.uptime / 1000)}s`);
            console.log(`Current Jobs: ${healthData.currentJobs}`);
            console.log(`Total Processed: ${healthData.totalProcessed}`);
            console.log(`Total Errors: ${healthData.totalErrors}`);
            console.log(`Success Rate: ${(healthData.metrics.successRate * 100).toFixed(2)}%`);
            resolve(0);
          } else {
            console.error('❌ Health check failed');
            console.error(`Status: ${healthData.status}`);
            console.error(`Response Code: ${res.statusCode}`);
            resolve(1);
          }
        } catch (error) {
          console.error('❌ Health check failed - Invalid JSON response');
          console.error(`Response: ${data}`);
          resolve(1);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Health check failed - Connection error');
      console.error(`Error: ${error.message}`);
      resolve(1);
    });

    req.on('timeout', () => {
      console.error('❌ Health check failed - Timeout');
      req.destroy();
      resolve(1);
    });

    req.end();
  });
}

// Readiness check
function performReadinessCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: config.healthCheckPort,
      path: '/ready',
      method: 'GET',
      timeout: config.timeout
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const readyData = JSON.parse(data);
          
          if (res.statusCode === 200 && readyData.status === 'ready') {
            console.log('✅ Readiness check passed');
            console.log(`Worker ID: ${readyData.workerId}`);
            console.log(`Current Jobs: ${readyData.currentJobs}/${readyData.maxJobs}`);
            resolve(0);
          } else {
            console.error('❌ Readiness check failed');
            console.error(`Status: ${readyData.status}`);
            console.error(`Response Code: ${res.statusCode}`);
            resolve(1);
          }
        } catch (error) {
          console.error('❌ Readiness check failed - Invalid JSON response');
          console.error(`Response: ${data}`);
          resolve(1);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Readiness check failed - Connection error');
      console.error(`Error: ${error.message}`);
      resolve(1);
    });

    req.on('timeout', () => {
      console.error('❌ Readiness check failed - Timeout');
      req.destroy();
      resolve(1);
    });

    req.end();
  });
}

// Main execution
async function main() {
  const checkType = process.argv[2] || 'health';
  
  let exitCode;
  
  switch (checkType) {
    case 'health':
      exitCode = await performHealthCheck();
      break;
    case 'ready':
      exitCode = await performReadinessCheck();
      break;
    default:
      console.error('❌ Invalid check type. Use "health" or "ready"');
      exitCode = 1;
  }
  
  process.exit(exitCode);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception in health check');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection in health check');
  console.error(reason);
  process.exit(1);
});

main();
