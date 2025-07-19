/**
 * Vitest Setup File
 * Global test configuration and setup for alerting system tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TestEnvironment } from './test-setup';
import '@testing-library/jest-dom';

// Global test setup
beforeAll(async () => {
  console.log('🚀 Setting up global test environment...');
  await TestEnvironment.setup();
});

// Global test cleanup
afterAll(async () => {
  console.log('🧹 Cleaning up global test environment...');
  await TestEnvironment.cleanup();
});

// Per-test setup
beforeEach(async () => {
  // Reset any global state if needed
});

// Per-test cleanup
afterEach(async () => {
  // Clean up any test-specific state
});

// Mock console methods in test environment to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // Only show errors that aren't expected test errors
    if (!args[0]?.toString().includes('Warning: ReactDOM.render is deprecated')) {
      originalConsoleError(...args);
    }
  };

  console.warn = (...args: any[]) => {
    // Filter out known warnings
    if (!args[0]?.toString().includes('componentWillReceiveProps has been renamed')) {
      originalConsoleWarn(...args);
    }
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
declare global {
  var testUtils: {
    waitFor: (condition: () => Promise<boolean>, timeout?: number) => Promise<void>;
    createTestTeam: () => Promise<any>;
    createTestUser: () => Promise<any>;
    createTestAlertRule: (teamId: string) => Promise<any>;
    createTestChannel: (teamId: string, type?: string) => Promise<any>;
  };
}

globalThis.testUtils = {
  waitFor: TestEnvironment.waitFor,
  createTestTeam: () => TestEnvironment.createTeam(),
  createTestUser: () => TestEnvironment.createUser(),
  createTestAlertRule: (teamId: string) => TestEnvironment.createAlertRule(teamId),
  createTestChannel: (teamId: string, type: any = 'email') => TestEnvironment.createNotificationChannel(teamId, type)
};
