import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Browser compatibility utilities
function isMatchMediaSupported(): boolean {
  return typeof window !== 'undefined' &&
         'matchMedia' in window &&
         typeof window.matchMedia === 'function'
}

function addEventListenerSafe(
  target: MediaQueryList,
  event: string,
  handler: () => void
): () => void {
  // Handle both modern and legacy APIs
  if ('addEventListener' in target) {
    target.addEventListener(event, handler)
    return () => target.removeEventListener(event, handler)
  } else if ('addListener' in target) {
    // Legacy API for older browsers
    target.addListener(handler)
    return () => target.removeListener(handler)
  }

  // Fallback for browsers without matchMedia support
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const updateMobile = () => {
      if (typeof window === 'undefined') return
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Initial check
    updateMobile()

    // Set up media query listener if supported
    if (isMatchMediaSupported()) {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      const cleanup = addEventListenerSafe(mql, 'change', updateMobile)
      return cleanup
    } else {
      // Fallback to resize listener for older browsers
      window.addEventListener('resize', updateMobile)
      return () => window.removeEventListener('resize', updateMobile)
    }
  }, [])

  return !!isMobile
}
