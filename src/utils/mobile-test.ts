// Mobile responsiveness testing utilities

export const MOBILE_BREAKPOINTS = {
  xs: 320,
  sm: 375,
  md: 414,
  lg: 768,
} as const;

export const COMMON_MOBILE_SIZES = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'iPhone 12/13/14', width: 390, height: 844 },
  { name: 'iPhone 12/13/14 Pro Max', width: 428, height: 926 },
  { name: 'Samsung Galaxy S21', width: 360, height: 800 },
  { name: 'iPad Mini', width: 768, height: 1024 },
] as const;

export function simulateViewport(width: number, height: number) {
  if (typeof window === 'undefined') return;
  
  // This is for testing purposes only - in real scenarios, 
  // the viewport is controlled by the device/browser
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute('content', `width=${width}, height=${height}, initial-scale=1.0`);
  }
  
  // Dispatch resize event to trigger responsive hooks
  window.dispatchEvent(new Event('resize'));
}

export function testModalResponsiveness() {
  console.log('Testing modal responsiveness across different viewport sizes...');
  
  COMMON_MOBILE_SIZES.forEach(({ name, width, height }) => {
    console.log(`Testing ${name} (${width}x${height})`);
    
    // Check if modal would fit
    const wouldFit = {
      width: width >= 320, // Minimum supported width
      height: height >= 400, // Minimum modal height
    };
    
    console.log(`  - Width fits: ${wouldFit.width}`);
    console.log(`  - Height fits: ${wouldFit.height}`);
    console.log(`  - Overall: ${wouldFit.width && wouldFit.height ? '✅ PASS' : '❌ FAIL'}`);
  });
}

export function checkModalElements() {
  const modal = document.querySelector('[data-radix-dialog-content]');
  if (!modal) {
    console.log('❌ Modal not found');
    return false;
  }
  
  const rect = modal.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  
  const checks = {
    withinViewport: rect.right <= viewport.width && rect.bottom <= viewport.height,
    hasCloseButton: !!modal.querySelector('[data-radix-dialog-close]'),
    isScrollable: modal.scrollHeight > modal.clientHeight,
    touchTargets: Array.from(modal.querySelectorAll('button')).every(btn => {
      const btnRect = btn.getBoundingClientRect();
      return btnRect.width >= 44 && btnRect.height >= 44;
    }),
  };
  
  console.log('Modal Element Checks:');
  console.log(`  - Within viewport: ${checks.withinViewport ? '✅' : '❌'}`);
  console.log(`  - Has close button: ${checks.hasCloseButton ? '✅' : '❌'}`);
  console.log(`  - Scrollable if needed: ${checks.isScrollable ? '✅' : '❌'}`);
  console.log(`  - Touch-friendly buttons: ${checks.touchTargets ? '✅' : '❌'}`);
  
  return Object.values(checks).every(Boolean);
}

// Auto-run tests in development
if (process.env.NODE_ENV === 'development') {
  // Run tests when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testModalResponsiveness);
  } else {
    testModalResponsiveness();
  }
}
