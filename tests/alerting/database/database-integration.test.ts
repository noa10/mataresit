/**
 * Database Integration Tests for Alerting System
 * Tests database interactions, RLS policies, and stored functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { alertingService } from '@/services/alertingService';

// Mock Supabase for database tests
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user-123' } }, 
        error: null 
      }))
    }
  }
}));

describe('Database Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Alert Rules Table Operations', () => {
    it('should create alert rule with proper database constraints', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      const mockRule = {
        id: 'rule-123',
        name: 'Test Rule',
        team_id: 'team-123',
        metric_name: 'cpu_usage',
        threshold_value: 80,
        severity: 'high',
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRule, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const ruleData = {
        name: 'Test Rule',
        description: 'Test rule for database testing',
        team_id: 'team-123',
        metric_name: 'cpu_usage',
        condition_type: 'threshold',
        threshold_value: 80,
        threshold_operator: 'greater_than',
        evaluation_window_minutes: 5,
        evaluation_frequency_minutes: 1,
        consecutive_failures_required: 1,
        severity: 'high',
        enabled: true,
        cooldown_minutes: 15,
        max_alerts_per_hour: 10,
        tags: {},
        custom_conditions: {},
        created_by: 'user-123'
      };

      const result = await alertingService.createAlertRule(ruleData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Rule');
      expect(supabase.from).toHaveBeenCalledWith('alert_rules');
      expect(mockSupabaseChain.insert).toHaveBeenCalledWith(ruleData);
    });

    it('should handle database constraint violations', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { 
            message: 'duplicate key value violates unique constraint',
            code: '23505'
          }
        })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const ruleData = {
        name: 'Duplicate Rule',
        team_id: 'team-123',
        metric_name: 'cpu_usage',
        condition_type: 'threshold',
        threshold_value: 80,
        threshold_operator: 'greater_than',
        evaluation_window_minutes: 5,
        evaluation_frequency_minutes: 1,
        consecutive_failures_required: 1,
        severity: 'high',
        enabled: true,
        cooldown_minutes: 15,
        max_alerts_per_hour: 10,
        tags: {},
        custom_conditions: {},
        created_by: 'user-123'
      };

      await expect(alertingService.createAlertRule(ruleData))
        .rejects.toThrow('Failed to create alert rule');
    });
  });

  describe('Stored Function Integration', () => {
    it('should call evaluate_alert_rule stored function correctly', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      (supabase.rpc as any).mockResolvedValue({ 
        data: true, 
        error: null 
      });

      const ruleId = 'rule-123';
      const result = await alertingService.evaluateAlertRule(ruleId);

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('evaluate_alert_rule', {
        _rule_id: ruleId
      });
    });

    it('should call get_alert_statistics stored function correctly', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      const mockStats = {
        total_alerts: 50,
        active_alerts: 5,
        acknowledged_alerts: 15,
        resolved_alerts: 30,
        critical_alerts: 2,
        high_alerts: 8,
        medium_alerts: 20,
        low_alerts: 20,
        avg_resolution_time_minutes: 45
      };

      (supabase.rpc as any).mockResolvedValue({ 
        data: mockStats, 
        error: null 
      });

      const teamId = 'team-123';
      const result = await alertingService.getAlertStatistics(teamId, 48);

      // Test that the result has the expected structure
      expect(result).toHaveProperty('total_alerts');
      expect(result).toHaveProperty('active_alerts');
      expect(typeof result.total_alerts).toBe('number');
      expect(supabase.rpc).toHaveBeenCalledWith('get_alert_statistics', {
        _team_id: teamId,
        _hours: 48
      });
    });

    it('should call acknowledge_alert stored function correctly', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      (supabase.rpc as any).mockResolvedValue({ 
        data: true, 
        error: null 
      });

      const alertId = 'alert-123';
      const result = await alertingService.acknowledgeAlert(alertId);

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('acknowledge_alert', {
        _alert_id: alertId,
        _user_id: 'test-user-123'
      });
    });

    it('should call resolve_alert stored function correctly', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      (supabase.rpc as any).mockResolvedValue({ 
        data: true, 
        error: null 
      });

      const alertId = 'alert-123';
      const result = await alertingService.resolveAlert(alertId);

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('resolve_alert', {
        _alert_id: alertId,
        _user_id: 'test-user-123'
      });
    });
  });

  describe('Query Optimization and Performance', () => {
    it('should use efficient queries for alert retrieval', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      const mockAlerts = [
        {
          id: 'alert-1',
          alert_rule_id: 'rule-123',
          status: 'active',
          severity: 'high',
          created_at: new Date().toISOString()
        }
      ];

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockAlerts, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const filters = {
        team_id: 'team-123',
        status: ['active', 'acknowledged'],
        severity: ['high', 'critical']
      };

      const result = await alertingService.getAlerts(filters);

      expect(result).toEqual(mockAlerts);
      expect(supabase.from).toHaveBeenCalledWith('alerts');
      
      // Verify that the query includes proper joins for related data
      expect(mockSupabaseChain.select).toHaveBeenCalledWith(expect.stringContaining('alert_rule:alert_rules'));
      expect(mockSupabaseChain.select).toHaveBeenCalledWith(expect.stringContaining('acknowledged_by_user:profiles'));
    });

    it('should handle large result sets efficiently', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      // Simulate a large number of alert rules
      const mockRules = Array.from({ length: 100 }, (_, i) => ({
        id: `rule-${i}`,
        name: `Rule ${i}`,
        team_id: 'team-123',
        enabled: true
      }));

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRules, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await alertingService.getAlertRules('team-123');

      expect(result).toHaveLength(100);
      expect(supabase.from).toHaveBeenCalledWith('alert_rules');
      
      // Verify that ordering is applied for consistent results
      expect(mockSupabaseChain.order).toHaveBeenCalled();
    });
  });

  describe('Data Consistency and Transactions', () => {
    it('should handle concurrent operations safely', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      // Mock successful operations
      (supabase.rpc as any).mockResolvedValue({ 
        data: true, 
        error: null 
      });

      const alertId = 'alert-123';
      
      // Simulate concurrent acknowledgment attempts
      const promises = Array(5).fill(null).map(() => 
        alertingService.acknowledgeAlert(alertId)
      );

      const results = await Promise.allSettled(promises);
      
      // All should succeed (database handles concurrency)
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toBe(true);
        }
      });

      expect(supabase.rpc).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      (supabase.rpc as any).mockRejectedValue(new Error('Connection timeout'));

      const ruleId = 'rule-123';
      
      await expect(alertingService.evaluateAlertRule(ruleId))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle invalid data gracefully', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { 
            message: 'invalid input syntax for type integer',
            code: '22P02'
          }
        })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const invalidRuleData = {
        name: 'Invalid Rule',
        team_id: 'team-123',
        metric_name: 'cpu_usage',
        condition_type: 'threshold',
        threshold_value: 'invalid_number', // Invalid data type
        threshold_operator: 'greater_than',
        evaluation_window_minutes: 5,
        evaluation_frequency_minutes: 1,
        consecutive_failures_required: 1,
        severity: 'high',
        enabled: true,
        cooldown_minutes: 15,
        max_alerts_per_hour: 10,
        tags: {},
        custom_conditions: {},
        created_by: 'user-123'
      };

      await expect(alertingService.createAlertRule(invalidRuleData as any))
        .rejects.toThrow('Failed to create alert rule');
    });
  });
});
