/**
 * Service Worker for Translation Caching
 * Provides offline support and performance optimization for translation files
 */

const CACHE_NAME = 'mataresit-translations-v1';
const CACHE_VERSION = '1.0.0';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Translation file patterns to cache
const TRANSLATION_PATTERNS = [
  /\/locales\/[a-z]{2}\/[a-z]+\.json$/,
  /\/assets\/i18n\/.*\.js$/
];

// Critical translation files to always cache
const CRITICAL_TRANSLATIONS = [
  '/locales/en/common.json',
  '/locales/en/navigation.json',
  '/locales/en/errors.json',
  '/locales/ms/common.json',
  '/locales/ms/navigation.json',
  '/locales/ms/errors.json'
];

/**
 * Install event - cache critical translation files
 */
self.addEventListener('install', (event) => {
  console.log('🔧 Translation Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching critical translation files...');
        return cache.addAll(CRITICAL_TRANSLATIONS);
      })
      .then(() => {
        console.log('✅ Critical translation files cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Failed to cache critical translations:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('🚀 Translation Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('mataresit-translations-') && cacheName !== CACHE_NAME) {
              console.log('🧹 Deleting old translation cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Translation Service Worker activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle translation file requests
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle translation-related requests
  if (!isTranslationRequest(url.pathname)) {
    return;
  }
  
  event.respondWith(
    handleTranslationRequest(event.request)
  );
});

/**
 * Check if request is for translation files
 */
function isTranslationRequest(pathname) {
  return TRANSLATION_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Handle translation file requests with cache-first strategy
 */
async function handleTranslationRequest(request) {
  const url = new URL(request.url);
  const cacheKey = url.pathname;
  
  try {
    // Try cache first
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Check if cache is expired
      const cacheTime = await getCacheTimestamp(cacheKey);
      const isExpired = cacheTime && (Date.now() - cacheTime > CACHE_EXPIRY);
      
      if (!isExpired) {
        console.log('📋 Serving translation from cache:', cacheKey);
        
        // Update cache in background if it's getting old
        if (cacheTime && (Date.now() - cacheTime > CACHE_EXPIRY / 2)) {
          updateCacheInBackground(request, cache);
        }
        
        return cachedResponse;
      } else {
        console.log('⏰ Translation cache expired:', cacheKey);
      }
    }
    
    // Fetch from network
    console.log('🌐 Fetching translation from network:', cacheKey);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the response
      await cacheTranslationResponse(cache, request, networkResponse.clone());
      return networkResponse;
    } else {
      // If network fails and we have cached version, use it even if expired
      if (cachedResponse) {
        console.log('🔄 Network failed, using expired cache:', cacheKey);
        return cachedResponse;
      }
      
      throw new Error(`Network request failed: ${networkResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ Translation request failed:', error);
    
    // Try to return cached version as fallback
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('🆘 Using cached fallback for:', cacheKey);
      return cachedResponse;
    }
    
    // Return empty translation object as last resort
    return new Response(
      JSON.stringify({}),
      {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }
}

/**
 * Cache translation response with timestamp
 */
async function cacheTranslationResponse(cache, request, response) {
  const url = new URL(request.url);
  const cacheKey = url.pathname;
  
  // Store the response
  await cache.put(request, response);
  
  // Store timestamp for expiry checking
  await setCacheTimestamp(cacheKey, Date.now());
  
  console.log('💾 Cached translation:', cacheKey);
}

/**
 * Update cache in background
 */
async function updateCacheInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheTranslationResponse(cache, request, response);
      console.log('🔄 Updated translation cache in background:', request.url);
    }
  } catch (error) {
    console.warn('⚠️ Background cache update failed:', error);
  }
}

/**
 * Get cache timestamp
 */
async function getCacheTimestamp(cacheKey) {
  try {
    const cache = await caches.open(`${CACHE_NAME}-timestamps`);
    const response = await cache.match(cacheKey);
    
    if (response) {
      const text = await response.text();
      return parseInt(text, 10);
    }
  } catch (error) {
    console.warn('⚠️ Failed to get cache timestamp:', error);
  }
  
  return null;
}

/**
 * Set cache timestamp
 */
async function setCacheTimestamp(cacheKey, timestamp) {
  try {
    const cache = await caches.open(`${CACHE_NAME}-timestamps`);
    const response = new Response(timestamp.toString(), {
      headers: { 'Content-Type': 'text/plain' }
    });
    
    await cache.put(cacheKey, response);
  } catch (error) {
    console.warn('⚠️ Failed to set cache timestamp:', error);
  }
}

/**
 * Message handler for cache management
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_TRANSLATIONS':
      handleCacheTranslations(data.language, data.namespaces)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;
      
    case 'CLEAR_TRANSLATION_CACHE':
      clearTranslationCache()
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo()
        .then((info) => {
          event.ports[0].postMessage({ success: true, data: info });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
      break;
  }
});

/**
 * Cache specific translations
 */
async function handleCacheTranslations(language, namespaces) {
  const cache = await caches.open(CACHE_NAME);
  const urls = namespaces.map(ns => `/locales/${language}/${ns}.json`);
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cacheTranslationResponse(cache, new Request(url), response);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to cache ${url}:`, error);
    }
  }
}

/**
 * Clear translation cache
 */
async function clearTranslationCache() {
  await caches.delete(CACHE_NAME);
  await caches.delete(`${CACHE_NAME}-timestamps`);
  console.log('🧹 Translation cache cleared');
}

/**
 * Get cache information
 */
async function getCacheInfo() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  const info = {
    version: CACHE_VERSION,
    cacheSize: keys.length,
    cachedFiles: keys.map(request => request.url),
    lastUpdated: Date.now()
  };
  
  return info;
}
