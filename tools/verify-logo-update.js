/**
 * Logo Update Verification Script
 *
 * Manual browser-console helper (not wired into any npm script). Paste it into
 * the devtools console on a running build to confirm the v4 brand mark is in
 * place: SVG favicon, raster fallbacks, and the lockup in the page chrome.
 *
 * Source of truth: brand_guidelines/BRAND-NOTES.md.
 */

console.log('🎨 Brand mark verification');
console.log('='.repeat(50));

const RASTER_SIZES = [32, 64, 180, 192, 512];
const SVG_ASSETS = ['/mataresit-mark.svg', '/mataresit-icon.svg'];

// Test 1: vector assets are served
console.log('\n📝 Test 1: Vector assets...');
SVG_ASSETS.forEach((path) => {
  fetch(path, { method: 'HEAD' })
    .then((response) => {
      console.log(response.ok ? `   ✅ ${path}` : `   ❌ ${path} not accessible`);
    })
    .catch((error) => console.log(`   ❌ ${path}:`, error));
});

// Test 2: raster set is served
console.log('\n📝 Test 2: Raster set...');
RASTER_SIZES.forEach((size) => {
  const path = `/mataresit-${size}.png`;
  fetch(path, { method: 'HEAD' })
    .then((response) => {
      console.log(response.ok ? `   ✅ ${path}` : `   ❌ ${path} not accessible`);
    })
    .catch((error) => console.log(`   ❌ ${path}:`, error));
});

// Test 3: the lockup renders the mark, not a bitmap
console.log('\n📝 Test 3: Lockup in page chrome...');
setTimeout(() => {
  const marks = document.querySelectorAll('svg[data-mark="mataresit"]');
  if (marks.length === 0) {
    console.log('   ❌ No brand mark found in the DOM');
  } else {
    console.log(`   ✅ Found ${marks.length} brand mark(s)`);
    marks.forEach((mark, index) => {
      const box = mark.getBoundingClientRect();
      const colour = getComputedStyle(mark).color;
      console.log(`   📊 #${index + 1} ${Math.round(box.width)}×${Math.round(box.height)} px, fill ${colour}`);
      if (box.width < 16) {
        console.log('   ❌ Mark is below the 16 px floor from BRAND-NOTES.md');
      }
    });
  }

  const legacyBitmap = document.querySelector('img[src*="mataresit-icon.png"]');
  console.log(
    legacyBitmap
      ? '   ❌ A retired mataresit-icon.png bitmap is still rendered'
      : '   ✅ No retired bitmap references in the DOM',
  );
}, 1000);

// Test 4: icon + social metadata
console.log('\n📝 Test 4: Icon and social metadata...');
setTimeout(() => {
  const svgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  const pngIcon = document.querySelector('link[rel="icon"][type="image/png"]');
  const touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  const themeColour = document.querySelector('meta[name="theme-color"]');

  const report = (label, element, attribute, expected) => {
    const value = element?.getAttribute(attribute);
    console.log(
      value && (expected ? value.includes(expected) : true)
        ? `   ✅ ${label}: ${value}`
        : `   ❌ ${label} missing or unexpected: ${value}`,
    );
  };

  report('SVG favicon', svgIcon, 'href', 'mataresit-mark.svg');
  report('PNG favicon', pngIcon, 'href', 'mataresit-32.png');
  report('Apple touch icon', touchIcon, 'href', 'mataresit-180.png');
  report('Open Graph image', ogImage, 'content', 'mataresit-512.png');
  report('Twitter image', twitterImage, 'content', 'mataresit-512.png');
  report('Theme colour', themeColour, 'content', '#0B6B4D');
}, 500);

// Test 5: no broken images on the page
console.log('\n📝 Test 5: Broken images...');
setTimeout(() => {
  const allImages = Array.from(document.querySelectorAll('img'));
  const broken = allImages.filter((img) => !img.complete || img.naturalHeight === 0);
  broken.forEach((img) => console.log(`   ❌ Broken image: ${img.src}`));
  console.log(
    broken.length === 0
      ? `   ✅ No broken images (${allImages.length} checked)`
      : `   ❌ ${broken.length} broken of ${allImages.length}`,
  );
}, 2000);

// Test 6: service worker cache holds the current notification icon
console.log('\n📝 Test 6: Service worker cache...');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((registration) => {
      console.log('   ✅ Service worker ready');
      return caches.open('mataresit-push-v2');
    })
    .then((cache) => cache.match('/mataresit-192.png'))
    .then((response) => {
      console.log(
        response
          ? '   ✅ Notification icon cached in mataresit-push-v2'
          : '   ⚠️  Notification icon not cached yet (normal on first load)',
      );
    })
    .catch((error) => console.log('   ⚠️  Could not inspect service worker cache:', error));
} else {
  console.log('   ❌ Service worker not supported');
}

console.log('\n🎯 Verification complete.');
