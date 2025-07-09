// NUCLEAR CACHE CLEAR - Run this in browser console on the search page
// This will clear ALL cache layers that might be preventing POWERCAT results from showing

console.log('💥 STARTING NUCLEAR CACHE CLEAR FOR POWERCAT...');

// Step 1: Clear all localStorage entries
console.log('🗑️ Step 1: Clearing localStorage...');
const localKeys = Object.keys(localStorage);
const cacheKeys = localKeys.filter(key => 
  key.includes('search_cache_') ||
  key.includes('conv_cache_') ||
  key.includes('background_search_') ||
  key.includes('conversation_') ||
  key.includes('chat_') ||
  key.includes('cache') ||
  key.toLowerCase().includes('powercat')
);

console.log(`Found ${cacheKeys.length} localStorage entries to clear:`, cacheKeys);
cacheKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`✅ Removed: ${key}`);
});

// Step 2: Clear sessionStorage
console.log('🗑️ Step 2: Clearing sessionStorage...');
const sessionKeys = Object.keys(sessionStorage);
const sessionCacheKeys = sessionKeys.filter(key => 
  key.includes('search') ||
  key.includes('cache') ||
  key.includes('conversation') ||
  key.toLowerCase().includes('powercat')
);

console.log(`Found ${sessionCacheKeys.length} sessionStorage entries to clear:`, sessionCacheKeys);
sessionCacheKeys.forEach(key => {
  sessionStorage.removeItem(key);
  console.log(`✅ Removed: ${key}`);
});

// Step 3: Clear conversation history cache (if accessible)
console.log('🗑️ Step 3: Clearing conversation history...');
try {
  const conversationKey = 'conversation_history';
  if (localStorage.getItem(conversationKey)) {
    const conversations = JSON.parse(localStorage.getItem(conversationKey) || '[]');
    console.log(`Found ${conversations.length} conversations`);
    
    // Clear search cache from all conversations
    conversations.forEach((conv, index) => {
      if (conv.metadata && conv.metadata.hasSearchResults) {
        conv.metadata.hasSearchResults = false;
        conv.metadata.searchResultsCache = undefined;
        conv.metadata.searchStatus = 'idle';
        conv.metadata.lastSearchQuery = undefined;
        console.log(`✅ Cleared cache from conversation ${index + 1}`);
      }
    });
    
    // Save updated conversations
    localStorage.setItem(conversationKey, JSON.stringify(conversations));
    console.log('✅ Updated conversation history');
  }
} catch (error) {
  console.log('⚠️ Could not clear conversation history:', error.message);
}

// Step 4: Clear any global cache objects
console.log('🗑️ Step 4: Clearing global cache objects...');
if (window.searchCache) {
  try {
    window.searchCache.invalidate();
    console.log('✅ Cleared window.searchCache');
  } catch (e) {
    console.log('⚠️ Could not clear window.searchCache:', e.message);
  }
}

// Step 5: Clear any React Query cache (if accessible)
console.log('🗑️ Step 5: Clearing React Query cache...');
try {
  // Try to find React Query cache in the DOM
  const reactQueryDevtools = document.querySelector('[data-testid="react-query-devtools"]');
  if (reactQueryDevtools) {
    console.log('Found React Query - attempting to clear cache');
    // This is a best-effort attempt
  }
} catch (error) {
  console.log('⚠️ Could not access React Query cache');
}

// Step 6: Clear IndexedDB (if any)
console.log('🗑️ Step 6: Clearing IndexedDB...');
if ('indexedDB' in window) {
  try {
    indexedDB.databases().then(databases => {
      databases.forEach(db => {
        if (db.name && (
          db.name.includes('search') || 
          db.name.includes('cache') || 
          db.name.includes('conversation')
        )) {
          console.log(`🗑️ Deleting IndexedDB: ${db.name}`);
          indexedDB.deleteDatabase(db.name);
        }
      });
    });
  } catch (e) {
    console.log('⚠️ IndexedDB clearing not supported');
  }
}

// Step 7: Summary and next steps
console.log('💥 NUCLEAR CACHE CLEAR COMPLETE!');
console.log(`✅ Cleared ${cacheKeys.length + sessionCacheKeys.length} cache entries`);
console.log('');
console.log('🔄 NEXT STEPS:');
console.log('1. Refresh the page (Ctrl+F5 or Cmd+Shift+R for hard refresh)');
console.log('2. Navigate to the search page');
console.log('3. Search for "powercat"');
console.log('4. You should now see 7 POWERCAT results instead of error messages');
console.log('');
console.log('If the issue persists, the problem is not cache-related.');

// Auto-refresh after 2 seconds
console.log('🔄 Auto-refreshing in 2 seconds...');
setTimeout(() => {
  window.location.reload(true);
}, 2000);
