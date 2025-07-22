/**
 * Phase 4 Integration Testing Setup
 * 
 * This file provides the main test setup infrastructure for Phase 4 integration tests.
 * It handles test database initialization, mock services setup, and test environment configuration.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, cleanupTestDatabase } from './database-setup';
import { MockServices, setupMockServices, teardownMockServices } from './mock-services';
import { TestUtilities } from './test-utilities';

// Test environment configuration
export interface TestConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  openrouterApiKey: string;
  testTimeout: number;
  concurrentUsers: number;
  batchSize: number;
  performanceThreshold: number;
}

// Global test state
export interface TestState {
  supabase: SupabaseClient;
  mockServices: MockServices;
  utilities: TestUtilities;
  config: TestConfig;
  testSessionId: string;
  startTime: number;
}

let globalTestState: TestState | null = null;

/**
 * Get test configuration from environment variables
 */
export function getTestConfig(): TestConfig {
  const config: TestConfig = {
    supabaseUrl: process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.TEST_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || '',
    geminiApiKey: process.env.TEST_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
    openrouterApiKey: process.env.TEST_OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '',
    testTimeout: parseInt(process.env.TEST_TIMEOUT || '300000'),
    concurrentUsers: parseInt(process.env.TEST_CONCURRENT_USERS || '50'),
    batchSize: parseInt(process.env.TEST_BATCH_SIZE || '100'),
    performanceThreshold: parseInt(process.env.TEST_PERFORMANCE_THRESHOLD || '7500')
  };

  // Validate required configuration
  const requiredFields = ['supabaseUrl', 'supabaseAnonKey', 'supabaseServiceRoleKey'];
  for (const field of requiredFields) {
    if (!config[field as keyof TestConfig]) {
      throw new Error(`Missing required test configuration: ${field}`);
    }
  }

  return config;
}

/**
 * Initialize test environment
 */
export async function initializeTestEnvironment(): Promise<TestState> {
  console.log('🚀 Initializing Phase 4 Integration Test Environment...');
  
  const config = getTestConfig();
  const testSessionId = `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create Supabase client for testing
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Setup test database
  console.log('📊 Setting up test database...');
  await setupTestDatabase(supabase);

  // Setup mock services
  console.log('🔧 Setting up mock services...');
  const mockServices = await setupMockServices(config);

  // Initialize test utilities
  console.log('🛠️ Initializing test utilities...');
  const utilities = new TestUtilities(supabase, config);

  const testState: TestState = {
    supabase,
    mockServices,
    utilities,
    config,
    testSessionId,
    startTime: Date.now()
  };

  globalTestState = testState;
  console.log('✅ Test environment initialized successfully');
  
  return testState;
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(): Promise<void> {
  if (!globalTestState) {
    return;
  }

  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Cleanup test database
    await cleanupTestDatabase(globalTestState.supabase);
    
    // Teardown mock services
    await teardownMockServices(globalTestState.mockServices);
    
    console.log('✅ Test environment cleaned up successfully');
  } catch (error) {
    console.error('❌ Error during test cleanup:', error);
    throw error;
  } finally {
    globalTestState = null;
  }
}

/**
 * Get current test state
 */
export function getTestState(): TestState {
  if (!globalTestState) {
    throw new Error('Test environment not initialized. Call initializeTestEnvironment() first.');
  }
  return globalTestState;
}

/**
 * Setup function for individual test suites
 */
export function setupTestSuite(suiteName: string) {
  beforeAll(async () => {
    console.log(`\n🧪 Setting up test suite: ${suiteName}`);
    await initializeTestEnvironment();
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    console.log(`\n🏁 Tearing down test suite: ${suiteName}`);
    await cleanupTestEnvironment();
  }, 30000); // 30 second timeout for cleanup
}

/**
 * Setup function for individual tests
 */
export function setupTest() {
  beforeEach(async () => {
    const testState = getTestState();
    // Reset any test-specific state
    testState.startTime = Date.now();
  });

  afterEach(async () => {
    // Cleanup any test-specific resources
    // This is handled by individual tests as needed
  });
}

/**
 * Create a test user for authentication testing
 */
export async function createTestUser(email?: string): Promise<{ user: any; session: any }> {
  const testState = getTestState();
  const testEmail = email || `test-user-${Date.now()}@example.com`;
  const testPassword = 'test-password-123';

  const { data, error } = await testState.supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  // Sign in the user to get a session
  const { data: sessionData, error: signInError } = await testState.supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInError) {
    throw new Error(`Failed to sign in test user: ${signInError.message}`);
  }

  return {
    user: data.user,
    session: sessionData.session
  };
}

/**
 * Create a test team for team-based testing
 */
export async function createTestTeam(userId: string, teamName?: string): Promise<any> {
  const testState = getTestState();
  const name = teamName || `Test Team ${Date.now()}`;

  const { data, error } = await testState.supabase
    .from('teams')
    .insert({
      name,
      created_by: userId,
      subscription_status: 'active',
      subscription_plan: 'pro'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test team: ${error.message}`);
  }

  // Add user as team member
  await testState.supabase
    .from('team_members')
    .insert({
      team_id: data.id,
      user_id: userId,
      role: 'owner'
    });

  return data;
}

/**
 * Wait for a condition to be met with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms timeout`);
}

/**
 * Generate a unique test identifier
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Export types for use in tests
export type { TestConfig, TestState };
