/**
 * Database Setup for Phase 4 Integration Tests
 * 
 * This file handles test database initialization, schema setup, and cleanup
 * for comprehensive integration testing of the batch upload, queue, and monitoring systems.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Setup test database with required schemas and data
 */
export async function setupTestDatabase(supabase: SupabaseClient): Promise<void> {
  console.log('📊 Setting up test database schemas...');
  
  try {
    // Ensure all required tables exist (they should from migrations)
    await verifyRequiredTables(supabase);
    
    // Clean any existing test data
    await cleanupTestData(supabase);
    
    // Setup test data
    await setupTestData(supabase);
    
    console.log('✅ Test database setup completed');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Verify that all required tables exist
 */
async function verifyRequiredTables(supabase: SupabaseClient): Promise<void> {
  const requiredTables = [
    'receipts',
    'embeddings',
    'batch_upload_sessions',
    'embedding_queue',
    'embedding_queue_workers',
    'embedding_metrics',
    'api_quota_tracking',
    'teams',
    'team_members'
  ];

  for (const table of requiredTables) {
    const { error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      throw new Error(`Required table '${table}' does not exist. Please run migrations first.`);
    }
  }
}

/**
 * Clean up any existing test data
 */
async function cleanupTestData(supabase: SupabaseClient): Promise<void> {
  console.log('🧹 Cleaning existing test data...');
  
  // Delete test data in reverse dependency order
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
    } catch (error) {
      // Log but don't fail on cleanup errors
      console.warn(`Warning: Cleanup query failed: ${query}`, error);
    }
  }
}

/**
 * Setup initial test data
 */
async function setupTestData(supabase: SupabaseClient): Promise<void> {
  console.log('📝 Setting up test data...');
  
  // Create test users (using auth admin API)
  const testUsers = await createTestUsers(supabase);
  
  // Create test teams
  const testTeams = await createTestTeams(supabase, testUsers);
  
  // Create test receipts
  await createTestReceipts(supabase, testUsers, testTeams);
  
  // Setup queue workers
  await setupTestQueueWorkers(supabase);
  
  console.log('✅ Test data setup completed');
}

/**
 * Create test users for authentication testing
 */
async function createTestUsers(supabase: SupabaseClient): Promise<any[]> {
  const testUsers = [];
  
  for (let i = 1; i <= 5; i++) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: `test-user-${i}@example.com`,
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: {
          test_user: true,
          test_index: i
        }
      });
      
      if (error) {
        console.warn(`Failed to create test user ${i}:`, error.message);
        continue;
      }
      
      testUsers.push(data.user);
    } catch (error) {
      console.warn(`Error creating test user ${i}:`, error);
    }
  }
  
  return testUsers;
}

/**
 * Create test teams
 */
async function createTestTeams(supabase: SupabaseClient, testUsers: any[]): Promise<any[]> {
  const testTeams = [];
  
  for (let i = 0; i < Math.min(3, testUsers.length); i++) {
    const user = testUsers[i];
    
    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        name: `Test Team ${i + 1}`,
        created_by: user.id,
        subscription_status: 'active',
        subscription_plan: 'pro'
      })
      .select()
      .single();
    
    if (error) {
      console.warn(`Failed to create test team ${i + 1}:`, error.message);
      continue;
    }
    
    // Add user as team member
    await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner'
      });
    
    testTeams.push(team);
  }
  
  return testTeams;
}

/**
 * Create test receipts for testing
 */
async function createTestReceipts(supabase: SupabaseClient, testUsers: any[], testTeams: any[]): Promise<void> {
  const testReceipts = [];
  
  for (let i = 1; i <= 20; i++) {
    const user = testUsers[i % testUsers.length];
    const team = testTeams[i % testTeams.length];
    
    if (!user || !team) continue;
    
    const receipt = {
      user_id: user.id,
      team_id: team.id,
      file_name: `test-receipt-${i}.jpg`,
      file_size: 1024 * (100 + i * 10), // Varying file sizes
      file_type: 'image/jpeg',
      status: i % 4 === 0 ? 'pending' : 'completed',
      total_amount: (Math.random() * 1000).toFixed(2),
      currency: 'USD',
      merchant_name: `Test Merchant ${i}`,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        test_data: 'true',
        test_index: i,
        processing_time_ms: Math.floor(Math.random() * 10000) + 2000
      }
    };
    
    testReceipts.push(receipt);
  }
  
  if (testReceipts.length > 0) {
    const { error } = await supabase
      .from('receipts')
      .insert(testReceipts);
    
    if (error) {
      console.warn('Failed to create test receipts:', error.message);
    }
  }
}

/**
 * Setup test queue workers
 */
async function setupTestQueueWorkers(supabase: SupabaseClient): Promise<void> {
  const workers = [
    {
      worker_id: 'test-worker-1',
      status: 'active',
      last_heartbeat: new Date().toISOString(),
      current_task: null,
      processed_count: 0,
      error_count: 0,
      metadata: { test_data: 'true' }
    },
    {
      worker_id: 'test-worker-2',
      status: 'active',
      last_heartbeat: new Date().toISOString(),
      current_task: null,
      processed_count: 0,
      error_count: 0,
      metadata: { test_data: 'true' }
    }
  ];
  
  const { error } = await supabase
    .from('embedding_queue_workers')
    .insert(workers);
  
  if (error) {
    console.warn('Failed to create test queue workers:', error.message);
  }
}

/**
 * Cleanup test database
 */
export async function cleanupTestDatabase(supabase: SupabaseClient): Promise<void> {
  console.log('🧹 Cleaning up test database...');
  
  try {
    await cleanupTestData(supabase);
    
    // Clean up test users
    await cleanupTestUsers(supabase);
    
    console.log('✅ Test database cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup test database:', error);
    throw error;
  }
}

/**
 * Cleanup test users
 */
async function cleanupTestUsers(supabase: SupabaseClient): Promise<void> {
  try {
    // Get test users
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.warn('Failed to list users for cleanup:', error.message);
      return;
    }
    
    // Delete test users
    for (const user of users.users) {
      if (user.email?.includes('test-user-') || user.user_metadata?.test_user) {
        try {
          await supabase.auth.admin.deleteUser(user.id);
        } catch (error) {
          console.warn(`Failed to delete test user ${user.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn('Error during test user cleanup:', error);
  }
}

/**
 * Create a test batch upload session
 */
export async function createTestBatchSession(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  options: {
    totalFiles?: number;
    processingStrategy?: string;
    sessionName?: string;
  } = {}
): Promise<any> {
  const sessionData = {
    user_id: userId,
    team_id: teamId,
    session_name: options.sessionName || `test-batch-${Date.now()}`,
    total_files: options.totalFiles || 10,
    files_completed: 0,
    files_failed: 0,
    files_pending: options.totalFiles || 10,
    max_concurrent: 3,
    processing_strategy: options.processingStrategy || 'balanced',
    status: 'pending',
    rate_limit_config: {
      maxConcurrentRequests: 3,
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    }
  };
  
  const { data, error } = await supabase
    .from('batch_upload_sessions')
    .insert(sessionData)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create test batch session: ${error.message}`);
  }
  
  return data;
}

/**
 * Add items to the embedding queue for testing
 */
export async function addTestQueueItems(
  supabase: SupabaseClient,
  count: number = 10,
  options: {
    priority?: string;
    status?: string;
  } = {}
): Promise<any[]> {
  const queueItems = [];
  
  for (let i = 1; i <= count; i++) {
    queueItems.push({
      source_type: 'receipts',
      source_id: `test-receipt-${i}`,
      operation: 'INSERT',
      priority: options.priority || 'medium',
      status: options.status || 'pending',
      retry_count: 0,
      metadata: {
        test_data: 'true',
        test_index: i
      }
    });
  }
  
  const { data, error } = await supabase
    .from('embedding_queue')
    .insert(queueItems)
    .select();
  
  if (error) {
    throw new Error(`Failed to add test queue items: ${error.message}`);
  }
  
  return data || [];
}
