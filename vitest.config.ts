/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './tests/alerting/setup/vitest-setup.ts',
      './tests/queue/setup/vitest-setup.ts',
      './tests/phase4-integration/setup/vitest-setup.ts'
    ],
    include: [
      'tests/alerting/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/queue/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/phase4-integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests/alerting/e2e/**/*',
      'tests/alerting/performance/**/*',
      'tests/queue/performance/**/*',
      'tests/phase4-integration/load-testing/**/*'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/coverage/**',
        'src/types/**',
        'src/**/*.stories.{js,ts,jsx,tsx}',
        'src/**/*.test.{js,ts,jsx,tsx}',
        'src/**/*.spec.{js,ts,jsx,tsx}'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Specific thresholds for alerting system
        'src/services/alertingService.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'src/services/alertNotificationDeliveryService.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        'src/hooks/useAlertEngine.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/vitest-results.json',
      html: './test-results/vitest-report.html'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  },
  define: {
    // Define test environment variables
    'process.env.NODE_ENV': '"test"',
    'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54331'),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || 'test-key')
  }
});
