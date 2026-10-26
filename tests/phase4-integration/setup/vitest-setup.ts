/**
 * Vitest Setup for Phase 4 Integration Tests
 * 
 * This file configures Vitest for Phase 4 integration testing,
 * including global setup, teardown, and test environment configuration.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import 'jsdom';

// Mock browser APIs that might not be available in test environment
Object.defineProperty(window, 'HTMLCanvasElement', {
  value: class HTMLCanvasElement {
    getContext() {
      return {
        fillStyle: '',
        fillRect: vi.fn(),
        fillText: vi.fn(),
        font: ''
      };
    }
    toBlob(callback: (blob: Blob | null) => void) {
      // Create a simple mock blob
      const blob = new Blob(['mock image data'], { type: 'image/jpeg' });
      callback(blob);
    }
    width = 400;
    height = 600;
  }
});

const originalCreateElement = document.createElement.bind(document);
Object.defineProperty(document, 'createElement', {
  value: (tagName: string) => {
    if (tagName === 'canvas') {
      return new window.HTMLCanvasElement();
    }
    return originalCreateElement(tagName);
  }
});

// Mock File constructor for test file generation
global.File = class File extends Blob {
  name: string;
  lastModified: number;

  constructor(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag) {
    super(fileBits, options);
    this.name = fileName;
    this.lastModified = options?.lastModified || Date.now();
  }
} as any;

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn()
  }
});

// Mock crypto API for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  }
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock WebSocket for real-time features
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
})) as any;

// Functional in-memory storage so tests that persist state (search chat
// history, drafts) behave like the browser under the full vitest config too.
const createMemoryStorage = (): Storage => {
  let store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

const localStorageMock = createMemoryStorage();
const sessionStorageMock = createMemoryStorage();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  configurable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  configurable: true,
});

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  value: vi.fn(() => 'mock-object-url')
});

Object.defineProperty(URL, 'revokeObjectURL', {
  value: vi.fn()
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as any;

// Keep the real MutationObserver: Testing Library's waitFor depends on it.

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16);
});

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = vi.fn();
  console.info = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test timeout
vi.setConfig({
  testTimeout: 60000, // 60 seconds for integration tests
  hookTimeout: 30000  // 30 seconds for setup/teardown
});

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

// Set default test environment variables if not provided
if (!process.env.TEST_SUPABASE_URL) {
  process.env.TEST_SUPABASE_URL = 'https://test.supabase.co';
}

if (!process.env.TEST_SUPABASE_ANON_KEY) {
  process.env.TEST_SUPABASE_ANON_KEY = 'test-anon-key';
}

if (!process.env.TEST_SUPABASE_SERVICE_ROLE_KEY) {
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
}

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Cleanup function for test isolation
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();

  // Reset fetch mock
  (global.fetch as any).mockClear?.();

  // Clear localStorage and sessionStorage
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  // Additional cleanup after each test
  vi.clearAllTimers();
  vi.restoreAllMocks();
});

// Export test utilities for use in tests
export const testUtils = {
  mockFetch: (response: any, options?: { status?: number; ok?: boolean }) => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: options?.ok ?? true,
      status: options?.status ?? 200,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: new Map()
    });
  },

  mockFetchError: (error: Error) => {
    (global.fetch as any).mockRejectedValueOnce(error);
  },

  waitFor: async (condition: () => boolean, timeout: number = 5000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Make test utilities available globally
(global as any).testUtils = testUtils;
