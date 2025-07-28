#!/usr/bin/env node

/**
 * Monitoring Setup Validation Script
 * 
 * This script validates the monitoring setup and provides recommendations
 * for optimal configuration.
 */

import fs from 'fs';
import path from 'path';

// Configuration validation
const requiredFiles = [
  '.github/workflows/monitoring.yml',
  'scripts/monitoring/simple-performance-check.js',
  'scripts/monitoring/simple-security-check.js',
  'scripts/monitoring/setup-slack-webhooks.js',
  'docs/monitoring/SLACK_WEBHOOK_SETUP.md',
  'docs/monitoring/ARCHITECTURE_MONITORING.md'
];

const packageJsonScripts = [
  'test:monitoring:performance',
  'test:monitoring:security',
  'setup:slack-webhooks',
  'test:slack-webhooks'
];

const environmentVariables = {
  required: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ],
  recommended: [
    'SUPABASE_ANON_KEY',
    'SLACK_WEBHOOK_URL',
    'CRITICAL_ALERTS_WEBHOOK_URL'
  ],
  optional: [
    'STAGING_SUPABASE_URL',
    'STAGING_SUPABASE_SERVICE_ROLE_KEY',
    'STAGING_SUPABASE_ANON_KEY',
    'PRODUCTION_KUBECONFIG',
    'STAGING_KUBECONFIG'
  ]
};

function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function checkPackageJsonScripts() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts || {};
    
    const results = {};
    for (const script of packageJsonScripts) {
      results[script] = scripts.hasOwnProperty(script);
    }
    
    return results;
  } catch {
    return {};
  }
}

function checkEnvironmentVariables() {
  const results = {
    required: {},
    recommended: {},
    optional: {}
  };
  
  for (const category in environmentVariables) {
    for (const envVar of environmentVariables[category]) {
      results[category][envVar] = !!process.env[envVar];
    }
  }
  
  return results;
}

function validateWorkflowSyntax() {
  try {
    const workflowContent = fs.readFileSync('.github/workflows/monitoring.yml', 'utf8');
    
    // Basic syntax checks
    const checks = {
      hasJobs: workflowContent.includes('jobs:'),
      hasHealthMonitoring: workflowContent.includes('health-monitoring:'),
      hasSupabaseMonitoring: workflowContent.includes('supabase-monitoring:'),
      hasPerformanceMonitoring: workflowContent.includes('performance-monitoring:'),
      hasSecurityMonitoring: workflowContent.includes('security-monitoring:'),
      hasAlertMonitoring: workflowContent.includes('alert-monitoring:'),
      hasCriticalAlerts: workflowContent.includes('critical-alerts:'),
      hasMonitoringReport: workflowContent.includes('monitoring-report:'),
      hasWorkflowDispatch: workflowContent.includes('workflow_dispatch:'),
      hasSchedule: workflowContent.includes('schedule:')
    };
    
    return checks;
  } catch {
    return {};
  }
}

function generateReport() {
  console.log('🔍 Mataresit Monitoring Setup Validation');
  console.log('='.repeat(50));
  
  // File validation
  console.log('\n📁 File Structure Validation:');
  let filesOk = 0;
  for (const file of requiredFiles) {
    const exists = checkFileExists(file);
    console.log(`${exists ? '✅' : '❌'} ${file}`);
    if (exists) filesOk++;
  }
  console.log(`\n📊 Files: ${filesOk}/${requiredFiles.length} present`);
  
  // Package.json scripts validation
  console.log('\n📦 Package.json Scripts Validation:');
  const scripts = checkPackageJsonScripts();
  let scriptsOk = 0;
  for (const script of packageJsonScripts) {
    const exists = scripts[script];
    console.log(`${exists ? '✅' : '❌'} ${script}`);
    if (exists) scriptsOk++;
  }
  console.log(`\n📊 Scripts: ${scriptsOk}/${packageJsonScripts.length} configured`);
  
  // Environment variables validation
  console.log('\n🔧 Environment Variables Validation:');
  const envVars = checkEnvironmentVariables();
  
  console.log('\n  Required (for core functionality):');
  let requiredOk = 0;
  for (const [envVar, exists] of Object.entries(envVars.required)) {
    console.log(`  ${exists ? '✅' : '❌'} ${envVar}`);
    if (exists) requiredOk++;
  }
  
  console.log('\n  Recommended (for full functionality):');
  let recommendedOk = 0;
  for (const [envVar, exists] of Object.entries(envVars.recommended)) {
    console.log(`  ${exists ? '✅' : '⚠️'} ${envVar}`);
    if (exists) recommendedOk++;
  }
  
  console.log('\n  Optional (for advanced features):');
  let optionalOk = 0;
  for (const [envVar, exists] of Object.entries(envVars.optional)) {
    console.log(`  ${exists ? '✅' : 'ℹ️'} ${envVar}`);
    if (exists) optionalOk++;
  }
  
  // Workflow syntax validation
  console.log('\n⚙️ Workflow Syntax Validation:');
  const workflow = validateWorkflowSyntax();
  let workflowOk = 0;
  const workflowChecks = Object.keys(workflow);
  for (const [check, passed] of Object.entries(workflow)) {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
    if (passed) workflowOk++;
  }
  console.log(`\n📊 Workflow: ${workflowOk}/${workflowChecks.length} components valid`);
  
  // Overall assessment
  console.log('\n🎯 Overall Assessment:');
  console.log('='.repeat(30));
  
  const totalRequired = requiredFiles.length + packageJsonScripts.length + workflowChecks.length;
  const totalPassed = filesOk + scriptsOk + workflowOk;
  const overallScore = (totalPassed / totalRequired) * 100;
  
  console.log(`📊 Setup Completeness: ${overallScore.toFixed(1)}%`);
  console.log(`🔧 Required Config: ${requiredOk}/${environmentVariables.required.length} configured`);
  console.log(`⚡ Recommended Config: ${recommendedOk}/${environmentVariables.recommended.length} configured`);
  console.log(`🚀 Optional Config: ${optionalOk}/${environmentVariables.optional.length} configured`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('='.repeat(20));
  
  if (filesOk < requiredFiles.length) {
    console.log('❌ Some required files are missing. Please check the file structure.');
  }
  
  if (scriptsOk < packageJsonScripts.length) {
    console.log('❌ Some package.json scripts are missing. Please update package.json.');
  }
  
  if (requiredOk < environmentVariables.required.length) {
    console.log('❌ Required environment variables missing. Core monitoring will be limited.');
    console.log('   Set up: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  
  if (recommendedOk < environmentVariables.recommended.length) {
    console.log('⚠️ Recommended environment variables missing. Some features unavailable.');
    console.log('   Consider setting up: SLACK_WEBHOOK_URL for notifications');
  }
  
  if (workflowOk < workflowChecks.length) {
    console.log('❌ Workflow syntax issues detected. Please check the monitoring.yml file.');
  }
  
  // Next steps
  console.log('\n🚀 Next Steps:');
  console.log('='.repeat(15));
  
  if (overallScore >= 90) {
    console.log('🎉 Excellent! Your monitoring setup is ready.');
    console.log('   → Run the GitHub workflow to test monitoring');
    console.log('   → Configure any missing optional features');
  } else if (overallScore >= 70) {
    console.log('👍 Good setup! A few improvements needed.');
    console.log('   → Configure missing environment variables');
    console.log('   → Test the monitoring workflow');
  } else if (overallScore >= 50) {
    console.log('⚠️ Basic setup complete, but improvements needed.');
    console.log('   → Fix missing files and scripts');
    console.log('   → Configure required environment variables');
  } else {
    console.log('🚨 Setup incomplete. Significant work needed.');
    console.log('   → Review the monitoring setup documentation');
    console.log('   → Fix missing files and configuration');
  }
  
  console.log('\n📚 Documentation:');
  console.log('   → Setup Guide: docs/monitoring/SLACK_WEBHOOK_SETUP.md');
  console.log('   → Architecture: docs/monitoring/ARCHITECTURE_MONITORING.md');
  console.log('   → Testing: docs/monitoring/TESTING_VALIDATION.md');
  
  console.log('\n🔧 Quick Commands:');
  console.log('   → Set up webhooks: npm run setup:slack-webhooks');
  console.log('   → Test performance: npm run test:monitoring:performance');
  console.log('   → Test security: npm run test:monitoring:security');
  
  return overallScore;
}

// Main execution
async function main() {
  const score = generateReport();
  
  // Exit with appropriate code
  if (score >= 70) {
    console.log('\n✅ Validation completed successfully');
    process.exit(0);
  } else {
    console.log('\n⚠️ Validation completed with issues');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Validation failed:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n💥 Validation failed:', reason);
  process.exit(1);
});

// Run the validation
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\n💥 Validation script failed:', error.message);
    process.exit(1);
  });
}

export { generateReport, checkFileExists, checkPackageJsonScripts, checkEnvironmentVariables, validateWorkflowSyntax };
