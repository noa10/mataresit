import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 5000,
  },
  plugins: [
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
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'vendor-utils': ['date-fns', 'clsx', 'class-variance-authority'],

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

          // Feature-specific chunks
          'feature-admin': ['./src/pages/admin/AdminDashboard.tsx'],
          'feature-settings': ['./src/pages/SettingsPage.tsx'],
          'feature-profile': ['./src/pages/Profile.tsx']
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

    // Optimize chunk size warnings
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
