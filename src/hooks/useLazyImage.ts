import { useState, useEffect, useRef, useCallback } from 'react';
import { getFormattedImageUrl, retryImageLoad } from '@/utils/imageUtils';
import { imagePerformanceMonitor } from '@/utils/imagePerformance';

// Image optimization options interface
interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  resize?: 'cover' | 'contain' | 'fill';
}

interface UseLazyImageOptions {
  /** Image optimization options */
  optimization?: ImageOptimizationOptions;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
  /** Enable retry logic for failed loads */
  enableRetry?: boolean;
  /** Placeholder image URL */
  placeholder?: string;
  /** Enable blur-up effect */
  enableBlurUp?: boolean;
  /** Preload image when near viewport */
  preloadDistance?: string;
}

interface UseLazyImageReturn {
  /** Image source URL */
  src: string;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  hasError: boolean;
  /** Whether image is in viewport */
  isInView: boolean;
  /** Ref to attach to image element */
  ref: React.RefObject<HTMLImageElement>;
  /** Retry loading the image */
  retry: () => void;
  /** Force load the image */
  forceLoad: () => void;
}

export function useLazyImage(
  imageUrl: string | undefined,
  options: UseLazyImageOptions = {}
): UseLazyImageReturn {
  const {
    optimization = {},
    rootMargin = '50px',
    threshold = 0.1,
    enableRetry = true,
    placeholder = '/placeholder.svg',
    enableBlurUp = true,
    preloadDistance = '200px'
  } = options;

  const [src, setSrc] = useState<string>(placeholder);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Load image function
  const loadImage = useCallback(async () => {
    if (!imageUrl || src !== placeholder) return;

    const startTime = performance.now();
    setIsLoading(true);
    setHasError(false);

    try {
      console.log('🖼️ Lazy loading image:', imageUrl);
      const formattedUrl = await getFormattedImageUrl(imageUrl, optimization);

      if (formattedUrl === placeholder) {
        setHasError(true);
        setIsLoading(false);
        // Record failed load
        imagePerformanceMonitor.recordMetric({
          url: imageUrl,
          loadTime: performance.now() - startTime,
          success: false,
          retryCount: 0,
          cacheHit: false,
          optimizationUsed: Object.keys(optimization).length > 0,
          lazyLoaded: true
        });
        return;
      }

      // Test image loading with retry if enabled
      if (enableRetry) {
        const loadSuccess = await retryImageLoad(formattedUrl);
        if (!loadSuccess) {
          setHasError(true);
          setIsLoading(false);
          // Record failed load
          imagePerformanceMonitor.recordMetric({
            url: imageUrl,
            loadTime: performance.now() - startTime,
            success: false,
            retryCount: 3, // Max retries attempted
            cacheHit: false,
            optimizationUsed: Object.keys(optimization).length > 0,
            lazyLoaded: true
          });
          return;
        }
      }

      // Create blur-up effect if enabled
      if (enableBlurUp && formattedUrl !== placeholder) {
        // Load a small blurred version first
        const blurUrl = await getFormattedImageUrl(imageUrl, {
          ...optimization,
          width: 20,
          quality: 20
        });
        setSrc(blurUrl);

        // Then load the full image
        setTimeout(() => {
          setSrc(formattedUrl);
          setIsLoading(false);
          // Record successful load
          imagePerformanceMonitor.recordMetric({
            url: imageUrl,
            loadTime: performance.now() - startTime,
            success: true,
            retryCount: 0,
            cacheHit: false,
            optimizationUsed: Object.keys(optimization).length > 0,
            lazyLoaded: true
          });
        }, 100);
      } else {
        setSrc(formattedUrl);
        setIsLoading(false);
        // Record successful load
        imagePerformanceMonitor.recordMetric({
          url: imageUrl,
          loadTime: performance.now() - startTime,
          success: true,
          retryCount: 0,
          cacheHit: false,
          optimizationUsed: Object.keys(optimization).length > 0,
          lazyLoaded: true
        });
      }
    } catch (error) {
      console.error('Error loading lazy image:', error);
      setHasError(true);
      setIsLoading(false);
      // Record failed load
      imagePerformanceMonitor.recordMetric({
        url: imageUrl,
        loadTime: performance.now() - startTime,
        success: false,
        retryCount: 0,
        cacheHit: false,
        optimizationUsed: Object.keys(optimization).length > 0,
        lazyLoaded: true
      });
    }
  }, [imageUrl, optimization, enableRetry, enableBlurUp, placeholder, src]);

  // Retry function
  const retry = useCallback(() => {
    setSrc(placeholder);
    setHasError(false);
    loadImage();
  }, [loadImage, placeholder]);

  // Force load function
  const forceLoad = useCallback(() => {
    setShouldLoad(true);
  }, []);

  // Set up intersection observer
  useEffect(() => {
    const currentRef = imgRef.current;
    if (!currentRef) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            setShouldLoad(true);
            // Stop observing once in view
            if (observerRef.current) {
              observerRef.current.unobserve(entry.target);
            }
          }
        });
      },
      {
        rootMargin: preloadDistance,
        threshold
      }
    );

    observerRef.current.observe(currentRef);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [preloadDistance, threshold]);

  // Load image when should load
  useEffect(() => {
    if (shouldLoad && imageUrl) {
      loadImage();
    }
  }, [shouldLoad, imageUrl, loadImage]);

  return {
    src,
    isLoading,
    hasError,
    isInView,
    ref: imgRef,
    retry,
    forceLoad
  };
}

/**
 * Hook for immediate image loading (non-lazy) with optimization
 */
export function useOptimizedImage(
  imageUrl: string | undefined,
  options: Omit<UseLazyImageOptions, 'rootMargin' | 'threshold' | 'preloadDistance'> = {}
): Omit<UseLazyImageReturn, 'isInView' | 'forceLoad'> {
  const {
    optimization = {},
    enableRetry = true,
    placeholder = '/placeholder.svg',
    enableBlurUp = false
  } = options;

  const [src, setSrc] = useState<string>(placeholder);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  // Load image function
  const loadImage = useCallback(async () => {
    if (!imageUrl) return;

    setIsLoading(true);
    setHasError(false);

    try {
      console.log('🖼️ Loading optimized image:', imageUrl);
      const formattedUrl = await getFormattedImageUrl(imageUrl, optimization);

      if (formattedUrl === placeholder) {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      // Test image loading with retry if enabled
      if (enableRetry) {
        const loadSuccess = await retryImageLoad(formattedUrl);
        if (!loadSuccess) {
          setHasError(true);
          setIsLoading(false);
          return;
        }
      }

      setSrc(formattedUrl);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading optimized image:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [imageUrl, optimization, enableRetry, placeholder]);

  // Retry function
  const retry = useCallback(() => {
    setSrc(placeholder);
    setHasError(false);
    loadImage();
  }, [loadImage, placeholder]);

  // Load image on mount or when imageUrl changes
  useEffect(() => {
    if (imageUrl) {
      loadImage();
    }
  }, [imageUrl, loadImage]);

  return {
    src,
    isLoading,
    hasError,
    ref: imgRef,
    retry
  };
}
