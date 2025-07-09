// Test script to verify service worker registration works without cache errors
// Run this in the browser console to test the fix

console.log('🧪 Testing Service Worker Fix...');

async function testServiceWorkerRegistration() {
  try {
    // Clear any existing service workers first
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`Found ${registrations.length} existing service worker registrations`);
      
      for (const registration of registrations) {
        console.log('Unregistering:', registration.scope);
        await registration.unregister();
      }
    }

    // Clear all caches
    const cacheNames = await caches.keys();
    console.log(`Found ${cacheNames.length} existing caches:`, cacheNames);
    
    for (const cacheName of cacheNames) {
      console.log('Deleting cache:', cacheName);
      await caches.delete(cacheName);
    }

    console.log('✅ Cleared existing service workers and caches');

    // Test push notification service worker registration
    console.log('📱 Testing push notification service worker...');
    const pushRegistration = await navigator.serviceWorker.register('/sw-push.js', {
      scope: '/'
    });
    
    console.log('✅ Push notification service worker registered successfully');
    
    // Wait for it to install
    await new Promise((resolve) => {
      if (pushRegistration.installing) {
        pushRegistration.installing.addEventListener('statechange', function() {
          if (this.state === 'installed') {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });

    // Test translation service worker registration
    console.log('🌐 Testing translation service worker...');
    const translationRegistration = await navigator.serviceWorker.register('/sw-translations.js');
    
    console.log('✅ Translation service worker registered successfully');

    // Check final state
    const finalRegistrations = await navigator.serviceWorker.getRegistrations();
    const finalCaches = await caches.keys();
    
    console.log('🎉 Test completed successfully!');
    console.log(`Final registrations: ${finalRegistrations.length}`);
    console.log(`Final caches: ${finalCaches.length}`, finalCaches);
    
    return true;
  } catch (error) {
    console.error('❌ Service worker test failed:', error);
    return false;
  }
}

// Run the test
testServiceWorkerRegistration().then(success => {
  if (success) {
    console.log('🎉 All service workers registered successfully without cache errors!');
    console.log('💡 You can now refresh the page to see if the console errors are gone.');
  } else {
    console.log('❌ Service worker test failed. Check the errors above.');
  }
});
