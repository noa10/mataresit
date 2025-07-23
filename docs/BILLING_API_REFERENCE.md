# Billing System API Reference

## Overview

This document provides comprehensive API reference for all Mataresit billing system Edge Functions. All functions are deployed as Supabase Edge Functions and can be invoked via the Supabase client or direct HTTP requests.

## Authentication

All API calls require proper authentication:

```typescript
// Using Supabase client
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { action: 'action-name', ...params }
});

// Direct HTTP request
const response = await fetch(`${SUPABASE_URL}/functions/v1/function-name`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ action: 'action-name', ...params })
});
```

## Edge Functions

### 1. billing-auto-renewal

Handles automatic subscription renewal logic and configuration.

#### configure_auto_renewal

Configure auto-renewal settings for a user.

**Request:**
```typescript
{
  action: 'configure_auto_renewal',
  userId: string,
  enabled: boolean,
  frequency: 'monthly' | 'annual',
  grace_period_days?: number,
  max_retry_attempts?: number,
  retry_interval_hours?: number
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string,
  configuration: {
    auto_renewal_enabled: boolean,
    auto_renewal_frequency: string,
    grace_period_days: number,
    max_payment_retry_attempts: number,
    retry_interval_hours: number
  }
}
```

#### process_renewals

Process pending subscription renewals.

**Request:**
```typescript
{
  action: 'process_renewals',
  limit?: number,
  dry_run?: boolean
}
```

**Response:**
```typescript
{
  success: boolean,
  processed: number,
  successful: number,
  failed: number,
  results: Array<{
    subscription_id: string,
    user_id: string,
    status: 'success' | 'failed',
    error?: string
  }>
}
```

#### handle_payment_retry

Handle failed payment retry logic.

**Request:**
```typescript
{
  action: 'handle_payment_retry',
  subscriptionId: string,
  attempt?: number
}
```

**Response:**
```typescript
{
  success: boolean,
  retry_scheduled: boolean,
  next_attempt?: string,
  max_attempts_reached?: boolean
}
```

#### check_subscription_health

Check subscription health and status.

**Request:**
```typescript
{
  action: 'check_subscription_health',
  userId: string,
  subscriptionId?: string
}
```

**Response:**
```typescript
{
  success: boolean,
  health: {
    subscription_tier: string,
    subscription_status: string,
    issues: Array<{
      type: string,
      severity: 'low' | 'medium' | 'high' | 'critical',
      message: string,
      expires_at?: string
    }>,
    recommendations: Array<{
      type: string,
      message: string
    }>,
    next_actions: string[]
  }
}
```

### 2. email-scheduler

Manages intelligent email scheduling and delivery tracking.

#### schedule_billing_reminders

Schedule billing reminder emails for a user.

**Request:**
```typescript
{
  action: 'schedule_billing_reminders',
  userId: string,
  subscriptionId: string,
  renewalDate: string,
  reminderTypes?: Array<'upcoming_renewal' | 'payment_due' | 'payment_overdue'>
}
```

**Response:**
```typescript
{
  success: boolean,
  scheduled_count: number,
  reminders: Array<{
    id: string,
    reminder_type: string,
    scheduled_for: string,
    template_name: string
  }>
}
```

#### process_scheduled_emails

Process pending scheduled emails.

**Request:**
```typescript
{
  action: 'process_scheduled_emails',
  limit?: number,
  priority_threshold?: number
}
```

**Response:**
```typescript
{
  success: boolean,
  processed: number,
  sent: number,
  failed: number,
  skipped: number,
  results: Array<{
    id: string,
    status: 'sent' | 'failed' | 'skipped',
    error?: string
  }>
}
```

#### reschedule_failed_emails

Reschedule failed email deliveries.

**Request:**
```typescript
{
  action: 'reschedule_failed_emails',
  max_retry_count?: number,
  backoff_multiplier?: number
}
```

**Response:**
```typescript
{
  success: boolean,
  rescheduled: number,
  abandoned: number,
  results: Array<{
    id: string,
    action: 'rescheduled' | 'abandoned',
    next_attempt?: string
  }>
}
```

#### get_email_delivery_stats

Get email delivery statistics and analytics.

**Request:**
```typescript
{
  action: 'get_email_delivery_stats',
  userId?: string,
  dateRange?: '1h' | '24h' | '7d' | '30d',
  reminderType?: string
}
```

**Response:**
```typescript
{
  success: boolean,
  stats: {
    total_emails: number,
    sent_emails: number,
    delivered_emails: number,
    failed_emails: number,
    scheduled_emails: number,
    delivery_rate: number,
    failure_rate: number,
    avg_processing_time_minutes: number,
    by_status: Record<string, number>,
    by_type: Record<string, number>
  }
}
```

#### update_email_preferences

Update user email preferences.

**Request:**
```typescript
{
  action: 'update_email_preferences',
  userId: string,
  preferences: {
    billing_email_enabled?: boolean,
    reminder_days_before_renewal?: number[],
    payment_failure_notifications?: boolean,
    grace_period_notifications?: boolean,
    preferred_language?: 'en' | 'ms',
    timezone?: string,
    quiet_hours_start?: string,
    quiet_hours_end?: string
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string,
  preferences: BillingPreferences
}
```

### 3. send-email

Enhanced email delivery with template support and tracking.

#### Send Email

Send an email using templates with optional preview mode.

**Request:**
```typescript
{
  to: string,
  subject?: string,
  html?: string,
  text?: string,
  template_name?: string,
  template_data?: Record<string, any>,
  related_entity_type?: string,
  related_entity_id?: string,
  team_id?: string,
  metadata?: Record<string, any>,
  preview_mode?: boolean
}
```

**Response:**
```typescript
{
  success: boolean,
  message_id?: string,
  preview?: {
    to: string,
    subject: string,
    html: string,
    text: string,
    template_name?: string,
    template_data?: Record<string, any>
  },
  error?: string
}
```

### 4. billing-monitor

Real-time system monitoring and health metrics.

#### get_health_metrics

Get comprehensive system health metrics.

**Request:**
```typescript
{
  action: 'get_health_metrics',
  timeframe?: '1h' | '6h' | '24h' | '7d' | '30d',
  include_details?: boolean
}
```

**Response:**
```typescript
{
  success: boolean,
  metrics: {
    overall_health: 'healthy' | 'warning' | 'critical',
    payment_processing: {
      success_rate: number,
      failed_payments_24h: number,
      retry_queue_depth: number,
      average_processing_time: number
    },
    email_delivery: {
      delivery_rate: number,
      failed_deliveries_24h: number,
      scheduled_emails_pending: number,
      average_delivery_time: number
    },
    subscription_health: {
      active_subscriptions: number,
      grace_period_subscriptions: number,
      failed_renewals_24h: number,
      churn_rate_7d: number
    },
    system_performance: {
      webhook_processing_rate: number,
      database_query_time: number,
      function_error_rate: number,
      api_response_time: number
    },
    alerts: Array<{
      id: string,
      severity: 'low' | 'medium' | 'high' | 'critical',
      type: string,
      message: string,
      timestamp: string,
      acknowledged: boolean
    }>
  },
  timestamp: string,
  timeframe: string
}
```

#### get_payment_metrics

Get detailed payment processing metrics.

**Request:**
```typescript
{
  action: 'get_payment_metrics',
  timeframe?: string
}
```

**Response:**
```typescript
{
  success: boolean,
  metrics: {
    success_rate: number,
    failed_payments: number,
    total_payments: number,
    total_amount: number,
    average_processing_time: number,
    retry_queue_depth: number,
    by_status: Record<string, number>,
    by_currency: Record<string, number>
  },
  timestamp: string
}
```

#### trigger_health_check

Trigger comprehensive system health check.

**Request:**
```typescript
{
  action: 'trigger_health_check'
}
```

**Response:**
```typescript
{
  success: boolean,
  health_checks: Array<{
    component: string,
    status: 'fulfilled' | 'rejected',
    result: any
  }>,
  timestamp: string
}
```

#### acknowledge_alert

Acknowledge a system alert.

**Request:**
```typescript
{
  action: 'acknowledge_alert',
  alert_id: string,
  acknowledged_by: string
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string
}
```

### 5. billing-alerting

Automated alerting and notification system.

#### check_alert_conditions

Check all alert conditions and trigger alerts if necessary.

**Request:**
```typescript
{
  action: 'check_alert_conditions'
}
```

**Response:**
```typescript
{
  success: boolean,
  alerts_checked: number,
  alerts_triggered: number,
  alerts: Array<{
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    message: string,
    component: string,
    details: Record<string, any>
  }>
}
```

#### create_alert

Create a new system alert.

**Request:**
```typescript
{
  action: 'create_alert',
  alert_type: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  title: string,
  message: string,
  component?: string,
  user_id?: string,
  subscription_id?: string,
  details?: Record<string, any>
}
```

**Response:**
```typescript
{
  success: boolean,
  alert_id: string,
  message: string
}
```

#### resolve_alert

Resolve an active alert.

**Request:**
```typescript
{
  action: 'resolve_alert',
  alert_id: string,
  resolved_by?: string
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string
}
```

### 6. billing-test-suite

Comprehensive testing and validation framework.

#### run_all_tests

Execute the complete billing system test suite.

**Request:**
```typescript
{
  action: 'run_all_tests',
  test_config?: {
    test_user_id?: string,
    include_cleanup?: boolean,
    generate_test_data?: boolean,
    timeout_ms?: number
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  summary: {
    total_suites: number,
    total_tests: number,
    passed: number,
    failed: number,
    skipped: number,
    success_rate: number,
    duration_ms: number
  },
  test_suites: Array<{
    suite_name: string,
    total_tests: number,
    passed: number,
    failed: number,
    skipped: number,
    duration_ms: number,
    tests: Array<{
      test_name: string,
      status: 'passed' | 'failed' | 'skipped',
      duration_ms: number,
      error?: string,
      details?: any
    }>
  }>,
  timestamp: string
}
```

#### test_email_templates

Test email template rendering and validation.

**Request:**
```typescript
{
  action: 'test_email_templates',
  test_config?: {
    templates?: string[],
    languages?: string[]
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  templates_tested: number,
  results: Array<{
    template: string,
    status: 'passed' | 'failed',
    error?: string,
    preview?: any
  }>
}
```

#### validate_billing_workflow

Validate end-to-end billing workflow.

**Request:**
```typescript
{
  action: 'validate_billing_workflow',
  test_config?: {
    test_user_id?: string,
    subscription_tier?: string
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  workflow_validation: {
    total_steps: number,
    passed_steps: number,
    failed_steps: number,
    success_rate: number
  },
  workflow_steps: Array<{
    step: string,
    status: 'passed' | 'failed',
    error?: string,
    result?: any
  }>
}
```

## Database Functions

### RPC Functions

These functions can be called directly via Supabase RPC:

```typescript
const { data, error } = await supabase.rpc('function_name', {
  parameter_name: value
});
```

#### initialize_billing_preferences

Initialize billing preferences for a new user.

**Parameters:**
- `p_user_id: UUID` - User ID
- `p_subscription_tier: TEXT` - Subscription tier

**Returns:** `UUID` - Billing preferences ID

#### get_billing_preferences

Get billing preferences for a user.

**Parameters:**
- `p_user_id: UUID` - User ID

**Returns:** `JSONB` - Billing preferences object

#### schedule_billing_reminder

Schedule a billing reminder email.

**Parameters:**
- `p_user_id: UUID` - User ID
- `p_subscription_id: TEXT` - Subscription ID
- `p_reminder_type: billing_reminder_type` - Reminder type
- `p_scheduled_for: TIMESTAMP WITH TIME ZONE` - Schedule time
- `p_template_data: JSONB` - Template data
- `p_language: TEXT` - Language code

**Returns:** `UUID` - Schedule ID

#### get_payment_health_metrics

Get payment processing health metrics.

**Parameters:**
- `p_time_filter: TIMESTAMP WITH TIME ZONE` - Time filter

**Returns:** `TABLE` - Payment health metrics

#### get_subscription_health_metrics

Get subscription health metrics.

**Parameters:**
- `p_time_filter: TIMESTAMP WITH TIME ZONE` - Time filter

**Returns:** `TABLE` - Subscription health metrics

#### create_billing_system_alert

Create a new billing system alert.

**Parameters:**
- `p_alert_type: TEXT` - Alert type
- `p_severity: TEXT` - Alert severity
- `p_title: TEXT` - Alert title
- `p_message: TEXT` - Alert message
- `p_component: TEXT` - Component name (optional)
- `p_user_id: UUID` - User ID (optional)
- `p_subscription_id: TEXT` - Subscription ID (optional)
- `p_details: JSONB` - Alert details (optional)

**Returns:** `UUID` - Alert ID

## Error Handling

All API responses follow a consistent error format:

```typescript
{
  success: false,
  error: string,
  message: string,
  details?: any
}
```

### Common Error Codes

- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource not found)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error (system error)

## Rate Limiting

API calls are subject to rate limiting:

- **Standard functions**: 100 requests per minute per user
- **Monitoring functions**: 60 requests per minute per user
- **Test functions**: 10 requests per minute per user

## Webhooks

### Stripe Webhook Events

The system handles the following Stripe webhook events:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.upcoming`
- `invoice.finalized`
- `payment_method.attached`
- `payment_method.detached`
- `setup_intent.succeeded`

### Webhook Payload

All webhook events are processed and logged in the audit trail:

```typescript
{
  event_type: string,
  event_description: string,
  stripe_event_id: string,
  stripe_subscription_id?: string,
  metadata: Record<string, any>,
  triggered_by: 'stripe_webhook'
}
```

## SDK Usage Examples

### TypeScript/JavaScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configure auto-renewal
const { data, error } = await supabase.functions.invoke('billing-auto-renewal', {
  body: {
    action: 'configure_auto_renewal',
    userId: 'user-id',
    enabled: true,
    frequency: 'monthly'
  }
});

// Schedule billing reminders
const { data: reminderData, error: reminderError } = await supabase.functions.invoke('email-scheduler', {
  body: {
    action: 'schedule_billing_reminders',
    userId: 'user-id',
    subscriptionId: 'sub-id',
    renewalDate: '2024-01-01T00:00:00Z'
  }
});

// Get health metrics
const { data: healthData, error: healthError } = await supabase.functions.invoke('billing-monitor', {
  body: {
    action: 'get_health_metrics',
    timeframe: '24h'
  }
});
```

### cURL Examples

```bash
# Configure auto-renewal
curl -X POST "${SUPABASE_URL}/functions/v1/billing-auto-renewal" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "configure_auto_renewal",
    "userId": "user-id",
    "enabled": true,
    "frequency": "monthly"
  }'

# Get health metrics
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_health_metrics",
    "timeframe": "24h"
  }'

# Run test suite
curl -X POST "${SUPABASE_URL}/functions/v1/billing-test-suite" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "run_all_tests",
    "test_config": {
      "test_user_id": "test-user-123",
      "include_cleanup": true
    }
  }'
```

This API reference provides comprehensive documentation for all billing system endpoints and functions. For additional examples and use cases, refer to the main billing system documentation.
