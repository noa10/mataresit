/**
 * API Target Switcher
 * Easily switch between production external-api and bypass-test functions for testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to .env.test file
const envFilePath = path.join(__dirname, '..', '.env.test');

// API URLs
const EXTERNAL_API_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const BYPASS_TEST_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/bypass-test/api/v1';

// Command line arguments
const args = process.argv.slice(2);
const targetArg = args[0]?.toLowerCase();

// Validate arguments
if (!targetArg || !['external', 'bypass', 'status'].includes(targetArg)) {
  console.log('Usage: node scripts/switch-api-target.js [external|bypass|status]');
  console.log('  external - Switch to production external-api function');
  console.log('  bypass   - Switch to bypass-test function');
  console.log('  status   - Show current API target');
  process.exit(1);
}

// Read current .env.test file
let envContent;
try {
  envContent = fs.readFileSync(envFilePath, 'utf8');
} catch (error) {
  console.error('Error reading .env.test file:', error.message);
  process.exit(1);
}

// Extract current API_BASE_URL
const currentUrlMatch = envContent.match(/API_BASE_URL=(.+)/);
const currentUrl = currentUrlMatch ? currentUrlMatch[1] : 'unknown';
const isCurrentExternal = currentUrl.includes('external-api');

// Just show status if requested
if (targetArg === 'status') {
  console.log('Current API Target:');
  console.log(`  URL: ${currentUrl}`);
  console.log(`  Type: ${isCurrentExternal ? 'Production External API' : 'Bypass Test API'}`);
  process.exit(0);
}

// Determine target URL
const targetUrl = targetArg === 'external' ? EXTERNAL_API_URL : BYPASS_TEST_URL;
const targetType = targetArg === 'external' ? 'Production External API' : 'Bypass Test API';

// Check if already using the requested target
if ((targetArg === 'external' && isCurrentExternal) || 
    (targetArg === 'bypass' && !isCurrentExternal)) {
  console.log(`Already using ${targetType}`);
  console.log(`  URL: ${currentUrl}`);
  process.exit(0);
}

// Update .env.test file
try {
  const updatedContent = envContent.replace(
    /API_BASE_URL=.+/,
    `API_BASE_URL=${targetUrl}`
  );
  
  fs.writeFileSync(envFilePath, updatedContent);
  
  console.log(`✅ Successfully switched to ${targetType}`);
  console.log(`  New URL: ${targetUrl}`);
} catch (error) {
  console.error('Error updating .env.test file:', error.message);
  process.exit(1);
}
