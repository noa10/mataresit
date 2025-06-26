/**
 * Simple script to create test API keys using direct SQL
 */

import crypto from 'crypto';

// Generate API keys
function generateApiKey(environment = 'test') {
  const prefix = `mk_${environment}_`;
  const randomBytes = crypto.randomBytes(32);
  const randomString = randomBytes.toString('hex');
  return prefix + randomString;
}

// Hash API key
function hashApiKey(apiKey) {
  const hash = crypto.createHash('sha256');
  hash.update(apiKey);
  return hash.digest('hex');
}

// Generate test keys
const testApiKey = generateApiKey('test');
const adminApiKey = generateApiKey('test');

console.log('Generated Test API Keys:');
console.log('========================');
console.log(`TEST_API_KEY=${testApiKey}`);
console.log(`ADMIN_API_KEY=${adminApiKey}`);
console.log('');
console.log('Key Hashes for Database:');
console.log('========================');
console.log(`Test Key Hash: ${hashApiKey(testApiKey)}`);
console.log(`Admin Key Hash: ${hashApiKey(adminApiKey)}`);
console.log('');
console.log('Key Prefixes:');
console.log('=============');
console.log(`Test Key Prefix: ${testApiKey.substring(0, 12)}`);
console.log(`Admin Key Prefix: ${adminApiKey.substring(0, 12)}`);
