/**
 * Logo Update Verification Script
 * 
 * This script verifies that all logo references have been successfully updated
 * to use the new mataresit-icon.png file.
 */

console.log('🎨 Logo Update Verification');
console.log('='.repeat(50));

// Test 1: Verify favicon exists and is accessible
console.log('\n📝 Test 1: Checking favicon...');

fetch('/favicon.ico')
  .then(response => {
    if (response.ok) {
      console.log('   ✅ Favicon is accessible');
      console.log(`   📊 Favicon size: ${response.headers.get('content-length')} bytes`);
    } else {
      console.log('   ❌ Favicon not accessible');
    }
  })
  .catch(error => {
    console.log('   ❌ Error fetching favicon:', error);
  });

// Test 2: Verify main logo image exists
console.log('\n📝 Test 2: Checking main logo image...');

fetch('/mataresit-icon.png')
  .then(response => {
    if (response.ok) {
      console.log('   ✅ Main logo image is accessible');
      console.log(`   📊 Logo size: ${response.headers.get('content-length')} bytes`);
    } else {
      console.log('   ❌ Main logo image not accessible');
    }
  })
  .catch(error => {
    console.log('   ❌ Error fetching main logo:', error);
  });

// Test 3: Verify logo appears in navbar
console.log('\n📝 Test 3: Checking navbar logo...');

setTimeout(() => {
  const navbarLogo = document.querySelector('img[src="/mataresit-icon.png"]');
  if (navbarLogo) {
    console.log('   ✅ Navbar logo found');
    console.log(`   📊 Logo dimensions: ${navbarLogo.naturalWidth}x${navbarLogo.naturalHeight}`);
    console.log(`   🎨 Logo classes: ${navbarLogo.className}`);
    
    // Check if logo loads successfully
    if (navbarLogo.complete && navbarLogo.naturalHeight !== 0) {
      console.log('   ✅ Navbar logo loaded successfully');
    } else {
      console.log('   ❌ Navbar logo failed to load');
    }
  } else {
    console.log('   ❌ Navbar logo not found in DOM');
  }
}, 1000);

// Test 4: Verify meta tags
console.log('\n📝 Test 4: Checking meta tags...');

setTimeout(() => {
  const ogImage = document.querySelector('meta[property="og:image"]');
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  const favicon = document.querySelector('link[rel="icon"]');
  
  if (ogImage && ogImage.content === '/mataresit-icon.png') {
    console.log('   ✅ Open Graph image meta tag is correct');
  } else {
    console.log('   ❌ Open Graph image meta tag is incorrect or missing');
  }
  
  if (twitterImage && twitterImage.content === '/mataresit-icon.png') {
    console.log('   ✅ Twitter image meta tag is correct');
  } else {
    console.log('   ❌ Twitter image meta tag is incorrect or missing');
  }
  
  if (favicon && favicon.href.includes('/mataresit-icon.png')) {
    console.log('   ✅ Favicon link tag is correct');
  } else {
    console.log('   ❌ Favicon link tag is incorrect or missing');
  }
}, 500);

// Test 5: Check for any broken image references
console.log('\n📝 Test 5: Checking for broken images...');

setTimeout(() => {
  const allImages = document.querySelectorAll('img');
  let brokenImages = 0;
  
  allImages.forEach((img, index) => {
    if (!img.complete || img.naturalHeight === 0) {
      console.log(`   ❌ Broken image found: ${img.src}`);
      brokenImages++;
    }
  });
  
  if (brokenImages === 0) {
    console.log('   ✅ No broken images found');
  } else {
    console.log(`   ❌ Found ${brokenImages} broken images`);
  }
  
  console.log(`   📊 Total images checked: ${allImages.length}`);
}, 2000);

// Test 6: Verify service worker cache
console.log('\n📝 Test 6: Checking service worker cache...');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    console.log('   ✅ Service worker is ready');
    
    // Check if the icon is cached
    caches.open('mataresit-push-v1').then(cache => {
      cache.match('/mataresit-icon.png').then(response => {
        if (response) {
          console.log('   ✅ Logo is cached in service worker');
        } else {
          console.log('   ⚠️  Logo not yet cached in service worker (this is normal on first load)');
        }
      });
    }).catch(error => {
      console.log('   ⚠️  Could not check service worker cache:', error);
    });
  }).catch(error => {
    console.log('   ❌ Service worker not available:', error);
  });
} else {
  console.log('   ❌ Service worker not supported');
}

console.log('\n🎯 Verification complete! Check the results above.');
console.log('💡 If all tests pass, the logo update was successful.');
