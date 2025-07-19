/**
 * Alerting System Test Setup and Configuration
 * Provides utilities for setting up test environments and data
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AlertRule, NotificationChannel, Alert, AlertEscalationPolicy } from '@/types/alerting';

// Test configuration
export const TEST_CONFIG = {
  supabase: {
    url: process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54331',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || 'test-service-key'
  },
  testData: {
    teamPrefix: 'test-team-',
    userPrefix: 'test-user-',
    rulePrefix: 'test-rule-',
    channelPrefix: 'test-channel-'
  },
  timeouts: {
    alertProcessing: 10000, // 10 seconds
    notificationDelivery: 30000, // 30 seconds
    escalationDelay: 5000 // 5 seconds for testing
  },
  performance: {
    maxAlertProcessingTime: 5000,
    maxNotificationDeliveryTime: 30000,
    maxThroughput: 100,
    maxErrorRate: 0.01
  }
};

// Test database client
export const testSupabase: SupabaseClient = createClient(
  TEST_CONFIG.supabase.url,
  TEST_CONFIG.supabase.anonKey
);

// Service role client for admin operations
export const adminSupabase: SupabaseClient = createClient(
  TEST_CONFIG.supabase.url,
  TEST_CONFIG.supabase.serviceKey
);

// Test data generators
export class TestDataGenerator {
  private static counter = 0;

  static getUniqueId(): string {
    return `${Date.now()}-${++this.counter}`;
  }

  static generateTeam(overrides: Partial<any> = {}): any {
    const id = this.getUniqueId();
    return {
      id: `${TEST_CONFIG.testData.teamPrefix}${id}`,
      name: `Test Team ${id}`,
      description: 'Team created for testing',
      created_by: `${TEST_CONFIG.testData.userPrefix}${id}`,
      ...overrides
    };
  }

  static generateUser(overrides: Partial<any> = {}): any {
    const id = this.getUniqueId();
    return {
      id: `${TEST_CONFIG.testData.userPrefix}${id}`,
      email: `test-user-${id}@example.com`,
      full_name: `Test User ${id}`,
      ...overrides
    };
  }

  static generateAlertRule(teamId: string, overrides: Partial<AlertRule> = {}): Omit<AlertRule, 'id' | 'created_at' | 'updated_at'> {
    const id = this.getUniqueId();
    return {
      name: `Test Alert Rule ${id}`,
      description: `Alert rule created for testing - ${id}`,
      team_id: teamId,
      metric_name: `test_metric_${id}`,
      condition_type: 'threshold',
      threshold_value: 80,
      threshold_operator: 'greater_than',
      evaluation_window_minutes: 5,
      evaluation_frequency_minutes: 1,
      consecutive_failures_required: 1,
      severity: 'medium',
      enabled: true,
      cooldown_minutes: 15,
      max_alerts_per_hour: 10,
      tags: { test: true, id },
      custom_conditions: {},
      created_by: `${TEST_CONFIG.testData.userPrefix}${id}`,
      ...overrides
    };
  }

  static generateNotificationChannel(teamId: string, type: 'email' | 'webhook' | 'slack' = 'email', overrides: Partial<NotificationChannel> = {}): Omit<NotificationChannel, 'id' | 'created_at' | 'updated_at'> {
    const id = this.getUniqueId();
    
    const baseConfig = {
      name: `Test ${type} Channel ${id}`,
      description: `${type} channel created for testing`,
      channel_type: type,
      enabled: true,
      max_notifications_per_hour: 50,
      max_notifications_per_day: 200,
      created_by: `${TEST_CONFIG.testData.userPrefix}${id}`,
      team_id: teamId,
      ...overrides
    };

    // Set type-specific configuration
    switch (type) {
      case 'email':
        baseConfig.configuration = {
          recipients: [`test-${id}@example.com`],
          subject_template: 'Test Alert: {{alert.name}}',
          body_template: 'Alert: {{alert.message}}'
        };
        break;
      case 'webhook':
        baseConfig.configuration = {
          url: `https://httpbin.org/post?test=${id}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload_template: '{"alert": "{{alert.name}}", "severity": "{{alert.severity}}"}'
        };
        break;
      case 'slack':
        baseConfig.configuration = {
          webhook_url: `https://hooks.slack.com/test/${id}`,
          channel: `#test-alerts-${id}`,
          username: 'AlertBot'
        };
        break;
    }

    return baseConfig;
  }

  static generateAlert(alertRuleId: string, teamId: string, overrides: Partial<Alert> = {}): Omit<Alert, 'id' | 'created_at' | 'updated_at'> {
    const id = this.getUniqueId();
    return {
      alert_rule_id: alertRuleId,
      team_id: teamId,
      severity: 'medium',
      status: 'active',
      message: `Test alert ${id} - metric threshold exceeded`,
      metric_value: 85,
      triggered_at: new Date().toISOString(),
      acknowledged_at: null,
      acknowledged_by: null,
      resolved_at: null,
      resolved_by: null,
      ...overrides
    };
  }

  static generateEscalationPolicy(teamId: string, overrides: Partial<any> = {}): any {
    const id = this.getUniqueId();
    return {
      name: `Test Escalation Policy ${id}`,
      description: `Escalation policy created for testing`,
      team_id: teamId,
      escalation_rules: [
        {
          level: 1,
          delay_minutes: 0,
          channels: [],
          contacts: []
        },
        {
          level: 2,
          delay_minutes: 5,
          channels: [],
          contacts: []
        }
      ],
      enabled: true,
      created_by: `${TEST_CONFIG.testData.userPrefix}${id}`,
      ...overrides
    };
  }
}

// Test environment setup utilities
export class TestEnvironment {
  private static createdResources: {
    teams: string[];
    users: string[];
    alertRules: string[];
    channels: string[];
    alerts: string[];
    escalationPolicies: string[];
  } = {
    teams: [],
    users: [],
    alertRules: [],
    channels: [],
    alerts: [],
    escalationPolicies: []
  };

  static async setup(): Promise<void> {
    console.log('Setting up test environment...');
    
    // Ensure test database is clean
    await this.cleanup();
    
    // Set up any global test data if needed
    console.log('Test environment setup complete');
  }

  static async cleanup(): Promise<void> {
    console.log('Cleaning up test environment...');
    
    try {
      // Clean up in reverse dependency order
      await this.cleanupAlerts();
      await this.cleanupEscalationPolicies();
      await this.cleanupChannels();
      await this.cleanupAlertRules();
      await this.cleanupUsers();
      await this.cleanupTeams();
      
      // Reset tracking arrays
      Object.keys(this.createdResources).forEach(key => {
        this.createdResources[key as keyof typeof this.createdResources] = [];
      });
      
      console.log('Test environment cleanup complete');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  static async createTeam(teamData?: Partial<any>): Promise<any> {
    const team = TestDataGenerator.generateTeam(teamData);
    
    const { data, error } = await testSupabase
      .from('teams')
      .insert(team)
      .select()
      .single();
    
    if (error) throw error;
    
    this.createdResources.teams.push(data.id);
    return data;
  }

  static async createUser(userData?: Partial<any>): Promise<any> {
    const user = TestDataGenerator.generateUser(userData);
    
    const { data, error } = await testSupabase
      .from('profiles')
      .insert(user)
      .select()
      .single();
    
    if (error) throw error;
    
    this.createdResources.users.push(data.id);
    return data;
  }

  static async createAlertRule(teamId: string, ruleData?: Partial<AlertRule>): Promise<AlertRule> {
    const rule = TestDataGenerator.generateAlertRule(teamId, ruleData);
    
    const { data, error } = await testSupabase
      .from('alert_rules')
      .insert(rule)
      .select()
      .single();
    
    if (error) throw error;
    
    this.createdResources.alertRules.push(data.id);
    return data;
  }

  static async createNotificationChannel(teamId: string, type: 'email' | 'webhook' | 'slack' = 'email', channelData?: Partial<NotificationChannel>): Promise<NotificationChannel> {
    const channel = TestDataGenerator.generateNotificationChannel(teamId, type, channelData);
    
    const { data, error } = await testSupabase
      .from('notification_channels')
      .insert(channel)
      .select()
      .single();
    
    if (error) throw error;
    
    this.createdResources.channels.push(data.id);
    return data;
  }

  static async createAlert(alertRuleId: string, teamId: string, alertData?: Partial<Alert>): Promise<Alert> {
    const alert = TestDataGenerator.generateAlert(alertRuleId, teamId, alertData);
    
    const { data, error } = await testSupabase
      .from('alerts')
      .insert(alert)
      .select()
      .single();
    
    if (error) throw error;
    
    this.createdResources.alerts.push(data.id);
    return data;
  }

  static async createEscalationPolicy(teamId: string, policyData?: Partial<any>): Promise<any> {
    const policy = TestDataGenerator.generateEscalationPolicy(teamId, policyData);
    
    const { data, error } = await testSupabase
      .from('alert_escalation_policies')
      .insert(policy)
      .select()
      .single();
    
    if (error) throw error;
    
    this.createdResources.escalationPolicies.push(data.id);
    return data;
  }

  static async linkChannelToRule(alertRuleId: string, channelId: string, escalationPolicyId?: string): Promise<void> {
    const { error } = await testSupabase
      .from('alert_rule_channels')
      .insert({
        alert_rule_id: alertRuleId,
        notification_channel_id: channelId,
        escalation_policy_id: escalationPolicyId,
        enabled: true
      });
    
    if (error) throw error;
  }

  // Cleanup methods
  private static async cleanupAlerts(): Promise<void> {
    if (this.createdResources.alerts.length > 0) {
      await testSupabase
        .from('alerts')
        .delete()
        .in('id', this.createdResources.alerts);
    }
  }

  private static async cleanupEscalationPolicies(): Promise<void> {
    if (this.createdResources.escalationPolicies.length > 0) {
      await testSupabase
        .from('alert_escalation_policies')
        .delete()
        .in('id', this.createdResources.escalationPolicies);
    }
  }

  private static async cleanupChannels(): Promise<void> {
    if (this.createdResources.channels.length > 0) {
      await testSupabase
        .from('notification_channels')
        .delete()
        .in('id', this.createdResources.channels);
    }
  }

  private static async cleanupAlertRules(): Promise<void> {
    if (this.createdResources.alertRules.length > 0) {
      await testSupabase
        .from('alert_rules')
        .delete()
        .in('id', this.createdResources.alertRules);
    }
  }

  private static async cleanupUsers(): Promise<void> {
    if (this.createdResources.users.length > 0) {
      await testSupabase
        .from('profiles')
        .delete()
        .in('id', this.createdResources.users);
    }
  }

  private static async cleanupTeams(): Promise<void> {
    if (this.createdResources.teams.length > 0) {
      await testSupabase
        .from('teams')
        .delete()
        .in('id', this.createdResources.teams);
    }
  }
}

// Test utilities
export class TestUtils {
  static async waitFor(condition: () => Promise<boolean>, timeout: number = 10000, interval: number = 100): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static async waitForAlert(alertId: string, expectedStatus?: string): Promise<Alert> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Alert ${alertId} not found within timeout`));
      }, TEST_CONFIG.timeouts.alertProcessing);

      const checkAlert = async () => {
        const { data, error } = await testSupabase
          .from('alerts')
          .select('*')
          .eq('id', alertId)
          .single();

        if (error) {
          clearTimeout(timeout);
          reject(error);
          return;
        }

        if (data && (!expectedStatus || data.status === expectedStatus)) {
          clearTimeout(timeout);
          resolve(data);
          return;
        }

        setTimeout(checkAlert, 500);
      };

      checkAlert();
    });
  }

  static async waitForNotification(alertId: string, channelId: string, expectedStatus: string = 'delivered'): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Notification for alert ${alertId} not found within timeout`));
      }, TEST_CONFIG.timeouts.notificationDelivery);

      const checkNotification = async () => {
        const { data, error } = await testSupabase
          .from('alert_notifications')
          .select('*')
          .eq('alert_id', alertId)
          .eq('channel_id', channelId)
          .single();

        if (error && error.code !== 'PGRST116') { // Not found error
          clearTimeout(timeout);
          reject(error);
          return;
        }

        if (data && data.status === expectedStatus) {
          clearTimeout(timeout);
          resolve(data);
          return;
        }

        setTimeout(checkNotification, 500);
      };

      checkNotification();
    });
  }

  static mockMetrics(metrics: Record<string, number>): void {
    // In a real implementation, this would inject metrics into the system
    // For testing, we can simulate this by directly calling evaluation functions
    console.log('Mocking metrics:', metrics);
  }

  static async triggerAlertEvaluation(ruleId: string, metrics: Record<string, number>): Promise<boolean> {
    const { data, error } = await testSupabase.rpc('evaluate_alert_rule', {
      rule_id: ruleId,
      metrics: metrics
    });

    if (error) throw error;
    return data;
  }

  static generateMetrics(count: number = 10): Record<string, number>[] {
    return Array.from({ length: count }, (_, i) => ({
      cpu_usage: Math.random() * 100,
      memory_usage: Math.random() * 100,
      disk_usage: Math.random() * 100,
      network_errors: Math.floor(Math.random() * 50),
      response_time: Math.random() * 5000,
      timestamp: Date.now() + (i * 1000)
    }));
  }
}

// Export test configuration for use in test files
export { TEST_CONFIG as default };
