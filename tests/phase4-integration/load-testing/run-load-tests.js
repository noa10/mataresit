#!/usr/bin/env node

/**
 * Load Test Execution Script
 *
 * This script runs the complete load testing suite for Phase 4 integration tests.
 * It can run individual test scenarios or the complete suite.
 */

import { spawn } from 'child_process';
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
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n🚀 ${title}`, 'blue');
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
 * Available load test scenarios
 */
const LOAD_TEST_SCENARIOS = {
  'peak-usage': {
    name: 'Peak Usage Load Test',
    description: '50 concurrent users performing typical batch uploads',
    testFile: 'peak-usage-load.test.ts',
    duration: '10 minutes',
    intensity: 'Medium'
  },
  'stress-test': {
    name: 'Stress Test',
    description: '100+ concurrent users pushing system limits',
    testFile: 'stress-testing.test.ts',
    duration: '15-60 minutes',
    intensity: 'High'
  },
  'all': {
    name: 'Complete Load Test Suite',
    description: 'All load testing scenarios',
    testFile: 'all',
    duration: '60+ minutes',
    intensity: 'Maximum'
  }
};

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    scenario: 'all',
    verbose: false,
    skipSetup: false,
    generateReport: true,
    timeout: 7200000, // 2 hours default
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scenario':
      case '-s':
        options.scenario = args[i + 1];
        i++;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--skip-setup':
        options.skipSetup = true;
        break;
      case '--no-report':
        options.generateReport = false;
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[i + 1]) * 1000; // Convert to milliseconds
        i++;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (args[i].startsWith('-')) {
          logError(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * Display help information
 */
function displayHelp() {
  log('\n🧪 Phase 4 Load Testing Suite', 'cyan');
  log('=====================================', 'cyan');
  log('\nUsage: node run-load-tests.js [options]');
  log('\nOptions:');
  log('  -s, --scenario <name>    Load test scenario to run (default: all)');
  log('  -v, --verbose           Enable verbose output');
  log('  --skip-setup            Skip test environment setup');
  log('  --no-report             Skip report generation');
  log('  -t, --timeout <seconds> Test timeout in seconds (default: 7200)');
  log('  -h, --help              Show this help message');
  
  log('\nAvailable Scenarios:', 'yellow');
  Object.entries(LOAD_TEST_SCENARIOS).forEach(([key, scenario]) => {
    log(`  ${key.padEnd(12)} ${scenario.name}`, 'cyan');
    log(`  ${' '.repeat(12)} ${scenario.description}`);
    log(`  ${' '.repeat(12)} Duration: ${scenario.duration}, Intensity: ${scenario.intensity}`);
    log('');
  });

  log('Environment Variables:', 'yellow');
  log('  TEST_SUPABASE_URL              Test Supabase URL');
  log('  TEST_SUPABASE_ANON_KEY         Test Supabase anonymous key');
  log('  TEST_SUPABASE_SERVICE_ROLE_KEY Test Supabase service role key');
  log('  TEST_GEMINI_API_KEY            Test Gemini API key');
  log('  TEST_OPENROUTER_API_KEY        Test OpenRouter API key');
  log('  LOAD_TEST_WORKERS              Number of queue workers (default: auto)');
  log('  LOAD_TEST_TIMEOUT              Test timeout in seconds');
  
  log('\nExamples:', 'yellow');
  log('  node run-load-tests.js --scenario peak-usage');
  log('  node run-load-tests.js --scenario stress-test --verbose');
  log('  node run-load-tests.js --scenario all --timeout 10800'); // 3 hours
}

/**
 * Check prerequisites
 */
function checkPrerequisites() {
  logSection('Checking Prerequisites');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    logError(`Node.js version ${nodeVersion} is not supported. Please use Node.js 18 or higher.`);
    return false;
  }
  logSuccess(`Node.js version: ${nodeVersion}`);
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    logError('package.json not found. Please run from the project root directory.');
    return false;
  }
  logSuccess('package.json found');
  
  // Check if vitest is available
  try {
    require.resolve('vitest');
    logSuccess('Vitest is available');
  } catch (error) {
    logError('Vitest is not installed. Please run: npm install');
    return false;
  }
  
  // Check environment variables
  const requiredEnvVars = [
    'TEST_SUPABASE_URL',
    'TEST_SUPABASE_ANON_KEY',
    'TEST_SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    logWarning('Missing environment variables:');
    missingEnvVars.forEach(varName => {
      log(`  - ${varName}`, 'yellow');
    });
    logWarning('Load tests may not work correctly without proper configuration.');
  } else {
    logSuccess('All required environment variables are set');
  }
  
  return true;
}

/**
 * Setup test environment
 */
async function setupTestEnvironment() {
  logSection('Setting Up Test Environment');
  
  try {
    // Run test environment setup script
    const setupScript = path.join(__dirname, '..', 'scripts', 'setup-test-environment.js');
    if (fs.existsSync(setupScript)) {
      await runCommand('node', [setupScript]);
      logSuccess('Test environment setup completed');
    } else {
      logWarning('Setup script not found, skipping environment setup');
    }
  } catch (error) {
    logError(`Test environment setup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Run a specific load test scenario
 */
async function runLoadTestScenario(scenario, options) {
  const scenarioConfig = LOAD_TEST_SCENARIOS[scenario];
  
  if (!scenarioConfig) {
    throw new Error(`Unknown scenario: ${scenario}`);
  }
  
  logSection(`Running ${scenarioConfig.name}`);
  log(`Description: ${scenarioConfig.description}`, 'cyan');
  log(`Expected Duration: ${scenarioConfig.duration}`, 'cyan');
  log(`Intensity: ${scenarioConfig.intensity}`, 'cyan');
  
  const startTime = Date.now();
  
  try {
    if (scenario === 'all') {
      // Run all scenarios sequentially
      await runLoadTestScenario('peak-usage', options);
      await runLoadTestScenario('stress-test', options);
    } else {
      // Run specific scenario
      const testFile = path.join(__dirname, scenarioConfig.testFile);
      const vitestArgs = [
        'run',
        testFile,
        '--reporter=verbose',
        `--testTimeout=${options.timeout}`
      ];
      
      if (options.verbose) {
        vitestArgs.push('--verbose');
      }
      
      await runCommand('npx', ['vitest', ...vitestArgs]);
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    logSuccess(`${scenarioConfig.name} completed in ${duration.toFixed(1)} seconds`);
    
  } catch (error) {
    logError(`${scenarioConfig.name} failed: ${error.message}`);
    throw error;
  }
}

/**
 * Generate load test report
 */
async function generateLoadTestReport() {
  logSection('Generating Load Test Report');
  
  try {
    const reportScript = path.join(__dirname, '..', 'scripts', 'generate-reports.js');
    if (fs.existsSync(reportScript)) {
      await runCommand('node', [reportScript, 'load-test']);
      logSuccess('Load test report generated');
    } else {
      logWarning('Report generation script not found, skipping report generation');
    }
  } catch (error) {
    logWarning(`Report generation failed: ${error.message}`);
  }
}

/**
 * Cleanup test environment
 */
async function cleanupTestEnvironment() {
  logSection('Cleaning Up Test Environment');
  
  try {
    const cleanupScript = path.join(__dirname, '..', 'scripts', 'cleanup-test-environment.js');
    if (fs.existsSync(cleanupScript)) {
      await runCommand('node', [cleanupScript]);
      logSuccess('Test environment cleanup completed');
    } else {
      logWarning('Cleanup script not found, skipping cleanup');
    }
  } catch (error) {
    logWarning(`Cleanup failed: ${error.message}`);
  }
}

/**
 * Run a command and return a promise
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main execution function
 */
async function main() {
  const options = parseArguments();
  
  if (options.help) {
    displayHelp();
    return;
  }
  
  log('\n🧪 Phase 4 Load Testing Suite', 'magenta');
  log('==============================', 'magenta');
  log(`Scenario: ${options.scenario}`);
  log(`Timeout: ${options.timeout / 1000} seconds`);
  log(`Verbose: ${options.verbose}`);
  log(`Generate Report: ${options.generateReport}`);
  
  let exitCode = 0;
  
  try {
    // Check prerequisites
    if (!checkPrerequisites()) {
      process.exit(1);
    }
    
    // Setup test environment
    if (!options.skipSetup) {
      await setupTestEnvironment();
    }
    
    // Run load tests
    await runLoadTestScenario(options.scenario, options);
    
    // Generate report
    if (options.generateReport) {
      await generateLoadTestReport();
    }
    
    log('\n🎉 Load testing completed successfully!', 'green');
    
  } catch (error) {
    logError(`Load testing failed: ${error.message}`);
    exitCode = 1;
  } finally {
    // Always cleanup
    await cleanupTestEnvironment();
  }
  
  process.exit(exitCode);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runLoadTestScenario,
  checkPrerequisites,
  setupTestEnvironment,
  cleanupTestEnvironment
};
