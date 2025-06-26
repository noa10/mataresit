/**
 * Setup test environment for API testing
 * Creates test users and API keys
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Configuration
const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzAxMjM4OSwiZXhwIjoyMDU4NTg4Mzg5fQ.o6Xn7TTIYF4U9zAOhGWVf5MoAcl_BGPtQ_BRcR2xV0o';

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// API Key generation functions
function generateApiKey(environment = 'test') {
  const prefix = `mk_${environment}_`;
  const randomBytes = crypto.randomBytes(32);
  const randomString = randomBytes.toString('hex');
  return prefix + randomString;
}

function hashApiKey(apiKey) {
  const hash = crypto.createHash('sha256');
  hash.update(apiKey);
  return hash.digest('hex');
}

function getApiKeyPrefix(apiKey) {
  return apiKey.substring(0, 12);
}

async function createTestUser(email, password, isAdmin = false) {
  try {
    console.log(`Creating user: ${email}...`);
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: isAdmin ? 'admin' : 'user',
        full_name: isAdmin ? 'Test Admin User' : 'Test Regular User'
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`✅ User ${email} already exists`);
        // Get existing user
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users.users.find(u => u.email === email);
        return existingUser;
      } else {
        throw error;
      }
    }

    console.log(`✅ Created user: ${email}`);
    return data.user;
  } catch (error) {
    console.error(`❌ Error creating user ${email}:`, error.message);
    throw error;
  }
}

async function createApiKey(userId, name, scopes, isAdmin = false) {
  try {
    const apiKey = generateApiKey('test');
    const keyPrefix = getApiKeyPrefix(apiKey);
    const keyHash = hashApiKey(apiKey);

    console.log(`Creating API key: ${name}...`);

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

async function main() {
  try {
    console.log('🚀 Setting up test environment for API testing...\n');

    // Create test users
    const testUser = await createTestUser('test@mataresit.com', 'testpassword123', false);
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
    
    console.log('\n💡 Create a .env.test file with these values:');
    console.log('==============================================');
    console.log(`TEST_API_KEY=${testApiKey.apiKey}`);
    console.log(`ADMIN_API_KEY=${adminApiKey.apiKey}`);
    console.log(`API_BASE_URL=https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1`);

    console.log('\n✅ Test environment setup complete!');
    console.log('You can now run the comprehensive test suite.');

  } catch (error) {
    console.error('❌ Failed to setup test environment:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
