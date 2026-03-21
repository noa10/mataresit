import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 5173,
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
        manualChunks(id) {
          // Core vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') && !id.includes('react-router') && !id.includes('react-day-picker') && !id.includes('react-hook-form') && !id.includes('react-i18next') && !id.includes('react-hot-toast') && !id.includes('react-window')) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('class-variance-authority')) {
              return 'vendor-utils';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('html2canvas') || id.includes('browser-image-compression') || id.includes('xlsx')) {
              return 'vendor-heavy';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n-core';
            }
          }

          // Translation chunks - split by language for better caching
          if (id.includes('/locales/en/')) {
            return 'translations-en';
          }
          if (id.includes('/locales/ms/')) {
            return 'translations-ms';
          }

          // Feature-specific chunks - more granular splitting
          if (id.includes('/pages/admin/') || id.includes('/components/admin/')) {
            return 'feature-admin';
          }
          if (id.includes('/pages/SettingsPage') || id.includes('/components/settings/') || id.includes('/components/categories/')) {
            return 'feature-settings';
          }
          if (id.includes('/pages/Profile')) {
            return 'feature-profile';
          }
          if (id.includes('/components/analytics/')) {
            return 'feature-analytics';
          }
          if (id.includes('/pages/SemanticSearch') || id.includes('/pages/UnifiedSearchPage')) {
            return 'feature-search';
          }
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

    // Optimize for better compression (Vite 8 uses oxc/esbuild, not terser)
    minify: 'oxc',

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
