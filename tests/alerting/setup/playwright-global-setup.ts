/**
 * Playwright Global Setup
 * Sets up test environment before running E2E tests
 */

import { chromium, FullConfig } from '@playwright/test';
import { TestEnvironment } from './test-setup';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up Playwright test environment...');
  
  // Set up test database and environment
  await TestEnvironment.setup();
  
  // Create test user and team for E2E tests
  const testTeam = await TestEnvironment.createTeam({
    name: 'E2E Test Team',
    description: 'Team for end-to-end testing'
  });
  
  const testUser = await TestEnvironment.createUser({
    email: 'e2e-test@example.com',
    full_name: 'E2E Test User'
  });
  
  // Store test data for use in tests
  process.env.E2E_TEST_TEAM_ID = testTeam.id;
  process.env.E2E_TEST_USER_ID = testUser.id;
  process.env.E2E_TEST_USER_EMAIL = testUser.email;
  
  // Launch browser for authentication setup if needed
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Pre-authenticate test user if needed
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';
    
    // Navigate to login page and authenticate
    await page.goto(`${baseURL}/login`);
    
    // Check if we can access the login page
    const loginForm = await page.locator('[data-testid="login-form"]').isVisible().catch(() => false);
    
    if (loginForm) {
      console.log('✓ Login page accessible');
      
      // Perform authentication if login form is available
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', 'testpassword123');
      await page.click('[data-testid="login-button"]');
      
      // Wait for successful login
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
        console.log('⚠️ Could not complete authentication setup');
      });
    } else {
      console.log('⚠️ Login form not found, skipping authentication setup');
    }
    
  } catch (error) {
    console.log('⚠️ Authentication setup failed:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('✓ Playwright test environment setup complete');
}

export default globalSetup;
