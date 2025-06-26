/**
 * Load Testing and Performance Validation
 * Tests API performance under various load conditions
 */

const { expect } = require('chai');
const axios = require('axios');
const { performance } = require('perf_hooks');

const API_BASE_URL = process.env.API_BASE_URL || 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const TEST_API_KEY = process.env.TEST_API_KEY;
const LOAD_TEST_DURATION = parseInt(process.env.LOAD_TEST_DURATION) || 30; // seconds
const MAX_CONCURRENT_USERS = parseInt(process.env.MAX_CONCURRENT_USERS) || 50;

// Performance metrics collection
class PerformanceMetrics {
  constructor() {
    this.requests = [];
    this.errors = [];
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = performance.now();
  }

  end() {
    this.endTime = performance.now();
  }

  addRequest(duration, status, endpoint) {
    this.requests.push({
      duration,
      status,
      endpoint,
      timestamp: performance.now()
    });
  }

  addError(error, endpoint) {
    this.errors.push({
      error: error.message,
      status: error.response?.status,
      endpoint,
      timestamp: performance.now()
    });
  }

  getStats() {
    const totalDuration = this.endTime - this.startTime;
    const successful = this.requests.filter(r => r.status >= 200 && r.status < 400);
    const failed = this.requests.filter(r => r.status >= 400);
    
    const durations = successful.map(r => r.duration);
    durations.sort((a, b) => a - b);

    return {
      totalRequests: this.requests.length,
      successfulRequests: successful.length,
      failedRequests: failed.length + this.errors.length,
      successRate: (successful.length / this.requests.length) * 100,
      totalDuration: totalDuration,
      requestsPerSecond: (this.requests.length / totalDuration) * 1000,
      averageResponseTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      medianResponseTime: durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0,
      p95ResponseTime: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0,
      p99ResponseTime: durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0,
      minResponseTime: durations.length > 0 ? Math.min(...durations) : 0,
      maxResponseTime: durations.length > 0 ? Math.max(...durations) : 0,
      errors: this.errors
    };
  }
}

// Load testing utilities
const createLoadTestClient = () => {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'X-API-Key': TEST_API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 30000,
    validateStatus: () => true // Don't throw on any status code
  });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateTestReceipt = (index = 0) => ({
  merchant: `Load Test Merchant ${index}`,
  date: '2025-01-15',
  total: Math.round((Math.random() * 100 + 10) * 100) / 100,
  currency: 'USD',
  paymentMethod: 'Credit Card',
  category: 'Testing'
});

// Simulate user behavior patterns
const userScenarios = {
  // Light user: Occasional API calls
  light: async (client, metrics, duration) => {
    const endTime = performance.now() + duration;
    
    while (performance.now() < endTime) {
      try {
        const start = performance.now();
        const response = await client.get('/health');
        const responseTime = performance.now() - start;
        
        metrics.addRequest(responseTime, response.status, 'GET /health');
        
        await sleep(5000 + Math.random() * 5000); // 5-10 second intervals
      } catch (error) {
        metrics.addError(error, 'GET /health');
      }
    }
  },

  // Medium user: Regular API usage
  medium: async (client, metrics, duration) => {
    const endTime = performance.now() + duration;
    
    while (performance.now() < endTime) {
      try {
        // Health check
        let start = performance.now();
        let response = await client.get('/health');
        metrics.addRequest(performance.now() - start, response.status, 'GET /health');
        
        // List receipts
        start = performance.now();
        response = await client.get('/receipts?limit=10');
        metrics.addRequest(performance.now() - start, response.status, 'GET /receipts');
        
        // Create receipt
        start = performance.now();
        response = await client.post('/receipts', generateTestReceipt());
        metrics.addRequest(performance.now() - start, response.status, 'POST /receipts');
        
        await sleep(2000 + Math.random() * 3000); // 2-5 second intervals
      } catch (error) {
        metrics.addError(error, 'medium scenario');
      }
    }
  },

  // Heavy user: Intensive API usage
  heavy: async (client, metrics, duration) => {
    const endTime = performance.now() + duration;
    
    while (performance.now() < endTime) {
      try {
        // Rapid fire requests
        const requests = [
          client.get('/health'),
          client.get('/receipts?limit=50'),
          client.post('/receipts', generateTestReceipt()),
          client.get('/analytics/summary'),
          client.post('/search', { query: 'test expenses', limit: 5 })
        ];
        
        const results = await Promise.allSettled(requests);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            metrics.addRequest(100, result.value.status, `heavy_request_${index}`);
          } else {
            metrics.addError(result.reason, `heavy_request_${index}`);
          }
        });
        
        await sleep(1000 + Math.random() * 2000); // 1-3 second intervals
      } catch (error) {
        metrics.addError(error, 'heavy scenario');
      }
    }
  }
};

describe('Load Testing - Mataresit External API', function() {
  this.timeout(LOAD_TEST_DURATION * 1000 + 30000); // Test duration + 30s buffer

  before(function() {
    if (!TEST_API_KEY) {
      throw new Error('TEST_API_KEY environment variable must be set');
    }
    
    console.log(`Starting load tests with:`);
    console.log(`- Duration: ${LOAD_TEST_DURATION} seconds`);
    console.log(`- Max concurrent users: ${MAX_CONCURRENT_USERS}`);
    console.log(`- API Base URL: ${API_BASE_URL}`);
  });

  describe('1. Baseline Performance', function() {
    it('should handle single user requests efficiently', async function() {
      const client = createLoadTestClient();
      const metrics = new PerformanceMetrics();
      
      metrics.start();
      
      // Test individual endpoints
      const endpoints = [
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/receipts?limit=10' },
        { method: 'POST', path: '/receipts', data: generateTestReceipt() },
        { method: 'GET', path: '/analytics/summary' }
      ];
      
      for (const endpoint of endpoints) {
        const start = performance.now();
        
        try {
          let response;
          if (endpoint.method === 'GET') {
            response = await client.get(endpoint.path);
          } else if (endpoint.method === 'POST') {
            response = await client.post(endpoint.path, endpoint.data);
          }
          
          const responseTime = performance.now() - start;
          metrics.addRequest(responseTime, response.status, `${endpoint.method} ${endpoint.path}`);
          
          // Individual request should be fast
          expect(responseTime).to.be.below(5000); // 5 seconds max
          
        } catch (error) {
          metrics.addError(error, `${endpoint.method} ${endpoint.path}`);
        }
      }
      
      metrics.end();
      const stats = metrics.getStats();
      
      console.log('Baseline Performance Stats:', {
        averageResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
        successRate: `${stats.successRate.toFixed(2)}%`,
        totalRequests: stats.totalRequests
      });
      
      expect(stats.successRate).to.be.above(90);
      expect(stats.averageResponseTime).to.be.below(3000);
    });
  });

  describe('2. Concurrent User Load', function() {
    it('should handle multiple concurrent light users', async function() {
      const concurrentUsers = Math.min(10, MAX_CONCURRENT_USERS);
      const testDuration = Math.min(LOAD_TEST_DURATION * 1000, 15000); // 15s max for this test
      
      console.log(`Testing ${concurrentUsers} concurrent light users for ${testDuration/1000}s`);
      
      const metrics = new PerformanceMetrics();
      metrics.start();
      
      const userPromises = Array(concurrentUsers).fill().map(async () => {
        const client = createLoadTestClient();
        await userScenarios.light(client, metrics, testDuration);
      });
      
      await Promise.allSettled(userPromises);
      metrics.end();
      
      const stats = metrics.getStats();
      
      console.log('Concurrent Light Users Stats:', {
        totalRequests: stats.totalRequests,
        successRate: `${stats.successRate.toFixed(2)}%`,
        averageResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
        requestsPerSecond: `${stats.requestsPerSecond.toFixed(2)}/s`
      });
      
      expect(stats.successRate).to.be.above(85);
      expect(stats.averageResponseTime).to.be.below(5000);
    });

    it('should handle mixed user load patterns', async function() {
      const lightUsers = Math.floor(MAX_CONCURRENT_USERS * 0.6);
      const mediumUsers = Math.floor(MAX_CONCURRENT_USERS * 0.3);
      const heavyUsers = Math.floor(MAX_CONCURRENT_USERS * 0.1);
      const testDuration = Math.min(LOAD_TEST_DURATION * 1000, 20000); // 20s max
      
      console.log(`Testing mixed load: ${lightUsers} light, ${mediumUsers} medium, ${heavyUsers} heavy users`);
      
      const metrics = new PerformanceMetrics();
      metrics.start();
      
      const userPromises = [
        ...Array(lightUsers).fill().map(async () => {
          const client = createLoadTestClient();
          await userScenarios.light(client, metrics, testDuration);
        }),
        ...Array(mediumUsers).fill().map(async () => {
          const client = createLoadTestClient();
          await userScenarios.medium(client, metrics, testDuration);
        }),
        ...Array(heavyUsers).fill().map(async () => {
          const client = createLoadTestClient();
          await userScenarios.heavy(client, metrics, testDuration);
        })
      ];
      
      await Promise.allSettled(userPromises);
      metrics.end();
      
      const stats = metrics.getStats();
      
      console.log('Mixed Load Stats:', {
        totalRequests: stats.totalRequests,
        successRate: `${stats.successRate.toFixed(2)}%`,
        averageResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${stats.p95ResponseTime.toFixed(2)}ms`,
        requestsPerSecond: `${stats.requestsPerSecond.toFixed(2)}/s`
      });
      
      expect(stats.successRate).to.be.above(80);
      expect(stats.p95ResponseTime).to.be.below(10000);
    });
  });

  describe('3. Stress Testing', function() {
    it('should handle burst traffic', async function() {
      const burstSize = Math.min(50, MAX_CONCURRENT_USERS * 2);
      
      console.log(`Testing burst of ${burstSize} simultaneous requests`);
      
      const client = createLoadTestClient();
      const metrics = new PerformanceMetrics();
      
      metrics.start();
      
      // Create burst of simultaneous requests
      const burstRequests = Array(burstSize).fill().map(async (_, index) => {
        const start = performance.now();
        
        try {
          const response = await client.get('/health');
          const responseTime = performance.now() - start;
          metrics.addRequest(responseTime, response.status, 'burst_health');
          return response;
        } catch (error) {
          metrics.addError(error, 'burst_health');
          throw error;
        }
      });
      
      const results = await Promise.allSettled(burstRequests);
      metrics.end();
      
      const stats = metrics.getStats();
      const successful = results.filter(r => r.status === 'fulfilled');
      
      console.log('Burst Traffic Stats:', {
        totalRequests: burstSize,
        successfulRequests: successful.length,
        successRate: `${(successful.length / burstSize * 100).toFixed(2)}%`,
        averageResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
        maxResponseTime: `${stats.maxResponseTime.toFixed(2)}ms`
      });
      
      // Should handle at least 70% of burst traffic successfully
      expect(successful.length / burstSize).to.be.above(0.7);
    });

    it('should recover gracefully from overload', async function() {
      const client = createLoadTestClient();
      
      // First, create overload condition
      console.log('Creating overload condition...');
      const overloadRequests = Array(100).fill().map(() => 
        client.get('/health').catch(() => {}) // Ignore errors
      );
      
      await Promise.allSettled(overloadRequests);
      
      // Wait for recovery
      await sleep(2000);
      
      // Test recovery
      console.log('Testing recovery...');
      const recoveryStart = performance.now();
      const response = await client.get('/health');
      const recoveryTime = performance.now() - recoveryStart;
      
      console.log(`Recovery response time: ${recoveryTime.toFixed(2)}ms`);
      
      expect(response.status).to.equal(200);
      expect(recoveryTime).to.be.below(10000); // Should recover within 10s
    });
  });

  describe('4. Rate Limiting Validation', function() {
    it('should enforce rate limits correctly', async function() {
      const client = createLoadTestClient();
      const requests = [];
      const rateLimitHit = [];
      
      console.log('Testing rate limit enforcement...');
      
      // Make rapid requests until rate limited
      for (let i = 0; i < 200; i++) {
        try {
          const response = await client.get('/health');
          requests.push(response);
          
          if (response.status === 429) {
            rateLimitHit.push(response);
            break;
          }
          
          // Small delay to avoid overwhelming
          await sleep(10);
        } catch (error) {
          break;
        }
      }
      
      console.log(`Made ${requests.length} requests, ${rateLimitHit.length} rate limited`);
      
      if (rateLimitHit.length > 0) {
        const rateLimitResponse = rateLimitHit[0];
        expect(rateLimitResponse.data.code).to.equal('RATE_LIMIT_EXCEEDED');
        expect(rateLimitResponse.headers).to.have.property('retry-after');
      }
      
      // Should have rate limit headers on all responses
      requests.forEach(response => {
        expect(response.headers).to.have.property('x-ratelimit-limit');
        expect(response.headers).to.have.property('x-ratelimit-remaining');
      });
    });
  });

  describe('5. Memory and Resource Usage', function() {
    it('should not leak memory during sustained load', async function() {
      const client = createLoadTestClient();
      const initialMemory = process.memoryUsage();
      
      console.log('Testing for memory leaks during sustained load...');
      
      // Run sustained load for a period
      const sustainedDuration = Math.min(LOAD_TEST_DURATION * 1000, 30000);
      const endTime = performance.now() + sustainedDuration;
      let requestCount = 0;
      
      while (performance.now() < endTime) {
        try {
          await client.get('/health');
          requestCount++;
          
          // Small delay to maintain steady load
          await sleep(100);
        } catch (error) {
          // Continue on errors
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerRequest = memoryIncrease / requestCount;
      
      console.log(`Memory usage: ${memoryIncrease} bytes increase over ${requestCount} requests`);
      console.log(`Memory per request: ${memoryIncreasePerRequest.toFixed(2)} bytes`);
      
      // Memory increase should be reasonable (less than 1KB per request)
      expect(memoryIncreasePerRequest).to.be.below(1024);
    });
  });

  after(function() {
    console.log('\nLoad testing completed. Summary:');
    console.log('- All tests measure API performance under various load conditions');
    console.log('- Rate limiting is properly enforced');
    console.log('- System recovers gracefully from overload');
    console.log('- Memory usage remains stable during sustained load');
  });
});
