/**
 * Test Configuration Validator
 * Validates that all test configurations are properly set up for production external-api function
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration files to check
const configFiles = [
  {
    name: '.env.test',
    path: path.join(__dirname, '..', '.env.test'),
    type: 'env'
  },
  {
    name: 'comprehensive-test-suite.js',
    path: path.join(__dirname, '..', 'tests', 'api', 'comprehensive-test-suite.js'),
    type: 'js'
  },
  {
    name: 'test-api-simple.js',
    path: path.join(__dirname, '..', 'scripts', 'test-api-simple.js'),
    type: 'js'
  },
  {
    name: 'mataresit-api.postman_collection.json',
    path: path.join(__dirname, '..', 'docs', 'testing', 'mataresit-api.postman_collection.json'),
    type: 'json'
  }
];

// Expected values
const EXPECTED_EXTERNAL_API_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const EXPECTED_BYPASS_API_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/bypass-test/api/v1';

async function validateConfiguration() {
  console.log('🔍 Validating Test Configuration for Production External API\n');
  
  let allValid = true;
  const results = [];

  // Check each configuration file
  for (const config of configFiles) {
    console.log(`📄 Checking ${config.name}...`);
    
    try {
      if (!fs.existsSync(config.path)) {
        console.log(`  ❌ File not found: ${config.path}`);
        allValid = false;
        results.push({ file: config.name, status: 'missing', issues: ['File not found'] });
        continue;
      }

      const content = fs.readFileSync(config.path, 'utf8');
      const issues = [];

      // Validate based on file type
      if (config.type === 'env') {
        // Check .env.test file
        if (!content.includes(`API_BASE_URL=${EXPECTED_EXTERNAL_API_URL}`)) {
          issues.push('API_BASE_URL not set to production external-api function');
        }
        if (!content.includes('SUPABASE_ANON_KEY=')) {
          issues.push('SUPABASE_ANON_KEY not set');
        }
        if (!content.includes('TEST_API_KEY=mk_test_')) {
          issues.push('TEST_API_KEY not properly configured');
        }
      } else if (config.type === 'js') {
        // Check JavaScript files
        if (content.includes('bypass-test') && !content.includes('external-api')) {
          issues.push('Still configured for bypass-test instead of external-api');
        }
        if (config.name === 'comprehensive-test-suite.js') {
          if (!content.includes('Production External API')) {
            issues.push('Missing production API documentation');
          }
          if (!content.includes('timeout: 15000')) {
            issues.push('Timeout not increased for production operations');
          }
        }
      } else if (config.type === 'json') {
        // Check JSON files (Postman collection)
        try {
          const jsonData = JSON.parse(content);
          const baseUrlVar = jsonData.variable?.find(v => v.key === 'base_url');
          if (!baseUrlVar || baseUrlVar.value !== EXPECTED_EXTERNAL_API_URL) {
            issues.push('Postman collection base_url not set to external-api');
          }
        } catch (e) {
          issues.push('Invalid JSON format');
        }
      }

      if (issues.length === 0) {
        console.log(`  ✅ Configuration valid`);
        results.push({ file: config.name, status: 'valid', issues: [] });
      } else {
        console.log(`  ❌ Issues found:`);
        issues.forEach(issue => console.log(`    - ${issue}`));
        allValid = false;
        results.push({ file: config.name, status: 'invalid', issues });
      }

    } catch (error) {
      console.log(`  ❌ Error reading file: ${error.message}`);
      allValid = false;
      results.push({ file: config.name, status: 'error', issues: [error.message] });
    }
  }

  console.log('\n🧪 Testing API Connectivity...');
  
  // Test API connectivity
  try {
    const response = await axios.get(`${EXPECTED_EXTERNAL_API_URL}/health`, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY',
        'X-API-Key': 'mk_test_499408260a6c25aceedc2f036a4887164daefe1e2915ad91302b8c1c5add71a7',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.status === 200 && response.data.success) {
      console.log('  ✅ API connectivity test passed');
      console.log(`  📊 Function: ${response.data.data.function}`);
      console.log(`  📊 Mode: ${response.data.data.mode}`);
      console.log(`  📊 User ID: ${response.data.data.user.id}`);
      results.push({ file: 'API Connectivity', status: 'valid', issues: [] });
    } else {
      console.log('  ❌ API returned unexpected response');
      allValid = false;
      results.push({ file: 'API Connectivity', status: 'invalid', issues: ['Unexpected response format'] });
    }
  } catch (error) {
    console.log(`  ❌ API connectivity test failed: ${error.message}`);
    allValid = false;
    results.push({ file: 'API Connectivity', status: 'error', issues: [error.message] });
  }

  // Summary
  console.log('\n📊 Configuration Validation Summary:');
  console.log('='.repeat(50));
  
  results.forEach(result => {
    const status = result.status === 'valid' ? '✅' : '❌';
    console.log(`${status} ${result.file}: ${result.status.toUpperCase()}`);
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`    - ${issue}`));
    }
  });

  console.log('\n' + '='.repeat(50));
  if (allValid) {
    console.log('🎉 ALL CONFIGURATIONS VALID!');
    console.log('✅ Test suite is properly configured for production external-api function');
    console.log('✅ Ready to run comprehensive test suite');
  } else {
    console.log('❌ CONFIGURATION ISSUES FOUND');
    console.log('⚠️  Please fix the issues above before running tests');
  }

  return allValid;
}

// Run validation
validateConfiguration().catch(console.error);
