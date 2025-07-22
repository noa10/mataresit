#!/usr/bin/env node

/**
 * Master Test Execution Script
 * 
 * This script orchestrates the complete Phase 4 integration test suite
 * including performance benchmarking, load testing, data consistency validation,
 * and production readiness assessment.
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
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
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

function logBold(message) {
  log(message, 'bold');
}

/**
 * Test suite definitions
 */
const TEST_SUITES = {
  integration: {
    name: 'Integration Tests',
    description: 'Core integration tests for Phase 4 systems',
    files: [
      'high-volume-batch-upload.test.ts',
      'system-failure-recovery.test.ts'
    ],
    timeout: 300000, // 5 minutes
    critical: true
  },
  performance: {
    name: 'Performance Benchmarking',
    description: 'Performance benchmarking and optimization validation',
    files: [
      '../performance/single-upload-performance.test.ts',
      '../performance/batch-upload-performance.test.ts',
      '../performance/queue-system-performance.test.ts',
      '../performance/monitoring-dashboard-performance.test.ts'
    ],
    timeout: 600000, // 10 minutes
    critical: true
  },
  load: {
    name: 'Load Testing',
    description: 'Load testing and stress testing scenarios',
    files: [
      '../load-testing/peak-usage-load.test.ts',
      '../load-testing/stress-testing.test.ts'
    ],
    timeout: 1800000, // 30 minutes
    critical: false
  },
  consistency: {
    name: 'Data Consistency Validation',
    description: 'Data consistency and integrity validation tests',
    files: [
      '../production-readiness/data-consistency-validation.test.ts',
      '../production-readiness/concurrent-modification.test.ts',
      '../production-readiness/data-integrity-validation.test.ts'
    ],
    timeout: 900000, // 15 minutes
    critical: true
  },
  production_readiness: {
    name: 'Production Readiness Validation',
    description: 'Complete production readiness validation framework',
    files: [
      '../production-readiness/production-readiness-validation.test.ts'
    ],
    timeout: 1200000, // 20 minutes
    critical: true
  }
};

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    suites: ['all'],
    parallel: false,
    verbose: false,
    generateReports: true,
    ciMode: false,
    outputDir: 'test-results',
    timeout: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--suites':
      case '-s':
        options.suites = args[i + 1].split(',');
        i++;
        break;
      case '--parallel':
      case '-p':
        options.parallel = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--no-reports':
        options.generateReports = false;
        break;
      case '--ci':
        options.ciMode = true;
        break;
      case '--output':
      case '-o':
        options.outputDir = args[i + 1];
        i++;
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[i + 1]) * 1000;
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
  log('\n🧪 Phase 4 Integration Test Suite', 'cyan');
  log('==================================', 'cyan');
  log('\nUsage: node run-all-tests.js [options]');
  log('\nOptions:');
  log('  -s, --suites <list>     Test suites to run (comma-separated)');
  log('  -p, --parallel          Run test suites in parallel');
  log('  -v, --verbose           Enable verbose output');
  log('  --no-reports            Skip report generation');
  log('  --ci                    CI/CD mode with strict validation');
  log('  -o, --output <dir>      Output directory for results');
  log('  -t, --timeout <seconds> Global timeout for all tests');
  log('  -h, --help              Show this help message');
  
  log('\nAvailable Test Suites:', 'yellow');
  Object.entries(TEST_SUITES).forEach(([key, suite]) => {
    log(`  ${key.padEnd(20)} ${suite.name}`, 'cyan');
    log(`  ${' '.repeat(20)} ${suite.description}`);
    log(`  ${' '.repeat(20)} Critical: ${suite.critical ? 'Yes' : 'No'}`);
    log('');
  });
  
  log('Special Values:', 'yellow');
  log('  all                     Run all test suites');
  log('  critical                Run only critical test suites');
  
  log('\nEnvironment Variables:', 'yellow');
  log('  TEST_SUPABASE_URL              Test Supabase URL');
  log('  TEST_SUPABASE_ANON_KEY         Test Supabase anonymous key');
  log('  TEST_SUPABASE_SERVICE_ROLE_KEY Test Supabase service role key');
  log('  TEST_GEMINI_API_KEY            Test Gemini API key');
  log('  TEST_OPENROUTER_API_KEY        Test OpenRouter API key');
  
  log('\nExamples:', 'yellow');
  log('  node run-all-tests.js');
  log('  node run-all-tests.js --suites integration,performance');
  log('  node run-all-tests.js --suites critical --ci');
  log('  node run-all-tests.js --parallel --verbose');
}

/**
 * Check prerequisites
 */
async function checkPrerequisites() {
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
    await import('vitest');
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
    logWarning('Some tests may not work correctly without proper configuration.');
  } else {
    logSuccess('All required environment variables are set');
  }
  
  return true;
}

/**
 * Resolve test suites to run
 */
function resolveTestSuites(suiteNames) {
  const suitesToRun = [];
  
  for (const suiteName of suiteNames) {
    if (suiteName === 'all') {
      suitesToRun.push(...Object.keys(TEST_SUITES));
    } else if (suiteName === 'critical') {
      suitesToRun.push(...Object.keys(TEST_SUITES).filter(key => TEST_SUITES[key].critical));
    } else if (TEST_SUITES[suiteName]) {
      suitesToRun.push(suiteName);
    } else {
      logWarning(`Unknown test suite: ${suiteName}`);
    }
  }
  
  // Remove duplicates
  return [...new Set(suitesToRun)];
}

/**
 * Run a single test suite
 */
async function runTestSuite(suiteKey, options) {
  const suite = TEST_SUITES[suiteKey];
  logSection(`Running ${suite.name}`);
  
  const startTime = Date.now();
  let success = true;
  
  try {
    for (const testFile of suite.files) {
      const testPath = path.join(__dirname, '..', testFile);
      
      if (!fs.existsSync(testPath)) {
        logWarning(`Test file not found: ${testFile}`);
        continue;
      }
      
      log(`📋 Running: ${testFile}`, 'cyan');
      
      const vitestArgs = [
        'run',
        testPath,
        '--reporter=verbose',
        `--testTimeout=${options.timeout || suite.timeout}`
      ];
      
      if (options.verbose) {
        vitestArgs.push('--verbose');
      }
      
      if (options.ciMode) {
        vitestArgs.push('--reporter=junit');
        vitestArgs.push(`--outputFile=${options.outputDir}/junit-${suiteKey}-${path.basename(testFile, '.test.ts')}.xml`);
      }
      
      await runCommand('npx', ['vitest', ...vitestArgs]);
      logSuccess(`Completed: ${testFile}`);
    }
    
    const duration = Date.now() - startTime;
    logSuccess(`${suite.name} completed in ${(duration / 1000).toFixed(1)}s`);
    
  } catch (error) {
    success = false;
    const duration = Date.now() - startTime;
    logError(`${suite.name} failed after ${(duration / 1000).toFixed(1)}s: ${error.message}`);
    
    if (suite.critical && options.ciMode) {
      throw new Error(`Critical test suite failed: ${suite.name}`);
    }
  }
  
  return { suite: suiteKey, success, duration: Date.now() - startTime };
}

/**
 * Run test suites
 */
async function runTestSuites(suiteKeys, options) {
  const results = [];
  
  if (options.parallel && suiteKeys.length > 1) {
    logSection('Running Test Suites in Parallel');
    
    const promises = suiteKeys.map(suiteKey => 
      runTestSuite(suiteKey, options).catch(error => ({ 
        suite: suiteKey, 
        success: false, 
        error: error.message,
        duration: 0
      }))
    );
    
    const parallelResults = await Promise.all(promises);
    results.push(...parallelResults);
    
  } else {
    logSection('Running Test Suites Sequentially');
    
    for (const suiteKey of suiteKeys) {
      try {
        const result = await runTestSuite(suiteKey, options);
        results.push(result);
      } catch (error) {
        results.push({ 
          suite: suiteKey, 
          success: false, 
          error: error.message,
          duration: 0
        });
        
        if (options.ciMode) {
          break; // Stop on first critical failure in CI mode
        }
      }
    }
  }
  
  return results;
}

/**
 * Generate test reports
 */
async function generateReports(results, options) {
  if (!options.generateReports) {
    return;
  }
  
  logSection('Generating Test Reports');
  
  try {
    // Ensure output directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }
    
    // Generate summary report
    const summaryPath = path.join(options.outputDir, 'test-summary.json');
    const summary = {
      timestamp: new Date().toISOString(),
      totalSuites: results.length,
      successfulSuites: results.filter(r => r.success).length,
      failedSuites: results.filter(r => !r.success).length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      results: results
    };
    
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    logSuccess(`Summary report generated: ${summaryPath}`);
    
    // Generate HTML report
    const htmlPath = path.join(options.outputDir, 'test-report.html');
    const html = generateHTMLReport(summary);
    fs.writeFileSync(htmlPath, html);
    logSuccess(`HTML report generated: ${htmlPath}`);
    
    // Run production readiness report if applicable
    if (results.some(r => r.suite === 'production_readiness' && r.success)) {
      const readinessScript = path.join(__dirname, '../production-readiness/run-production-readiness.js');
      if (fs.existsSync(readinessScript)) {
        await runCommand('node', [readinessScript, '--format', 'html', '--output', path.join(options.outputDir, 'production-readiness.html')]);
        logSuccess('Production readiness report generated');
      }
    }
    
  } catch (error) {
    logError(`Report generation failed: ${error.message}`);
  }
}

/**
 * Generate HTML report
 */
function generateHTMLReport(summary) {
  const successRate = (summary.successfulSuites / summary.totalSuites * 100).toFixed(1);
  const duration = (summary.totalDuration / 1000).toFixed(1);
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Phase 4 Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .summary-value { font-size: 24px; font-weight: bold; color: #333; }
        .summary-label { color: #666; margin-top: 5px; }
        .results { margin-top: 30px; }
        .result-item { padding: 15px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #007bff; }
        .result-item.success { border-left-color: #28a745; background: #f8fff9; }
        .result-item.failure { border-left-color: #dc3545; background: #fff5f5; }
        .result-header { display: flex; justify-content: space-between; align-items: center; }
        .result-name { font-weight: bold; }
        .result-status { padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase; }
        .result-status.success { background: #28a745; color: white; }
        .result-status.failure { background: #dc3545; color: white; }
        .result-duration { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Phase 4 Integration Test Report</h1>
            <p>Generated: ${summary.timestamp}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <div class="summary-value">${successRate}%</div>
                <div class="summary-label">Success Rate</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${summary.totalSuites}</div>
                <div class="summary-label">Total Suites</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${summary.successfulSuites}</div>
                <div class="summary-label">Successful</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${duration}s</div>
                <div class="summary-label">Duration</div>
            </div>
        </div>
        
        <div class="results">
            <h2>Test Suite Results</h2>
            ${summary.results.map(result => `
                <div class="result-item ${result.success ? 'success' : 'failure'}">
                    <div class="result-header">
                        <span class="result-name">${TEST_SUITES[result.suite]?.name || result.suite}</span>
                        <span class="result-status ${result.success ? 'success' : 'failure'}">${result.success ? 'PASSED' : 'FAILED'}</span>
                    </div>
                    <div class="result-duration">Duration: ${(result.duration / 1000).toFixed(1)}s</div>
                    ${result.error ? `<div style="color: #dc3545; margin-top: 10px;">Error: ${result.error}</div>` : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
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
  
  log('\n🧪 Phase 4 Integration Test Suite', 'magenta');
  log('==================================', 'magenta');
  log(`Suites: ${options.suites.join(', ')}`);
  log(`Parallel: ${options.parallel}`);
  log(`CI Mode: ${options.ciMode}`);
  log(`Output: ${options.outputDir}`);
  
  let exitCode = 0;
  
  try {
    // Check prerequisites
    if (!(await checkPrerequisites())) {
      process.exit(1);
    }
    
    // Resolve test suites
    const suitesToRun = resolveTestSuites(options.suites);
    if (suitesToRun.length === 0) {
      logError('No valid test suites specified');
      process.exit(1);
    }
    
    logBold(`\nRunning ${suitesToRun.length} test suite(s): ${suitesToRun.join(', ')}`);
    
    // Run test suites
    const results = await runTestSuites(suitesToRun, options);
    
    // Generate reports
    await generateReports(results, options);
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    const successRate = (successful / total * 100).toFixed(1);
    
    logSection('Test Execution Summary');
    logBold(`Success Rate: ${successRate}% (${successful}/${total})`);
    
    if (successful === total) {
      log('\n🎉 All test suites passed successfully!', 'green');
    } else {
      log(`\n⚠️  ${total - successful} test suite(s) failed`, 'yellow');
      exitCode = 1;
    }
    
    // CI mode validation
    if (options.ciMode) {
      const criticalFailures = results.filter(r => !r.success && TEST_SUITES[r.suite]?.critical).length;
      if (criticalFailures > 0) {
        log(`\n❌ ${criticalFailures} critical test suite(s) failed - blocking deployment`, 'red');
        exitCode = 2;
      }
    }
    
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    exitCode = 1;
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
  runTestSuite,
  runTestSuites,
  generateReports,
  checkPrerequisites
};
