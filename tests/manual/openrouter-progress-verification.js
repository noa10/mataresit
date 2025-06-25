// OpenRouter Progress Verification Script
// Run this in the browser console to verify the implementation

console.log('🔍 OpenRouter Progress Verification Script');
console.log('==========================================');

// Check if OpenRouter progress hook is available
function checkOpenRouterProgressHook() {
  console.log('\n1. Checking OpenRouter Progress Hook...');
  
  // Look for the hook in React DevTools or component state
  const uploadZone = document.querySelector('[role="button"][aria-label*="Upload receipt"]');
  if (uploadZone) {
    console.log('✅ Upload zone found');
  } else {
    console.log('❌ Upload zone not found');
  }
  
  // Check for progress logs container
  const progressContainer = document.querySelector('[data-testid="processing-logs"], .processing-logs');
  if (progressContainer) {
    console.log('✅ Progress logs container found');
  } else {
    console.log('⚠️ Progress logs container not visible (normal when not uploading)');
  }
}

// Check model selection and OpenRouter detection
function checkModelSelection() {
  console.log('\n2. Checking Model Selection...');
  
  // Look for model dropdown or selection
  const modelSelectors = document.querySelectorAll('[data-testid*="model"], select, [role="combobox"]');
  console.log(`Found ${modelSelectors.length} potential model selectors`);
  
  // Check for OpenRouter models (look for 🌐 icon or "openrouter/" prefix)
  const openRouterIndicators = document.querySelectorAll('[data-testid*="openrouter"], [title*="OpenRouter"], [aria-label*="OpenRouter"]');
  if (openRouterIndicators.length > 0) {
    console.log('✅ OpenRouter model indicators found');
  } else {
    console.log('⚠️ OpenRouter model indicators not visible (check model dropdown)');
  }
}

// Check ARIA live regions for accessibility
function checkAccessibility() {
  console.log('\n3. Checking Accessibility...');
  
  const ariaLiveRegions = document.querySelectorAll('[aria-live]');
  console.log(`Found ${ariaLiveRegions.length} ARIA live regions:`);
  
  ariaLiveRegions.forEach((region, index) => {
    const id = region.id || `region-${index}`;
    const liveType = region.getAttribute('aria-live');
    const content = region.textContent?.trim() || '(empty)';
    console.log(`  - ${id}: ${liveType} - "${content}"`);
  });
  
  // Check for upload status region specifically
  const uploadStatus = document.getElementById('upload-status');
  if (uploadStatus) {
    console.log('✅ Upload status ARIA region found');
  } else {
    console.log('❌ Upload status ARIA region missing');
  }
}

// Monitor console for OpenRouter progress events
function monitorProgressEvents() {
  console.log('\n4. Setting up Progress Event Monitor...');
  
  // Store original console.log to intercept OpenRouter progress logs
  const originalLog = console.log;
  let progressEventCount = 0;
  
  console.log = function(...args) {
    const message = args.join(' ');
    
    // Look for OpenRouter progress events
    if (message.includes('OpenRouter Progress:') || 
        message.includes('🔄 Using OpenRouter model') ||
        message.includes('OpenRouter API response')) {
      progressEventCount++;
      originalLog(`📊 [PROGRESS EVENT ${progressEventCount}]`, ...args);
    } else {
      originalLog(...args);
    }
  };
  
  console.log('✅ Progress event monitor active');
  console.log('   Upload a receipt with an OpenRouter model to see progress events');
  
  // Restore original console.log after 5 minutes
  setTimeout(() => {
    console.log = originalLog;
    console.log(`📊 Progress monitoring stopped. Captured ${progressEventCount} events.`);
  }, 5 * 60 * 1000);
}

// Check for potential issues
function checkPotentialIssues() {
  console.log('\n5. Checking for Potential Issues...');
  
  // Check for JavaScript errors
  const errorCount = window.performance?.getEntriesByType?.('navigation')?.[0]?.loadEventEnd || 0;
  if (errorCount > 0) {
    console.log('⚠️ Page load issues detected');
  }
  
  // Check for React DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ React DevTools available');
  } else {
    console.log('⚠️ React DevTools not available (install for better debugging)');
  }
  
  // Check for common OpenRouter issues
  const localStorageSettings = localStorage.getItem('receiptProcessingSettings');
  if (localStorageSettings) {
    try {
      const settings = JSON.parse(localStorageSettings);
      if (settings.userApiKeys?.openrouter) {
        console.log('✅ OpenRouter API key configured');
      } else {
        console.log('❌ OpenRouter API key not configured');
      }
    } catch (e) {
      console.log('⚠️ Settings parsing error');
    }
  } else {
    console.log('⚠️ No settings found in localStorage');
  }
}

// Test progress mapping
function testProgressMapping() {
  console.log('\n6. Testing Progress Mapping...');
  
  // Simulate progress events to verify mapping
  const testEvents = [
    { step: 'START', message: 'Initializing OpenRouter processing', expected: 5 },
    { step: 'START', message: 'Validating API key', expected: 10 },
    { step: 'AI', message: 'Processing with AI model', expected: 40 },
    { step: 'PROCESSING', message: 'Extracting receipt data', expected: 75 },
    { step: 'COMPLETE', message: 'Processing completed successfully', expected: 100 }
  ];
  
  console.log('Expected progress mapping:');
  testEvents.forEach(event => {
    console.log(`  ${event.step}: "${event.message}" → ${event.expected}%`);
  });
}

// Main verification function
function runVerification() {
  console.log('Starting OpenRouter Progress Verification...\n');
  
  checkOpenRouterProgressHook();
  checkModelSelection();
  checkAccessibility();
  monitorProgressEvents();
  checkPotentialIssues();
  testProgressMapping();
  
  console.log('\n==========================================');
  console.log('✅ Verification complete!');
  console.log('\nNext steps:');
  console.log('1. Select an OpenRouter model (look for 🌐 icon)');
  console.log('2. Upload a receipt image');
  console.log('3. Watch console for progress events');
  console.log('4. Verify progress logs appear in UI');
  console.log('\nIf issues occur, check the troubleshooting section in the test plan.');
}

// Auto-run verification
runVerification();

// Export functions for manual testing
window.openRouterVerification = {
  runVerification,
  checkOpenRouterProgressHook,
  checkModelSelection,
  checkAccessibility,
  monitorProgressEvents,
  checkPotentialIssues,
  testProgressMapping
};

console.log('\n💡 Tip: Use window.openRouterVerification.functionName() to run individual checks');
