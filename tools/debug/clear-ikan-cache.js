// Clear IKAN search cache to force fresh results
// Run this in browser console

console.log('🗑️ Clearing IKAN search cache...');

// Clear localStorage cache entries
const keys = Object.keys(localStorage);
const searchCacheKeys = keys.filter(key => 
  key.startsWith('search_cache_') && 
  (key.includes('ikan') || key.includes('IKAN'))
);

console.log(`Found ${searchCacheKeys.length} IKAN cache entries to clear:`, searchCacheKeys);

searchCacheKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

// Clear conversation cache entries
const conversationKeys = keys.filter(key => 
  key.startsWith('conv_cache_') && 
  (key.includes('ikan') || key.includes('IKAN'))
);

console.log(`Found ${conversationKeys.length} conversation cache entries to clear:`, conversationKeys);

conversationKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

// Clear any other cache entries that might contain IKAN
const allCacheKeys = keys.filter(key => 
  (key.includes('cache') || key.includes('search')) && 
  (key.includes('ikan') || key.includes('IKAN'))
);

console.log(`Found ${allCacheKeys.length} additional cache entries to clear:`, allCacheKeys);

allCacheKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

console.log('✅ IKAN cache cleared! Please refresh the page and try searching again.');

// Also clear all search cache entries to be safe
const allSearchKeys = keys.filter(key => key.startsWith('search_cache_'));
console.log(`Found ${allSearchKeys.length} total search cache entries to clear for fresh results`);

allSearchKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

console.log('✅ All search cache cleared! The next search will fetch fresh results from the backend.');
