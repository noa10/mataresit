#!/usr/bin/env node

/**
 * Phase 4 Integration Test Environment Setup
 *
 * This script sets up the test environment for Phase 4 integration tests,
 * including test database initialization and mock service configuration.
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
  log(`\n🔧 ${title}`, 'blue');
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
 * Check if required environment variables are set
 */
function checkEnvironmentVariables() {
  logSection('Checking Environment Variables');
  
  const requiredVars = [
    'TEST_SUPABASE_URL',
    'TEST_SUPABASE_ANON_KEY',
    'TEST_SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const optionalVars = [
    'TEST_GEMINI_API_KEY',
    'TEST_OPENROUTER_API_KEY',
    'TEST_TIMEOUT',
    'TEST_CONCURRENT_USERS',
    'TEST_BATCH_SIZE'
  ];
  
  let missingRequired = [];
  let missingOptional = [];
  
  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      // Try fallback to production variables
      const fallbackName = varName.replace('TEST_', 'VITE_');
      if (process.env[fallbackName]) {
        process.env[varName] = process.env[fallbackName];
        logWarning(`Using ${fallbackName} as fallback for ${varName}`);
      } else {
        missingRequired.push(varName);
      }
    } else {
      logSuccess(`${varName} is set`);
    }
  }
  
  // Check optional variables
  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      missingOptional.push(varName);
    } else {
      logSuccess(`${varName} is set`);
    }
  }
  
  if (missingRequired.length > 0) {
    logError('Missing required environment variables:');
    missingRequired.forEach(varName => {
      log(`  - ${varName}`, 'red');
    });
    return false;
  }
  
  if (missingOptional.length > 0) {
    logWarning('Missing optional environment variables (using defaults):');
    missingOptional.forEach(varName => {
      log(`  - ${varName}`, 'yellow');
    });
  }
  
  return true;
}

/**
 * Create test directories if they don't exist
 */
function createTestDirectories() {
  logSection('Creating Test Directories');
  
  const testDirs = [
    'tests/phase4-integration/reports',
    'tests/phase4-integration/fixtures/test-receipts',
    'tests/phase4-integration/integration',
    'tests/phase4-integration/performance',
    'tests/phase4-integration/load-testing',
    'tests/phase4-integration/production-readiness'
  ];
  
  for (const dir of testDirs) {
    const fullPath = path.resolve(dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      logSuccess(`Created directory: ${dir}`);
    } else {
      log(`Directory already exists: ${dir}`, 'cyan');
    }
  }
}

/**
 * Create test configuration file
 */
function createTestConfiguration() {
  logSection('Creating Test Configuration');
  
  const configPath = 'tests/phase4-integration/test-config.json';
  const config = {
    timestamp: new Date().toISOString(),
    environment: {
      supabaseUrl: process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      hasGeminiKey: !!process.env.TEST_GEMINI_API_KEY,
      hasOpenRouterKey: !!process.env.TEST_OPENROUTER_API_KEY
    },
    testSettings: {
      timeout: parseInt(process.env.TEST_TIMEOUT || '300000'),
      concurrentUsers: parseInt(process.env.TEST_CONCURRENT_USERS || '50'),
      batchSize: parseInt(process.env.TEST_BATCH_SIZE || '100'),
      performanceThreshold: parseInt(process.env.TEST_PERFORMANCE_THRESHOLD || '7500')
    },
    testSuites: {
      integration: true,
      performance: true,
      loadTesting: process.env.SKIP_LOAD_TESTS !== 'true',
      productionReadiness: true
    }
  };
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logSuccess(`Test configuration created: ${configPath}`);
  } catch (error) {
    logError(`Failed to create test configuration: ${error.message}`);
    return false;
  }
  
  return true;
}

/**
 * Validate test dependencies
 */
function validateTestDependencies() {
  logSection('Validating Test Dependencies');
  
  const packageJsonPath = 'package.json';
  
  if (!fs.existsSync(packageJsonPath)) {
    logError('package.json not found');
    return false;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const requiredDeps = [
      'vitest',
      '@testing-library/react',
      '@supabase/supabase-js',
      'msw'
    ];
    
    const devDeps = packageJson.devDependencies || {};
    const deps = packageJson.dependencies || {};
    
    for (const dep of requiredDeps) {
      if (devDeps[dep] || deps[dep]) {
        logSuccess(`${dep} is installed`);
      } else {
        logError(`${dep} is not installed`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    logError(`Failed to read package.json: ${error.message}`);
    return false;
  }
}

/**
 * Create sample test files if they don't exist
 */
function createSampleTestFiles() {
  logSection('Creating Sample Test Files');
  
  // Create a simple integration test file if it doesn't exist
  const integrationTestPath = 'tests/phase4-integration/integration/sample.test.ts';
  
  if (!fs.existsSync(integrationTestPath)) {
    const sampleTest = `/**
 * Sample Integration Test for Phase 4
 * This is a placeholder test file to ensure the test infrastructure works.
 */

import { describe, it, expect } from 'vitest';

describe('Phase 4 Integration Test Infrastructure', () => {
  it('should have test environment properly configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.VITEST).toBe('true');
  });

  it('should have access to test configuration', () => {
    // Basic test to verify test setup is working
    expect(true).toBe(true);
  });
});
`;
    
    try {
      fs.writeFileSync(integrationTestPath, sampleTest);
      logSuccess(`Created sample test file: ${integrationTestPath}`);
    } catch (error) {
      logWarning(`Failed to create sample test file: ${error.message}`);
    }
  }
}

/**
 * Main setup function
 */
async function main() {
  log('\n🚀 Phase 4 Integration Test Environment Setup', 'blue');
  log('='.repeat(50), 'blue');
  
  try {
    // Check environment variables
    if (!checkEnvironmentVariables()) {
      logError('Environment setup failed. Please set required environment variables.');
      process.exit(1);
    }
    
    // Create test directories
    createTestDirectories();
    
    // Create test configuration
    if (!createTestConfiguration()) {
      logError('Failed to create test configuration');
      process.exit(1);
    }
    
    // Validate dependencies
    if (!validateTestDependencies()) {
      logError('Test dependencies validation failed');
      process.exit(1);
    }
    
    // Create sample test files
    createSampleTestFiles();
    
    log('\n🎉 Test environment setup completed successfully!', 'green');
    log('You can now run the Phase 4 integration tests.', 'green');
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  checkEnvironmentVariables,
  createTestDirectories,
  createTestConfiguration,
  validateTestDependencies
};
