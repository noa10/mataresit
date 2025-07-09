// Force clear all POWERCAT-related cache
// Run this in browser console on the search page

console.log('🗑️ FORCE CLEARING ALL POWERCAT CACHE...');

// 1. Clear localStorage
const localKeys = Object.keys(localStorage);
console.log(`Found ${localKeys.length} localStorage keys`);

const powercatLocalKeys = localKeys.filter(key => 
  key.toLowerCase().includes('powercat') ||
  key.includes('search_cache_') ||
  key.includes('conv_cache_') ||
  key.includes('background_search_') ||
  key.includes('chat_') ||
  key.includes('conversation_')
);

console.log(`Clearing ${powercatLocalKeys.length} localStorage entries:`, powercatLocalKeys);
powercatLocalKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`✅ Removed localStorage: ${key}`);
});

// 2. Clear sessionStorage
const sessionKeys = Object.keys(sessionStorage);
console.log(`Found ${sessionKeys.length} sessionStorage keys`);

const powercatSessionKeys = sessionKeys.filter(key => 
  key.toLowerCase().includes('powercat') ||
  key.includes('search') ||
  key.includes('cache') ||
  key.includes('conversation')
);

console.log(`Clearing ${powercatSessionKeys.length} sessionStorage entries:`, powercatSessionKeys);
powercatSessionKeys.forEach(key => {
  sessionStorage.removeItem(key);
  console.log(`✅ Removed sessionStorage: ${key}`);
});

// 3. Clear IndexedDB (if any)
if ('indexedDB' in window) {
  try {
    indexedDB.databases().then(databases => {
      databases.forEach(db => {
        if (db.name && (db.name.includes('search') || db.name.includes('cache'))) {
          console.log(`🗑️ Clearing IndexedDB: ${db.name}`);
          indexedDB.deleteDatabase(db.name);
        }
      });
    });
  } catch (e) {
    console.log('IndexedDB clearing not supported');
  }
}

// 4. Clear any in-memory caches if accessible
if (window.searchCache) {
  console.log('🗑️ Clearing window.searchCache');
  window.searchCache.invalidate();
}

if (window.clearPowercatCache) {
  console.log('🗑️ Calling window.clearPowercatCache');
  window.clearPowercatCache();
}

if (window.clearAllSearchCache) {
  console.log('🗑️ Calling window.clearAllSearchCache');
  window.clearAllSearchCache();
}

// 5. Force reload without cache
console.log('✅ Cache clearing complete!');
console.log('🔄 Now performing hard refresh...');

// Force hard refresh to clear any remaining cache
setTimeout(() => {
  window.location.reload(true);
}, 1000);
