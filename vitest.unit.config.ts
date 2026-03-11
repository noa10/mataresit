/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const UNIT_BASELINE_EXCLUDES = [
  "src/**/*.integration.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
  "src/contexts/__tests__/NotificationContext.test.tsx",
  "src/lib/__tests__/shareCards.test.ts",
  "src/lib/__tests__/ui-component-parser.test.ts",
  "src/lib/__tests__/ui-component-parser-enhanced.test.ts",
  "src/services/__tests__/notificationService.test.ts",
  "src/components/upload/__tests__/EnhancedBatchProcessingControls.test.tsx",
  "src/lib/batch-session/__tests__/BatchSessionManager.test.ts",
  "src/lib/export/__tests__/dailyExpenseReportDownload.test.ts",
  "src/lib/rate-limiting/__tests__/AdaptiveRateLimiter.test.ts",
  "src/components/chat/ui-components/__tests__/SectionHeaderComponent.test.tsx",
  "src/components/team/enhanced/__tests__/MemberAnalyticsDashboard.test.tsx",
];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/vitest.unit.setup.ts"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      ".idea",
      ".git",
      ".cache",
      "src/tests/**/*",
      "src/**/integration/**/*",
      "src/tests/integration/**/*",
      ...UNIT_BASELINE_EXCLUDES,
    ],
    testTimeout: 30000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
    "process.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54331"),
    "process.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || "test-key"),
  },
});