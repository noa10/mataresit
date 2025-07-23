# Billing System Monitoring Setup Guide

## Overview
This document provides instructions for setting up automated monitoring and health checks for the Mataresit billing system.

## Production Monitoring System Status
✅ **DEPLOYED AND FUNCTIONAL**
- All monitoring Edge Functions deployed and tested
- Health check functions working correctly
- Database logging operational
- Alert system configured and responsive

## Required External Scheduling

Since Supabase doesn't support native cron jobs, external scheduling is required for automated monitoring.

### 1. Health Check Monitoring (Every 5 minutes)
```bash
# Cron expression: */5 * * * *
curl -X POST "https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/billing-health-check" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "comprehensive_health_check"}'
```

### 2. Alert Condition Checking (Every 10 minutes)
```bash
# Cron expression: */10 * * * *
curl -X POST "https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/billing-alerting" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "check_alert_conditions"}'
```

### 3. System Metrics Collection (Every 15 minutes)
```bash
# Cron expression: */15 * * * *
curl -X POST "https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/billing-monitor" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_health_metrics", "timeframe": "1h", "include_details": true}'
```

## Monitoring Endpoints

### Health Check Function
- **URL**: `https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/billing-health-check`
- **Actions**: `comprehensive_health_check`
- **Response**: Health status with metrics and alerts

### Billing Monitor Function  
- **URL**: `https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/billing-monitor`
- **Actions**: `get_health_metrics`, `get_payment_metrics`, `get_email_metrics`, `get_subscription_metrics`
- **Response**: Detailed system metrics

### Billing Alerting Function
- **URL**: `https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/billing-alerting`
- **Actions**: `check_alert_conditions`, `get_alert_rules`, `create_alert`, `resolve_alert`
- **Response**: Alert status and notifications

## Health Metrics Monitored

### 1. Payment Processing
- Success rate (target: >95%)
- Failed payments in last 24h
- Average processing time
- Retry queue depth

### 2. Email Delivery
- Delivery rate (target: >90%)
- Failed deliveries in last 24h
- Scheduled emails pending
- Average delivery time

### 3. Subscription Health
- Active subscriptions count
- Grace period subscriptions
- Failed renewals in last 24h
- Churn rate (7-day rolling)

### 4. System Performance
- Database response time (target: <500ms)
- Webhook processing rate
- Function error rate
- API response time

### 5. Webhook Processing
- Total webhooks processed
- Success rate (target: >98%)
- Failed webhook count
- Average processing time

## Alert Thresholds

### Critical Alerts
- Payment success rate < 90%
- Database response time > 2000ms
- Webhook failure rate > 5%
- System downtime detected

### Warning Alerts
- Payment success rate < 95%
- Database response time > 1000ms
- Email delivery rate < 85%
- High churn rate (>10%)

### Info Alerts
- New subscription milestones
- System performance improvements
- Successful deployments

## Database Tables

### billing_health_monitoring
Stores all health check results and system metrics.

### billing_audit_trail
Logs all billing system events including webhook processing.

## Setup Instructions

### 1. External Cron Service Setup
Choose one of these options:

#### Option A: GitHub Actions (Recommended)
Create `.github/workflows/billing-monitoring.yml`:
```yaml
name: Billing System Monitoring
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Run Health Check
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/billing-health-check" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"action": "comprehensive_health_check"}'
```

#### Option B: Vercel Cron Jobs
Create `api/cron/billing-health-check.js`:
```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/billing-health-check`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'comprehensive_health_check' })
  });
  
  const result = await response.json();
  res.status(200).json(result);
}
```

#### Option C: Traditional Cron Server
Add to crontab:
```bash
# Health checks every 5 minutes
*/5 * * * * /path/to/billing-health-check.sh

# Alert checks every 10 minutes  
*/10 * * * * /path/to/billing-alert-check.sh

# Metrics collection every 15 minutes
*/15 * * * * /path/to/billing-metrics-collection.sh
```

### 2. Environment Variables Required
- `SUPABASE_URL`: https://mpmkbtsufihzdelrlszs.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

### 3. Monitoring Dashboard
Access monitoring data via:
- Supabase Dashboard: Database tables
- Custom dashboard: Query health monitoring tables
- Alert notifications: Email/Slack integration

## Verification

### Test Health Check
```bash
curl -X POST "https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/billing-health-check" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "comprehensive_health_check"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Health check completed successfully",
  "results": {
    "timestamp": "2025-07-22T17:54:00.000Z",
    "checks_performed": 4,
    "alerts_triggered": 0,
    "summary": {
      "payment_processing": {"status": "healthy"},
      "subscription_health": {"status": "healthy"},
      "system_performance": {"status": "healthy"},
      "webhook_processing": {"status": "healthy"}
    }
  }
}
```

## Troubleshooting

### Common Issues
1. **Authentication errors**: Verify service role key
2. **Function timeouts**: Check database connectivity
3. **Missing metrics**: Ensure health metric functions are deployed
4. **Alert not triggering**: Verify alert thresholds and conditions

### Support
- Check Supabase function logs in dashboard
- Review billing_health_monitoring table for historical data
- Monitor billing_audit_trail for system events

---

**Status**: ✅ Production Ready
**Last Updated**: 2025-07-22
**Version**: 1.0.0
