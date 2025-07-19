/**
 * End-to-End Tests for Critical Alert Flow
 * Tests complete user workflows using Playwright
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  testUser: {
    email: 'test@example.com',
    password: 'testpassword123'
  },
  testTeam: {
    name: 'E2E Test Team',
    id: 'e2e-test-team'
  }
};

// Helper functions
async function loginUser(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', TEST_CONFIG.testUser.email);
  await page.fill('[data-testid="password-input"]', TEST_CONFIG.testUser.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function navigateToAlertsAdmin(page: Page) {
  await page.click('[data-testid="admin-menu"]');
  await page.click('[data-testid="alerts-admin-link"]');
  await page.waitForURL('/admin/alerts');
}

async function createAlertRule(page: Page, ruleConfig: {
  name: string;
  metric: string;
  threshold: number;
  severity: string;
}) {
  await page.click('[data-testid="create-rule-btn"]');
  
  // Fill rule details
  await page.fill('[data-testid="rule-name"]', ruleConfig.name);
  await page.fill('[data-testid="rule-description"]', `E2E test rule for ${ruleConfig.metric}`);
  await page.selectOption('[data-testid="metric-name"]', ruleConfig.metric);
  await page.selectOption('[data-testid="condition-type"]', 'threshold');
  await page.fill('[data-testid="threshold-value"]', ruleConfig.threshold.toString());
  await page.selectOption('[data-testid="threshold-operator"]', 'greater_than');
  await page.selectOption('[data-testid="severity"]', ruleConfig.severity);
  
  // Configure timing
  await page.fill('[data-testid="evaluation-window"]', '5');
  await page.fill('[data-testid="evaluation-frequency"]', '1');
  await page.fill('[data-testid="consecutive-failures"]', '1');
  
  // Save rule
  await page.click('[data-testid="save-rule-btn"]');
  await page.waitForSelector('[data-testid="rule-created-success"]');
}

async function addNotificationChannel(page: Page, channelConfig: {
  name: string;
  type: string;
  config: Record<string, any>;
}) {
  await page.click('[data-testid="add-channel-btn"]');
  
  await page.fill('[data-testid="channel-name"]', channelConfig.name);
  await page.selectOption('[data-testid="channel-type"]', channelConfig.type);
  
  if (channelConfig.type === 'email') {
    await page.fill('[data-testid="email-recipients"]', channelConfig.config.recipients.join(','));
    await page.fill('[data-testid="email-subject"]', channelConfig.config.subject || 'Alert: {{alert.name}}');
  } else if (channelConfig.type === 'webhook') {
    await page.fill('[data-testid="webhook-url"]', channelConfig.config.url);
    await page.selectOption('[data-testid="webhook-method"]', channelConfig.config.method || 'POST');
  }
  
  await page.click('[data-testid="save-channel-btn"]');
  await page.waitForSelector('[data-testid="channel-created-success"]');
}

async function triggerCriticalCondition(page: Page, metric: string, value: number) {
  // Navigate to system metrics simulation
  await page.goto('/admin/system-simulator');
  
  // Set metric value to trigger alert
  await page.fill(`[data-testid="metric-${metric}"]`, value.toString());
  await page.click('[data-testid="apply-metrics-btn"]');
  
  // Wait for metric to be processed
  await page.waitForTimeout(2000);
}

async function verifyEmailDelivery(email: string): Promise<boolean> {
  // In a real test, this would check an email testing service
  // For now, we'll simulate the check
  console.log(`Simulating email delivery verification for ${email}`);
  return true;
}

test.describe('Critical Alert End-to-End Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('Complete critical alert workflow', async ({ page }) => {
    // 1. Navigate to alerts administration
    await navigateToAlertsAdmin(page);
    
    // Verify we're on the alerts admin page
    await expect(page.locator('[data-testid="alerts-admin-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="alerts-admin-header"]')).toContainText('Alert Management');

    // 2. Create critical alert rule
    await createAlertRule(page, {
      name: 'Critical System Error',
      metric: 'cpu_usage',
      threshold: 90,
      severity: 'critical'
    });

    // Verify rule appears in list
    await expect(page.locator('[data-testid="alert-rules-list"]')).toContainText('Critical System Error');
    await expect(page.locator('[data-testid="rule-severity-critical"]')).toBeVisible();

    // 3. Configure notification channels
    await page.click('[data-testid="notification-channels-tab"]');
    
    // Add email channel
    await addNotificationChannel(page, {
      name: 'Critical Alerts Email',
      type: 'email',
      config: {
        recipients: ['admin@example.com', 'oncall@example.com'],
        subject: 'CRITICAL: {{alert.name}}'
      }
    });

    // Add webhook channel
    await addNotificationChannel(page, {
      name: 'PagerDuty Integration',
      type: 'webhook',
      config: {
        url: 'https://events.pagerduty.com/integration/test/enqueue',
        method: 'POST'
      }
    });

    // Verify channels are listed
    await expect(page.locator('[data-testid="notification-channels-list"]')).toContainText('Critical Alerts Email');
    await expect(page.locator('[data-testid="notification-channels-list"]')).toContainText('PagerDuty Integration');

    // 4. Link channels to alert rule
    await page.click('[data-testid="alert-rules-tab"]');
    await page.click('[data-testid="edit-rule-Critical System Error"]');
    
    await page.check('[data-testid="channel-Critical Alerts Email"]');
    await page.check('[data-testid="channel-PagerDuty Integration"]');
    
    await page.click('[data-testid="save-rule-channels-btn"]');
    await page.waitForSelector('[data-testid="rule-updated-success"]');

    // 5. Trigger alert condition
    await triggerCriticalCondition(page, 'cpu_usage', 95);

    // 6. Verify alert creation
    await page.click('[data-testid="active-alerts-tab"]');
    await page.waitForSelector('[data-testid="active-alerts-list"]', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="active-alerts-list"]')).toContainText('Critical System Error');
    await expect(page.locator('[data-testid="alert-severity-critical"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-status-active"]')).toBeVisible();

    // 7. Verify alert details
    await page.click('[data-testid="alert-details-Critical System Error"]');
    
    await expect(page.locator('[data-testid="alert-metric-value"]')).toContainText('95');
    await expect(page.locator('[data-testid="alert-threshold"]')).toContainText('90');
    await expect(page.locator('[data-testid="alert-triggered-time"]')).toBeVisible();

    // 8. Verify notification delivery status
    await page.click('[data-testid="alert-notifications-tab"]');
    
    // Check email notification
    await expect(page.locator('[data-testid="notification-Critical Alerts Email"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-status-delivered"]')).toBeVisible();
    
    // Check webhook notification
    await expect(page.locator('[data-testid="notification-PagerDuty Integration"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-status-delivered"]')).toBeVisible();

    // 9. Test acknowledgment
    await page.click('[data-testid="acknowledge-alert-btn"]');
    await page.fill('[data-testid="acknowledgment-note"]', 'Investigating the issue');
    await page.click('[data-testid="confirm-acknowledge-btn"]');
    
    // Verify acknowledgment
    await expect(page.locator('[data-testid="alert-status"]')).toContainText('Acknowledged');
    await expect(page.locator('[data-testid="acknowledged-by"]')).toContainText(TEST_CONFIG.testUser.email);
    await expect(page.locator('[data-testid="acknowledgment-note"]')).toContainText('Investigating the issue');

    // 10. Test resolution
    await page.click('[data-testid="resolve-alert-btn"]');
    await page.fill('[data-testid="resolution-note"]', 'Issue resolved - CPU usage normalized');
    await page.click('[data-testid="confirm-resolve-btn"]');
    
    // Verify resolution
    await expect(page.locator('[data-testid="alert-status"]')).toContainText('Resolved');
    await expect(page.locator('[data-testid="resolved-by"]')).toContainText(TEST_CONFIG.testUser.email);
    await expect(page.locator('[data-testid="resolution-note"]')).toContainText('Issue resolved - CPU usage normalized');

    // 11. Verify alert appears in resolved alerts
    await page.click('[data-testid="resolved-alerts-tab"]');
    await expect(page.locator('[data-testid="resolved-alerts-list"]')).toContainText('Critical System Error');
  });

  test('Multi-level escalation policy execution', async ({ page }) => {
    // 1. Create escalation policy
    await navigateToAlertsAdmin(page);
    await page.click('[data-testid="escalation-policies-tab"]');
    await page.click('[data-testid="create-escalation-policy-btn"]');
    
    await page.fill('[data-testid="policy-name"]', 'Critical Escalation');
    await page.fill('[data-testid="policy-description"]', 'Multi-level escalation for critical alerts');
    
    // Configure escalation levels
    await page.click('[data-testid="add-escalation-level-btn"]');
    await page.fill('[data-testid="level-1-delay"]', '0');
    await page.selectOption('[data-testid="level-1-channels"]', ['oncall-team']);
    
    await page.click('[data-testid="add-escalation-level-btn"]');
    await page.fill('[data-testid="level-2-delay"]', '5');
    await page.selectOption('[data-testid="level-2-channels"]', ['team-lead']);
    
    await page.click('[data-testid="add-escalation-level-btn"]');
    await page.fill('[data-testid="level-3-delay"]', '15');
    await page.selectOption('[data-testid="level-3-channels"]', ['director']);
    
    await page.click('[data-testid="save-escalation-policy-btn"]');

    // 2. Create alert rule with escalation policy
    await page.click('[data-testid="alert-rules-tab"]');
    await createAlertRule(page, {
      name: 'Escalation Test Alert',
      metric: 'memory_usage',
      threshold: 85,
      severity: 'critical'
    });
    
    // Link escalation policy
    await page.click('[data-testid="edit-rule-Escalation Test Alert"]');
    await page.selectOption('[data-testid="escalation-policy"]', 'Critical Escalation');
    await page.click('[data-testid="save-rule-btn"]');

    // 3. Trigger alert
    await triggerCriticalCondition(page, 'memory_usage', 90);

    // 4. Verify level 1 notification (immediate)
    await page.click('[data-testid="active-alerts-tab"]');
    await page.waitForSelector('[data-testid="alert-Escalation Test Alert"]');
    await page.click('[data-testid="alert-details-Escalation Test Alert"]');
    await page.click('[data-testid="escalation-history-tab"]');
    
    await expect(page.locator('[data-testid="escalation-level-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="escalation-level-1-status"]')).toContainText('Completed');

    // 5. Wait for level 2 escalation (5 minutes - simulated)
    await page.click('[data-testid="simulate-time-advance-btn"]');
    await page.fill('[data-testid="time-advance-minutes"]', '6');
    await page.click('[data-testid="apply-time-advance-btn"]');
    
    await page.reload();
    await expect(page.locator('[data-testid="escalation-level-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="escalation-level-2-status"]')).toContainText('Completed');

    // 6. Acknowledge at level 2 to stop escalation
    await page.click('[data-testid="acknowledge-alert-btn"]');
    await page.fill('[data-testid="acknowledgment-note"]', 'Team lead acknowledging');
    await page.click('[data-testid="confirm-acknowledge-btn"]');

    // 7. Verify escalation stops (level 3 should not trigger)
    await page.click('[data-testid="simulate-time-advance-btn"]');
    await page.fill('[data-testid="time-advance-minutes"]', '20');
    await page.click('[data-testid="apply-time-advance-btn"]');
    
    await page.reload();
    await expect(page.locator('[data-testid="escalation-level-3"]')).not.toBeVisible();
  });

  test('Maintenance window suppression', async ({ page }) => {
    // 1. Create maintenance window
    await navigateToAlertsAdmin(page);
    await page.click('[data-testid="maintenance-windows-tab"]');
    await page.click('[data-testid="create-maintenance-window-btn"]');
    
    await page.fill('[data-testid="maintenance-name"]', 'System Upgrade');
    await page.fill('[data-testid="maintenance-description"]', 'Scheduled system maintenance');
    
    // Set maintenance window for next hour
    const now = new Date();
    const startTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
    const endTime = new Date(now.getTime() + 65 * 60000); // 65 minutes from now
    
    await page.fill('[data-testid="maintenance-start"]', startTime.toISOString().slice(0, 16));
    await page.fill('[data-testid="maintenance-end"]', endTime.toISOString().slice(0, 16));
    
    await page.check('[data-testid="suppress-all-alerts"]');
    await page.click('[data-testid="save-maintenance-window-btn"]');

    // 2. Create alert rule
    await page.click('[data-testid="alert-rules-tab"]');
    await createAlertRule(page, {
      name: 'Maintenance Test Alert',
      metric: 'disk_usage',
      threshold: 80,
      severity: 'high'
    });

    // 3. Advance time to maintenance window
    await page.click('[data-testid="simulate-time-advance-btn"]');
    await page.fill('[data-testid="time-advance-minutes"]', '10');
    await page.click('[data-testid="apply-time-advance-btn"]');

    // 4. Trigger alerts during maintenance
    await triggerCriticalCondition(page, 'disk_usage', 85);

    // 5. Verify alerts are suppressed
    await page.click('[data-testid="active-alerts-tab"]');
    await page.waitForTimeout(5000); // Wait for processing
    
    // Should not see active alerts
    await expect(page.locator('[data-testid="no-active-alerts"]')).toBeVisible();
    
    // Check suppression log
    await page.click('[data-testid="suppression-log-tab"]');
    await expect(page.locator('[data-testid="suppression-reason"]')).toContainText('Maintenance window');

    // 6. End maintenance window
    await page.click('[data-testid="maintenance-windows-tab"]');
    await page.click('[data-testid="end-maintenance-System Upgrade"]');
    await page.click('[data-testid="confirm-end-maintenance-btn"]');

    // 7. Trigger alert after maintenance
    await triggerCriticalCondition(page, 'disk_usage', 87);

    // 8. Verify normal notification delivery
    await page.click('[data-testid="active-alerts-tab"]');
    await page.waitForSelector('[data-testid="alert-Maintenance Test Alert"]');
    
    await expect(page.locator('[data-testid="alert-Maintenance Test Alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-status-active"]')).toBeVisible();
  });

  test('Rate limiting behavior', async ({ page }) => {
    // 1. Create alert rule with low rate limits
    await navigateToAlertsAdmin(page);
    await createAlertRule(page, {
      name: 'Rate Limit Test',
      metric: 'network_errors',
      threshold: 10,
      severity: 'medium'
    });
    
    // Configure low rate limits
    await page.click('[data-testid="edit-rule-Rate Limit Test"]');
    await page.fill('[data-testid="max-alerts-per-hour"]', '3');
    await page.fill('[data-testid="cooldown-minutes"]', '10');
    await page.click('[data-testid="save-rule-btn"]');

    // 2. Trigger multiple alerts rapidly
    for (let i = 0; i < 5; i++) {
      await triggerCriticalCondition(page, 'network_errors', 15 + i);
      await page.waitForTimeout(1000); // Small delay between triggers
    }

    // 3. Verify only allowed number of alerts were created
    await page.click('[data-testid="active-alerts-tab"]');
    
    const alertElements = await page.locator('[data-testid^="alert-Rate Limit Test"]').count();
    expect(alertElements).toBeLessThanOrEqual(3);

    // 4. Check rate limiting log
    await page.click('[data-testid="rate-limiting-tab"]');
    await expect(page.locator('[data-testid="rate-limit-exceeded"]')).toBeVisible();
    await expect(page.locator('[data-testid="suppressed-alerts-count"]')).toContainText('2');
  });
});
