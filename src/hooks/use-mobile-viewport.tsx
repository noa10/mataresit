import { useState, useEffect, useCallback } from 'react';

interface ViewportSize {
  width: number;
  height: number;
  isMobile: boolean;
  isLandscape: boolean;
}

// Browser compatibility utilities
function getViewportHeight(): number {
  if (typeof window === 'undefined') return 0;

  // Try different methods to get accurate viewport height
  if ('visualViewport' in window && window.visualViewport) {
    return window.visualViewport.height;
  }

  // Fallback to window.innerHeight
  return window.innerHeight;
}

function getViewportWidth(): number {
  if (typeof window === 'undefined') return 0;

  // Try different methods to get accurate viewport width
  if ('visualViewport' in window && window.visualViewport) {
    return window.visualViewport.width;
  }

  // Fallback to window.innerWidth
  return window.innerWidth;
}

function isOrientationChangeSupported(): boolean {
  return typeof window !== 'undefined' && 'orientation' in window;
}

export function useMobileViewport(): ViewportSize {
  const [viewport, setViewport] = useState<ViewportSize>({
    width: getViewportWidth(),
    height: getViewportHeight(),
    isMobile: getViewportWidth() < 768,
    isLandscape: getViewportWidth() > getViewportHeight(),
  });

  const updateViewport = useCallback(() => {
    const width = getViewportWidth();
    const height = getViewportHeight();

    setViewport({
      width,
      height,
      isMobile: width < 768,
      isLandscape: width > height,
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Debounce function to prevent excessive updates
    let timeoutId: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateViewport, 16); // ~60fps
    };

    // Update on resize
    window.addEventListener('resize', debouncedUpdate, { passive: true });

    // Update on orientation change (mobile) with cross-browser support
    if (isOrientationChangeSupported()) {
      const handleOrientationChange = () => {
        // Multiple timeouts to handle different browser behaviors
        setTimeout(updateViewport, 100);
        setTimeout(updateViewport, 300);
        setTimeout(updateViewport, 500);
      };

      window.addEventListener('orientationchange', handleOrientationChange, { passive: true });

      // Also listen for screen orientation API if available
      if ('screen' in window && 'orientation' in window.screen) {
        window.screen.orientation?.addEventListener('change', handleOrientationChange);
      }
    }

    // Visual viewport API support for better mobile handling
    if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.addEventListener('resize', debouncedUpdate, { passive: true });
    }

    // Initial update
    updateViewport();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedUpdate);

      if (isOrientationChangeSupported()) {
        window.removeEventListener('orientationchange', updateViewport);

        if ('screen' in window && 'orientation' in window.screen) {
          window.screen.orientation?.removeEventListener('change', updateViewport);
        }
      }

      if ('visualViewport' in window && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', debouncedUpdate);
      }
    };
  }, [updateViewport]);

  return viewport;
}

// Hook to get safe area insets for mobile devices
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      if (typeof window !== 'undefined' && 'CSS' in window && CSS.supports('padding-top: env(safe-area-inset-top)')) {
        const computedStyle = getComputedStyle(document.documentElement);
        
        setInsets({
          top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
          bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
          left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0'),
          right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
        });
      }
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, []);

  return insets;
}
