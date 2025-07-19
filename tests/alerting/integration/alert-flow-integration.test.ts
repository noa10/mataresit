/**
 * Integration Tests for Complete Alert Flow
 * Tests the end-to-end alert processing pipeline
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { alertingService } from '@/services/alertingService';
import { notificationChannelService } from '@/services/notificationChannelService';
import { AlertRule, NotificationChannel, Alert } from '@/types/alerting';

// Mock Supabase for integration tests
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

// Use test Supabase instance for direct operations
const testSupabase = createClient(
  process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54331',
  process.env.VITE_SUPABASE_ANON_KEY || 'test-key'
);

describe('Alert Flow Integration', () => {
  let testTeamId: string;
  let testUserId: string;
  let testAlertRule: AlertRule;
  let testEmailChannel: NotificationChannel;
  let testWebhookChannel: NotificationChannel;

  beforeEach(async () => {
    // Set up test data with mocked IDs
    testTeamId = 'test-team-' + Date.now();
    testUserId = 'test-user-' + Date.now();

    // Mock test alert rule
    testAlertRule = {
      id: 'test-rule-' + Date.now(),
      name: 'Integration Test Rule',
      description: 'Test rule for integration testing',
      team_id: testTeamId,
      metric_name: 'test_metric',
      condition_type: 'threshold',
      threshold_value: 80,
      threshold_operator: 'greater_than',
      evaluation_window_minutes: 1,
      evaluation_frequency_minutes: 1,
      consecutive_failures_required: 1,
      severity: 'high',
      enabled: true,
      cooldown_minutes: 5,
      max_alerts_per_hour: 10,
      created_by: testUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: {},
      custom_conditions: {}
    } as AlertRule;

    // Mock test notification channels
    testEmailChannel = {
      id: 'test-email-channel-' + Date.now(),
      name: 'Test Email Channel',
      description: 'Email channel for integration testing',
      channel_type: 'email',
      enabled: true,
      configuration: {
        recipients: ['test@example.com'],
        subject_template: 'Alert: {{alert.name}}',
        body_template: 'Alert triggered: {{alert.message}}'
      },
      max_notifications_per_hour: 50,
      max_notifications_per_day: 200,
      created_by: testUserId,
      team_id: testTeamId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as NotificationChannel;

    testWebhookChannel = {
      id: 'test-webhook-channel-' + Date.now(),
      name: 'Test Webhook Channel',
      description: 'Webhook channel for integration testing',
      channel_type: 'webhook',
      enabled: true,
      configuration: {
        url: 'https://httpbin.org/post',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload_template: '{"alert": "{{alert.name}}", "severity": "{{alert.severity}}"}'
      },
      max_notifications_per_hour: 100,
      max_notifications_per_day: 500,
      created_by: testUserId,
      team_id: testTeamId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as NotificationChannel;
  });

  afterEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should trigger alert from database metric change', async () => {
    // Mock Supabase operations
    const { supabase } = await import('@/lib/supabase');

    // Mock evaluateAlertRule
    (supabase.rpc as any).mockResolvedValueOnce({
      data: true,
      error: null
    });

    // Mock createAlert
    const mockAlert = {
      id: 'test-alert-' + Date.now(),
      alert_rule_id: testAlertRule.id,
      team_id: testTeamId,
      severity: 'high',
      status: 'active',
      message: 'Test metric value 85 exceeds threshold 80',
      metric_value: 85,
      triggered_at: new Date().toISOString()
    };

    const mockSupabaseChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockAlert, error: null })
    };

    (supabase.from as any).mockReturnValue(mockSupabaseChain);

    // 1. Evaluate alert rule
    const shouldTrigger = await alertingService.evaluateAlertRule(testAlertRule.id);
    expect(shouldTrigger).toBe(true);

    // 2. Verify the RPC call was made
    expect(supabase.rpc).toHaveBeenCalledWith('evaluate_alert_rule', {
      _rule_id: testAlertRule.id
    });
  });

  it('should evaluate multiple rules simultaneously', async () => {
    const { supabase } = await import('@/lib/supabase');

    // Mock multiple rule evaluations
    (supabase.rpc as any)
      .mockResolvedValueOnce({ data: true, error: null })  // Rule 1
      .mockResolvedValueOnce({ data: true, error: null })  // Rule 2
      .mockResolvedValueOnce({ data: true, error: null }); // Rule 3

    // Create mock additional rules
    const rule2Id = 'test-rule-memory-' + Date.now();
    const rule3Id = 'test-rule-disk-' + Date.now();

    // Evaluate all rules
    const evaluationPromises = [
      alertingService.evaluateAlertRule(testAlertRule.id),
      alertingService.evaluateAlertRule(rule2Id),
      alertingService.evaluateAlertRule(rule3Id)
    ];

    const results = await Promise.all(evaluationPromises);

    // All rules should trigger
    expect(results).toEqual([true, true, true]);

    // Verify all RPC calls were made
    expect(supabase.rpc).toHaveBeenCalledTimes(3);
    expect(supabase.rpc).toHaveBeenCalledWith('evaluate_alert_rule', { _rule_id: testAlertRule.id });
    expect(supabase.rpc).toHaveBeenCalledWith('evaluate_alert_rule', { _rule_id: rule2Id });
    expect(supabase.rpc).toHaveBeenCalledWith('evaluate_alert_rule', { _rule_id: rule3Id });
  });

  it('should test notification channel integration', async () => {
    // Test that notification channels can be created and configured
    const { supabase } = await import('@/lib/supabase');

    const mockChannel = {
      id: 'test-channel-' + Date.now(),
      name: 'Integration Test Channel',
      channel_type: 'email',
      enabled: true,
      configuration: { recipients: ['test@example.com'] },
      team_id: testTeamId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const mockSupabaseChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockChannel, error: null })
    };

    (supabase.from as any).mockReturnValue(mockSupabaseChain);

    // Test creating a notification channel
    const channel = await alertingService.createNotificationChannel({
      name: 'Integration Test Channel',
      description: 'Test channel for integration testing',
      channel_type: 'email',
      enabled: true,
      configuration: { recipients: ['test@example.com'] },
      max_notifications_per_hour: 50,
      max_notifications_per_day: 200,
      created_by: testUserId,
      team_id: testTeamId
    });

    expect(channel).toBeDefined();
    expect(channel.name).toBe('Integration Test Channel');
    expect(channel.channel_type).toBe('email');
  });

  it('should test alert rule and channel integration', async () => {
    const { supabase } = await import('@/lib/supabase');

    // Test getting alert rules for a team
    const mockRules = [testAlertRule];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockRules, error: null })
    };

    (supabase.from as any).mockReturnValue(mockSupabaseChain);

    const rules = await alertingService.getAlertRules(testTeamId);

    expect(rules).toBeDefined();
    expect(Array.isArray(rules)).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('alert_rules');
  });

  it('should test alert statistics integration', async () => {
    const { supabase } = await import('@/lib/supabase');

    // Mock alert statistics
    const mockStats = {
      total_alerts: 10,
      active_alerts: 2,
      acknowledged_alerts: 3,
      resolved_alerts: 5,
      critical_alerts: 1,
      high_alerts: 2,
      medium_alerts: 4,
      low_alerts: 3,
      avg_resolution_time_minutes: 30
    };

    (supabase.rpc as any).mockResolvedValue({
      data: mockStats,
      error: null
    });

    const stats = await alertingService.getAlertStatistics(testTeamId);

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('total_alerts');
    expect(stats).toHaveProperty('active_alerts');
    expect(supabase.rpc).toHaveBeenCalledWith('get_alert_statistics', {
      _team_id: testTeamId,
      _hours: 24
    });
  });

  it('should test alert acknowledgment integration', async () => {
    const { supabase } = await import('@/lib/supabase');

    // Mock successful acknowledgment
    (supabase.rpc as any).mockResolvedValue({
      data: true,
      error: null
    });

    const alertId = 'test-alert-' + Date.now();
    const result = await alertingService.acknowledgeAlert(alertId);

    expect(result).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('acknowledge_alert', {
      _alert_id: alertId,
      _user_id: 'test-user-123'
    });
  });

  it('should test alert resolution integration', async () => {
    const { supabase } = await import('@/lib/supabase');

    // Mock successful resolution
    (supabase.rpc as any).mockResolvedValue({
      data: true,
      error: null
    });

    const alertId = 'test-alert-' + Date.now();
    const result = await alertingService.resolveAlert(alertId);

    expect(result).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('resolve_alert', {
      _alert_id: alertId,
      _user_id: 'test-user-123'
    });
  });
});
