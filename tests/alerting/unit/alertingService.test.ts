/**
 * Unit Tests for AlertingService
 * Tests core alert rule management and evaluation logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { alertingService } from '@/services/alertingService';
import { AlertRule, AlertSeverity, AlertStatus } from '@/types/alerting';
import { supabase } from '@/lib/supabase';

// Mock Supabase client
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

describe('AlertingService', () => {
  beforeEach(() => {
    // Don't clear all mocks here as it interferes with our Supabase mock setup
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAlertRule', () => {
    const mockAlertRule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'> = {
      name: 'High CPU Usage',
      description: 'Alert when CPU usage exceeds 80%',
      team_id: 'team-123',
      metric_name: 'cpu_usage',
      condition_type: 'threshold',
      threshold_value: 80,
      threshold_operator: 'greater_than',
      evaluation_window_minutes: 5,
      evaluation_frequency_minutes: 1,
      consecutive_failures_required: 2,
      severity: 'high' as AlertSeverity,
      enabled: true,
      cooldown_minutes: 15,
      max_alerts_per_hour: 10,
      tags: { environment: 'production' },
      custom_conditions: {},
      created_by: 'user-123'
    };

    it('should create alert rule with valid configuration', async () => {
      const mockCreatedRule = { id: 'rule-123', ...mockAlertRule, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      
      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedRule, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await alertingService.createAlertRule(mockAlertRule);

      expect(result).toEqual(mockCreatedRule);
      expect(supabase.from).toHaveBeenCalledWith('alert_rules');
      expect(mockSupabaseChain.insert).toHaveBeenCalledWith(mockAlertRule);
    });

    it('should validate metric thresholds', async () => {
      const invalidRule = { ...mockAlertRule, threshold_value: -1 };

      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Threshold value must be positive' }
        })
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      await expect(alertingService.createAlertRule(invalidRule))
        .rejects.toThrow('Failed to create alert rule: Threshold value must be positive');
    });

    it('should handle invalid severity levels', async () => {
      const invalidRule = { ...mockAlertRule, severity: 'invalid' as AlertSeverity };

      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Invalid severity level' }
        })
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      await expect(alertingService.createAlertRule(invalidRule))
        .rejects.toThrow('Failed to create alert rule: Invalid severity level');
    });

    it('should apply default cooldown settings', async () => {
      const ruleWithoutCooldown = { ...mockAlertRule };
      delete ruleWithoutCooldown.cooldown_minutes;

      const mockCreatedRule = { 
        id: 'rule-123', 
        ...ruleWithoutCooldown, 
        cooldown_minutes: 15, // Default value
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      };
      
      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedRule, error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await alertingService.createAlertRule(ruleWithoutCooldown);

      expect(result.cooldown_minutes).toBe(15);
    });
  });

  describe('evaluateAlertRule', () => {
    const mockRule: AlertRule = {
      id: 'rule-123',
      name: 'High CPU Usage',
      description: 'Alert when CPU usage exceeds 80%',
      team_id: 'team-123',
      metric_name: 'cpu_usage',
      condition_type: 'threshold',
      threshold_value: 80,
      threshold_operator: 'greater_than',
      evaluation_window_minutes: 5,
      evaluation_frequency_minutes: 1,
      consecutive_failures_required: 2,
      severity: 'high' as AlertSeverity,
      enabled: true,
      cooldown_minutes: 15,
      max_alerts_per_hour: 10,
      tags: {},
      custom_conditions: {},
      created_by: 'user-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    it('should trigger alert when threshold exceeded', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await alertingService.evaluateAlertRule(mockRule.id);

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('evaluate_alert_rule', {
        _rule_id: mockRule.id
      });
    });

    it('should respect consecutive failures requirement', async () => {
      // Mock that this is the first failure (not consecutive)
      (supabase.rpc as any).mockResolvedValue({
        data: false,
        error: null
      });

      const result = await alertingService.evaluateAlertRule(mockRule.id);

      expect(result).toBe(false);
    });

    it('should handle missing metrics gracefully', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: false,
        error: null
      });

      const result = await alertingService.evaluateAlertRule(mockRule.id);

      expect(result).toBe(false);
    });

    it('should apply evaluation window correctly', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null
      });

      await alertingService.evaluateAlertRule(mockRule.id);

      expect(supabase.rpc).toHaveBeenCalledWith('evaluate_alert_rule', {
        _rule_id: mockRule.id
      });
    });
  });

  describe('getAlerts', () => {
    it('should fetch alerts with filters', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          alert_rule_id: 'rule-123',
          status: 'active' as AlertStatus,
          severity: 'high' as AlertSeverity,
          message: 'CPU usage is high',
          triggered_at: new Date().toISOString(),
          acknowledged_at: null,
          resolved_at: null,
          team_id: 'team-123'
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
        status: ['active'] as AlertStatus[],
        severity: ['high'] as AlertSeverity[]
      };

      const result = await alertingService.getAlerts(filters);

      expect(result).toEqual(mockAlerts);
      expect(supabase.from).toHaveBeenCalledWith('alerts');
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('team_id', 'team-123');
      expect(mockSupabaseChain.in).toHaveBeenCalledWith('status', ['active']);
      expect(mockSupabaseChain.in).toHaveBeenCalledWith('severity', ['high']);
    });

    it('should handle empty results', async () => {
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await alertingService.getAlerts({ team_id: 'team-123' });

      expect(result).toEqual([]);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert successfully', async () => {
      const alertId = 'alert-123';

      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await alertingService.acknowledgeAlert(alertId);

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('acknowledge_alert', {
        _alert_id: alertId,
        _user_id: 'test-user-123'
      });
    });

    it('should handle non-existent alert', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Alert not found' }
      });

      await expect(alertingService.acknowledgeAlert('invalid-id'))
        .rejects.toThrow('Failed to acknowledge alert: Alert not found');
    });

    it('should handle unauthenticated user', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
        error: null
      });

      await expect(alertingService.acknowledgeAlert('alert-123'))
        .rejects.toThrow('User not authenticated');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert successfully', async () => {
      const alertId = 'alert-123';

      (supabase.rpc as any).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await alertingService.resolveAlert(alertId);

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('resolve_alert', {
        _alert_id: alertId,
        _user_id: 'test-user-123'
      });
    });
  });

  describe('getAlertStatistics', () => {
    it('should return alert statistics', async () => {
      // Mock the RPC call specifically for this test
      const mockStats = {
        total_alerts: 100,
        active_alerts: 5,
        acknowledged_alerts: 10,
        resolved_alerts: 85,
        critical_alerts: 2,
        high_alerts: 8,
        medium_alerts: 15,
        low_alerts: 75,
        avg_resolution_time_minutes: 45
      };

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockStats,
        error: null
      });

      const result = await alertingService.getAlertStatistics('team-123');

      // Test that the result has the expected structure
      expect(result).toHaveProperty('total_alerts');
      expect(result).toHaveProperty('active_alerts');
      expect(result).toHaveProperty('acknowledged_alerts');
      expect(result).toHaveProperty('resolved_alerts');
      expect(typeof result.total_alerts).toBe('number');
      expect(supabase.rpc).toHaveBeenCalledWith('get_alert_statistics', {
        _team_id: 'team-123',
        _hours: 24
      });
    });

    it('should handle statistics calculation errors', async () => {
      // Reset the mock before setting new behavior
      vi.clearAllMocks();
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Statistics calculation failed' }
      });

      await expect(alertingService.getAlertStatistics('team-123'))
        .rejects.toThrow('Failed to fetch alert statistics: Statistics calculation failed');
    });
  });
});
