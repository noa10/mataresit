// Cross-browser compatibility utilities

export interface BrowserSupport {
  hasSelector: boolean;
  visualViewport: boolean;
  dvhUnits: boolean;
  matchMedia: boolean;
  orientationChange: boolean;
  touchEvents: boolean;
  cssGrid: boolean;
  flexbox: boolean;
}

// Feature detection functions
export function detectBrowserSupport(): BrowserSupport {
  if (typeof window === 'undefined') {
    return {
      hasSelector: false,
      visualViewport: false,
      dvhUnits: false,
      matchMedia: false,
      orientationChange: false,
      touchEvents: false,
      cssGrid: false,
      flexbox: false,
    };
  }

  return {
    hasSelector: supportsHasSelector(),
    visualViewport: supportsVisualViewport(),
    dvhUnits: supportsDvhUnits(),
    matchMedia: supportsMatchMedia(),
    orientationChange: supportsOrientationChange(),
    touchEvents: supportsTouchEvents(),
    cssGrid: supportsCssGrid(),
    flexbox: supportsFlexbox(),
  };
}

// Individual feature detection functions
export function supportsHasSelector(): boolean {
  if (typeof window === 'undefined' || !window.CSS) return false;
  try {
    return window.CSS.supports('selector(:has(*))');
  } catch {
    return false;
  }
}

export function supportsVisualViewport(): boolean {
  return typeof window !== 'undefined' && 'visualViewport' in window;
}

export function supportsDvhUnits(): boolean {
  if (typeof window === 'undefined' || !window.CSS) return false;
  try {
    return window.CSS.supports('height', '100dvh');
  } catch {
    return false;
  }
}

export function supportsMatchMedia(): boolean {
  return typeof window !== 'undefined' && 
         'matchMedia' in window && 
         typeof window.matchMedia === 'function';
}

export function supportsOrientationChange(): boolean {
  return typeof window !== 'undefined' && 'orientation' in window;
}

export function supportsTouchEvents(): boolean {
  return typeof window !== 'undefined' && 
         ('ontouchstart' in window || 
          (window.navigator && window.navigator.maxTouchPoints > 0));
}

export function supportsCssGrid(): boolean {
  if (typeof window === 'undefined' || !window.CSS) return false;
  try {
    return window.CSS.supports('display', 'grid');
  } catch {
    return false;
  }
}

export function supportsFlexbox(): boolean {
  if (typeof window === 'undefined' || !window.CSS) return false;
  try {
    return window.CSS.supports('display', 'flex');
  } catch {
    return false;
  }
}

// Browser detection utilities
export function getBrowserInfo() {
  if (typeof window === 'undefined') return { name: 'unknown', version: 'unknown' };

  const userAgent = window.navigator.userAgent;
  
  // Chrome
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return { name: 'chrome', version: match ? match[1] : 'unknown' };
  }
  
  // Firefox
  if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    return { name: 'firefox', version: match ? match[1] : 'unknown' };
  }
  
  // Safari
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+)/);
    return { name: 'safari', version: match ? match[1] : 'unknown' };
  }
  
  // Edge
  if (userAgent.includes('Edg')) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return { name: 'edge', version: match ? match[1] : 'unknown' };
  }
  
  return { name: 'unknown', version: 'unknown' };
}

// Viewport utilities with cross-browser support
export function getViewportDimensions() {
  if (typeof window === 'undefined') return { width: 0, height: 0 };

  // Try visual viewport first (most accurate on mobile)
  if (supportsVisualViewport() && window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
    };
  }

  // Fallback to window dimensions
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

// Safe event listener utilities
export function addEventListenerSafe(
  target: EventTarget | MediaQueryList,
  event: string,
  handler: EventListener | (() => void),
  options?: AddEventListenerOptions | boolean
): () => void {
  if ('addEventListener' in target) {
    target.addEventListener(event, handler as EventListener, options);
    return () => target.removeEventListener(event, handler as EventListener, options);
  } else if ('addListener' in target && typeof target.addListener === 'function') {
    // Legacy MediaQueryList API
    target.addListener(handler as () => void);
    return () => (target as any).removeListener(handler);
  }
  
  // Fallback - no cleanup possible
  return () => {};
}

// CSS class utilities for cross-browser compatibility
export function addCrossBrowserClass(element: HTMLElement, className: string) {
  if (element.classList) {
    element.classList.add(className);
  } else {
    // IE9 fallback
    element.className += ` ${className}`;
  }
}

export function removeCrossBrowserClass(element: HTMLElement, className: string) {
  if (element.classList) {
    element.classList.remove(className);
  } else {
    // IE9 fallback
    element.className = element.className.replace(new RegExp(`\\b${className}\\b`, 'g'), '');
  }
}

// Polyfill utilities
export function polyfillInert() {
  // Note: Inert polyfill removed to avoid dependency issues
  // The modal functionality works without this polyfill
  // If inert support is needed, install 'wicg-inert' package manually
  if (typeof window !== 'undefined' && !('inert' in HTMLElement.prototype)) {
    console.info('Inert attribute not supported in this browser. Consider adding wicg-inert polyfill if needed.');
  }
}

// Debug utilities
export function logBrowserSupport() {
  if (process.env.NODE_ENV === 'development') {
    const support = detectBrowserSupport();
    const browser = getBrowserInfo();
    
    console.group('Browser Compatibility Report');
    console.log('Browser:', browser);
    console.log('Feature Support:', support);
    console.groupEnd();
  }
}

// Initialize browser compatibility on load - disabled by default
// Uncomment to enable automatic browser compatibility logging:
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   window.addEventListener('load', logBrowserSupport);
// }
