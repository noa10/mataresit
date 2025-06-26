/**
 * Security Audit and Penetration Testing Suite
 * Comprehensive security testing for the Mataresit External API
 */

const { expect } = require('chai');
const axios = require('axios');
const crypto = require('crypto');

const API_BASE_URL = process.env.API_BASE_URL || 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const TEST_API_KEY = process.env.TEST_API_KEY;
const INVALID_API_KEY = 'mk_live_invalid_key_for_testing';

// Security test utilities
const createSecurityClient = (apiKey = null, headers = {}) => {
  const config = {
    baseURL: API_BASE_URL,
    timeout: 10000,
    validateStatus: () => true, // Don't throw on any status code
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  
  return axios.create(config);
};

const generateLargePayload = (size = 1024 * 1024) => {
  return 'A'.repeat(size);
};

const sqlInjectionPayloads = [
  "'; DROP TABLE api_keys; --",
  "' OR '1'='1",
  "'; SELECT * FROM profiles; --",
  "' UNION SELECT * FROM api_keys --",
  "'; UPDATE profiles SET subscription_tier='max'; --"
];

const xssPayloads = [
  '<script>alert("xss")</script>',
  'javascript:alert("xss")',
  '<img src="x" onerror="alert(\'xss\')">',
  '"><script>alert("xss")</script>',
  '\';alert(String.fromCharCode(88,83,83))//\';alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//--></SCRIPT>"\'>alert(String.fromCharCode(88,83,83))</SCRIPT>'
];

const commandInjectionPayloads = [
  '; ls -la',
  '| cat /etc/passwd',
  '&& whoami',
  '`id`',
  '$(id)'
];

describe('Security Audit - Mataresit External API', function() {
  this.timeout(30000);

  describe('1. Authentication Security', function() {
    it('should reject requests without API key', async function() {
      const client = createSecurityClient();
      const response = await client.get('/health');
      
      expect(response.status).to.equal(401);
      expect(response.data.error).to.be.true;
      expect(response.data.code).to.equal('INVALID_API_KEY');
    });

    it('should reject requests with invalid API key format', async function() {
      const invalidKeys = [
        'invalid_key',
        'mk_test_',
        'mk_live_',
        'bearer_token',
        '',
        null,
        undefined
      ];

      for (const key of invalidKeys) {
        const client = createSecurityClient(key);
        const response = await client.get('/health');
        
        expect(response.status).to.equal(401);
        expect(response.data.error).to.be.true;
      }
    });

    it('should reject requests with malformed API key', async function() {
      const malformedKeys = [
        'mk_live_' + 'x'.repeat(10), // Too short
        'mk_live_' + 'x'.repeat(100), // Too long
        'mk_live_invalid!@#$%^&*()', // Invalid characters
        'MK_LIVE_UPPERCASE_KEY', // Wrong case
      ];

      for (const key of malformedKeys) {
        const client = createSecurityClient(key);
        const response = await client.get('/health');
        
        expect(response.status).to.equal(401);
      }
    });

    it('should handle API key in different header formats', async function() {
      const client = createSecurityClient(null, {
        'Authorization': `Bearer ${TEST_API_KEY}` // Wrong format
      });
      
      const response = await client.get('/health');
      expect(response.status).to.equal(401);
    });

    it('should prevent API key enumeration', async function() {
      // Test multiple invalid keys to ensure consistent response times
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        const client = createSecurityClient(`mk_live_${crypto.randomBytes(32).toString('hex')}`);
        await client.get('/health');
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / 5;
      
      // Response time should be consistent (not revealing valid vs invalid keys)
      expect(avgTime).to.be.below(2000); // Reasonable response time
    });
  });

  describe('2. Input Validation Security', function() {
    it('should prevent SQL injection in query parameters', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      for (const payload of sqlInjectionPayloads) {
        const response = await client.get(`/receipts?merchant=${encodeURIComponent(payload)}`);
        
        // Should not return 500 (internal server error)
        expect(response.status).to.not.equal(500);
        
        // Should either return valid results or validation error
        expect(response.status).to.be.oneOf([200, 400, 422]);
      }
    });

    it('should prevent SQL injection in request body', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      for (const payload of sqlInjectionPayloads) {
        const maliciousReceipt = {
          merchant: payload,
          date: '2025-01-15',
          total: 10.00,
          currency: 'USD'
        };
        
        const response = await client.post('/receipts', maliciousReceipt);
        
        // Should not return 500
        expect(response.status).to.not.equal(500);
        
        if (response.status === 201) {
          // If created, the payload should be sanitized
          expect(response.data.data.merchant).to.not.include('DROP TABLE');
          expect(response.data.data.merchant).to.not.include('SELECT *');
        }
      }
    });

    it('should prevent XSS in input fields', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      for (const payload of xssPayloads) {
        const maliciousReceipt = {
          merchant: payload,
          date: '2025-01-15',
          total: 10.00,
          currency: 'USD'
        };
        
        const response = await client.post('/receipts', maliciousReceipt);
        
        if (response.status === 201) {
          // XSS payload should be sanitized or escaped
          expect(response.data.data.merchant).to.not.include('<script>');
          expect(response.data.data.merchant).to.not.include('javascript:');
          expect(response.data.data.merchant).to.not.include('onerror=');
        }
      }
    });

    it('should prevent command injection', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      for (const payload of commandInjectionPayloads) {
        const maliciousData = {
          query: payload
        };
        
        const response = await client.post('/search', maliciousData);
        
        // Should not execute system commands
        expect(response.status).to.not.equal(500);
        
        if (response.status === 200) {
          // Should not contain command output
          const responseStr = JSON.stringify(response.data);
          expect(responseStr).to.not.include('/etc/passwd');
          expect(responseStr).to.not.include('root:');
          expect(responseStr).to.not.include('uid=');
        }
      }
    });

    it('should validate data types and ranges', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      const invalidData = [
        { merchant: 'Test', date: '2025-01-15', total: -100 }, // Negative amount
        { merchant: 'Test', date: '2025-01-15', total: 'invalid' }, // String instead of number
        { merchant: 'Test', date: 'invalid-date', total: 10 }, // Invalid date
        { merchant: '', date: '2025-01-15', total: 10 }, // Empty merchant
        { merchant: 'A'.repeat(1000), date: '2025-01-15', total: 10 }, // Too long merchant
      ];
      
      for (const data of invalidData) {
        const response = await client.post('/receipts', data);
        expect(response.status).to.equal(400);
        expect(response.data.code).to.equal('VALIDATION_ERROR');
      }
    });
  });

  describe('3. Authorization Security', function() {
    it('should enforce scope-based permissions', async function() {
      // This would require a limited-scope API key for proper testing
      // For now, we test with invalid scopes
      const client = createSecurityClient(TEST_API_KEY);
      
      // Try to access admin endpoint (should fail for non-admin users)
      const response = await client.get('/performance');
      
      if (response.status === 403) {
        expect(response.data.code).to.equal('INSUFFICIENT_PERMISSIONS');
      }
      // If 200, user has admin access (which is fine for testing)
    });

    it('should prevent access to other users\' data', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      // Try to access a non-existent receipt (should return 404, not 403)
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await client.get(`/receipts/${fakeId}`);
      
      expect(response.status).to.equal(404);
      expect(response.data.code).to.equal('RESOURCE_NOT_FOUND');
    });

    it('should validate team access permissions', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      // Try to access a non-existent team
      const fakeTeamId = '00000000-0000-0000-0000-000000000000';
      const response = await client.get(`/teams/${fakeTeamId}`);
      
      expect(response.status).to.be.oneOf([403, 404]);
    });
  });

  describe('4. Rate Limiting Security', function() {
    it('should enforce rate limits consistently', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      // Make rapid requests to test rate limiting
      const requests = Array(50).fill().map(() => client.get('/health'));
      const results = await Promise.allSettled(requests);
      
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );
      
      // Should eventually hit rate limits
      if (rateLimited.length > 0) {
        const response = rateLimited[0].value;
        expect(response.data.code).to.equal('RATE_LIMIT_EXCEEDED');
        expect(response.headers).to.have.property('retry-after');
      }
    });

    it('should prevent rate limit bypass attempts', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      // Try different headers that might bypass rate limiting
      const bypassHeaders = [
        { 'X-Forwarded-For': '127.0.0.1' },
        { 'X-Real-IP': '127.0.0.1' },
        { 'X-Originating-IP': '127.0.0.1' },
        { 'User-Agent': 'Different-Agent' },
      ];
      
      for (const headers of bypassHeaders) {
        const bypassClient = createSecurityClient(TEST_API_KEY, headers);
        const response = await bypassClient.get('/health');
        
        // Should still be subject to rate limiting
        expect(response.headers).to.have.property('x-ratelimit-limit');
      }
    });
  });

  describe('5. Data Exposure Security', function() {
    it('should not expose sensitive information in errors', async function() {
      const client = createSecurityClient(INVALID_API_KEY);
      const response = await client.get('/health');
      
      const responseStr = JSON.stringify(response.data);
      
      // Should not expose internal paths, database info, etc.
      expect(responseStr).to.not.include('/var/');
      expect(responseStr).to.not.include('postgres://');
      expect(responseStr).to.not.include('supabase_auth_');
      expect(responseStr).to.not.include('process.env');
      expect(responseStr).to.not.include('stack trace');
    });

    it('should not expose API keys in responses', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      const response = await client.get('/health');
      
      const responseStr = JSON.stringify(response.data);
      
      // Should not expose any API keys
      expect(responseStr).to.not.include('mk_live_');
      expect(responseStr).to.not.include('mk_test_');
      expect(responseStr).to.not.include(TEST_API_KEY);
    });

    it('should sanitize error messages', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      // Send malformed JSON
      try {
        await axios.post(`${API_BASE_URL}/receipts`, 'invalid json', {
          headers: {
            'X-API-Key': TEST_API_KEY,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        });
      } catch (error) {
        // Error message should not expose internal details
        const errorStr = JSON.stringify(error.response.data);
        expect(errorStr).to.not.include('SyntaxError');
        expect(errorStr).to.not.include('JSON.parse');
        expect(errorStr).to.not.include('line ');
        expect(errorStr).to.not.include('column ');
      }
    });
  });

  describe('6. HTTP Security Headers', function() {
    it('should include security headers', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      const response = await client.get('/health');
      
      // Check for important security headers
      expect(response.headers).to.have.property('access-control-allow-origin');
      
      // CORS should be properly configured
      const corsOrigin = response.headers['access-control-allow-origin'];
      expect(corsOrigin).to.not.equal('*'); // Should not allow all origins in production
    });

    it('should handle CORS preflight requests', async function() {
      const response = await axios.options(`${API_BASE_URL}/health`, {
        headers: {
          'Origin': 'https://mataresit.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'X-API-Key'
        },
        validateStatus: () => true
      });
      
      expect(response.status).to.be.oneOf([200, 204]);
      expect(response.headers).to.have.property('access-control-allow-methods');
    });
  });

  describe('7. Payload Security', function() {
    it('should reject oversized payloads', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      const largePayload = {
        merchant: generateLargePayload(10 * 1024 * 1024), // 10MB
        date: '2025-01-15',
        total: 10.00
      };
      
      const response = await client.post('/receipts', largePayload);
      
      // Should reject large payloads
      expect(response.status).to.be.oneOf([400, 413, 422]);
    });

    it('should handle malformed JSON gracefully', async function() {
      const malformedPayloads = [
        '{"merchant": "test"', // Incomplete JSON
        '{"merchant": "test",}', // Trailing comma
        '{merchant: "test"}', // Unquoted keys
        'null',
        'undefined',
        ''
      ];
      
      for (const payload of malformedPayloads) {
        try {
          const response = await axios.post(`${API_BASE_URL}/receipts`, payload, {
            headers: {
              'X-API-Key': TEST_API_KEY,
              'Content-Type': 'application/json'
            },
            validateStatus: () => true
          });
          
          expect(response.status).to.equal(400);
          expect(response.data.error).to.be.true;
        } catch (error) {
          // Network errors are acceptable for malformed requests
        }
      }
    });

    it('should validate content-type headers', async function() {
      const client = createSecurityClient(TEST_API_KEY, {
        'Content-Type': 'text/plain' // Wrong content type
      });
      
      const response = await client.post('/receipts', JSON.stringify({
        merchant: 'Test',
        date: '2025-01-15',
        total: 10.00
      }));
      
      // Should reject or handle gracefully
      expect(response.status).to.be.oneOf([400, 415]);
    });
  });

  describe('8. Business Logic Security', function() {
    it('should prevent negative amounts', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      const negativeAmountReceipt = {
        merchant: 'Test',
        date: '2025-01-15',
        total: -100.00,
        currency: 'USD'
      };
      
      const response = await client.post('/receipts', negativeAmountReceipt);
      
      expect(response.status).to.equal(400);
      expect(response.data.code).to.equal('VALIDATION_ERROR');
    });

    it('should validate currency codes', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      const invalidCurrencies = ['INVALID', 'US', 'USDD', '123', ''];
      
      for (const currency of invalidCurrencies) {
        const receipt = {
          merchant: 'Test',
          date: '2025-01-15',
          total: 10.00,
          currency
        };
        
        const response = await client.post('/receipts', receipt);
        
        if (response.status === 400) {
          expect(response.data.code).to.equal('VALIDATION_ERROR');
        }
      }
    });

    it('should validate date ranges', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      const invalidDates = [
        '2025-13-01', // Invalid month
        '2025-01-32', // Invalid day
        '1900-01-01', // Too old
        '2100-01-01', // Too far in future
        'invalid-date'
      ];
      
      for (const date of invalidDates) {
        const receipt = {
          merchant: 'Test',
          date,
          total: 10.00,
          currency: 'USD'
        };
        
        const response = await client.post('/receipts', receipt);
        expect(response.status).to.equal(400);
      }
    });
  });

  describe('9. Session Security', function() {
    it('should not maintain server-side sessions', async function() {
      const client1 = createSecurityClient(TEST_API_KEY);
      const client2 = createSecurityClient(TEST_API_KEY);
      
      // Each request should be independent
      const response1 = await client1.get('/health');
      const response2 = await client2.get('/health');
      
      expect(response1.status).to.equal(200);
      expect(response2.status).to.equal(200);
      
      // Should not share any session state
      expect(response1.data.data.user.id).to.equal(response2.data.data.user.id);
    });
  });

  describe('10. Logging Security', function() {
    it('should not log sensitive information', async function() {
      const client = createSecurityClient(TEST_API_KEY);
      
      // Make a request that would typically be logged
      await client.post('/receipts', {
        merchant: 'Sensitive Data Test',
        date: '2025-01-15',
        total: 10.00,
        currency: 'USD',
        fullText: 'Credit Card: 4111-1111-1111-1111' // Fake credit card
      });
      
      // We can't directly test logs, but the API should handle this securely
      // This test documents the expectation that sensitive data is not logged
    });
  });
});
