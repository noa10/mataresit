# Alerting System Testing Strategy - Phase 1

## Overview

This document outlines a comprehensive testing strategy for the Phase 1 alerting system implementation, covering all 6 major components: database schema, real-time alert engine, multi-channel notifications, escalation management, configurable rules interface, and alert suppression/rate limiting.

## Testing Framework Stack

### Core Testing Tools
- **Unit Testing**: Vitest (recommended upgrade from current Mocha/Chai setup)
- **Integration Testing**: Supertest + Supabase Test Client
- **E2E Testing**: Playwright (for admin interface)
- **Database Testing**: Supabase CLI + pgTAP
- **Performance Testing**: Artillery.js + Custom metrics
- **Mocking**: MSW (Mock Service Worker) for API mocking

### Current Stack Integration
- Leverage existing Mocha/Chai setup for immediate implementation
- Gradual migration to Vitest for better TypeScript support
- Utilize existing Supabase test client configuration

## 1. Unit Testing Strategy

### 1.1 Alert Engine Components

#### AlertingService (`src/services/alertingService.ts`)
```typescript
// Test file: src/services/__tests__/alertingService.test.ts
describe('AlertingService', () => {
  describe('createAlertRule', () => {
    it('should create alert rule with valid configuration')
    it('should validate metric thresholds')
    it('should handle invalid severity levels')
    it('should apply default cooldown settings')
  })
  
  describe('evaluateAlertRule', () => {
    it('should trigger alert when threshold exceeded')
    it('should respect consecutive failures requirement')
    it('should handle missing metrics gracefully')
    it('should apply evaluation window correctly')
  })
})
```

#### Notification Channels (`src/services/notificationChannelService.ts`)
```typescript
describe('NotificationChannelService', () => {
  describe('sendNotification', () => {
    it('should send email notifications successfully')
    it('should handle webhook delivery with retries')
    it('should format Slack messages correctly')
    it('should respect rate limits per channel')
  })
  
  describe('validateChannelConfig', () => {
    it('should validate email configuration')
    it('should validate webhook URLs')
    it('should validate Slack channel format')
  })
})
```

#### Suppression Manager (`src/services/alertSuppressionManager.ts`)
```typescript
describe('AlertSuppressionManager', () => {
  describe('shouldSuppressAlert', () => {
    it('should suppress during maintenance windows')
    it('should respect cooldown periods')
    it('should handle duplicate alert detection')
    it('should apply rate limiting correctly')
  })
})
```

#### Rate Limiter (`src/services/alertRateLimiter.ts`)
```typescript
describe('AlertRateLimiter', () => {
  describe('checkRateLimit', () => {
    it('should allow alerts within limits')
    it('should block alerts exceeding limits')
    it('should reset counters after window expires')
    it('should handle concurrent requests safely')
  })
})
```

### 1.2 React Hooks Testing

#### useAlertEngine Hook
```typescript
// Test file: src/hooks/__tests__/useAlertEngine.test.ts
describe('useAlertEngine', () => {
  it('should start engine successfully')
  it('should handle engine failures gracefully')
  it('should refresh alerts automatically')
  it('should acknowledge alerts correctly')
  it('should update statistics in real-time')
})
```

#### useNotificationChannels Hook
```typescript
describe('useNotificationChannels', () => {
  it('should create channels with validation')
  it('should test channel connectivity')
  it('should update channel configurations')
  it('should handle channel deletion')
})
```

### 1.3 Component Testing

#### AlertRulesInterface Component
```typescript
// Test file: src/components/admin/__tests__/AlertRulesInterface.test.tsx
describe('AlertRulesInterface', () => {
  it('should render alert rules list')
  it('should create new alert rules')
  it('should edit existing rules')
  it('should delete rules with confirmation')
  it('should show real-time alert status')
})
```

## 2. Integration Testing Plan

### 2.1 Complete Alert Flow Testing

#### Database to Notification Pipeline
```typescript
// Test file: tests/integration/alert-flow-integration.test.ts
describe('Alert Flow Integration', () => {
  it('should trigger alert from database metric change')
  it('should evaluate multiple rules simultaneously')
  it('should deliver notifications to all configured channels')
  it('should handle escalation policy execution')
  it('should suppress duplicate alerts correctly')
})
```

#### Real-time Processing Integration
```typescript
describe('Real-time Alert Processing', () => {
  it('should process alerts within 30 seconds of trigger')
  it('should handle concurrent alert evaluations')
  it('should maintain alert state consistency')
  it('should recover from processing failures')
})
```

### 2.2 Cross-Service Communication

#### Supabase Edge Functions Integration
```typescript
describe('Edge Functions Integration', () => {
  it('should trigger alerts from edge function metrics')
  it('should handle authentication correctly')
  it('should process webhook notifications')
  it('should maintain RLS policy compliance')
})
```

#### External Service Integration
```typescript
describe('External Services Integration', () => {
  it('should send emails via configured SMTP')
  it('should deliver webhooks to external systems')
  it('should integrate with Slack API')
  it('should handle external service outages')
})
```

## 3. End-to-End Testing Scenarios

### 3.1 Critical Alert Scenarios

#### High-Severity Alert Flow
```typescript
// Test file: tests/e2e/critical-alert-flow.spec.ts
test('Critical Alert End-to-End Flow', async ({ page }) => {
  // 1. Create critical alert rule
  await page.goto('/admin/alerts')
  await page.click('[data-testid="create-rule-btn"]')
  await page.fill('[data-testid="rule-name"]', 'Critical System Error')
  await page.selectOption('[data-testid="severity"]', 'critical')
  
  // 2. Configure notification channels
  await page.click('[data-testid="add-channel"]')
  await page.selectOption('[data-testid="channel-type"]', 'email')
  await page.fill('[data-testid="email-recipients"]', 'admin@example.com')
  
  // 3. Trigger alert condition
  await triggerCriticalCondition()
  
  // 4. Verify alert creation
  await expect(page.locator('[data-testid="active-alerts"]')).toContainText('Critical System Error')
  
  // 5. Verify notification delivery
  await verifyEmailDelivery('admin@example.com')
  
  // 6. Test acknowledgment
  await page.click('[data-testid="acknowledge-btn"]')
  await expect(page.locator('[data-testid="alert-status"]')).toContainText('Acknowledged')
})
```

### 3.2 Escalation Policy Testing

#### Multi-Level Escalation
```typescript
test('Multi-Level Escalation Policy', async ({ page }) => {
  // 1. Create escalation policy
  await createEscalationPolicy({
    levels: [
      { delay: 5, contacts: ['oncall@team.com'] },
      { delay: 15, contacts: ['manager@team.com'] },
      { delay: 30, contacts: ['director@team.com'] }
    ]
  })
  
  // 2. Trigger alert
  await triggerAlert('high')
  
  // 3. Verify level 1 notification
  await waitForNotification('oncall@team.com', 5)
  
  // 4. Wait for escalation
  await waitForNotification('manager@team.com', 15)
  
  // 5. Acknowledge at level 2
  await acknowledgeAlert()
  
  // 6. Verify escalation stops
  await verifyNoNotification('director@team.com', 30)
})
```

### 3.3 Suppression and Rate Limiting

#### Maintenance Window Testing
```typescript
test('Maintenance Window Suppression', async ({ page }) => {
  // 1. Create maintenance window
  await createMaintenanceWindow({
    start: new Date(),
    duration: 60, // minutes
    suppressionRules: ['all']
  })
  
  // 2. Trigger alerts during maintenance
  await triggerMultipleAlerts()
  
  // 3. Verify alerts are suppressed
  await verifyNoNotifications()
  
  // 4. End maintenance window
  await endMaintenanceWindow()
  
  // 5. Trigger alert after maintenance
  await triggerAlert()
  
  // 6. Verify normal notification delivery
  await verifyNotificationDelivery()
})
```

## 4. Performance Testing

### 4.1 Alert Volume Testing

#### High-Volume Alert Processing
```javascript
// Test file: tests/performance/alert-volume.test.js
const Artillery = require('artillery')

const config = {
  target: 'http://localhost:3000',
  phases: [
    { duration: 60, arrivalRate: 10 }, // Ramp up
    { duration: 300, arrivalRate: 50 }, // Sustained load
    { duration: 60, arrivalRate: 100 } // Peak load
  ],
  scenarios: [
    {
      name: 'Alert Creation',
      weight: 70,
      flow: [
        { post: { url: '/api/alerts/trigger', json: { metric: 'cpu_usage', value: 95 } } }
      ]
    },
    {
      name: 'Alert Acknowledgment',
      weight: 30,
      flow: [
        { post: { url: '/api/alerts/acknowledge', json: { alertId: '{{ alertId }}' } } }
      ]
    }
  ]
}

// Performance thresholds
const thresholds = {
  alertProcessingTime: 5000, // 5 seconds max
  notificationDeliveryTime: 30000, // 30 seconds max
  throughput: 100, // alerts per second
  errorRate: 0.01 // 1% max error rate
}
```

### 4.2 Notification Throughput Testing

#### Multi-Channel Delivery Performance
```typescript
describe('Notification Performance', () => {
  it('should deliver 1000 notifications within 2 minutes', async () => {
    const startTime = Date.now()
    const notifications = generateNotifications(1000)
    
    await Promise.all(notifications.map(n => deliverNotification(n)))
    
    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(120000) // 2 minutes
  })
  
  it('should handle concurrent channel delivery', async () => {
    const alert = createTestAlert()
    const channels = ['email', 'webhook', 'slack']
    
    const deliveryPromises = channels.map(channel => 
      measureDeliveryTime(alert, channel)
    )
    
    const results = await Promise.all(deliveryPromises)
    results.forEach(result => {
      expect(result.duration).toBeLessThan(10000) // 10 seconds
      expect(result.success).toBe(true)
    })
  })
})
```

## 5. Database Testing

### 5.1 Migration Testing

#### Schema Validation
```sql
-- Test file: tests/database/schema-validation.sql
BEGIN;

-- Test alert_rules table structure
SELECT has_table('public', 'alert_rules', 'alert_rules table exists');
SELECT has_column('public', 'alert_rules', 'id', 'alert_rules has id column');
SELECT has_column('public', 'alert_rules', 'severity', 'alert_rules has severity column');

-- Test RLS policies
SELECT policy_exists('public', 'alert_rules', 'Users can manage alert rules in their teams');

-- Test triggers
SELECT trigger_exists('public', 'alert_rules', 'update_alert_rules_updated_at');

-- Test functions
SELECT function_exists('public', 'evaluate_alert_rule');
SELECT function_exists('public', 'suppress_alert');

ROLLBACK;
```

### 5.2 RLS Policy Testing

#### Row Level Security Validation
```typescript
// Test file: tests/database/rls-policies.test.ts
describe('RLS Policies', () => {
  it('should allow team members to access team alert rules', async () => {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('team_id', testTeamId)
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
  })
  
  it('should deny access to other teams alert rules', async () => {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('team_id', otherTeamId)
    
    expect(data).toHaveLength(0)
  })
})
```

### 5.3 Stored Function Testing

#### Database Function Validation
```sql
-- Test file: tests/database/functions.sql
BEGIN;

-- Test evaluate_alert_rule function
SELECT plan(5);

-- Test with valid alert rule
SELECT ok(
  evaluate_alert_rule('test-rule-id', '{"cpu_usage": 95}'::jsonb),
  'evaluate_alert_rule returns true for threshold breach'
);

-- Test with invalid data
SELECT ok(
  NOT evaluate_alert_rule('invalid-rule-id', '{}'::jsonb),
  'evaluate_alert_rule returns false for invalid rule'
);

SELECT finish();
ROLLBACK;
```

## 6. Frontend Testing

### 6.1 React Component Testing

#### Alert Dashboard Components
```typescript
// Test file: src/components/admin/__tests__/AlertDashboard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AlertDashboard } from '../AlertDashboard'

describe('AlertDashboard', () => {
  it('should display alert statistics', async () => {
    render(<AlertDashboard teamId="test-team" />)
    
    await waitFor(() => {
      expect(screen.getByText('Active Alerts')).toBeInTheDocument()
      expect(screen.getByText('24')).toBeInTheDocument() // Mock count
    })
  })
  
  it('should refresh data when refresh button clicked', async () => {
    const mockRefresh = jest.fn()
    render(<AlertDashboard teamId="test-team" onRefresh={mockRefresh} />)
    
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(mockRefresh).toHaveBeenCalled()
  })
})
```

### 6.2 Hook Testing

#### Custom Hook Validation
```typescript
// Test file: src/hooks/__tests__/useAlertEngine.test.ts
import { renderHook, act } from '@testing-library/react'
import { useAlertEngine } from '../useAlertEngine'

describe('useAlertEngine', () => {
  it('should start engine and update status', async () => {
    const { result } = renderHook(() => useAlertEngine({ teamId: 'test' }))
    
    await act(async () => {
      await result.current.startEngine()
    })
    
    expect(result.current.status?.isRunning).toBe(true)
    expect(result.current.isEngineHealthy).toBe(true)
  })
})
```

## 7. Error Handling and Edge Cases

### 7.1 Failure Scenarios

#### Network Failure Testing
```typescript
describe('Network Failure Handling', () => {
  it('should retry failed notifications', async () => {
    // Mock network failure
    mockNetworkFailure()
    
    const alert = createTestAlert()
    const result = await deliverNotification(alert, 'webhook')
    
    expect(result.attempts).toBeGreaterThan(1)
    expect(result.success).toBe(true) // Eventually succeeds
  })
  
  it('should fallback to alternative channels', async () => {
    // Mock primary channel failure
    mockChannelFailure('email')
    
    const alert = createTestAlert()
    await processAlert(alert)
    
    // Verify fallback channel was used
    expect(getNotificationHistory()).toContain('slack')
  })
})
```

### 7.2 Data Consistency Testing

#### Concurrent Modification Handling
```typescript
describe('Concurrent Modifications', () => {
  it('should handle concurrent alert acknowledgments', async () => {
    const alertId = 'test-alert'
    
    // Simulate concurrent acknowledgments
    const promises = Array(5).fill(null).map(() => 
      acknowledgeAlert(alertId)
    )
    
    const results = await Promise.allSettled(promises)
    
    // Only one should succeed
    const successful = results.filter(r => r.status === 'fulfilled')
    expect(successful).toHaveLength(1)
  })
})
```

## 8. Deployment Testing

### 8.1 Environment Validation

#### Development Environment
```bash
#!/bin/bash
# Test file: tests/deployment/dev-environment.sh

echo "Testing development environment..."

# Test database connectivity
npm run test:db-connection

# Test Supabase functions
npm run test:edge-functions

# Test notification channels
npm run test:notification-channels

# Test alert engine startup
npm run test:alert-engine

echo "Development environment validation complete"
```

#### Staging Environment
```typescript
// Test file: tests/deployment/staging-validation.test.ts
describe('Staging Environment', () => {
  it('should have all required environment variables', () => {
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SMTP_HOST',
      'SLACK_WEBHOOK_URL'
    ]
    
    requiredVars.forEach(varName => {
      expect(process.env[varName]).toBeDefined()
    })
  })
  
  it('should connect to staging database', async () => {
    const { data, error } = await supabase.from('alert_rules').select('count')
    expect(error).toBeNull()
  })
})
```

### 8.2 Production Readiness

#### Production Smoke Tests
```typescript
describe('Production Readiness', () => {
  it('should handle production load', async () => {
    // Test with production-like data volumes
    const alerts = generateProductionAlerts(10000)
    const startTime = Date.now()
    
    await processAlerts(alerts)
    
    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(300000) // 5 minutes
  })
  
  it('should maintain 99.9% uptime', async () => {
    const uptimeCheck = await checkSystemUptime()
    expect(uptimeCheck.percentage).toBeGreaterThan(99.9)
  })
})
```

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- Set up testing infrastructure
- Implement unit tests for core services
- Create database testing framework

### Phase 2: Integration (Week 2)
- Implement integration tests
- Set up E2E testing framework
- Create performance testing baseline

### Phase 3: Comprehensive (Week 3)
- Complete E2E test scenarios
- Implement error handling tests
- Set up deployment validation

### Phase 4: Optimization (Week 4)
- Performance tuning based on test results
- Test coverage optimization
- Documentation and training

## Success Metrics

- **Test Coverage**: >90% for critical paths
- **Performance**: <5s alert processing, <30s notification delivery
- **Reliability**: 99.9% uptime, <0.1% error rate
- **Scalability**: Handle 1000+ alerts/hour
- **Recovery**: <2 minutes MTTR for system failures

This comprehensive testing strategy ensures the alerting system is robust, reliable, and ready for production deployment.
