/**
 * Script to create test API keys for the comprehensive API test suite
 * This script creates both regular user and admin API keys for testing
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION environment variable is required');
  process.exit(1);
}

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Hash API key for secure storage using SHA-256
 */
async function hashApiKey(apiKey) {
  const hash = crypto.createHash('sha256');
  hash.update(apiKey);
  return hash.digest('hex');
}

/**
 * Generates a new API key with proper format
 */
function generateApiKey(environment = 'test') {
  const prefix = `mk_${environment}_`;
  const randomBytes = crypto.randomBytes(32);
  const randomString = randomBytes.toString('hex');
  return prefix + randomString;
}

/**
 * Extracts API key prefix for identification
 */
function getApiKeyPrefix(apiKey) {
  return apiKey.substring(0, 12); // e.g., "mk_test_abc1"
}

/**
 * Creates a test user if it doesn't exist
 */
async function createTestUser(email, password, isAdmin = false) {
  try {
    // Try to create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: isAdmin ? 'admin' : 'user',
        name: isAdmin ? 'Test Admin' : 'Test User'
      }
    });

    if (authError && !authError.message.includes('already registered')) {
      throw authError;
    }

    // Get the user (either newly created or existing)
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.users.find(u => u.email === email);
    if (!user) {
      throw new Error(`User ${email} not found after creation`);
    }

    console.log(`✅ User ${email} ready (${isAdmin ? 'admin' : 'user'})`);
    return user;
  } catch (error) {
    console.error(`❌ Error creating user ${email}:`, error.message);
    throw error;
  }
}

/**
 * Creates an API key for a user
 */
async function createApiKey(userId, name, scopes, isAdmin = false) {
  try {
    const apiKey = generateApiKey('test');
    const keyPrefix = getApiKeyPrefix(apiKey);
    const keyHash = await hashApiKey(apiKey);

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name,
        description: `Test API key for ${isAdmin ? 'admin' : 'user'} testing`,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes,
        is_active: true,
        created_by: userId
      })
      .select('id, name, scopes')
      .single();

    if (error) {
      throw error;
    }

    console.log(`✅ Created API key: ${name} (${keyPrefix}...)`);
    return { ...data, apiKey };
  } catch (error) {
    console.error(`❌ Error creating API key ${name}:`, error.message);
    throw error;
  }
}

/**
 * Main function to create test API keys
 */
async function main() {
  try {
    console.log('🚀 Creating test API keys for comprehensive test suite...\n');

    // Create test users
    const testUser = await createTestUser('test@mataresit.com', 'testpassword123');
    const adminUser = await createTestUser('admin@mataresit.com', 'adminpassword123', true);

    // Define scopes
    const userScopes = [
      'receipts:read',
      'receipts:write',
      'claims:read',
      'claims:write',
      'search:read',
      'analytics:read',
      'teams:read'
    ];

    const adminScopes = [
      'receipts:read',
      'receipts:write',
      'receipts:delete',
      'claims:read',
      'claims:write',
      'claims:delete',
      'search:read',
      'analytics:read',
      'teams:read',
      'admin:all'
    ];

    // Create API keys
    const testApiKey = await createApiKey(testUser.id, 'Test Suite User Key', userScopes, false);
    const adminApiKey = await createApiKey(adminUser.id, 'Test Suite Admin Key', adminScopes, true);

    // Output environment variables
    console.log('\n📋 Environment Variables for Testing:');
    console.log('=====================================');
    console.log(`export TEST_API_KEY="${testApiKey.apiKey}"`);
    console.log(`export ADMIN_API_KEY="${adminApiKey.apiKey}"`);
    console.log(`export API_BASE_URL="https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1"`);
    
    console.log('\n💡 Add these to your shell environment or create a .env.test file:');
    console.log('================================================================');
    console.log(`TEST_API_KEY=${testApiKey.apiKey}`);
    console.log(`ADMIN_API_KEY=${adminApiKey.apiKey}`);
    console.log(`API_BASE_URL=https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1`);

    console.log('\n✅ Test API keys created successfully!');
    console.log('You can now run the comprehensive test suite with these keys.');

  } catch (error) {
    console.error('❌ Failed to create test API keys:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
