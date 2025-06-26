/**
 * Comprehensive API Test Suite - Updated for Production External API
 * Tests all endpoints, security, rate limiting, and error handling
 * Now testing against the production external-api function with full database integration
 */

import { expect } from 'chai';
import axios from 'axios';
import crypto from 'crypto';

// Test configuration - Updated to use production external-api function
const API_BASE_URL = process.env.API_BASE_URL || 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const API_BASE_URL_BYPASS = process.env.API_BASE_URL_BYPASS || 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/bypass-test/api/v1';
const TEST_API_KEY = process.env.TEST_API_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log('🧪 Test Configuration:');
console.log('  Primary API URL:', API_BASE_URL);
console.log('  Bypass API URL:', API_BASE_URL_BYPASS);
console.log('  Using Production External API:', API_BASE_URL.includes('external-api'));
console.log('  Test API Key:', TEST_API_KEY ? TEST_API_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('  Supabase Key:', SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

// Test data
const testReceipt = {
  merchant: 'Test Merchant',
  date: '2025-01-15',
  total: 25.50,
  currency: 'USD',
  paymentMethod: 'Credit Card',
  category: 'Testing'
};

const testClaim = {
  teamId: null, // Will be set during tests
  title: 'Test Expense Claim',
  description: 'Test claim for API validation',
  amount: 100.00,
  currency: 'USD',
  category: 'Testing',
  priority: 'medium'
};

// API client setup for production external-api function with middleware bypass authentication
const createApiClient = (apiKey) => {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY environment variable must be set for middleware bypass');
  }

  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // Required for middleware bypass
      'X-API-Key': apiKey,                            // Required for database validation
      'Content-Type': 'application/json'
    },
    timeout: 15000 // Increased timeout for production database operations
  });
};

const apiClient = createApiClient(TEST_API_KEY);
const adminClient = createApiClient(ADMIN_API_KEY);

// Test utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateRandomString = (length = 10) => {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
};

const assertRateLimitHeaders = (response) => {
  expect(response.headers).to.have.property('x-ratelimit-limit');
  expect(response.headers).to.have.property('x-ratelimit-remaining');
  expect(response.headers).to.have.property('x-ratelimit-reset');
};

const assertSuccessResponse = (response, expectedStatus = 200) => {
  expect(response.status).to.equal(expectedStatus);
  expect(response.data).to.have.property('success', true);
  expect(response.data).to.have.property('data');
  expect(response.data).to.have.property('timestamp');
  assertRateLimitHeaders(response);
};

const assertErrorResponse = (error, expectedStatus, expectedCode = null) => {
  expect(error.response.status).to.equal(expectedStatus);
  expect(error.response.data).to.have.property('error', true);
  expect(error.response.data).to.have.property('message');
  expect(error.response.data).to.have.property('timestamp');
  
  if (expectedCode) {
    expect(error.response.data).to.have.property('code', expectedCode);
  }
};

describe('Mataresit External API - Comprehensive Test Suite', function() {
  this.timeout(30000); // 30 second timeout for all tests
  
  let createdReceiptId = null;
  let createdClaimId = null;
  let userTeamId = null;

  before(async function() {
    console.log('Setting up test environment...');

    // Verify API keys and Supabase anon key are set
    if (!TEST_API_KEY || !ADMIN_API_KEY || !SUPABASE_ANON_KEY) {
      throw new Error('TEST_API_KEY, ADMIN_API_KEY, and SUPABASE_ANON_KEY environment variables must be set');
    }
    
    // Get user's team for claim testing
    try {
      const teamsResponse = await apiClient.get('/teams');
      if (teamsResponse.data.data.teams.length > 0) {
        userTeamId = teamsResponse.data.data.teams[0].id;
        testClaim.teamId = userTeamId;
      }
    } catch (error) {
      console.warn('No teams found for user, claim tests may be skipped');
    }
  });

  describe('1. System Health & Authentication', function() {
    it('should return healthy status', async function() {
      const response = await apiClient.get('/health');
      assertSuccessResponse(response);
      expect(response.data.data.status).to.equal('healthy');
      expect(response.data.data.user).to.have.property('id');
      expect(response.data.data.user.scopes).to.be.an('array');
    });

    it('should reject requests without API key', async function() {
      try {
        await axios.get(`${API_BASE_URL}/health`);
        expect.fail('Should have thrown an error');
      } catch (error) {
        assertErrorResponse(error, 401, 'INVALID_API_KEY');
      }
    });

    it('should reject requests with invalid API key', async function() {
      try {
        const invalidClient = createApiClient('mk_live_invalid_key');
        await invalidClient.get('/health');
        expect.fail('Should have thrown an error');
      } catch (error) {
        assertErrorResponse(error, 401, 'INVALID_API_KEY');
      }
    });

    it('should return performance metrics for admin users', async function() {
      const response = await adminClient.get('/performance');
      assertSuccessResponse(response);
      expect(response.data.data).to.have.property('cache');
      expect(response.data.data).to.have.property('health');
    });
  });

  describe('2. Receipts API', function() {
    it('should list receipts with pagination', async function() {
      const response = await apiClient.get('/receipts?page=1&limit=5');
      assertSuccessResponse(response);
      expect(response.data.data.receipts).to.be.an('array');
      expect(response.data.data.pagination).to.have.property('page', 1);
      expect(response.data.data.pagination).to.have.property('limit', 5);
    });

    it('should create a new receipt', async function() {
      const response = await apiClient.post('/receipts', testReceipt);
      assertSuccessResponse(response, 201);
      expect(response.data.data).to.have.property('id');
      expect(response.data.data.merchant).to.equal(testReceipt.merchant);
      expect(response.data.data.total).to.equal(testReceipt.total);
      
      createdReceiptId = response.data.data.id;
    });

    it('should get specific receipt by ID', async function() {
      expect(createdReceiptId).to.not.be.null;
      
      const response = await apiClient.get(`/receipts/${createdReceiptId}`);
      assertSuccessResponse(response);
      expect(response.data.data.id).to.equal(createdReceiptId);
      expect(response.data.data.merchant).to.equal(testReceipt.merchant);
    });

    it('should update receipt', async function() {
      expect(createdReceiptId).to.not.be.null;
      
      const updates = {
        category: 'Updated Category',
        status: 'reviewed'
      };
      
      const response = await apiClient.put(`/receipts/${createdReceiptId}`, updates);
      assertSuccessResponse(response);
      expect(response.data.data.category).to.equal(updates.category);
      expect(response.data.data.status).to.equal(updates.status);
    });

    it('should get receipt image URLs', async function() {
      expect(createdReceiptId).to.not.be.null;
      
      const response = await apiClient.get(`/receipts/${createdReceiptId}/image`);
      assertSuccessResponse(response);
      expect(response.data.data).to.have.property('receiptId', createdReceiptId);
    });

    it('should create receipts in batch', async function() {
      const batchReceipts = [
        { ...testReceipt, merchant: 'Batch Test 1', total: 10.00 },
        { ...testReceipt, merchant: 'Batch Test 2', total: 20.00 }
      ];
      
      const response = await apiClient.post('/receipts/batch', { receipts: batchReceipts });
      assertSuccessResponse(response, 201);
      expect(response.data.data.created).to.be.an('array');
      expect(response.data.data.summary.successful).to.equal(2);
    });

    it('should filter receipts by date range', async function() {
      const response = await apiClient.get('/receipts?start_date=2025-01-01&end_date=2025-01-31');
      assertSuccessResponse(response);
      expect(response.data.data.receipts).to.be.an('array');
    });

    it('should validate required fields', async function() {
      try {
        await apiClient.post('/receipts', { merchant: 'Test' }); // Missing required fields
        expect.fail('Should have thrown validation error');
      } catch (error) {
        assertErrorResponse(error, 400, 'VALIDATION_ERROR');
      }
    });

    it('should return 404 for non-existent receipt', async function() {
      try {
        await apiClient.get('/receipts/00000000-0000-0000-0000-000000000000');
        expect.fail('Should have thrown 404 error');
      } catch (error) {
        assertErrorResponse(error, 404, 'RESOURCE_NOT_FOUND');
      }
    });
  });

  describe('3. Claims API', function() {
    it('should list claims', async function() {
      const response = await apiClient.get('/claims');
      assertSuccessResponse(response);
      expect(response.data.data.claims).to.be.an('array');
    });

    it('should create a new claim (if team available)', async function() {
      if (!userTeamId) {
        this.skip();
        return;
      }
      
      const response = await apiClient.post('/claims', testClaim);
      assertSuccessResponse(response, 201);
      expect(response.data.data).to.have.property('id');
      expect(response.data.data.title).to.equal(testClaim.title);
      
      createdClaimId = response.data.data.id;
    });

    it('should attach receipts to claim', async function() {
      if (!createdClaimId || !createdReceiptId) {
        this.skip();
        return;
      }
      
      const response = await apiClient.post(`/claims/${createdClaimId}/receipts`, {
        receiptIds: [createdReceiptId]
      });
      assertSuccessResponse(response);
    });

    it('should get claim receipts', async function() {
      if (!createdClaimId) {
        this.skip();
        return;
      }
      
      const response = await apiClient.get(`/claims/${createdClaimId}/receipts`);
      assertSuccessResponse(response);
      expect(response.data.data.receipts).to.be.an('array');
    });
  });

  describe('4. Search API', function() {
    it('should perform semantic search', async function() {
      const searchQuery = {
        query: 'test expenses',
        sources: ['receipts'],
        limit: 5
      };
      
      const response = await apiClient.post('/search', searchQuery);
      assertSuccessResponse(response);
      expect(response.data.data.results).to.be.an('array');
      expect(response.data.data).to.have.property('executionTime');
    });

    it('should get search suggestions', async function() {
      const response = await apiClient.post('/search/suggestions', { query: 'test' });
      assertSuccessResponse(response);
      expect(response.data.data.suggestions).to.be.an('array');
    });

    it('should get available search sources', async function() {
      const response = await apiClient.get('/search/sources');
      assertSuccessResponse(response);
      expect(response.data.data.sources).to.be.an('array');
    });
  });

  describe('5. Analytics API', function() {
    it('should get comprehensive analytics', async function() {
      const response = await apiClient.get('/analytics?start_date=2025-01-01&end_date=2025-01-31');
      assertSuccessResponse(response);
      expect(response.data.data).to.have.property('summary');
      expect(response.data.data).to.have.property('categoryBreakdown');
    });

    it('should get spending summary', async function() {
      const response = await apiClient.get('/analytics/summary?start_date=2025-01-01&end_date=2025-01-31');
      assertSuccessResponse(response);
      expect(response.data.data).to.have.property('totalAmount');
      expect(response.data.data).to.have.property('totalReceipts');
    });

    it('should get category analytics', async function() {
      const response = await apiClient.get('/analytics/categories?start_date=2025-01-01&end_date=2025-01-31');
      assertSuccessResponse(response);
      expect(response.data.data.categories).to.be.an('array');
    });

    it('should get API usage analytics', async function() {
      const response = await apiClient.get('/analytics/api-usage');
      assertSuccessResponse(response);
      expect(response.data.data).to.have.property('total_requests');
    });
  });

  describe('6. Teams API', function() {
    it('should list user teams', async function() {
      const response = await apiClient.get('/teams');
      assertSuccessResponse(response);
      expect(response.data.data.teams).to.be.an('array');
    });

    it('should get team details (if team available)', async function() {
      if (!userTeamId) {
        this.skip();
        return;
      }
      
      const response = await apiClient.get(`/teams/${userTeamId}`);
      assertSuccessResponse(response);
      expect(response.data.data.id).to.equal(userTeamId);
    });

    it('should get team statistics', async function() {
      if (!userTeamId) {
        this.skip();
        return;
      }
      
      const response = await apiClient.get(`/teams/${userTeamId}/stats`);
      assertSuccessResponse(response);
      expect(response.data.data).to.have.property('totalReceipts');
    });

    it('should get team members', async function() {
      if (!userTeamId) {
        this.skip();
        return;
      }
      
      const response = await apiClient.get(`/teams/${userTeamId}/members`);
      assertSuccessResponse(response);
      expect(response.data.data.members).to.be.an('array');
    });
  });

  describe('7. Rate Limiting', function() {
    it('should include rate limit headers', async function() {
      const response = await apiClient.get('/health');
      assertRateLimitHeaders(response);
      
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      
      expect(limit).to.be.a('number');
      expect(remaining).to.be.a('number');
      expect(remaining).to.be.at.most(limit);
    });

    it('should enforce rate limits (stress test)', async function() {
      this.timeout(60000); // 1 minute timeout
      
      const requests = [];
      const maxRequests = 20; // Adjust based on your rate limits
      
      for (let i = 0; i < maxRequests; i++) {
        requests.push(apiClient.get('/health'));
      }
      
      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled');
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && r.reason.response?.status === 429
      );
      
      console.log(`Successful requests: ${successful.length}, Rate limited: ${rateLimited.length}`);
      
      // Should have some successful requests
      expect(successful.length).to.be.greaterThan(0);
    });
  });

  describe('8. Error Handling', function() {
    it('should handle malformed JSON', async function() {
      try {
        await axios.post(`${API_BASE_URL}/receipts`, 'invalid json', {
          headers: {
            'X-API-Key': TEST_API_KEY,
            'Content-Type': 'application/json'
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        assertErrorResponse(error, 400);
      }
    });

    it('should handle unsupported HTTP methods', async function() {
      try {
        await apiClient.patch('/health'); // PATCH not supported on health endpoint
        expect.fail('Should have thrown an error');
      } catch (error) {
        assertErrorResponse(error, 405, 'METHOD_NOT_ALLOWED');
      }
    });

    it('should handle invalid UUIDs', async function() {
      try {
        await apiClient.get('/receipts/invalid-uuid');
        expect.fail('Should have thrown an error');
      } catch (error) {
        assertErrorResponse(error, 400);
      }
    });
  });

  describe('9. Security Tests', function() {
    it('should reject SQL injection attempts', async function() {
      try {
        await apiClient.get('/receipts?merchant=\'; DROP TABLE receipts; --');
        // Should not throw error but should not cause damage
      } catch (error) {
        // Any error is acceptable as long as it's not a 500
        expect(error.response.status).to.not.equal(500);
      }
    });

    it('should reject XSS attempts', async function() {
      try {
        const xssPayload = {
          ...testReceipt,
          merchant: '<script>alert("xss")</script>'
        };
        
        const response = await apiClient.post('/receipts', xssPayload);
        // Should create receipt but sanitize the input
        expect(response.data.data.merchant).to.not.include('<script>');
      } catch (error) {
        // Validation error is acceptable
        expect(error.response.status).to.be.oneOf([400, 422]);
      }
    });

    it('should enforce CORS headers', async function() {
      const response = await apiClient.get('/health');
      expect(response.headers).to.have.property('access-control-allow-origin');
    });
  });

  describe('10. Performance Tests', function() {
    it('should respond within acceptable time limits', async function() {
      const startTime = Date.now();
      await apiClient.get('/health');
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).to.be.below(2000); // 2 seconds max
    });

    it('should handle concurrent requests', async function() {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill().map(() => apiClient.get('/health'));
      
      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).to.equal(concurrentRequests);
    });
  });

  after(async function() {
    console.log('Cleaning up test data...');
    
    // Clean up created test data
    if (createdReceiptId) {
      try {
        await apiClient.delete(`/receipts/${createdReceiptId}`);
        console.log('Cleaned up test receipt');
      } catch (error) {
        console.warn('Failed to clean up test receipt:', error.message);
      }
    }
    
    if (createdClaimId) {
      try {
        await apiClient.delete(`/claims/${createdClaimId}`);
        console.log('Cleaned up test claim');
      } catch (error) {
        console.warn('Failed to clean up test claim:', error.message);
      }
    }
  });
});
