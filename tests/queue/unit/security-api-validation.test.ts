/**
 * Security API Validation Tests for Queue System
 * Tests input validation, API security, rate limiting, and injection prevention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock input validation service
class MockInputValidationService {
  private readonly validationRules = {
    queueItemId: /^[a-zA-Z0-9_-]{1,50}$/,
    workerId: /^worker-[a-zA-Z0-9_-]{1,40}$/,
    sourceType: /^(receipts|claims|documents)$/,
    priority: /^(low|medium|high|critical)$/,
    status: /^(pending|processing|completed|failed|rate_limited)$/,
    batchSize: (value: number) => Number.isInteger(value) && value >= 1 && value <= 100,
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    apiKeyFormat: /^mk_(test|live)_[a-zA-Z0-9]{32,}$/
  };

  validateInput(field: string, value: any): { valid: boolean; error?: string } {
    if (value === null || value === undefined) {
      return { valid: false, error: `${field} is required` };
    }

    const rule = this.validationRules[field as keyof typeof this.validationRules];
    if (!rule) {
      return { valid: false, error: `No validation rule for field: ${field}` };
    }

    if (typeof rule === 'function') {
      const isValid = rule(value);
      return isValid ? { valid: true } : { valid: false, error: `Invalid ${field}` };
    }

    if (rule instanceof RegExp) {
      const isValid = rule.test(String(value));
      return isValid ? { valid: true } : { valid: false, error: `Invalid ${field} format` };
    }

    return { valid: false, error: `Invalid validation rule type for ${field}` };
  }

  validateObject(obj: any, requiredFields: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    requiredFields.forEach(field => {
      if (!(field in obj)) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate each field that has a validation rule
    Object.keys(obj).forEach(field => {
      if (this.validationRules[field as keyof typeof this.validationRules]) {
        const validation = this.validateInput(field, obj[field]);
        if (!validation.valid) {
          errors.push(validation.error!);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>'"&]/g, '') // Remove HTML/XML characters
      .replace(/[;(){}[\]]/g, '') // Remove code injection characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  detectSQLInjection(input: string): boolean {
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(--|\/\*|\*\/)/,
      /(\b(OR|AND)\b.*=.*)/i,
      /['"]\s*(OR|AND)\s*['"]/i,
      /;\s*(DROP|DELETE|INSERT|UPDATE)/i
    ];

    return sqlInjectionPatterns.some(pattern => pattern.test(input));
  }

  detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe\b/i,
      /<object\b/i,
      /<embed\b/i,
      /expression\s*\(/i
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  detectCommandInjection(input: string): boolean {
    const commandInjectionPatterns = [
      /[;&|`$(){}[\]]/,
      /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig)\b/i,
      /\.\.\//,
      /\/etc\/passwd/i,
      /\/bin\//i
    ];

    return commandInjectionPatterns.some(pattern => pattern.test(input));
  }
}

// Mock rate limiting service
class MockRateLimitingService {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private readonly limits = {
    default: { requests: 100, windowMs: 60000 }, // 100 requests per minute
    auth: { requests: 10, windowMs: 60000 }, // 10 auth attempts per minute
    admin: { requests: 1000, windowMs: 60000 }, // 1000 admin requests per minute
    worker: { requests: 500, windowMs: 60000 } // 500 worker requests per minute
  };

  checkRateLimit(identifier: string, type: keyof typeof this.limits = 'default'): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const limit = this.limits[type];
    const key = `${identifier}:${type}`;
    
    let requestData = this.requests.get(key);
    
    // Initialize or reset if window expired
    if (!requestData || now > requestData.resetTime) {
      requestData = {
        count: 0,
        resetTime: now + limit.windowMs
      };
    }

    // Check if limit exceeded
    if (requestData.count >= limit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: requestData.resetTime
      };
    }

    // Increment count and update
    requestData.count++;
    this.requests.set(key, requestData);

    return {
      allowed: true,
      remaining: limit.requests - requestData.count,
      resetTime: requestData.resetTime
    };
  }

  resetRateLimit(identifier: string, type: keyof typeof this.limits = 'default'): void {
    const key = `${identifier}:${type}`;
    this.requests.delete(key);
  }

  getRateLimitStatus(identifier: string, type: keyof typeof this.limits = 'default'): { count: number; limit: number; resetTime: number } {
    const key = `${identifier}:${type}`;
    const requestData = this.requests.get(key);
    const limit = this.limits[type];

    return {
      count: requestData?.count || 0,
      limit: limit.requests,
      resetTime: requestData?.resetTime || Date.now() + limit.windowMs
    };
  }
}

// Mock API security middleware
class MockAPISecurityMiddleware {
  constructor(
    private validator: MockInputValidationService,
    private rateLimiter: MockRateLimitingService
  ) {}

  async validateQueueRequest(request: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Rate limiting check
    const clientId = request.clientId || request.ip || 'anonymous';
    const rateLimit = this.rateLimiter.checkRateLimit(clientId);
    
    if (!rateLimit.allowed) {
      errors.push('Rate limit exceeded');
    }

    // Input validation
    if (request.body) {
      const bodyValidation = this.validateRequestBody(request.body, request.endpoint);
      if (!bodyValidation.valid) {
        errors.push(...bodyValidation.errors);
      }
    }

    // Query parameter validation
    if (request.query) {
      const queryValidation = this.validateQueryParameters(request.query);
      if (!queryValidation.valid) {
        errors.push(...queryValidation.errors);
      }
    }

    // Header validation
    const headerValidation = this.validateHeaders(request.headers);
    if (!headerValidation.valid) {
      errors.push(...headerValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateRequestBody(body: any, endpoint: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Endpoint-specific validation
    switch (endpoint) {
      case '/queue/items':
        const queueItemValidation = this.validator.validateObject(body, ['source_type', 'source_id', 'operation']);
        if (!queueItemValidation.valid) {
          errors.push(...queueItemValidation.errors);
        }
        break;

      case '/queue/workers/start':
        if (!body.workerId || !this.validator.validateInput('workerId', body.workerId).valid) {
          errors.push('Invalid worker ID format');
        }
        break;

      case '/queue/config':
        if (body.batchSize && !this.validator.validateInput('batchSize', body.batchSize).valid) {
          errors.push('Invalid batch size');
        }
        break;
    }

    // Check for injection attacks in all string fields
    this.checkForInjectionAttacks(body, errors);

    return { valid: errors.length === 0, errors };
  }

  private validateQueryParameters(query: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate common query parameters
    if (query.limit) {
      const limit = parseInt(query.limit);
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        errors.push('Invalid limit parameter');
      }
    }

    if (query.offset) {
      const offset = parseInt(query.offset);
      if (isNaN(offset) || offset < 0) {
        errors.push('Invalid offset parameter');
      }
    }

    if (query.status && !this.validator.validateInput('status', query.status).valid) {
      errors.push('Invalid status parameter');
    }

    // Check for injection attacks in query parameters
    this.checkForInjectionAttacks(query, errors);

    return { valid: errors.length === 0, errors };
  }

  private validateHeaders(headers: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate Content-Type for POST/PUT requests
    if (headers['content-type'] && !headers['content-type'].includes('application/json')) {
      errors.push('Invalid Content-Type header');
    }

    // Validate User-Agent (should be present and reasonable)
    if (!headers['user-agent'] || headers['user-agent'].length > 500) {
      errors.push('Invalid or missing User-Agent header');
    }

    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip'];
    suspiciousHeaders.forEach(header => {
      if (headers[header] && this.containsSuspiciousContent(headers[header])) {
        errors.push(`Suspicious content in ${header} header`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  private checkForInjectionAttacks(obj: any, errors: string[]): void {
    const checkValue = (value: any, path: string) => {
      if (typeof value === 'string') {
        if (this.validator.detectSQLInjection(value)) {
          errors.push(`Potential SQL injection detected in ${path}`);
        }
        if (this.validator.detectXSS(value)) {
          errors.push(`Potential XSS attack detected in ${path}`);
        }
        if (this.validator.detectCommandInjection(value)) {
          errors.push(`Potential command injection detected in ${path}`);
        }
      } else if (typeof value === 'object' && value !== null) {
        Object.keys(value).forEach(key => {
          checkValue(value[key], `${path}.${key}`);
        });
      }
    };

    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        checkValue(obj[key], key);
      });
    }
  }

  private containsSuspiciousContent(value: string): boolean {
    const suspiciousPatterns = [
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP addresses
      /[<>'"&]/,
      /javascript:/i,
      /data:/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(value));
  }
}

describe('Security API Validation Tests', () => {
  let validator: MockInputValidationService;
  let rateLimiter: MockRateLimitingService;
  let apiSecurity: MockAPISecurityMiddleware;

  beforeEach(() => {
    validator = new MockInputValidationService();
    rateLimiter = new MockRateLimitingService();
    apiSecurity = new MockAPISecurityMiddleware(validator, rateLimiter);
  });

  describe('Input Validation Tests', () => {
    it('should validate queue item IDs correctly', () => {
      const validIds = ['item-123', 'queue_item_456', 'ITEM-789'];
      const invalidIds = ['', 'item with spaces', 'item@special', 'a'.repeat(51)];

      validIds.forEach(id => {
        const result = validator.validateInput('queueItemId', id);
        expect(result.valid).toBe(true);
      });

      invalidIds.forEach(id => {
        const result = validator.validateInput('queueItemId', id);
        expect(result.valid).toBe(false);
      });
    });

    it('should validate worker IDs correctly', () => {
      const validWorkerIds = ['worker-123', 'worker-test_456'];
      const invalidWorkerIds = ['worker123', 'invalid-worker', 'worker-'];

      validWorkerIds.forEach(id => {
        const result = validator.validateInput('workerId', id);
        expect(result.valid).toBe(true);
      });

      invalidWorkerIds.forEach(id => {
        const result = validator.validateInput('workerId', id);
        expect(result.valid).toBe(false);
      });
    });

    it('should validate batch sizes correctly', () => {
      const validSizes = [1, 5, 50, 100];
      const invalidSizes = [0, -1, 101, 1.5, 'not-a-number'];

      validSizes.forEach(size => {
        const result = validator.validateInput('batchSize', size);
        expect(result.valid).toBe(true);
      });

      invalidSizes.forEach(size => {
        const result = validator.validateInput('batchSize', size);
        expect(result.valid).toBe(false);
      });
    });

    it('should validate complete objects correctly', () => {
      const validQueueItem = {
        queueItemId: 'item-123',
        sourceType: 'receipts',
        priority: 'high',
        status: 'pending'
      };

      const invalidQueueItem = {
        queueItemId: 'invalid id with spaces',
        sourceType: 'invalid_type',
        priority: 'super_high',
        status: 'unknown'
      };

      const validResult = validator.validateObject(validQueueItem, ['queueItemId', 'sourceType']);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidResult = validator.validateObject(invalidQueueItem, ['queueItemId', 'sourceType']);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Injection Attack Detection Tests', () => {
    it('should detect SQL injection attempts', () => {
      const sqlInjectionInputs = [
        "'; DROP TABLE embedding_queue; --",
        "1' OR '1'='1",
        "admin'--",
        "1; DELETE FROM users",
        "' UNION SELECT * FROM api_keys --"
      ];

      sqlInjectionInputs.forEach(input => {
        const detected = validator.detectSQLInjection(input);
        expect(detected).toBe(true);
      });

      const safeInputs = ['normal text', 'item-123', 'user@example.com'];
      safeInputs.forEach(input => {
        const detected = validator.detectSQLInjection(input);
        expect(detected).toBe(false);
      });
    });

    it('should detect XSS attempts', () => {
      const xssInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src="x" onerror="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        'expression(alert(1))'
      ];

      xssInputs.forEach(input => {
        const detected = validator.detectXSS(input);
        expect(detected).toBe(true);
      });

      const safeInputs = ['<p>Normal HTML</p>', 'user@example.com', 'item-123'];
      safeInputs.forEach(input => {
        const detected = validator.detectXSS(input);
        expect(detected).toBe(false);
      });
    });

    it('should detect command injection attempts', () => {
      const commandInjectionInputs = [
        'item-123; cat /etc/passwd',
        'item-123 && ls -la',
        'item-123 | whoami',
        '../../../etc/passwd',
        '$(cat /etc/passwd)'
      ];

      commandInjectionInputs.forEach(input => {
        const detected = validator.detectCommandInjection(input);
        expect(detected).toBe(true);
      });

      const safeInputs = ['item-123', 'normal-text', 'user@example.com'];
      safeInputs.forEach(input => {
        const detected = validator.detectCommandInjection(input);
        expect(detected).toBe(false);
      });
    });

    it('should sanitize input correctly', () => {
      const maliciousInput = '<script>alert("xss")</script> & DROP TABLE users;';
      const sanitized = validator.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('&');
      expect(sanitized).not.toContain(';');
      expect(sanitized).toBe('scriptalert(xss)/script  DROP TABLE users');
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits correctly', () => {
      const clientId = 'test-client-123';

      // Should allow requests within limit
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.checkRateLimit(clientId, 'auth');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10 - i - 1);
      }

      // Should block requests exceeding limit
      const blockedResult = rateLimiter.checkRateLimit(clientId, 'auth');
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });

    it('should reset rate limits after window expires', () => {
      const clientId = 'test-client-456';

      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkRateLimit(clientId, 'auth');
      }

      // Should be blocked
      let result = rateLimiter.checkRateLimit(clientId, 'auth');
      expect(result.allowed).toBe(false);

      // Reset manually (simulating window expiry)
      rateLimiter.resetRateLimit(clientId, 'auth');

      // Should be allowed again
      result = rateLimiter.checkRateLimit(clientId, 'auth');
      expect(result.allowed).toBe(true);
    });

    it('should handle different rate limit types', () => {
      const clientId = 'test-client-789';

      // Admin should have higher limits
      const adminResult = rateLimiter.checkRateLimit(clientId, 'admin');
      expect(adminResult.allowed).toBe(true);

      const status = rateLimiter.getRateLimitStatus(clientId, 'admin');
      expect(status.limit).toBe(1000); // Admin limit is higher

      // Default should have lower limits
      const defaultStatus = rateLimiter.getRateLimitStatus(clientId, 'default');
      expect(defaultStatus.limit).toBe(100); // Default limit is lower
    });
  });

  describe('API Security Middleware Tests', () => {
    it('should validate complete queue requests', async () => {
      const validRequest = {
        endpoint: '/queue/items',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Test Client 1.0',
          'authorization': 'Bearer valid-token'
        },
        body: {
          sourceType: 'receipts',
          source_id: 'receipt-123',
          operation: 'INSERT',
          priority: 'high'
        },
        query: {
          limit: '10',
          status: 'pending'
        },
        clientId: 'test-client'
      };

      const result = await apiSecurity.validateQueueRequest(validRequest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject requests with injection attempts', async () => {
      const maliciousRequest = {
        endpoint: '/queue/items',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Test Client 1.0'
        },
        body: {
          sourceType: 'receipts',
          source_id: "'; DROP TABLE embedding_queue; --",
          operation: 'INSERT'
        },
        clientId: 'malicious-client'
      };

      const result = await apiSecurity.validateQueueRequest(maliciousRequest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('SQL injection'))).toBe(true);
    });

    it('should enforce rate limits in middleware', async () => {
      const clientId = 'rate-limited-client';
      
      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        rateLimiter.checkRateLimit(clientId);
      }

      const rateLimitedRequest = {
        endpoint: '/queue/items',
        method: 'GET',
        headers: { 'user-agent': 'Test Client 1.0' },
        clientId
      };

      const result = await apiSecurity.validateQueueRequest(rateLimitedRequest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Rate limit exceeded'))).toBe(true);
    });

    it('should validate headers correctly', async () => {
      const requestWithBadHeaders = {
        endpoint: '/queue/items',
        method: 'POST',
        headers: {
          'content-type': 'text/plain', // Wrong content type
          'user-agent': 'A'.repeat(600), // Too long user agent
          'x-forwarded-for': '<script>alert(1)</script>' // Suspicious header
        },
        body: { sourceType: 'receipts' },
        clientId: 'test-client'
      };

      const result = await apiSecurity.validateQueueRequest(requestWithBadHeaders);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('API Key Security Tests', () => {
    it('should validate API key formats', () => {
      const validApiKeys = [
        'mk_test_1234567890abcdef1234567890abcdef',
        'mk_live_abcdef1234567890abcdef1234567890'
      ];

      const invalidApiKeys = [
        'invalid-key',
        'mk_test_short',
        'mk_prod_1234567890abcdef1234567890abcdef', // Wrong environment
        'sk_test_1234567890abcdef1234567890abcdef' // Wrong prefix
      ];

      validApiKeys.forEach(key => {
        const result = validator.validateInput('apiKeyFormat', key);
        expect(result.valid).toBe(true);
      });

      invalidApiKeys.forEach(key => {
        const result = validator.validateInput('apiKeyFormat', key);
        expect(result.valid).toBe(false);
      });
    });
  });
});
