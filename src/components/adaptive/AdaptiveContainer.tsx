// Adaptive Container Component
// Phase 5: Personalization & Memory System - Task 4

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAdaptiveUI } from '@/hooks/useAdaptiveUI';

interface AdaptiveContainerProps {
  componentId: string;
  children: React.ReactNode;
  className?: string;
  trackInteractions?: boolean;
  fallbackVisible?: boolean;
  adaptiveProps?: {
    enableVisibilityAdaptation?: boolean;
    enableSizeAdaptation?: boolean;
    enableStyleAdaptation?: boolean;
    enablePositionAdaptation?: boolean;
  };
}

export function AdaptiveContainer({
  componentId,
  children,
  className,
  trackInteractions = true,
  fallbackVisible = true,
  adaptiveProps = {
    enableVisibilityAdaptation: true,
    enableSizeAdaptation: true,
    enableStyleAdaptation: true,
    enablePositionAdaptation: false
  }
}: AdaptiveContainerProps) {
  const {
    isComponentVisible,
    getAdaptiveClasses,
    trackComponentInteraction
  } = useAdaptiveUI();

  const containerRef = useRef<HTMLDivElement>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout>();

  // Check if component should be visible
  const shouldBeVisible = isComponentVisible(componentId) ?? fallbackVisible;

  // Get adaptive CSS classes
  const adaptiveClasses = getAdaptiveClasses(componentId);

  // Track component mount/unmount
  useEffect(() => {
    if (trackInteractions) {
      trackComponentInteraction(componentId, 'mount');
      
      return () => {
        trackComponentInteraction(componentId, 'unmount');
      };
    }
  }, [componentId, trackInteractions, trackComponentInteraction]);

  // Track component visibility changes
  useEffect(() => {
    if (trackInteractions) {
      trackComponentInteraction(componentId, shouldBeVisible ? 'show' : 'hide');
    }
  }, [shouldBeVisible, componentId, trackInteractions, trackComponentInteraction]);

  // Handle click interactions
  const handleClick = (event: React.MouseEvent) => {
    if (trackInteractions) {
      // Debounce interaction tracking
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      
      interactionTimeoutRef.current = setTimeout(() => {
        trackComponentInteraction(componentId, 'click');
      }, 100);
    }
  };

  // Handle hover interactions
  const handleMouseEnter = () => {
    if (trackInteractions) {
      trackComponentInteraction(componentId, 'hover');
    }
  };

  // Don't render if visibility adaptation is enabled and component should be hidden
  if (adaptiveProps.enableVisibilityAdaptation && !shouldBeVisible) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'adaptive-container',
        adaptiveProps.enableSizeAdaptation && 'adaptive-size-enabled',
        adaptiveProps.enableStyleAdaptation && 'adaptive-style-enabled',
        adaptiveProps.enablePositionAdaptation && 'adaptive-position-enabled',
        adaptiveClasses,
        className
      )}
      data-component-id={componentId}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {children}
    </div>
  );
}

// Higher-order component for adding adaptive behavior to existing components
export function withAdaptiveContainer<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentId: string,
  options?: Partial<AdaptiveContainerProps>
) {
  return function AdaptiveWrappedComponent(props: P) {
    return (
      <AdaptiveContainer componentId={componentId} {...options}>
        <WrappedComponent {...props} />
      </AdaptiveContainer>
    );
  };
}

export default AdaptiveContainer;
