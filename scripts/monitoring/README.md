# Mataresit Monitoring Scripts

This directory contains monitoring and alerting scripts for the Mataresit application.

## 📁 Scripts Overview

### Performance Monitoring
- **`simple-performance-check.js`** - Lightweight performance monitoring for CI/CD
  - Tests Supabase health and response times
  - Database query performance validation
  - Edge Function responsiveness checks
  - Generates performance scores and reports

### Security Monitoring
- **`simple-security-check.js`** - Security validation for CI/CD
  - Authentication enforcement testing
  - Security headers validation
  - Row Level Security (RLS) configuration checks
  - SSL/TLS configuration validation

### Notification Setup
- **`setup-slack-webhooks.js`** - Interactive Slack webhook configuration
  - Guided webhook setup process
  - Webhook testing and validation
  - GitHub secrets configuration instructions

## 🚀 Quick Start

### Run Performance Check
```bash
npm run test:monitoring:performance
```

### Run Security Check
```bash
npm run test:monitoring:security
```

### Set Up Slack Webhooks
```bash
npm run setup:slack-webhooks
```

### Test Existing Webhooks
```bash
npm run test:slack-webhooks
```

## 📊 Performance Monitoring

The performance monitoring script tests:

- **Supabase Health**: Basic connectivity and response time
- **Database Queries**: Query performance and responsiveness
- **Edge Functions**: Function availability and response time
- **Overall Score**: Composite performance rating

### Thresholds
- Supabase Health: < 2 seconds
- Database Query: < 3 seconds
- Edge Function: < 5 seconds
- API Endpoint: < 4 seconds

### Exit Codes
- `0`: Success or warnings only
- `1`: Critical performance issues detected

## 🔒 Security Monitoring

The security monitoring script validates:

- **Authentication**: Proper access control enforcement
- **Security Headers**: Essential HTTP security headers
- **RLS Configuration**: Row Level Security policy validation
- **SSL/TLS**: HTTPS configuration and certificate validation

### Security Score
- 80-100: Excellent security posture
- 60-79: Good security posture
- 40-59: Needs improvement
- 0-39: Poor security posture (immediate attention required)

## 🔔 Notification Setup

### Required Webhooks

1. **General Notifications** (`SLACK_WEBHOOK_URL`):
   - Deployment updates
   - System status reports
   - Performance summaries

2. **Critical Alerts** (`CRITICAL_ALERTS_WEBHOOK_URL`):
   - System failures
   - Security issues
   - Performance degradation

### Setup Process

1. **Create Slack App**:
   - Go to https://api.slack.com/apps
   - Create new app: "Mataresit Monitoring"
   - Enable incoming webhooks

2. **Configure Channels**:
   - General: `#deployments` or `#general`
   - Critical: `#alerts` or `#critical-alerts`

3. **Run Setup Script**:
   ```bash
   npm run setup:slack-webhooks
   ```

4. **Add GitHub Secrets**:
   - Repository Settings → Secrets and variables → Actions
   - Add `SLACK_WEBHOOK_URL` and `CRITICAL_ALERTS_WEBHOOK_URL`

## 🔧 Configuration

### Environment Variables

**For Performance Monitoring**:
- `TEST_SUPABASE_URL` or `SUPABASE_URL`
- `TEST_SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

**For Security Monitoring**:
- `TEST_SUPABASE_URL` or `SUPABASE_URL`
- `TEST_SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` (for RLS testing)

**For Webhook Testing**:
- `SLACK_WEBHOOK_URL`
- `CRITICAL_ALERTS_WEBHOOK_URL`

## 🧪 Testing

### Manual Testing
```bash
# Test performance monitoring
node scripts/monitoring/simple-performance-check.js

# Test security monitoring
node scripts/monitoring/simple-security-check.js

# Test webhook setup
node scripts/monitoring/setup-slack-webhooks.js --test
```

### CI/CD Integration
These scripts are integrated into the GitHub Actions monitoring workflow:
- `.github/workflows/monitoring.yml`
- Runs every 15 minutes on schedule
- Can be triggered manually with different check types

## 📋 Troubleshooting

### Common Issues

1. **"Missing Supabase configuration"**:
   - Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
   - Check GitHub repository secrets

2. **"Webhook test failed"**:
   - Verify webhook URL format
   - Check Slack app permissions
   - Ensure channel exists and app has access

3. **"Performance threshold exceeded"**:
   - Check Supabase service status
   - Verify network connectivity
   - Review database performance

4. **"Security issues detected"**:
   - Review RLS policies
   - Check security headers configuration
   - Verify SSL/TLS setup

### Getting Help

1. **Check Workflow Logs**:
   - GitHub Actions → Monitoring workflow
   - Review detailed output and error messages

2. **Run Scripts Locally**:
   - Test scripts on your development machine
   - Use environment variables for configuration

3. **Review Documentation**:
   - `docs/monitoring/SLACK_WEBHOOK_SETUP.md`
   - GitHub repository README
   - Script source code comments

## 🔄 Fallback Mechanisms

The monitoring system includes multiple fallback options:

1. **No Webhooks Configured**:
   - GitHub issues created for critical alerts
   - Detailed logs in workflow output
   - Email notifications (if GitHub notifications enabled)

2. **Webhook Failures**:
   - Retry logic with exponential backoff
   - Fallback to alternative webhook if available
   - GitHub issue creation as last resort

3. **Service Unavailability**:
   - Graceful degradation of monitoring checks
   - Warning messages instead of hard failures
   - Partial monitoring when services are limited

This ensures monitoring continues to function even when external services are unavailable.
