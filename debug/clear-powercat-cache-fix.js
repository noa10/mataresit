// Clear POWERCAT cache to test the enhanced response fix
// Run this in the browser console on the search page

console.log('🗑️ Clearing POWERCAT cache to test enhanced response fix...');

// Method 1: Use the built-in cache clearing function if available
if (typeof window !== 'undefined' && window.clearPowercatCache) {
  console.log('Using built-in clearPowercatCache function');
  window.clearPowercatCache();
} else {
  // Method 2: Manual cache clearing
  console.log('Manual cache clearing...');
  
  // Clear localStorage entries
  const keys = Object.keys(localStorage);
  const powercatKeys = keys.filter(key => 
    key.toLowerCase().includes('powercat') ||
    (key.includes('search_cache_') || key.includes('conv_cache_') || key.includes('background_search_'))
  );
  
  console.log(`Found ${powercatKeys.length} cache entries to clear:`, powercatKeys);
  
  powercatKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Removed: ${key}`);
  });
  
  // Clear sessionStorage as well
  const sessionKeys = Object.keys(sessionStorage);
  const sessionPowercatKeys = sessionKeys.filter(key => 
    key.toLowerCase().includes('powercat') ||
    (key.includes('search_cache_') || key.includes('conv_cache_'))
  );
  
  sessionPowercatKeys.forEach(key => {
    sessionStorage.removeItem(key);
    console.log(`Removed from session: ${key}`);
  });
}

console.log('✅ POWERCAT cache cleared! The next search should use fresh results with UI components.');
console.log('🔄 Please try searching for "powercat" again to test the fix.');
