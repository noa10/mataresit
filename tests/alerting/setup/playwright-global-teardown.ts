/**
 * Playwright Global Teardown
 * Cleans up test environment after running E2E tests
 */

import { TestEnvironment } from './test-setup';

async function globalTeardown() {
  console.log('🧹 Cleaning up Playwright test environment...');
  
  try {
    // Clean up test data
    await TestEnvironment.cleanup();
    
    // Clear environment variables
    delete process.env.E2E_TEST_TEAM_ID;
    delete process.env.E2E_TEST_USER_ID;
    delete process.env.E2E_TEST_USER_EMAIL;
    
    console.log('✓ Playwright test environment cleanup complete');
  } catch (error) {
    console.error('❌ Error during Playwright cleanup:', error);
  }
}

export default globalTeardown;
