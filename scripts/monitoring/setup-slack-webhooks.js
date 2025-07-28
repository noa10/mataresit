#!/usr/bin/env node

/**
 * Slack Webhook Setup and Test Script
 * 
 * This script helps set up and test Slack webhooks for the Mataresit monitoring system.
 */

import https from 'https';
import readline from 'readline';

// Configuration
const config = {
  timeout: 10000, // 10 seconds
  retries: 2
};

// Utility functions
function makeSlackRequest(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const postData = JSON.stringify({ text: message });
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: config.timeout
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data.toString(),
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function validateWebhookUrl(url) {
  if (!url) return false;
  if (!url.startsWith('https://hooks.slack.com/services/')) {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function testWebhook(webhookUrl, webhookType) {
  console.log(`\n🧪 Testing ${webhookType} webhook...`);
  
  const testMessage = `🧪 Test message from Mataresit monitoring setup
  
**Webhook Type**: ${webhookType}
**Time**: ${new Date().toISOString()}
**Status**: Testing webhook configuration

This is a test message to verify your Slack webhook is working correctly. If you see this message, your webhook is properly configured! 🎉`;

  try {
    const response = await makeSlackRequest(webhookUrl, testMessage);
    
    if (response.statusCode === 200) {
      console.log(`✅ ${webhookType} webhook test successful!`);
      console.log(`   Check your Slack channel for the test message.`);
      return true;
    } else {
      console.log(`❌ ${webhookType} webhook test failed!`);
      console.log(`   HTTP Status: ${response.statusCode}`);
      console.log(`   Response: ${response.data}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${webhookType} webhook test failed!`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function generateGitHubSecretsInstructions(webhooks) {
  console.log('\n📋 GitHub Secrets Configuration Instructions:');
  console.log('='.repeat(50));
  console.log('\n1. Go to your GitHub repository');
  console.log('2. Navigate to Settings → Secrets and variables → Actions');
  console.log('3. Add the following repository secrets:\n');

  if (webhooks.general) {
    console.log('   🔹 Secret Name: SLACK_WEBHOOK_URL');
    console.log(`   🔹 Secret Value: ${webhooks.general}`);
    console.log('   🔹 Description: General notifications webhook\n');
  }

  if (webhooks.critical) {
    console.log('   🔹 Secret Name: CRITICAL_ALERTS_WEBHOOK_URL');
    console.log(`   🔹 Secret Value: ${webhooks.critical}`);
    console.log('   🔹 Description: Critical alerts webhook\n');
  }

  console.log('4. Click "Add secret" for each one');
  console.log('5. Run the monitoring workflow to test the configuration');
}

async function interactiveSetup() {
  console.log('🚀 Mataresit Slack Webhook Setup');
  console.log('='.repeat(40));
  console.log('\nThis script will help you set up and test Slack webhooks for monitoring.\n');

  const rl = createReadlineInterface();
  const webhooks = {};

  try {
    // Get general webhook
    console.log('📢 General Notifications Webhook Setup');
    console.log('This webhook will receive deployment updates and general notifications.');
    const generalUrl = await askQuestion(rl, '\nEnter your general notifications webhook URL (or press Enter to skip): ');
    
    if (generalUrl) {
      if (validateWebhookUrl(generalUrl)) {
        webhooks.general = generalUrl;
        const generalTest = await testWebhook(generalUrl, 'General Notifications');
        if (!generalTest) {
          const retry = await askQuestion(rl, 'Would you like to retry with a different URL? (y/n): ');
          if (retry.toLowerCase() === 'y') {
            const retryUrl = await askQuestion(rl, 'Enter the corrected webhook URL: ');
            if (validateWebhookUrl(retryUrl)) {
              webhooks.general = retryUrl;
              await testWebhook(retryUrl, 'General Notifications');
            }
          }
        }
      } else {
        console.log('❌ Invalid webhook URL format. Please check your URL.');
      }
    } else {
      console.log('⏭️ Skipping general notifications webhook.');
    }

    // Get critical alerts webhook
    console.log('\n🚨 Critical Alerts Webhook Setup');
    console.log('This webhook will receive critical system alerts and failures.');
    const criticalUrl = await askQuestion(rl, '\nEnter your critical alerts webhook URL (or press Enter to skip): ');
    
    if (criticalUrl) {
      if (validateWebhookUrl(criticalUrl)) {
        webhooks.critical = criticalUrl;
        const criticalTest = await testWebhook(criticalUrl, 'Critical Alerts');
        if (!criticalTest) {
          const retry = await askQuestion(rl, 'Would you like to retry with a different URL? (y/n): ');
          if (retry.toLowerCase() === 'y') {
            const retryUrl = await askQuestion(rl, 'Enter the corrected webhook URL: ');
            if (validateWebhookUrl(retryUrl)) {
              webhooks.critical = retryUrl;
              await testWebhook(retryUrl, 'Critical Alerts');
            }
          }
        }
      } else {
        console.log('❌ Invalid webhook URL format. Please check your URL.');
      }
    } else {
      console.log('⏭️ Skipping critical alerts webhook.');
    }

    // Generate instructions
    if (webhooks.general || webhooks.critical) {
      await generateGitHubSecretsInstructions(webhooks);
      
      console.log('\n✅ Setup Complete!');
      console.log('\nNext steps:');
      console.log('1. Add the secrets to your GitHub repository');
      console.log('2. Run the monitoring workflow to verify everything works');
      console.log('3. Check your Slack channels for notifications');
    } else {
      console.log('\n⚠️ No webhooks configured.');
      console.log('\nThe monitoring system will still work but will use fallback notifications:');
      console.log('- GitHub issues for critical alerts');
      console.log('- Workflow logs for all notifications');
    }

  } finally {
    rl.close();
  }
}

async function testExistingWebhooks() {
  console.log('🧪 Testing Existing Webhook Configuration');
  console.log('='.repeat(40));

  const generalWebhook = process.env.SLACK_WEBHOOK_URL;
  const criticalWebhook = process.env.CRITICAL_ALERTS_WEBHOOK_URL;

  if (!generalWebhook && !criticalWebhook) {
    console.log('❌ No webhook environment variables found.');
    console.log('\nPlease set one or both of the following environment variables:');
    console.log('- SLACK_WEBHOOK_URL (for general notifications)');
    console.log('- CRITICAL_ALERTS_WEBHOOK_URL (for critical alerts)');
    return;
  }

  let allPassed = true;

  if (generalWebhook) {
    const result = await testWebhook(generalWebhook, 'General Notifications');
    allPassed = allPassed && result;
  }

  if (criticalWebhook) {
    const result = await testWebhook(criticalWebhook, 'Critical Alerts');
    allPassed = allPassed && result;
  }

  console.log('\n' + '='.repeat(40));
  if (allPassed) {
    console.log('✅ All webhook tests passed!');
  } else {
    console.log('❌ Some webhook tests failed. Please check your configuration.');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test') || args.includes('-t')) {
    await testExistingWebhooks();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log('Mataresit Slack Webhook Setup Script');
    console.log('\nUsage:');
    console.log('  node setup-slack-webhooks.js          # Interactive setup');
    console.log('  node setup-slack-webhooks.js --test   # Test existing webhooks');
    console.log('  node setup-slack-webhooks.js --help   # Show this help');
    console.log('\nEnvironment Variables:');
    console.log('  SLACK_WEBHOOK_URL              # General notifications webhook');
    console.log('  CRITICAL_ALERTS_WEBHOOK_URL    # Critical alerts webhook');
  } else {
    await interactiveSetup();
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n💥 Unhandled rejection:', reason);
  process.exit(1);
});

// Run the setup script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\n💥 Setup script failed:', error.message);
    process.exit(1);
  });
}

export { testWebhook, validateWebhookUrl, makeSlackRequest };
