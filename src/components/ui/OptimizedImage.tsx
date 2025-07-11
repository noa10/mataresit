import React from 'react';
import { cn } from '@/lib/utils';
import { useLazyImage, useOptimizedImage } from '@/hooks/useLazyImage';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Image optimization options interface
interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  resize?: 'cover' | 'contain' | 'fill';
}

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Image URL */
  src: string | undefined;
  /** Alt text */
  alt: string;
  /** Enable lazy loading */
  lazy?: boolean;
  /** Image optimization options */
  optimization?: ImageOptimizationOptions;
  /** Show loading skeleton */
  showSkeleton?: boolean;
  /** Show error state with retry button */
  showErrorState?: boolean;
  /** Custom placeholder */
  placeholder?: string;
  /** Enable blur-up effect */
  enableBlurUp?: boolean;
  /** Container class name */
  containerClassName?: string;
  /** Loading skeleton class name */
  skeletonClassName?: string;
  /** Error state class name */
  errorClassName?: string;
  /** Preload distance for lazy loading */
  preloadDistance?: string;
  /** Enable retry logic */
  enableRetry?: boolean;
}

/**
 * Skeleton loading component
 */
function ImageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      "animate-pulse bg-muted rounded-md flex items-center justify-center",
      className
    )}>
      <div className="w-8 h-8 bg-muted-foreground/20 rounded-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
      </div>
    </div>
  );
}

/**
 * Error state component
 */
function ImageError({ 
  onRetry, 
  className,
  alt 
}: { 
  onRetry: () => void;
  className?: string;
  alt: string;
}) {
  return (
    <div className={cn(
      "bg-muted rounded-md flex flex-col items-center justify-center p-4 text-center",
      className
    )}>
      <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
      <p className="text-sm text-muted-foreground mb-2">
        Failed to load image
      </p>
      <p className="text-xs text-muted-foreground/70 mb-3 break-all">
        {alt}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="h-8 px-3"
      >
        <RefreshCw className="w-3 h-3 mr-1" />
        Retry
      </Button>
    </div>
  );
}

/**
 * Optimized Image Component with lazy loading, skeleton states, and error handling
 */
export const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(({
  src,
  alt,
  lazy = true,
  optimization = {},
  showSkeleton = true,
  showErrorState = true,
  placeholder = '/placeholder.svg',
  enableBlurUp = true,
  containerClassName,
  skeletonClassName,
  errorClassName,
  preloadDistance = '200px',
  enableRetry = true,
  className,
  ...props
}, forwardedRef) => {
  // Use appropriate hook based on lazy loading preference
  const imageHook = lazy 
    ? useLazyImage(src, {
        optimization,
        placeholder,
        enableBlurUp,
        preloadDistance,
        enableRetry
      })
    : useOptimizedImage(src, {
        optimization,
        placeholder,
        enableBlurUp,
        enableRetry
      });

  const {
    src: imageSrc,
    isLoading,
    hasError,
    ref: hookRef,
    retry
  } = imageHook;

  // Show skeleton while loading
  if (isLoading && showSkeleton) {
    return (
      <div className={containerClassName}>
        <ImageSkeleton className={cn(className, skeletonClassName)} />
      </div>
    );
  }

  // Show error state
  if (hasError && showErrorState) {
    return (
      <div className={containerClassName}>
        <ImageError 
          onRetry={retry}
          className={cn(className, errorClassName)}
          alt={alt}
        />
      </div>
    );
  }

  // Combine refs - use forwardedRef if provided, otherwise use hookRef
  const combinedRef = forwardedRef || hookRef;

  // Render image
  return (
    <div className={containerClassName}>
      <img
        ref={combinedRef}
        src={imageSrc}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-50" : "opacity-100",
          enableBlurUp && isLoading ? "filter blur-sm" : "",
          className
        )}
        onError={() => {
          console.error('Image failed to load:', src);
        }}
        {...props}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

/**
 * Preset configurations for common use cases
 */
export const ImagePresets = {
  /** Receipt card thumbnail */
  receiptCard: {
    optimization: {
      width: 400,
      height: 300,
      quality: 80,
      format: 'webp' as const,
      resize: 'cover' as const
    },
    lazy: true,
    enableBlurUp: true,
    showSkeleton: true
  },

  /** Receipt viewer (full size) */
  receiptViewer: {
    optimization: {
      width: 1200,
      quality: 90,
      format: 'webp' as const
    },
    lazy: false, // Critical image, load immediately
    enableBlurUp: false,
    showSkeleton: true
  },

  /** Receipt picker thumbnail */
  receiptPicker: {
    optimization: {
      width: 200,
      height: 150,
      quality: 75,
      format: 'webp' as const,
      resize: 'cover' as const
    },
    lazy: true,
    enableBlurUp: true,
    showSkeleton: true
  },

  /** Receipt preview */
  receiptPreview: {
    optimization: {
      width: 300,
      height: 200,
      quality: 80,
      format: 'webp' as const,
      resize: 'cover' as const
    },
    lazy: true,
    enableBlurUp: true,
    showSkeleton: true
  }
};

/**
 * Convenience components for common use cases
 */
export function ReceiptCardImage(props: Omit<OptimizedImageProps, keyof typeof ImagePresets.receiptCard>) {
  return <OptimizedImage {...ImagePresets.receiptCard} {...props} />;
}

export const ReceiptViewerImage = React.forwardRef<HTMLImageElement, Omit<OptimizedImageProps, keyof typeof ImagePresets.receiptViewer>>((props, ref) => {
  return <OptimizedImage {...ImagePresets.receiptViewer} {...props} ref={ref} />;
});

ReceiptViewerImage.displayName = 'ReceiptViewerImage';

export function ReceiptPickerImage(props: Omit<OptimizedImageProps, keyof typeof ImagePresets.receiptPicker>) {
  return <OptimizedImage {...ImagePresets.receiptPicker} {...props} />;
}

export function ReceiptPreviewImage(props: Omit<OptimizedImageProps, keyof typeof ImagePresets.receiptPreview>) {
  return <OptimizedImage {...ImagePresets.receiptPreview} {...props} />;
}
