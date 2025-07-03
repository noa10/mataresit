/**
 * Progressive Loading Hook
 * Manages progressive loading states and staged data display
 */

import { useState, useEffect, useCallback } from 'react';

export interface LoadingStage {
  id: string;
  label: string;
  completed: boolean;
  duration: number;
  data?: any;
}

export interface ProgressiveLoadingOptions {
  stages: Omit<LoadingStage, 'completed'>[];
  autoProgress?: boolean;
  onStageComplete?: (stageId: string, data?: any) => void;
  onAllComplete?: () => void;
}

export interface ProgressiveLoadingState {
  currentStage: number;
  stages: LoadingStage[];
  isLoading: boolean;
  isComplete: boolean;
  progress: number;
}

export function useProgressiveLoading(options: ProgressiveLoadingOptions) {
  const { stages: initialStages, autoProgress = true, onStageComplete, onAllComplete } = options;

  const [state, setState] = useState<ProgressiveLoadingState>({
    currentStage: 0,
    stages: initialStages.map(stage => ({ ...stage, completed: false })),
    isLoading: false,
    isComplete: false,
    progress: 0,
  });

  // Start the progressive loading process
  const start = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      isComplete: false,
      currentStage: 0,
      stages: prev.stages.map(stage => ({ ...stage, completed: false })),
      progress: 0,
    }));
  }, []);

  // Complete a specific stage
  const completeStage = useCallback((stageId: string, data?: any) => {
    setState(prev => {
      const stageIndex = prev.stages.findIndex(s => s.id === stageId);
      if (stageIndex === -1) return prev;

      const newStages = [...prev.stages];
      newStages[stageIndex] = { ...newStages[stageIndex], completed: true, data };

      const completedCount = newStages.filter(s => s.completed).length;
      const progress = (completedCount / newStages.length) * 100;
      const isComplete = completedCount === newStages.length;

      // Move to next stage if auto-progressing
      let nextStage = prev.currentStage;
      if (autoProgress && stageIndex === prev.currentStage && !isComplete) {
        nextStage = Math.min(prev.currentStage + 1, newStages.length - 1);
      }

      // Call callbacks
      if (onStageComplete) {
        onStageComplete(stageId, data);
      }

      if (isComplete && onAllComplete) {
        onAllComplete();
      }

      return {
        ...prev,
        stages: newStages,
        currentStage: nextStage,
        progress,
        isComplete,
        isLoading: !isComplete,
      };
    });
  }, [autoProgress, onStageComplete, onAllComplete]);

  // Complete all stages
  const completeAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      stages: prev.stages.map(stage => ({ ...stage, completed: true })),
      currentStage: prev.stages.length - 1,
      progress: 100,
      isComplete: true,
      isLoading: false,
    }));

    if (onAllComplete) {
      onAllComplete();
    }
  }, [onAllComplete]);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      currentStage: 0,
      stages: initialStages.map(stage => ({ ...stage, completed: false })),
      isLoading: false,
      isComplete: false,
      progress: 0,
    });
  }, [initialStages]);

  // Auto-progress through stages with delays
  useEffect(() => {
    if (!state.isLoading || !autoProgress) return;

    const currentStageData = state.stages[state.currentStage];
    if (!currentStageData || currentStageData.completed) return;

    const timer = setTimeout(() => {
      completeStage(currentStageData.id);
    }, currentStageData.duration);

    return () => clearTimeout(timer);
  }, [state.isLoading, state.currentStage, autoProgress, completeStage, state.stages]);

  // Get current stage data
  const getCurrentStage = useCallback(() => {
    return state.stages[state.currentStage] || null;
  }, [state.stages, state.currentStage]);

  // Get completed stages data
  const getCompletedData = useCallback(() => {
    return state.stages
      .filter(stage => stage.completed && stage.data)
      .reduce((acc, stage) => {
        acc[stage.id] = stage.data;
        return acc;
      }, {} as Record<string, any>);
  }, [state.stages]);

  // Check if a specific stage is completed
  const isStageCompleted = useCallback((stageId: string) => {
    return state.stages.find(s => s.id === stageId)?.completed || false;
  }, [state.stages]);

  return {
    ...state,
    start,
    completeStage,
    completeAll,
    reset,
    getCurrentStage,
    getCompletedData,
    isStageCompleted,
  };
}

/**
 * Predefined loading stages for common use cases
 */
export const COMMON_LOADING_STAGES = {
  usageStats: [
    { id: 'basic', label: 'Loading basic stats', duration: 300 },
    { id: 'usage', label: 'Calculating usage', duration: 500 },
    { id: 'analytics', label: 'Preparing analytics', duration: 800 },
  ],
  
  receipts: [
    { id: 'fetch', label: 'Fetching receipts', duration: 400 },
    { id: 'process', label: 'Processing data', duration: 600 },
    { id: 'render', label: 'Preparing display', duration: 300 },
  ],
  
  analytics: [
    { id: 'data', label: 'Loading data', duration: 500 },
    { id: 'calculate', label: 'Running calculations', duration: 800 },
    { id: 'charts', label: 'Generating charts', duration: 600 },
    { id: 'insights', label: 'Analyzing insights', duration: 400 },
  ],
  
  upload: [
    { id: 'validate', label: 'Validating files', duration: 200 },
    { id: 'upload', label: 'Uploading images', duration: 2000 },
    { id: 'process', label: 'Processing receipts', duration: 3000 },
    { id: 'save', label: 'Saving data', duration: 500 },
  ],
};

/**
 * Hook for simulating realistic loading with cached data
 */
export function useProgressiveLoadingWithCache<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  stages: Omit<LoadingStage, 'completed'>[],
  options?: {
    showProgressOnCacheHit?: boolean;
    minLoadingTime?: number;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCacheHit, setIsCacheHit] = useState(false);

  const progressiveLoading = useProgressiveLoading({
    stages,
    autoProgress: true,
    onAllComplete: () => {
      // Fetch data when loading stages complete
      if (!data) {
        fetchData();
      }
    },
  });

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchFn();
      setData(result);
      setIsCacheHit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [fetchFn]);

  const startLoading = useCallback(() => {
    // Check if we have cached data
    const cached = localStorage.getItem(cacheKey);
    if (cached && options?.showProgressOnCacheHit !== false) {
      try {
        const cachedData = JSON.parse(cached);
        setData(cachedData);
        setIsCacheHit(true);
        
        // Show quick progress for cache hit
        progressiveLoading.start();
        setTimeout(() => progressiveLoading.completeAll(), options?.minLoadingTime || 500);
        return;
      } catch {
        // Invalid cache, proceed with normal loading
      }
    }

    // Normal loading flow
    progressiveLoading.start();
  }, [cacheKey, options, progressiveLoading]);

  // Cache data when it changes
  useEffect(() => {
    if (data && !isCacheHit) {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    }
  }, [data, cacheKey, isCacheHit]);

  return {
    ...progressiveLoading,
    data,
    error,
    isCacheHit,
    startLoading,
    refetch: fetchData,
  };
}
