// Clear POWERCAT search cache to force fresh results
// Run this in browser console or as a script

console.log('🗑️ Clearing POWERCAT search cache...');

// Clear localStorage cache entries
const keys = Object.keys(localStorage);
const searchCacheKeys = keys.filter(key => 
  key.startsWith('search_cache_') && 
  (key.includes('powercat') || key.includes('POWERCAT'))
);

console.log(`Found ${searchCacheKeys.length} POWERCAT cache entries to clear:`, searchCacheKeys);

searchCacheKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

// Clear conversation cache entries
const conversationKeys = keys.filter(key => 
  key.startsWith('conv_cache_') && 
  (key.includes('powercat') || key.includes('POWERCAT'))
);

console.log(`Found ${conversationKeys.length} conversation cache entries to clear:`, conversationKeys);

conversationKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

// Clear any other cache entries that might contain POWERCAT
const allCacheKeys = keys.filter(key => 
  (key.includes('cache') || key.includes('search')) && 
  (key.includes('powercat') || key.includes('POWERCAT'))
);

console.log(`Found ${allCacheKeys.length} additional cache entries to clear:`, allCacheKeys);

allCacheKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

console.log('✅ POWERCAT cache cleared! Please refresh the page and try searching again.');
