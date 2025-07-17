/**
 * Optimized Animation System
 * High-performance animations with reduced motion support and intelligent frame management
 */

import { Variants, Transition, MotionProps } from 'framer-motion';

// Animation performance configuration
interface AnimationConfig {
  enableAnimations: boolean;
  respectReducedMotion: boolean;
  enableGPUAcceleration: boolean;
  maxConcurrentAnimations: number;
  frameThrottleMs: number;
  enableWillChange: boolean;
}

// Animation presets for common UI patterns
export const ANIMATION_PRESETS = {
  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2, ease: 'easeOut' }
  },

  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },

  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },

  // Scale animations
  scaleIn: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { duration: 0.2, ease: 'easeOut' }
  },

  scaleInBounce: {
    initial: { opacity: 0, scale: 0.3 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.3 },
    transition: { 
      duration: 0.4, 
      ease: [0.175, 0.885, 0.32, 1.275] // Custom bounce easing
    }
  },

  // Slide animations
  slideInLeft: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },

  slideInRight: {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },

  // List animations
  staggerChildren: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  },

  listItem: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.2, ease: 'easeOut' }
  },

  // Loading animations
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  },

  spin: {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  },

  // Progress animations
  progressBar: {
    initial: { scaleX: 0, originX: 0 },
    animate: { scaleX: 1 },
    transition: { duration: 0.5, ease: 'easeOut' }
  },

  // Hover animations
  hoverScale: {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: { duration: 0.1, ease: 'easeOut' }
  },

  hoverLift: {
    whileHover: { y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
    transition: { duration: 0.2, ease: 'easeOut' }
  }
};

// Reduced motion variants
const REDUCED_MOTION_PRESETS = Object.fromEntries(
  Object.entries(ANIMATION_PRESETS).map(([key, preset]) => [
    key,
    {
      ...preset,
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.1 }
    }
  ])
);

class OptimizedAnimationManager {
  private config: AnimationConfig = {
    enableAnimations: true,
    respectReducedMotion: true,
    enableGPUAcceleration: true,
    maxConcurrentAnimations: 10,
    frameThrottleMs: 16,
    enableWillChange: true
  };

  private activeAnimations = new Set<string>();
  private animationQueue: Array<{ id: string; callback: () => void }> = [];
  private isProcessingQueue = false;

  constructor() {
    this.detectReducedMotion();
  }

  /**
   * Detect user's reduced motion preference
   */
  private detectReducedMotion(): void {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      
      const handleChange = () => {
        if (this.config.respectReducedMotion) {
          this.config.enableAnimations = !mediaQuery.matches;
        }
      };

      handleChange();
      mediaQuery.addEventListener('change', handleChange);
    }
  }

  /**
   * Get optimized animation preset
   */
  getPreset(presetName: keyof typeof ANIMATION_PRESETS): MotionProps {
    const useReducedMotion = !this.config.enableAnimations;
    const presets = useReducedMotion ? REDUCED_MOTION_PRESETS : ANIMATION_PRESETS;
    
    const preset = presets[presetName] || ANIMATION_PRESETS.fadeIn;
    
    // Add GPU acceleration if enabled
    if (this.config.enableGPUAcceleration) {
      return {
        ...preset,
        style: {
          willChange: this.config.enableWillChange ? 'transform, opacity' : 'auto',
          transform: 'translateZ(0)', // Force GPU layer
          ...preset.style
        }
      };
    }

    return preset;
  }

  /**
   * Create optimized stagger animation
   */
  createStaggerAnimation(
    itemCount: number,
    staggerDelay: number = 0.1,
    maxStagger: number = 1
  ): Variants {
    const actualStagger = Math.min(staggerDelay, maxStagger / itemCount);
    
    return {
      animate: {
        transition: {
          staggerChildren: actualStagger,
          delayChildren: 0.1
        }
      }
    };
  }

  /**
   * Create optimized transition
   */
  createTransition(
    duration: number = 0.3,
    ease: string | number[] = 'easeOut',
    delay: number = 0
  ): Transition {
    if (!this.config.enableAnimations) {
      return { duration: 0.1 };
    }

    return {
      duration,
      ease,
      delay
    };
  }

  /**
   * Schedule animation with concurrency control
   */
  scheduleAnimation(id: string, animationCallback: () => void): void {
    // If we're at the limit, queue the animation
    if (this.activeAnimations.size >= this.config.maxConcurrentAnimations) {
      this.animationQueue.push({ id, callback: animationCallback });
      return;
    }

    this.executeAnimation(id, animationCallback);
  }

  /**
   * Execute animation immediately
   */
  private executeAnimation(id: string, animationCallback: () => void): void {
    this.activeAnimations.add(id);
    
    try {
      animationCallback();
    } catch (error) {
      console.error(`Animation error for ${id}:`, error);
    }

    // Clean up after animation completes
    setTimeout(() => {
      this.activeAnimations.delete(id);
      this.processAnimationQueue();
    }, 1000); // Assume max animation duration
  }

  /**
   * Process queued animations
   */
  private processAnimationQueue(): void {
    if (this.isProcessingQueue || this.animationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (
      this.animationQueue.length > 0 && 
      this.activeAnimations.size < this.config.maxConcurrentAnimations
    ) {
      const { id, callback } = this.animationQueue.shift()!;
      this.executeAnimation(id, callback);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Create performance-optimized variants for lists
   */
  createListVariants(itemCount: number): {
    container: Variants;
    item: Variants;
  } {
    const staggerDelay = Math.min(0.1, 1 / itemCount); // Adaptive stagger

    return {
      container: {
        animate: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1
          }
        }
      },
      item: this.config.enableAnimations ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.2, ease: 'easeOut' }
      } : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.1 }
      }
    };
  }

  /**
   * Create optimized loading animation
   */
  createLoadingAnimation(type: 'pulse' | 'spin' | 'bounce' = 'pulse'): MotionProps {
    if (!this.config.enableAnimations) {
      return { animate: {} };
    }

    const animations = {
      pulse: {
        animate: {
          scale: [1, 1.05, 1],
          transition: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }
        }
      },
      spin: {
        animate: {
          rotate: 360,
          transition: {
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      },
      bounce: {
        animate: {
          y: [0, -10, 0],
          transition: {
            duration: 0.6,
            repeat: Infinity,
            ease: 'easeInOut'
          }
        }
      }
    };

    return animations[type];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AnimationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get animation statistics
   */
  getStats(): {
    activeAnimations: number;
    queuedAnimations: number;
    animationsEnabled: boolean;
    reducedMotionDetected: boolean;
  } {
    return {
      activeAnimations: this.activeAnimations.size,
      queuedAnimations: this.animationQueue.length,
      animationsEnabled: this.config.enableAnimations,
      reducedMotionDetected: typeof window !== 'undefined' ? 
        window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
    };
  }

  /**
   * Clear all animations
   */
  clearAnimations(): void {
    this.activeAnimations.clear();
    this.animationQueue = [];
  }
}

// Export singleton instance
export const optimizedAnimationManager = new OptimizedAnimationManager();

// React hooks for optimized animations
export function useOptimizedAnimation(presetName: keyof typeof ANIMATION_PRESETS) {
  return optimizedAnimationManager.getPreset(presetName);
}

export function useStaggerAnimation(itemCount: number, staggerDelay: number = 0.1) {
  return optimizedAnimationManager.createListVariants(itemCount);
}

export function useLoadingAnimation(type: 'pulse' | 'spin' | 'bounce' = 'pulse') {
  return optimizedAnimationManager.createLoadingAnimation(type);
}

export function useAnimationScheduler() {
  return {
    scheduleAnimation: optimizedAnimationManager.scheduleAnimation.bind(optimizedAnimationManager),
    getStats: optimizedAnimationManager.getStats.bind(optimizedAnimationManager)
  };
}

// Utility functions for common animation patterns
export const createEntranceAnimation = (delay: number = 0): MotionProps => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: optimizedAnimationManager.createTransition(0.3, 'easeOut', delay)
});

export const createExitAnimation = (): MotionProps => ({
  exit: { opacity: 0, y: -20 },
  transition: optimizedAnimationManager.createTransition(0.2, 'easeIn')
});

export const createHoverAnimation = (): MotionProps => ({
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: optimizedAnimationManager.createTransition(0.1, 'easeOut')
});

// Performance-optimized animation variants
export const OPTIMIZED_VARIANTS = {
  // Fast animations for frequent updates
  fastFade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.1 }
  },

  // Smooth animations for important transitions
  smoothSlide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  },

  // Minimal animations for reduced motion
  minimal: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 }
  }
};

export type { AnimationConfig };
