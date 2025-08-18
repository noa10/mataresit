import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 5000,
  },
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-toast'
          ],
          'vendor-utils': ['date-fns', 'clsx', 'class-variance-authority'],
          'vendor-charts': ['recharts', 'd3-scale', 'd3-shape'],
          'vendor-heavy': ['html2canvas', 'browser-image-compression', 'xlsx'],

          // Translation chunks - split by language for better caching
          'i18n-core': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'translations-en': [
            './src/locales/en/common.json',
            './src/locales/en/navigation.json',
            './src/locales/en/dashboard.json',
            './src/locales/en/receipts.json',
            './src/locales/en/auth.json'
          ],
          'translations-ms': [
            './src/locales/ms/common.json',
            './src/locales/ms/navigation.json',
            './src/locales/ms/dashboard.json',
            './src/locales/ms/receipts.json',
            './src/locales/ms/auth.json'
          ],

          // Feature-specific chunks - more granular splitting
          'feature-admin': [
            './src/pages/admin/AdminDashboard.tsx',
            './src/components/admin/BlogAnalytics.tsx',
            './src/components/admin/EmbeddingRepairTest.tsx',
            './src/components/admin/CacheMonitor.tsx',
            './src/components/admin/FeedbackAnalytics.tsx'
          ],
          'feature-settings': [
            './src/pages/SettingsPage.tsx',
            './src/components/settings/NotificationPreferences.tsx',
            './src/components/categories/CategoryManager.tsx'
          ],
          'feature-profile': ['./src/pages/Profile.tsx'],
          'feature-analytics': [
            './src/components/analytics/AnalyticsDashboard.tsx',
            './src/components/analytics/InteractionTrendsChart.tsx',
            './src/components/analytics/FeatureUsageChart.tsx'
          ],
          'feature-search': [
            './src/pages/SemanticSearch.tsx',
            './src/pages/UnifiedSearchPage.tsx'
          ]
        },

        // Optimize chunk naming for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';

          // Special naming for translation files
          if (chunkInfo.name?.includes('translations-')) {
            return `assets/i18n/[name]-[hash].js`;
          }

          // Special naming for vendor chunks
          if (chunkInfo.name?.includes('vendor-')) {
            return `assets/vendor/[name]-[hash].js`;
          }

          return `assets/[name]-[hash].js`;
        },

        // Optimize asset naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];

          // Group translation JSON files
          if (assetInfo.name?.includes('/locales/')) {
            return `assets/i18n/[name]-[hash][extname]`;
          }

          // Group by file type
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }

          if (/css/i.test(ext || '')) {
            return `assets/styles/[name]-[hash][extname]`;
          }

          return `assets/[name]-[hash][extname]`;
        }
      }
    },

    // Optimize for better compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },

    // Enable source maps for production debugging
    sourcemap: false,

    // Optimize chunk size warnings - set to 1000 to reduce build warnings while maintaining performance
    chunkSizeWarningLimit: 1000,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'i18next',
      'react-i18next',
      'i18next-browser-languagedetector'
    ]
    // Note: Translation files are statically imported in i18n.ts, so no exclusion needed
  }
});
