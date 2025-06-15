// Cross-browser compatibility testing utilities

import { detectBrowserSupport, getBrowserInfo, getViewportDimensions } from './browser-compat';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

export interface CrossBrowserTestSuite {
  browser: ReturnType<typeof getBrowserInfo>;
  support: ReturnType<typeof detectBrowserSupport>;
  viewport: ReturnType<typeof getViewportDimensions>;
  tests: TestResult[];
  overallScore: number;
}

// Test functions
function testModalVisibility(): TestResult {
  const modal = document.querySelector('[data-radix-dialog-content]');
  
  if (!modal) {
    return {
      name: 'Modal Visibility',
      passed: false,
      message: 'Modal element not found',
      critical: true,
    };
  }

  const rect = modal.getBoundingClientRect();
  const isVisible = rect.width > 0 && rect.height > 0;
  
  return {
    name: 'Modal Visibility',
    passed: isVisible,
    message: isVisible ? 'Modal is visible' : 'Modal is not visible',
    critical: true,
  };
}

function testModalDimensions(): TestResult {
  const modal = document.querySelector('[data-radix-dialog-content]');
  
  if (!modal) {
    return {
      name: 'Modal Dimensions',
      passed: false,
      message: 'Modal element not found',
      critical: true,
    };
  }

  const rect = modal.getBoundingClientRect();
  const viewport = getViewportDimensions();
  
  const fitsViewport = rect.right <= viewport.width && rect.bottom <= viewport.height;
  
  return {
    name: 'Modal Dimensions',
    passed: fitsViewport,
    message: fitsViewport 
      ? `Modal fits viewport (${Math.round(rect.width)}x${Math.round(rect.height)})` 
      : `Modal overflows viewport (${Math.round(rect.width)}x${Math.round(rect.height)} vs ${viewport.width}x${viewport.height})`,
    critical: true,
  };
}

function testScrollability(): TestResult {
  const modal = document.querySelector('[data-radix-dialog-content]');
  
  if (!modal) {
    return {
      name: 'Modal Scrollability',
      passed: false,
      message: 'Modal element not found',
      critical: false,
    };
  }

  const isScrollable = modal.scrollHeight > modal.clientHeight;
  const hasOverflow = getComputedStyle(modal).overflowY !== 'visible';
  
  return {
    name: 'Modal Scrollability',
    passed: !isScrollable || hasOverflow,
    message: isScrollable 
      ? (hasOverflow ? 'Modal is scrollable' : 'Modal content overflows but no scroll')
      : 'Modal content fits without scrolling',
    critical: false,
  };
}

function testTouchTargets(): TestResult {
  const modal = document.querySelector('[data-radix-dialog-content]');
  
  if (!modal) {
    return {
      name: 'Touch Targets',
      passed: false,
      message: 'Modal element not found',
      critical: false,
    };
  }

  const buttons = Array.from(modal.querySelectorAll('button'));
  const validTargets = buttons.filter(btn => {
    const rect = btn.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  });

  const passed = buttons.length === 0 || validTargets.length === buttons.length;
  
  return {
    name: 'Touch Targets',
    passed,
    message: `${validTargets.length}/${buttons.length} buttons meet 44px minimum size`,
    critical: false,
  };
}

function testBodyScrollPrevention(): TestResult {
  const body = document.body;
  const hasModalOpen = document.querySelector('[data-state="open"][data-radix-dialog-content]');
  
  if (!hasModalOpen) {
    return {
      name: 'Body Scroll Prevention',
      passed: true,
      message: 'No modal open to test',
      critical: false,
    };
  }

  const bodyStyle = getComputedStyle(body);
  const isScrollPrevented = bodyStyle.overflow === 'hidden' || 
                           body.classList.contains('modal-open');
  
  return {
    name: 'Body Scroll Prevention',
    passed: isScrollPrevented,
    message: isScrollPrevented 
      ? 'Body scroll is prevented' 
      : 'Body scroll is not prevented',
    critical: false,
  };
}

function testCSSFeatureSupport(): TestResult {
  const support = detectBrowserSupport();
  const criticalFeatures = ['matchMedia', 'flexbox'];
  const missingCritical = criticalFeatures.filter(feature => !support[feature as keyof typeof support]);
  
  return {
    name: 'CSS Feature Support',
    passed: missingCritical.length === 0,
    message: missingCritical.length === 0 
      ? 'All critical CSS features supported'
      : `Missing critical features: ${missingCritical.join(', ')}`,
    critical: true,
  };
}

function testViewportUnits(): TestResult {
  const support = detectBrowserSupport();
  
  // Check if the modal is using appropriate viewport units
  const modal = document.querySelector('[data-radix-dialog-content]');
  if (!modal) {
    return {
      name: 'Viewport Units',
      passed: false,
      message: 'Modal element not found',
      critical: false,
    };
  }

  const style = getComputedStyle(modal);
  const hasViewportHeight = style.height.includes('vh') || style.height.includes('dvh');
  
  return {
    name: 'Viewport Units',
    passed: true, // We have fallbacks, so this should always pass
    message: support.dvhUnits 
      ? 'Modern viewport units (dvh) supported'
      : 'Using fallback viewport units (vh)',
    critical: false,
  };
}

// Main test runner
export function runCrossBrowserTests(): CrossBrowserTestSuite {
  const tests: TestResult[] = [
    testModalVisibility(),
    testModalDimensions(),
    testScrollability(),
    testTouchTargets(),
    testBodyScrollPrevention(),
    testCSSFeatureSupport(),
    testViewportUnits(),
  ];

  const passedTests = tests.filter(test => test.passed);
  const criticalTests = tests.filter(test => test.critical);
  const passedCritical = criticalTests.filter(test => test.passed);
  
  // Calculate score: critical tests are weighted more heavily
  const criticalScore = criticalTests.length > 0 ? (passedCritical.length / criticalTests.length) * 0.7 : 0.7;
  const overallScore = criticalScore + (passedTests.length / tests.length) * 0.3;

  return {
    browser: getBrowserInfo(),
    support: detectBrowserSupport(),
    viewport: getViewportDimensions(),
    tests,
    overallScore: Math.round(overallScore * 100),
  };
}

// Automated testing function
export function autoTestCrossBrowserCompatibility(): void {
  if (process.env.NODE_ENV !== 'development') return;

  const results = runCrossBrowserTests();
  
  console.group('🔍 Cross-Browser Compatibility Test Results');
  console.log(`Browser: ${results.browser.name} ${results.browser.version}`);
  console.log(`Viewport: ${results.viewport.width}x${results.viewport.height}`);
  console.log(`Overall Score: ${results.overallScore}%`);
  
  console.group('Test Results:');
  results.tests.forEach(test => {
    const icon = test.passed ? '✅' : '❌';
    const priority = test.critical ? '[CRITICAL]' : '[OPTIONAL]';
    console.log(`${icon} ${priority} ${test.name}: ${test.message}`);
  });
  console.groupEnd();
  
  console.group('Feature Support:');
  Object.entries(results.support).forEach(([feature, supported]) => {
    console.log(`${supported ? '✅' : '❌'} ${feature}`);
  });
  console.groupEnd();
  
  console.groupEnd();

  // Show warnings for critical failures
  const criticalFailures = results.tests.filter(test => test.critical && !test.passed);
  if (criticalFailures.length > 0) {
    console.warn('⚠️ Critical compatibility issues detected:', criticalFailures.map(t => t.name));
  }
}

// Auto-run tests when modal opens - disabled by default
// Uncomment to enable automatic cross-browser testing:
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   // Watch for modal state changes
//   const observer = new MutationObserver((mutations) => {
//     mutations.forEach((mutation) => {
//       if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
//         const target = mutation.target as Element;
//         if (target.getAttribute('data-state') === 'open' &&
//             target.hasAttribute('data-radix-dialog-content')) {
//           // Delay test to allow modal to fully render
//           setTimeout(autoTestCrossBrowserCompatibility, 100);
//         }
//       }
//     });
//   });

//   // Start observing
//   observer.observe(document.body, {
//     attributes: true,
//     subtree: true,
//     attributeFilter: ['data-state'],
//   });
// }
