# Billing System Deployment and Testing Guide

## Overview

This guide provides step-by-step instructions for deploying and testing the Mataresit billing system. Follow these procedures to ensure a successful deployment with comprehensive validation.

## Pre-Deployment Checklist

### Environment Requirements

- [ ] Supabase project with PostgreSQL 15+
- [ ] Stripe account with API keys
- [ ] Email service provider (configured)
- [ ] Node.js 18+ for local development
- [ ] Supabase CLI installed and configured

### Configuration Verification

- [ ] Environment variables configured
- [ ] Database connection established
- [ ] Stripe webhook endpoint configured
- [ ] Email service API keys validated
- [ ] Frontend build configuration updated

## Deployment Steps

### 1. Database Migration

Deploy the comprehensive billing system database schema:

```bash
# Navigate to project root
cd /path/to/mataresit

# Apply database migrations
supabase db push

# Verify migration success
supabase db diff
```

**Expected Output:**
- All billing tables created successfully
- Indexes and constraints applied
- RLS policies enabled
- Database functions deployed

**Verification Commands:**
```sql
-- Check table creation
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'billing_%';

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename LIKE 'billing_%';

-- Test database functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%billing%';
```

### 2. Edge Functions Deployment

Deploy all billing system Edge Functions:

```bash
# Deploy auto-renewal function
supabase functions deploy billing-auto-renewal

# Deploy email scheduler
supabase functions deploy email-scheduler

# Deploy enhanced email sender
supabase functions deploy send-email

# Deploy monitoring system
supabase functions deploy billing-monitor

# Deploy alerting system
supabase functions deploy billing-alerting

# Deploy health check cron job
supabase functions deploy billing-health-check

# Deploy test suite
supabase functions deploy billing-test-suite
```

**Verification:**
```bash
# List deployed functions
supabase functions list

# Test function accessibility
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_health_metrics"}'
```

### 3. Webhook Configuration

Configure Stripe webhooks for billing system integration:

```bash
# Using Stripe CLI (recommended for development)
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# For production, configure webhook endpoint in Stripe Dashboard:
# Endpoint URL: https://your-project.supabase.co/functions/v1/stripe-webhook
```

**Required Webhook Events:**
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

### 4. Cron Job Setup

Configure automated health monitoring:

```bash
# For production deployment, set up cron job
# Add to crontab (every 5 minutes):
*/5 * * * * curl -X POST https://your-project.supabase.co/functions/v1/billing-health-check \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null 2>&1
```

**Alternative: Supabase Cron (if available):**
```sql
-- Create cron job for health checks
SELECT cron.schedule('billing-health-check', '*/5 * * * *', 
  'SELECT net.http_post(
    url := ''https://your-project.supabase.co/functions/v1/billing-health-check'',
    headers := ''{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '", "Content-Type": "application/json"}'',
    body := ''{}''
  );'
);
```

### 5. Frontend Integration

Update frontend configuration and deploy UI components:

```bash
# Build frontend with updated configuration
npm run build

# Deploy to hosting platform
npm run deploy
```

**Configuration Updates:**
```typescript
// Update environment variables
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
```

## Post-Deployment Testing

### 1. Automated Test Suite

Run the comprehensive billing system test suite:

```bash
# Using Supabase client
supabase functions invoke billing-test-suite --data '{
  "action": "run_all_tests",
  "test_config": {
    "test_user_id": "test-user-deployment",
    "include_cleanup": true,
    "generate_test_data": true
  }
}'
```

**Expected Results:**
- All test suites pass (100% success rate)
- Email templates render correctly
- Auto-renewal logic functions properly
- Payment processing works as expected
- Monitoring system is operational

### 2. Manual Testing Procedures

#### Email Template Testing

```bash
# Test email template rendering
curl -X POST "${SUPABASE_URL}/functions/v1/send-email" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "template_name": "upcoming_renewal",
    "template_data": {
      "recipientName": "Test User",
      "subscriptionTier": "pro",
      "renewalDate": "2024-01-01T00:00:00Z",
      "amount": 29.99,
      "currency": "usd"
    },
    "preview_mode": true
  }'
```

#### Auto-Renewal Testing

```bash
# Test auto-renewal configuration
curl -X POST "${SUPABASE_URL}/functions/v1/billing-auto-renewal" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "configure_auto_renewal",
    "userId": "test-user-id",
    "enabled": true,
    "frequency": "monthly"
  }'
```

#### Monitoring System Testing

```bash
# Test health metrics
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_health_metrics",
    "timeframe": "24h"
  }'
```

### 3. Integration Testing

#### Stripe Webhook Testing

```bash
# Test webhook processing with Stripe CLI
stripe trigger customer.subscription.created

# Verify webhook processing in logs
supabase functions logs stripe-webhook
```

#### End-to-End Workflow Testing

1. **Create Test User:**
   ```sql
   INSERT INTO auth.users (id, email) 
   VALUES ('test-user-e2e', 'test-e2e@example.com');
   ```

2. **Initialize Billing Preferences:**
   ```sql
   SELECT initialize_billing_preferences('test-user-e2e', 'pro');
   ```

3. **Schedule Billing Reminders:**
   ```bash
   curl -X POST "${SUPABASE_URL}/functions/v1/email-scheduler" \
     -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "schedule_billing_reminders",
       "userId": "test-user-e2e",
       "subscriptionId": "test-sub-e2e",
       "renewalDate": "2024-01-01T00:00:00Z"
     }'
   ```

4. **Verify Email Scheduling:**
   ```sql
   SELECT * FROM billing_email_schedule 
   WHERE user_id = 'test-user-e2e';
   ```

5. **Test Email Processing:**
   ```bash
   curl -X POST "${SUPABASE_URL}/functions/v1/email-scheduler" \
     -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "process_scheduled_emails",
       "limit": 10
     }'
   ```

## Performance Testing

### Load Testing

Test system performance under load:

```bash
# Install artillery for load testing
npm install -g artillery

# Create load test configuration
cat > billing-load-test.yml << EOF
config:
  target: '${SUPABASE_URL}'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Authorization: 'Bearer ${SERVICE_ROLE_KEY}'
      Content-Type: 'application/json'

scenarios:
  - name: 'Health Metrics'
    weight: 50
    flow:
      - post:
          url: '/functions/v1/billing-monitor'
          json:
            action: 'get_health_metrics'
            timeframe: '24h'
  
  - name: 'Email Template Preview'
    weight: 30
    flow:
      - post:
          url: '/functions/v1/send-email'
          json:
            to: 'test@example.com'
            template_name: 'upcoming_renewal'
            template_data:
              recipientName: 'Load Test User'
              subscriptionTier: 'pro'
            preview_mode: true
  
  - name: 'Auto-Renewal Check'
    weight: 20
    flow:
      - post:
          url: '/functions/v1/billing-auto-renewal'
          json:
            action: 'check_subscription_health'
            userId: 'load-test-user'
EOF

# Run load test
artillery run billing-load-test.yml
```

### Database Performance Testing

```sql
-- Test query performance
EXPLAIN ANALYZE SELECT * FROM billing_preferences WHERE user_id = 'test-user';
EXPLAIN ANALYZE SELECT * FROM billing_email_schedule WHERE status = 'scheduled';
EXPLAIN ANALYZE SELECT * FROM billing_audit_trail WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' AND tablename LIKE 'billing_%';
```

## Monitoring and Validation

### 1. System Health Validation

```bash
# Check overall system health
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "trigger_health_check"}' | jq '.'
```

### 2. Alert System Validation

```bash
# Test alert creation
curl -X POST "${SUPABASE_URL}/functions/v1/billing-alerting" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_alert",
    "alert_type": "deployment_test",
    "severity": "low",
    "title": "Deployment Test Alert",
    "message": "Testing alert system after deployment",
    "component": "test"
  }'

# Verify alert was created
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_system_alerts"}' | jq '.alerts'
```

### 3. Audit Trail Validation

```sql
-- Check audit trail is working
SELECT event_type, event_description, created_at 
FROM billing_audit_trail 
ORDER BY created_at DESC 
LIMIT 10;

-- Verify webhook events are logged
SELECT event_type, COUNT(*) 
FROM billing_audit_trail 
WHERE triggered_by = 'stripe_webhook' 
GROUP BY event_type;
```

## Rollback Procedures

### Emergency Rollback

If critical issues are discovered:

1. **Disable Cron Jobs:**
   ```bash
   # Remove cron job
   crontab -e
   # Comment out billing-health-check line
   ```

2. **Revert Edge Functions:**
   ```bash
   # Deploy previous version
   git checkout previous-version
   supabase functions deploy billing-auto-renewal
   supabase functions deploy email-scheduler
   # ... deploy other functions
   ```

3. **Database Rollback:**
   ```bash
   # Revert database changes
   supabase db reset
   # Apply previous migration
   git checkout previous-migration
   supabase db push
   ```

### Partial Rollback

For specific component issues:

```bash
# Rollback specific function
git checkout HEAD~1 -- supabase/functions/billing-auto-renewal/
supabase functions deploy billing-auto-renewal

# Disable specific features
UPDATE billing_preferences SET auto_renewal_enabled = false;
```

## Production Checklist

### Pre-Go-Live

- [ ] All tests pass (100% success rate)
- [ ] Performance testing completed
- [ ] Security audit completed
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested
- [ ] Rollback procedures documented
- [ ] Team training completed

### Go-Live

- [ ] Deploy during maintenance window
- [ ] Monitor system health continuously
- [ ] Verify webhook processing
- [ ] Check email delivery rates
- [ ] Validate payment processing
- [ ] Confirm monitoring alerts

### Post-Go-Live

- [ ] 24-hour monitoring period
- [ ] Performance metrics review
- [ ] User feedback collection
- [ ] System optimization based on real usage
- [ ] Documentation updates

## Troubleshooting

### Common Issues

1. **Function Deployment Failures:**
   ```bash
   # Check function logs
   supabase functions logs function-name
   
   # Verify environment variables
   supabase secrets list
   ```

2. **Database Connection Issues:**
   ```bash
   # Test database connection
   supabase db ping
   
   # Check connection pool
   SELECT * FROM pg_stat_activity;
   ```

3. **Webhook Processing Failures:**
   ```bash
   # Check webhook logs
   supabase functions logs stripe-webhook
   
   # Verify webhook signature
   stripe webhooks list
   ```

4. **Email Delivery Issues:**
   ```bash
   # Check email scheduler logs
   supabase functions logs email-scheduler
   
   # Verify email service configuration
   curl -X POST "${SUPABASE_URL}/functions/v1/send-email" \
     -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
     -d '{"to": "test@example.com", "subject": "Test", "text": "Test", "preview_mode": true}'
   ```

### Support Contacts

- **Technical Issues**: Use built-in monitoring and alerting system
- **Performance Issues**: Check system health metrics
- **Integration Issues**: Review webhook and API logs
- **User Issues**: Check billing preferences and audit trail

## Maintenance Schedule

### Daily
- Monitor system health metrics
- Review alert status
- Check email delivery rates

### Weekly
- Analyze performance trends
- Review audit trail for anomalies
- Update documentation as needed

### Monthly
- Comprehensive system testing
- Performance optimization review
- Security audit and updates

This deployment guide ensures a successful and reliable billing system deployment with comprehensive testing and monitoring capabilities.
