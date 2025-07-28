# Slack Webhook Setup Guide for Mataresit Monitoring

This guide explains how to set up Slack webhooks for the Mataresit monitoring system to receive critical alerts and notifications.

## 🚨 Current Issue

The monitoring workflow is failing with the error:
```
Specify secrets.SLACK_WEBHOOK_URL
```

This happens because the GitHub repository doesn't have the required Slack webhook secrets configured.

## 📋 Required Secrets

The monitoring system uses two types of Slack webhooks:

### 1. Primary Slack Webhook (`SLACK_WEBHOOK_URL`)
- **Purpose**: General notifications, deployment updates, and non-critical alerts
- **Channel**: Usually `#deployments` or `#general`
- **Required**: Recommended but not critical

### 2. Critical Alerts Webhook (`CRITICAL_ALERTS_WEBHOOK_URL`)
- **Purpose**: Critical system failures, security issues, and urgent alerts
- **Channel**: Usually `#alerts` or `#critical-alerts`
- **Required**: Highly recommended for production monitoring

## 🔧 Setup Instructions

### Step 1: Create Slack App and Webhooks

1. **Go to Slack API Dashboard**:
   - Visit https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Name: "Mataresit Monitoring"
   - Workspace: Select your workspace

2. **Enable Incoming Webhooks**:
   - In your app settings, go to "Incoming Webhooks"
   - Toggle "Activate Incoming Webhooks" to On
   - Click "Add New Webhook to Workspace"

3. **Configure Webhook Channels**:
   
   **For General Notifications** (`SLACK_WEBHOOK_URL`):
   - Select channel: `#deployments` or `#general`
   - Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)
   
   **For Critical Alerts** (`CRITICAL_ALERTS_WEBHOOK_URL`):
   - Click "Add New Webhook to Workspace" again
   - Select channel: `#alerts` or `#critical-alerts`
   - Copy the webhook URL

### Step 2: Configure GitHub Secrets

1. **Go to Repository Settings**:
   - Navigate to your GitHub repository
   - Go to Settings → Secrets and variables → Actions

2. **Add Repository Secrets**:
   
   **Add SLACK_WEBHOOK_URL**:
   - Click "New repository secret"
   - Name: `SLACK_WEBHOOK_URL`
   - Value: Your general notifications webhook URL
   - Click "Add secret"
   
   **Add CRITICAL_ALERTS_WEBHOOK_URL**:
   - Click "New repository secret"
   - Name: `CRITICAL_ALERTS_WEBHOOK_URL`
   - Value: Your critical alerts webhook URL
   - Click "Add secret"

### Step 3: Test the Configuration

1. **Run the Monitoring Workflow**:
   - Go to Actions → Production Monitoring & Health Checks
   - Click "Run workflow"
   - Select environment: production
   - Check type: all

2. **Verify Notifications**:
   - Check your Slack channels for test messages
   - Look for webhook test results in the workflow logs

## 🔄 Alternative Setup Options

### Option 1: Single Webhook (Minimum Setup)
If you only want to set up one webhook:
- Configure only `SLACK_WEBHOOK_URL`
- The system will use it for both general and critical alerts
- This is the minimum viable setup

### Option 2: Email Notifications (Fallback)
If Slack is not available, you can use email notifications:
- The monitoring system will create GitHub issues for critical alerts
- Configure email notifications in your GitHub settings

### Option 3: GitHub Issues Only
If no webhooks are configured:
- Critical alerts will create GitHub issues automatically
- Logs will contain all alert information
- This is the fallback when no external notifications are available

## 🧪 Testing Your Setup

### Manual Test
You can test your webhooks manually using curl:

```bash
# Test general webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🧪 Test message from Mataresit monitoring setup"}' \
  YOUR_SLACK_WEBHOOK_URL

# Test critical alerts webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🚨 Test critical alert from Mataresit monitoring setup"}' \
  YOUR_CRITICAL_ALERTS_WEBHOOK_URL
```

### Automated Test
The monitoring workflow includes automatic webhook testing:
- Tests are performed during each monitoring run
- Results are logged in the workflow output
- Failed tests generate warnings but don't fail the workflow

## 📊 Notification Types

### General Notifications (`SLACK_WEBHOOK_URL`)
- ✅ Deployment successes
- ℹ️ System status updates
- 📊 Performance reports
- 🔄 Workflow completions

### Critical Alerts (`CRITICAL_ALERTS_WEBHOOK_URL`)
- 🚨 System health failures
- 🔒 Security issues detected
- ⚠️ Performance degradation
- 💥 Service outages

## 🔧 Troubleshooting

### Common Issues

1. **"Webhook URL not found" Error**:
   - Verify the webhook URL is correct
   - Check that the Slack app has proper permissions
   - Ensure the channel still exists

2. **"No permission to post" Error**:
   - Verify the webhook has permission to post to the channel
   - Check if the channel is private and the app has access

3. **"Timeout" Errors**:
   - Check your network connectivity
   - Verify Slack's service status
   - The monitoring system includes retry logic

### Verification Steps

1. **Check Secret Configuration**:
   ```bash
   # In GitHub Actions, secrets should be visible as:
   # SLACK_WEBHOOK_URL: ***
   # CRITICAL_ALERTS_WEBHOOK_URL: ***
   ```

2. **Check Workflow Logs**:
   - Look for "Testing primary Slack webhook..." messages
   - Verify webhook test results
   - Check for any error messages

3. **Check Slack Channel**:
   - Verify test messages appear in the correct channels
   - Check message formatting and content

## 🚀 Next Steps

After setting up the webhooks:

1. **Monitor the Setup**:
   - Run a few test workflows to ensure notifications work
   - Verify both success and failure scenarios

2. **Customize Notifications**:
   - Adjust channel assignments if needed
   - Configure additional notification rules

3. **Document for Your Team**:
   - Share webhook URLs with team members who need them
   - Document your specific channel conventions

## 📞 Support

If you encounter issues:
1. Check the GitHub Actions workflow logs
2. Verify Slack webhook configuration
3. Test webhooks manually using curl
4. Review this documentation for troubleshooting steps

The monitoring system is designed to work with or without Slack webhooks, so your monitoring will continue to function even if webhooks are not configured.
