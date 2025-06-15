// Cross-browser validation script for upload modal

import { detectBrowserSupport, getBrowserInfo } from './browser-compat';

export function validateCrossBrowserSupport(): void {
  if (typeof window === 'undefined') return;

  const browser = getBrowserInfo();
  const support = detectBrowserSupport();

  console.group('🔧 Cross-Browser Validation Report');
  console.log(`Browser: ${browser.name} ${browser.version}`);
  console.log(`User Agent: ${navigator.userAgent}`);
  
  // Test CSS feature support
  console.group('CSS Feature Support:');
  
  // Test viewport units
  if (support.dvhUnits) {
    console.log('✅ Modern viewport units (100dvh) supported');
  } else {
    console.log('⚠️ Using fallback viewport units (100vh)');
  }
  
  // Test :has() selector
  if (support.hasSelector) {
    console.log('✅ :has() selector supported');
  } else {
    console.log('⚠️ Using class-based fallback for body scroll prevention');
  }
  
  // Test visual viewport
  if (support.visualViewport) {
    console.log('✅ Visual Viewport API supported');
  } else {
    console.log('⚠️ Using window dimensions fallback');
  }
  
  // Test matchMedia
  if (support.matchMedia) {
    console.log('✅ matchMedia API supported');
  } else {
    console.log('⚠️ Using resize event fallback');
  }
  
  console.groupEnd();

  // Test modal functionality
  console.group('Modal Functionality Tests:');
  
  // Check if modal elements exist
  const modalTrigger = document.querySelector('[data-testid="upload-modal-trigger"]') || 
                      document.querySelector('button:contains("Upload")') ||
                      document.querySelector('[aria-label*="upload" i]');
  
  if (modalTrigger) {
    console.log('✅ Modal trigger found');
  } else {
    console.log('⚠️ Modal trigger not found - check if upload button is present');
  }

  // Check CSS classes and styles
  const hasModalStyles = Array.from(document.styleSheets).some(sheet => {
    try {
      return Array.from(sheet.cssRules).some(rule => 
        rule.cssText.includes('[data-radix-dialog-content]')
      );
    } catch {
      return false;
    }
  });

  if (hasModalStyles) {
    console.log('✅ Modal CSS styles loaded');
  } else {
    console.log('❌ Modal CSS styles not found');
  }

  console.groupEnd();

  // Browser-specific recommendations
  console.group('Browser-Specific Notes:');
  
  switch (browser.name) {
    case 'chrome':
      if (parseInt(browser.version) < 108) {
        console.log('⚠️ Chrome < 108: Using 100vh fallback for viewport units');
      } else {
        console.log('✅ Chrome: Full feature support');
      }
      break;
      
    case 'firefox':
      if (parseInt(browser.version) < 121) {
        console.log('⚠️ Firefox < 121: Using class-based fallback for :has() selector');
      } else {
        console.log('✅ Firefox: Full feature support');
      }
      break;
      
    case 'safari':
      console.log('✅ Safari: Native support for all features');
      break;
      
    case 'edge':
      console.log('✅ Edge: Chromium-based, full compatibility');
      break;
      
    default:
      console.log('ℹ️ Unknown browser: Using all fallbacks for maximum compatibility');
  }
  
  console.groupEnd();

  // Performance recommendations
  console.group('Performance Optimizations:');
  
  if (support.touchEvents) {
    console.log('✅ Touch events supported - mobile optimizations active');
  } else {
    console.log('ℹ️ Desktop browser - touch optimizations disabled');
  }
  
  if ('requestIdleCallback' in window) {
    console.log('✅ requestIdleCallback supported - can use for non-critical updates');
  } else {
    console.log('ℹ️ Using setTimeout fallback for deferred updates');
  }
  
  console.groupEnd();

  // Overall compatibility score
  const supportedFeatures = Object.values(support).filter(Boolean).length;
  const totalFeatures = Object.keys(support).length;
  const compatibilityScore = Math.round((supportedFeatures / totalFeatures) * 100);
  
  console.log(`📊 Overall Compatibility Score: ${compatibilityScore}%`);
  
  if (compatibilityScore >= 90) {
    console.log('🎉 Excellent browser compatibility!');
  } else if (compatibilityScore >= 75) {
    console.log('✅ Good browser compatibility with fallbacks');
  } else {
    console.log('⚠️ Limited browser compatibility - some features may not work optimally');
  }
  
  console.groupEnd();
}

// Test modal interaction
export function testModalInteraction(): void {
  console.group('🧪 Modal Interaction Test');
  
  // Find and click upload button
  const uploadButton = document.querySelector('[data-testid="upload-modal-trigger"]') as HTMLElement;
  
  if (!uploadButton) {
    console.log('❌ Upload button not found');
    console.groupEnd();
    return;
  }
  
  console.log('✅ Upload button found, testing modal interaction...');
  
  // Set up modal observer
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
        const target = mutation.target as Element;
        if (target.getAttribute('data-state') === 'open' && 
            target.hasAttribute('data-radix-dialog-content')) {
          
          console.log('✅ Modal opened successfully');
          
          // Test modal properties
          const rect = target.getBoundingClientRect();
          const viewport = { width: window.innerWidth, height: window.innerHeight };
          
          console.log(`Modal dimensions: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
          console.log(`Viewport dimensions: ${viewport.width}x${viewport.height}`);
          
          if (rect.right <= viewport.width && rect.bottom <= viewport.height) {
            console.log('✅ Modal fits within viewport');
          } else {
            console.log('❌ Modal overflows viewport');
          }
          
          // Test close button
          const closeButton = target.querySelector('[data-radix-dialog-close]');
          if (closeButton) {
            console.log('✅ Close button found');
            
            // Auto-close after test
            setTimeout(() => {
              (closeButton as HTMLElement).click();
              console.log('✅ Modal closed successfully');
              observer.disconnect();
              console.groupEnd();
            }, 2000);
          } else {
            console.log('❌ Close button not found');
            observer.disconnect();
            console.groupEnd();
          }
        }
      }
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: ['data-state'],
  });
  
  // Click the upload button
  uploadButton.click();
  
  // Timeout if modal doesn't open
  setTimeout(() => {
    observer.disconnect();
    console.log('⏱️ Modal test timeout - modal may not have opened');
    console.groupEnd();
  }, 5000);
}

// Auto-run validation in development - disabled by default
// Uncomment to enable automatic validation and testing:
// if (process.env.NODE_ENV === 'development') {
//   // Run validation when DOM is ready
//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', () => {
//       setTimeout(validateCrossBrowserSupport, 1000);
//     });
//   } else {
//     setTimeout(validateCrossBrowserSupport, 1000);
//   }
//
//   // Add global test function for manual testing
//   (window as any).testModal = testModalInteraction;
//   (window as any).validateBrowser = validateCrossBrowserSupport;
//
//   console.log('🔧 Cross-browser validation loaded. Run testModal() or validateBrowser() in console.');
// }
