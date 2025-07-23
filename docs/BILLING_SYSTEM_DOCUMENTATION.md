# Mataresit Billing System Documentation

## Overview

The Mataresit billing system is a comprehensive, enterprise-grade subscription management solution built on Supabase and Stripe. It provides automated renewal processing, intelligent email scheduling, comprehensive monitoring, and robust error handling.

## Architecture

### Core Components

1. **Database Schema** - Comprehensive billing data management
2. **Email Templates** - Multilingual billing communication system
3. **Auto-Renewal Logic** - Automated subscription management
4. **Email Scheduling** - Intelligent reminder and notification system
5. **User Interface** - Comprehensive billing preferences management
6. **Webhook Processing** - Enhanced Stripe integration
7. **Monitoring & Alerting** - Real-time system health tracking
8. **Testing Framework** - Comprehensive validation and testing

### Technology Stack

- **Backend**: Supabase Edge Functions (Deno/TypeScript)
- **Database**: PostgreSQL 15 with Row Level Security
- **Payment Processing**: Stripe API with webhooks
- **Email Delivery**: Integrated email service with template system
- **Frontend**: React 18 + TypeScript with Shadcn/UI
- **Monitoring**: Real-time metrics and alerting system

## Database Schema

### Core Tables

#### `billing_preferences`
Stores user billing preferences and auto-renewal settings.

```sql
CREATE TABLE billing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_renewal_enabled BOOLEAN DEFAULT true,
  auto_renewal_frequency TEXT DEFAULT 'monthly',
  billing_email_enabled BOOLEAN DEFAULT true,
  reminder_days_before_renewal INTEGER[] DEFAULT '{7,3,1}',
  payment_failure_notifications BOOLEAN DEFAULT true,
  grace_period_notifications BOOLEAN DEFAULT true,
  max_payment_retry_attempts INTEGER DEFAULT 3,
  retry_interval_hours INTEGER DEFAULT 24,
  grace_period_days INTEGER DEFAULT 7,
  preferred_language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `billing_email_schedule`
Manages scheduled billing emails and delivery tracking.

```sql
CREATE TABLE billing_email_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT,
  reminder_type billing_reminder_type NOT NULL,
  template_name TEXT NOT NULL,
  template_data JSONB DEFAULT '{}',
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled',
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 5,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `billing_audit_trail`
Comprehensive audit logging for all billing operations.

```sql
CREATE TABLE billing_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  stripe_event_id TEXT,
  stripe_subscription_id TEXT,
  triggered_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `billing_system_alerts`
System alerts and monitoring notifications.

```sql
CREATE TABLE billing_system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  component TEXT,
  user_id UUID REFERENCES auth.users(id),
  subscription_id TEXT,
  resolved BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Key Database Functions

#### `initialize_billing_preferences(user_id, subscription_tier)`
Initializes billing preferences for new users with sensible defaults.

#### `get_billing_preferences(user_id)`
Retrieves comprehensive billing preferences for a user.

#### `schedule_billing_reminder(user_id, subscription_id, reminder_type, scheduled_for, template_data, language)`
Schedules a billing reminder email with intelligent conflict resolution.

#### `get_payment_health_metrics(time_filter)`
Returns comprehensive payment processing health metrics.

#### `get_subscription_health_metrics(time_filter)`
Returns subscription lifecycle and churn analysis metrics.

## Edge Functions

### 1. billing-auto-renewal
Handles automatic subscription renewal logic and configuration.

**Actions:**
- `configure_auto_renewal` - Set user auto-renewal preferences
- `process_renewals` - Process pending subscription renewals
- `handle_payment_retry` - Manage failed payment retry logic
- `check_subscription_health` - Validate subscription status

### 2. email-scheduler
Manages intelligent email scheduling and delivery tracking.

**Actions:**
- `schedule_billing_reminders` - Schedule renewal reminders
- `process_scheduled_emails` - Process pending email queue
- `reschedule_failed_emails` - Handle failed email delivery
- `get_email_delivery_stats` - Retrieve delivery analytics
- `update_email_preferences` - Manage user email preferences

### 3. send-email
Enhanced email delivery with template support and tracking.

**Features:**
- Template-based email rendering
- Multi-language support (English/Malay)
- Preview mode for testing
- Delivery tracking and analytics
- Personalized content with billing data

### 4. billing-monitor
Real-time system monitoring and health metrics.

**Actions:**
- `get_health_metrics` - Comprehensive system health overview
- `get_payment_metrics` - Payment processing analytics
- `get_email_metrics` - Email delivery statistics
- `get_subscription_metrics` - Subscription health analytics
- `trigger_health_check` - On-demand system validation

### 5. billing-alerting
Automated alerting and notification system.

**Actions:**
- `check_alert_conditions` - Evaluate alert conditions
- `create_alert` - Create system alerts
- `resolve_alert` - Resolve active alerts
- `send_alert_notification` - Multi-channel notifications

### 6. billing-health-check
Automated health monitoring cron job (5-minute intervals).

**Features:**
- Continuous system monitoring
- Automated alert triggering
- Performance metrics collection
- Alert cleanup and maintenance

### 7. billing-test-suite
Comprehensive testing and validation framework.

**Actions:**
- `run_all_tests` - Execute complete test suite
- `test_email_templates` - Validate email templates
- `test_auto_renewal` - Test renewal logic
- `validate_billing_workflow` - End-to-end validation

## Email Templates

### Template Types

1. **upcoming_renewal** - Renewal reminder notifications
2. **payment_failed** - Payment failure notifications
3. **payment_confirmation** - Payment success confirmations
4. **subscription_cancelled** - Cancellation notifications
5. **trial_ending** - Trial expiration warnings

### Template Features

- **Multi-language support** (English/Malay)
- **Personalized content** with user and billing data
- **Responsive design** for all devices
- **Preview mode** for testing and validation
- **Template performance tracking**

### Template Data Structure

```typescript
interface TemplateData {
  recipientName: string;
  recipientEmail: string;
  subscriptionTier: string;
  amount: number;
  currency: string;
  renewalDate: string;
  billingInterval: string;
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  manageSubscriptionUrl: string;
  language: 'en' | 'ms';
}
```

## User Interface Components

### BillingPreferences Component
Comprehensive billing management interface with:

- **Auto-renewal settings** with frequency selection
- **Email notification preferences** with granular controls
- **Payment method management** via Stripe Customer Portal
- **Payment history** with transaction details
- **Email delivery statistics** with performance metrics

### BillingSystemMonitor Component
Real-time monitoring dashboard featuring:

- **System health overview** with color-coded status
- **Key performance metrics** with trend indicators
- **Active alerts management** with acknowledgment
- **Detailed analytics tabs** for deep-dive analysis

### BillingTestSuite Component
Comprehensive testing interface providing:

- **Full test suite execution** with progress tracking
- **Individual component testing** for targeted validation
- **Test configuration** with customizable parameters
- **Results export** for documentation and analysis

## Monitoring and Alerting

### Alert Conditions

#### Payment Processing
- Success rate < 90% (Critical) / < 95% (Warning)
- Retry queue depth > 50 (High) / > 100 (Critical)
- Processing time > 5 minutes (Medium)

#### Email Delivery
- Delivery rate < 90% (Critical) / < 95% (Warning)
- Queue depth > 1000 (High) / > 2000 (Critical)
- Processing delays > 30 minutes (Medium)

#### Subscription Health
- Failed renewals > 10/24h (High) / > 25/24h (Critical)
- Churn rate > 5% (High) / > 10% (Critical)
- Grace period subscriptions > 50 (Medium)

#### System Performance
- Database response time > 5 seconds (Critical)
- Webhook failures > 10/hour (High)
- Function error rate > 5% (Medium)

### Notification Channels

1. **Email** - All severity levels with detailed reports
2. **Slack** - High and critical alerts for team notifications
3. **Webhook** - External system integration
4. **SMS** - Critical alerts for immediate attention

## Testing Framework

### Test Categories

1. **Email Template Tests**
   - Template rendering validation
   - Multi-language support verification
   - Data validation and error handling

2. **Auto-Renewal Tests**
   - Configuration management
   - Renewal processing logic
   - Payment retry mechanisms

3. **Payment Processing Tests**
   - Health metrics validation
   - Billing preferences functionality
   - Transaction processing

4. **Webhook Processing Tests**
   - Event logging verification
   - Stripe integration validation
   - Error handling testing

5. **Monitoring System Tests**
   - Health metrics retrieval
   - Alert system functionality
   - Performance monitoring

6. **End-to-End Workflow Tests**
   - Complete billing cycle validation
   - Component integration testing
   - Data flow verification

### Test Configuration

```typescript
interface TestConfig {
  test_user_id: string;
  include_cleanup: boolean;
  generate_test_data: boolean;
  timeout_ms?: number;
  retry_attempts?: number;
}
```

## Deployment and Configuration

### Environment Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
SERVICE_ROLE_KEY=your_service_role_key

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Frontend Configuration
FRONTEND_URL=your_frontend_url

# Email Configuration
EMAIL_SERVICE_API_KEY=your_email_service_key
```

### Deployment Steps

1. **Database Migration**
   ```bash
   supabase db push
   ```

2. **Edge Functions Deployment**
   ```bash
   supabase functions deploy billing-auto-renewal
   supabase functions deploy email-scheduler
   supabase functions deploy send-email
   supabase functions deploy billing-monitor
   supabase functions deploy billing-alerting
   supabase functions deploy billing-health-check
   supabase functions deploy billing-test-suite
   ```

3. **Webhook Configuration**
   - Configure Stripe webhook endpoint
   - Set webhook events for subscription lifecycle
   - Verify webhook signature validation

4. **Cron Job Setup**
   ```bash
   # Setup cron job for health checks (every 5 minutes)
   */5 * * * * curl -X POST your_supabase_url/functions/v1/billing-health-check
   ```

## Security Considerations

### Row Level Security (RLS)
All tables implement comprehensive RLS policies:
- Users can only access their own billing data
- Service role has full access for system operations
- Admin users have read access for monitoring

### Data Protection
- Sensitive payment data handled via Stripe
- PCI compliance through Stripe Customer Portal
- Audit logging for all billing operations
- Encrypted data transmission and storage

### Access Control
- Function-level security with proper authentication
- API key management for external services
- Role-based access for admin functions
- Webhook signature verification

## Troubleshooting

### Common Issues

1. **Email Delivery Failures**
   - Check email service API keys
   - Verify template data completeness
   - Review delivery logs and error messages

2. **Payment Processing Issues**
   - Validate Stripe webhook configuration
   - Check payment method validity
   - Review retry logic and grace periods

3. **Auto-Renewal Problems**
   - Verify subscription status in Stripe
   - Check billing preferences configuration
   - Review renewal scheduling logic

4. **Monitoring Alerts**
   - Check system health metrics
   - Verify alert condition thresholds
   - Review notification channel configuration

### Debugging Tools

1. **Test Suite** - Comprehensive system validation
2. **Health Monitor** - Real-time system status
3. **Audit Trail** - Complete operation history
4. **Alert System** - Proactive issue detection

## Performance Optimization

### Database Optimization
- Strategic indexing for query performance
- Efficient RLS policy design
- Regular maintenance and cleanup
- Connection pooling and caching

### Function Optimization
- Minimal cold start times
- Efficient error handling
- Batch processing for bulk operations
- Resource usage monitoring

### Email Optimization
- Template caching and reuse
- Batch email processing
- Delivery rate optimization
- Queue management and prioritization

## Maintenance and Updates

### Regular Maintenance Tasks

1. **Weekly**
   - Review system health metrics
   - Check alert status and resolution
   - Validate email delivery rates
   - Monitor payment success rates

2. **Monthly**
   - Analyze billing system performance
   - Review and update alert thresholds
   - Clean up old audit trail entries
   - Update documentation and procedures

3. **Quarterly**
   - Comprehensive system testing
   - Performance optimization review
   - Security audit and updates
   - Disaster recovery testing

### Update Procedures

1. **Code Updates**
   - Test in development environment
   - Run comprehensive test suite
   - Deploy to staging for validation
   - Deploy to production with monitoring

2. **Database Updates**
   - Create migration scripts
   - Test with sample data
   - Backup production database
   - Apply migrations with rollback plan

3. **Configuration Updates**
   - Document configuration changes
   - Test in non-production environment
   - Apply changes during maintenance window
   - Verify system functionality post-update

## Support and Contact

For technical support or questions about the billing system:

1. **Documentation** - Refer to this comprehensive guide
2. **Test Suite** - Use built-in testing tools for validation
3. **Monitoring** - Check system health and alerts
4. **Audit Trail** - Review operation logs for troubleshooting

The Mataresit billing system is designed for reliability, scalability, and ease of maintenance. Regular monitoring and proactive maintenance ensure optimal performance and user experience.
