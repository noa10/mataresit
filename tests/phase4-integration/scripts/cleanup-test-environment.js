#!/usr/bin/env node

/**
 * Phase 4 Integration Test Environment Cleanup
 *
 * This script cleans up the test environment after Phase 4 integration tests,
 * including test data removal and temporary file cleanup.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n🧹 ${title}`, 'blue');
  log('='.repeat(title.length + 3), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

/**
 * Clean up temporary test files
 */
function cleanupTemporaryFiles() {
  logSection('Cleaning Up Temporary Files');
  
  const tempPaths = [
    'tests/phase4-integration/test-config.json',
    'tests/phase4-integration/fixtures/test-receipts/*.tmp',
    'tests/phase4-integration/reports/*.tmp'
  ];
  
  for (const tempPath of tempPaths) {
    try {
      if (tempPath.includes('*')) {
        // Handle glob patterns
        const dir = path.dirname(tempPath);
        const pattern = path.basename(tempPath);
        
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          const matchingFiles = files.filter(file => 
            pattern.replace('*', '').split('.').every(part => file.includes(part))
          );
          
          for (const file of matchingFiles) {
            const filePath = path.join(dir, file);
            fs.unlinkSync(filePath);
            logSuccess(`Removed temporary file: ${filePath}`);
          }
        }
      } else {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
          logSuccess(`Removed temporary file: ${tempPath}`);
        }
      }
    } catch (error) {
      logWarning(`Failed to remove ${tempPath}: ${error.message}`);
    }
  }
}

/**
 * Clean up test reports older than specified days
 */
function cleanupOldReports(daysToKeep = 7) {
  logSection(`Cleaning Up Reports Older Than ${daysToKeep} Days`);
  
  const reportsDir = 'tests/phase4-integration/reports';
  
  if (!fs.existsSync(reportsDir)) {
    log('Reports directory does not exist', 'cyan');
    return;
  }
  
  try {
    const files = fs.readdirSync(reportsDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let removedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        logSuccess(`Removed old report: ${file}`);
        removedCount++;
      }
    }
    
    if (removedCount === 0) {
      log('No old reports to remove', 'cyan');
    } else {
      logSuccess(`Removed ${removedCount} old report(s)`);
    }
  } catch (error) {
    logError(`Failed to clean up old reports: ${error.message}`);
  }
}

/**
 * Clean up test database data (if configured)
 */
async function cleanupTestDatabase() {
  logSection('Cleaning Up Test Database Data');
  
  // Check if we have database configuration
  const hasSupabaseConfig = process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!hasSupabaseConfig) {
    logWarning('No test database configuration found, skipping database cleanup');
    return;
  }
  
  try {
    // Import Supabase client dynamically
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.TEST_SUPABASE_URL,
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Clean up test data in reverse dependency order
    const cleanupQueries = [
      // Clean embeddings first (references receipts)
      `DELETE FROM embeddings WHERE receipt_id IN (
        SELECT id FROM receipts WHERE metadata->>'test_data' = 'true'
      )`,
      
      // Clean receipts
      `DELETE FROM receipts WHERE metadata->>'test_data' = 'true'`,
      
      // Clean batch upload sessions
      `DELETE FROM batch_upload_sessions WHERE session_name LIKE 'test-%'`,
      
      // Clean queue items
      `DELETE FROM embedding_queue WHERE metadata->>'test_data' = 'true'`,
      
      // Clean metrics
      `DELETE FROM embedding_metrics WHERE metadata->>'test_data' = 'true'`,
      
      // Clean API quota tracking
      `DELETE FROM api_quota_tracking WHERE metadata->>'test_data' = 'true'`,
      
      // Clean test workers
      `DELETE FROM embedding_queue_workers WHERE metadata->>'test_worker' = 'true'`,
      
      // Clean team members for test teams
      `DELETE FROM team_members WHERE team_id IN (
        SELECT id FROM teams WHERE name LIKE 'Test Team%'
      )`,
      
      // Clean test teams
      `DELETE FROM teams WHERE name LIKE 'Test Team%'`
    ];
    
    for (const query of cleanupQueries) {
      try {
        await supabase.rpc('execute_sql', { sql: query });
        logSuccess(`Executed cleanup query: ${query.substring(0, 50)}...`);
      } catch (error) {
        logWarning(`Cleanup query failed (this may be expected): ${error.message}`);
      }
    }
    
    // Clean up test users
    try {
      const { data: users, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        logWarning(`Failed to list users for cleanup: ${error.message}`);
      } else {
        let deletedUsers = 0;
        
        for (const user of users.users) {
          if (user.email?.includes('test-user-') || user.user_metadata?.test_user) {
            try {
              await supabase.auth.admin.deleteUser(user.id);
              deletedUsers++;
            } catch (error) {
              logWarning(`Failed to delete test user ${user.id}: ${error.message}`);
            }
          }
        }
        
        if (deletedUsers > 0) {
          logSuccess(`Deleted ${deletedUsers} test user(s)`);
        } else {
          log('No test users to delete', 'cyan');
        }
      }
    } catch (error) {
      logWarning(`Error during test user cleanup: ${error.message}`);
    }
    
    logSuccess('Database cleanup completed');
    
  } catch (error) {
    logError(`Database cleanup failed: ${error.message}`);
    logWarning('This may be expected if Supabase client is not available');
  }
}

/**
 * Reset environment variables
 */
function resetEnvironmentVariables() {
  logSection('Resetting Environment Variables');
  
  const testEnvVars = [
    'TEST_TIMEOUT',
    'TEST_CONCURRENT_USERS',
    'TEST_BATCH_SIZE',
    'TEST_PERFORMANCE_THRESHOLD',
    'SKIP_LOAD_TESTS'
  ];
  
  for (const varName of testEnvVars) {
    if (process.env[varName]) {
      delete process.env[varName];
      logSuccess(`Reset environment variable: ${varName}`);
    }
  }
}

/**
 * Generate cleanup summary
 */
function generateCleanupSummary() {
  logSection('Cleanup Summary');
  
  const summary = {
    timestamp: new Date().toISOString(),
    actions: [
      'Temporary files removed',
      'Old reports cleaned up',
      'Test database data removed',
      'Environment variables reset'
    ],
    status: 'completed'
  };
  
  try {
    const summaryPath = 'tests/phase4-integration/reports/cleanup-summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    logSuccess(`Cleanup summary saved: ${summaryPath}`);
  } catch (error) {
    logWarning(`Failed to save cleanup summary: ${error.message}`);
  }
}

/**
 * Main cleanup function
 */
async function main() {
  log('\n🧹 Phase 4 Integration Test Environment Cleanup', 'blue');
  log('='.repeat(52), 'blue');
  
  try {
    // Clean up temporary files
    cleanupTemporaryFiles();
    
    // Clean up old reports
    cleanupOldReports();
    
    // Clean up test database data
    await cleanupTestDatabase();
    
    // Reset environment variables
    resetEnvironmentVariables();
    
    // Generate cleanup summary
    generateCleanupSummary();
    
    log('\n🎉 Test environment cleanup completed successfully!', 'green');
    
  } catch (error) {
    logError(`Cleanup failed: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  daysToKeep: 7,
  skipDatabase: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--days':
      options.daysToKeep = parseInt(args[i + 1]) || 7;
      i++;
      break;
    case '--skip-database':
      options.skipDatabase = true;
      break;
    case '--help':
      console.log('Phase 4 Integration Test Environment Cleanup');
      console.log('');
      console.log('Usage: node cleanup-test-environment.js [options]');
      console.log('');
      console.log('Options:');
      console.log('  --days <number>     Days of reports to keep (default: 7)');
      console.log('  --skip-database     Skip database cleanup');
      console.log('  --help              Show this help message');
      process.exit(0);
  }
}

// Run cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  cleanupTemporaryFiles,
  cleanupOldReports,
  cleanupTestDatabase,
  resetEnvironmentVariables
};
