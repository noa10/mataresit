/**
 * Optimized Loading States
 * High-performance loading indicators with smooth animations and minimal re-renders
 */

import React, { memo, useMemo, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Loader2, Search, Brain, Database, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRenderOptimization } from '@/lib/ui-performance-optimizer';

// Loading state types
export type LoadingStage = 
  | 'idle'
  | 'preprocessing' 
  | 'searching' 
  | 'processing' 
  | 'generating' 
  | 'streaming'
  | 'complete'
  | 'error';

// Loading configuration
interface LoadingConfig {
  showProgress: boolean;
  showStageLabels: boolean;
  showEstimatedTime: boolean;
  enableAnimations: boolean;
  minimumDisplayTime: number;
  smoothTransitions: boolean;
}

// Stage information
interface StageInfo {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  estimatedDuration: number;
  color: string;
}

// Progress information
interface ProgressInfo {
  stage: LoadingStage;
  progress: number;
  message: string;
  estimatedTimeRemaining: number;
  startTime: number;
}

// Stage definitions
const STAGE_INFO: Record<LoadingStage, StageInfo> = {
  idle: {
    icon: Search,
    label: 'Ready',
    description: 'Ready to search',
    estimatedDuration: 0,
    color: 'text-muted-foreground'
  },
  preprocessing: {
    icon: Brain,
    label: 'Understanding',
    description: 'Analyzing your query...',
    estimatedDuration: 200,
    color: 'text-blue-500'
  },
  searching: {
    icon: Database,
    label: 'Searching',
    description: 'Searching through your data...',
    estimatedDuration: 1000,
    color: 'text-green-500'
  },
  processing: {
    icon: Zap,
    label: 'Processing',
    description: 'Processing search results...',
    estimatedDuration: 500,
    color: 'text-yellow-500'
  },
  generating: {
    icon: Brain,
    label: 'Generating',
    description: 'Generating intelligent response...',
    estimatedDuration: 800,
    color: 'text-purple-500'
  },
  streaming: {
    icon: Zap,
    label: 'Streaming',
    description: 'Streaming response...',
    estimatedDuration: 300,
    color: 'text-indigo-500'
  },
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    description: 'Search completed successfully',
    estimatedDuration: 0,
    color: 'text-green-600'
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    description: 'An error occurred',
    estimatedDuration: 0,
    color: 'text-red-500'
  }
};

// Optimized progress bar component
const OptimizedProgressBar = memo<{
  progress: number;
  className?: string;
  showPercentage?: boolean;
  animated?: boolean;
}>(({ progress, className, showPercentage = false, animated = true }) => {
  const { elementRef, shouldRender } = useRenderOptimization('progress-bar', 1, 1);

  if (!shouldRender) {
    return <div ref={elementRef} className={cn('h-2 bg-muted rounded-full', className)} />;
  }

  return (
    <div ref={elementRef} className={cn('relative h-2 bg-muted rounded-full overflow-hidden', className)}>
      <motion.div
        className="h-full bg-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        transition={animated ? { duration: 0.3, ease: 'easeOut' } : { duration: 0 }}
      />
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
});

OptimizedProgressBar.displayName = 'OptimizedProgressBar';

// Optimized stage indicator
const StageIndicator = memo<{
  stage: LoadingStage;
  isActive: boolean;
  isCompleted: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}>(({ stage, isActive, isCompleted, showLabel = true, size = 'md' }) => {
  const stageInfo = STAGE_INFO[stage];
  const Icon = stageInfo.icon;
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const { elementRef, shouldRender } = useRenderOptimization(`stage-${stage}`, 1, 1);

  if (!shouldRender) {
    return <div ref={elementRef} className="flex items-center gap-2" />;
  }

  return (
    <motion.div
      ref={elementRef}
      className="flex items-center gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: isActive || isCompleted ? 1 : 0.5,
        scale: isActive ? 1.1 : 1
      }}
      transition={{ duration: 0.2 }}
    >
      <div className={cn(
        'flex items-center justify-center rounded-full border-2 transition-colors',
        isCompleted ? 'bg-green-100 border-green-500' :
        isActive ? 'bg-primary/10 border-primary' : 'bg-muted border-muted-foreground/20'
      )}>
        <Icon className={cn(
          sizeClasses[size],
          isCompleted ? 'text-green-600' :
          isActive ? stageInfo.color : 'text-muted-foreground',
          isActive && 'animate-pulse'
        )} />
      </div>
      {showLabel && (
        <span className={cn(
          'text-sm font-medium transition-colors',
          isActive ? stageInfo.color : 'text-muted-foreground'
        )}>
          {stageInfo.label}
        </span>
      )}
    </motion.div>
  );
});

StageIndicator.displayName = 'StageIndicator';

// Main loading component
interface OptimizedLoadingProps {
  stage: LoadingStage;
  progress?: number;
  message?: string;
  estimatedTimeRemaining?: number;
  config?: Partial<LoadingConfig>;
  className?: string;
  compact?: boolean;
}

export const OptimizedLoading = memo<OptimizedLoadingProps>(({
  stage,
  progress = 0,
  message,
  estimatedTimeRemaining,
  config = {},
  className,
  compact = false
}) => {
  const [displayStartTime] = useState(Date.now());
  const [shouldShow, setShouldShow] = useState(false);

  const loadingConfig: LoadingConfig = {
    showProgress: true,
    showStageLabels: true,
    showEstimatedTime: true,
    enableAnimations: true,
    minimumDisplayTime: 300,
    smoothTransitions: true,
    ...config
  };

  const { elementRef, shouldRender } = useRenderOptimization('optimized-loading', 1, 2);

  // Minimum display time logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldShow(true);
    }, 100); // Small delay to prevent flash

    return () => clearTimeout(timer);
  }, []);

  // Memoized stage progression
  const stageProgression = useMemo(() => {
    const stages: LoadingStage[] = ['preprocessing', 'searching', 'processing', 'generating', 'streaming'];
    const currentIndex = stages.indexOf(stage);
    
    return stages.map((s, index) => ({
      stage: s,
      isActive: s === stage,
      isCompleted: index < currentIndex || stage === 'complete'
    }));
  }, [stage]);

  // Memoized time formatting
  const formattedTime = useMemo(() => {
    if (!estimatedTimeRemaining || !loadingConfig.showEstimatedTime) return null;
    
    if (estimatedTimeRemaining < 1000) {
      return 'Less than a second';
    } else if (estimatedTimeRemaining < 60000) {
      return `${Math.ceil(estimatedTimeRemaining / 1000)} seconds`;
    } else {
      return `${Math.ceil(estimatedTimeRemaining / 60000)} minutes`;
    }
  }, [estimatedTimeRemaining, loadingConfig.showEstimatedTime]);

  if (!shouldShow || !shouldRender || stage === 'idle') {
    return null;
  }

  if (compact) {
    return (
      <div ref={elementRef} className={cn('flex items-center gap-2', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">
          {message || STAGE_INFO[stage].description}
        </span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={elementRef}
        className={cn('space-y-4 p-4 bg-card rounded-lg border', className)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: loadingConfig.smoothTransitions ? 0.3 : 0 }}
      >
        {/* Stage indicators */}
        {loadingConfig.showStageLabels && (
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {stageProgression.map(({ stage: s, isActive, isCompleted }) => (
              <StageIndicator
                key={s}
                stage={s}
                isActive={isActive}
                isCompleted={isCompleted}
                showLabel={!compact}
                size="sm"
              />
            ))}
          </div>
        )}

        {/* Progress bar */}
        {loadingConfig.showProgress && progress > 0 && (
          <OptimizedProgressBar
            progress={progress}
            showPercentage={progress > 10}
            animated={loadingConfig.enableAnimations}
          />
        )}

        {/* Current stage info */}
        <div className="flex items-center gap-3">
          <StageIndicator
            stage={stage}
            isActive={true}
            isCompleted={false}
            showLabel={false}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">
              {STAGE_INFO[stage].label}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {message || STAGE_INFO[stage].description}
            </div>
          </div>
        </div>

        {/* Estimated time */}
        {formattedTime && (
          <div className="text-xs text-muted-foreground text-center">
            Estimated time remaining: {formattedTime}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

OptimizedLoading.displayName = 'OptimizedLoading';

// Skeleton loading components
export const SearchResultSkeleton = memo(() => {
  const { elementRef, shouldRender } = useRenderOptimization('search-skeleton', 1, 1);

  if (!shouldRender) {
    return <div ref={elementRef} className="h-24 bg-muted rounded animate-pulse" />;
  }

  return (
    <div ref={elementRef} className="space-y-3 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-muted rounded animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded animate-pulse" />
        <div className="h-3 bg-muted rounded animate-pulse w-5/6" />
      </div>
    </div>
  );
});

SearchResultSkeleton.displayName = 'SearchResultSkeleton';

export const ChatMessageSkeleton = memo(() => {
  const { elementRef, shouldRender } = useRenderOptimization('chat-skeleton', 1, 1);

  if (!shouldRender) {
    return <div ref={elementRef} className="h-16 bg-muted rounded animate-pulse" />;
  }

  return (
    <div ref={elementRef} className="flex items-start gap-3 p-4">
      <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-1/4" />
        <div className="space-y-1">
          <div className="h-3 bg-muted rounded animate-pulse" />
          <div className="h-3 bg-muted rounded animate-pulse w-4/5" />
          <div className="h-3 bg-muted rounded animate-pulse w-3/5" />
        </div>
      </div>
    </div>
  );
});

ChatMessageSkeleton.displayName = 'ChatMessageSkeleton';

export const ComponentSkeleton = memo<{ height?: number }>(({ height = 100 }) => {
  const { elementRef, shouldRender } = useRenderOptimization('component-skeleton', 1, 1);

  if (!shouldRender) {
    return <div ref={elementRef} className="bg-muted rounded animate-pulse" style={{ height }} />;
  }

  return (
    <div ref={elementRef} className="bg-muted rounded animate-pulse" style={{ height }}>
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted-foreground/20 rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-3 bg-muted-foreground/20 rounded" />
          <div className="h-3 bg-muted-foreground/20 rounded w-5/6" />
        </div>
      </div>
    </div>
  );
});

ComponentSkeleton.displayName = 'ComponentSkeleton';

// Loading state hook
export function useOptimizedLoading(initialStage: LoadingStage = 'idle') {
  const [stage, setStage] = useState<LoadingStage>(initialStage);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);

  const updateStage = useCallback((newStage: LoadingStage, newMessage?: string) => {
    setStage(newStage);
    if (newMessage) setMessage(newMessage);
    if (newStage !== 'idle' && !startTime) {
      setStartTime(Date.now());
    }
  }, [startTime]);

  const updateProgress = useCallback((newProgress: number) => {
    setProgress(Math.min(100, Math.max(0, newProgress)));
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setProgress(0);
    setMessage('');
    setStartTime(null);
  }, []);

  const estimatedTimeRemaining = useMemo(() => {
    if (!startTime || stage === 'idle' || stage === 'complete') return 0;
    
    const elapsed = Date.now() - startTime;
    const stageInfo = STAGE_INFO[stage];
    const estimated = stageInfo.estimatedDuration;
    
    return Math.max(0, estimated - elapsed);
  }, [startTime, stage]);

  return {
    stage,
    progress,
    message,
    estimatedTimeRemaining,
    updateStage,
    updateProgress,
    reset,
    isLoading: stage !== 'idle' && stage !== 'complete' && stage !== 'error'
  };
}
