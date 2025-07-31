#!/usr/bin/env node

/**
 * Test script to verify ES module conversion
 * This script tests that the converted scripts can be imported and executed correctly
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testESModuleConversion() {
  console.log('🧪 Testing ES Module Conversion...\n');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Import setup-test-environment.js
    console.log('📦 Testing setup-test-environment.js import...');
    const setupModule = await import('./setup-test-environment.js');
    
    if (setupModule.checkEnvironmentVariables && 
        setupModule.createTestDirectories && 
        setupModule.createTestConfiguration && 
        setupModule.validateTestDependencies) {
      console.log('✅ setup-test-environment.js exports are accessible');
    } else {
      console.log('❌ setup-test-environment.js exports are missing');
      allTestsPassed = false;
    }
    
    // Test 2: Import cleanup-test-environment.js
    console.log('📦 Testing cleanup-test-environment.js import...');
    const cleanupModule = await import('./cleanup-test-environment.js');
    
    if (cleanupModule.cleanupTemporaryFiles && 
        cleanupModule.cleanupOldReports && 
        cleanupModule.cleanupTestDatabase && 
        cleanupModule.resetEnvironmentVariables) {
      console.log('✅ cleanup-test-environment.js exports are accessible');
    } else {
      console.log('❌ cleanup-test-environment.js exports are missing');
      allTestsPassed = false;
    }
    
    // Test 3: Import run-load-tests.js
    console.log('📦 Testing run-load-tests.js import...');
    const loadTestModule = await import('../load-testing/run-load-tests.js');
    
    if (loadTestModule.runLoadTestScenario && 
        loadTestModule.checkPrerequisites && 
        loadTestModule.setupTestEnvironment && 
        loadTestModule.cleanupTestEnvironment) {
      console.log('✅ run-load-tests.js exports are accessible');
    } else {
      console.log('❌ run-load-tests.js exports are missing');
      allTestsPassed = false;
    }
    
    // Test 4: Verify ES module syntax works
    console.log('🔍 Testing ES module syntax compatibility...');
    
    // Test import.meta.url
    if (import.meta.url) {
      console.log('✅ import.meta.url is available');
    } else {
      console.log('❌ import.meta.url is not available');
      allTestsPassed = false;
    }
    
    // Test fileURLToPath
    const testFilename = fileURLToPath(import.meta.url);
    if (testFilename && testFilename.includes('test-es-module-conversion.js')) {
      console.log('✅ fileURLToPath works correctly');
    } else {
      console.log('❌ fileURLToPath failed');
      allTestsPassed = false;
    }
    
  } catch (error) {
    console.log(`❌ ES Module conversion test failed: ${error.message}`);
    console.log(`🔍 Error details:`, error);
    allTestsPassed = false;
  }
  
  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 All ES Module conversion tests passed!');
    console.log('✅ The converted scripts should work in CI environment');
    process.exit(0);
  } else {
    console.log('❌ Some ES Module conversion tests failed');
    console.log('🔧 Please check the converted scripts for issues');
    process.exit(1);
  }
}

// Run the test
testESModuleConversion();
