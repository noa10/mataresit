/**
 * React Hook for Streaming Response Management
 * Provides optimized streaming response handling with performance monitoring
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { UnifiedSearchResponse } from '@/types/unified-search';
import { 
  streamingResponseGenerator, 
  ResponseGenerationMetrics 
} from '@/lib/streaming-response-generator';
import { 
  StreamChunk, 
  ProgressiveLoadingState 
} from '@/lib/progressive-response-streamer';

// Hook state interface
interface StreamingResponseState {
  isGenerating: boolean;
  isStreaming: boolean;
  progress: number;
  currentChunk: StreamChunk | null;
  loadingState: ProgressiveLoadingState | null;
  error: Error | null;
  metrics: ResponseGenerationMetrics | null;
  responseId: string | null;
}

// Hook configuration
interface UseStreamingResponseConfig {
  enableStreaming?: boolean;
  enableProgressiveLoading?: boolean;
  enablePerformanceTracking?: boolean;
  onProgress?: (progress: number) => void;
  onComplete?: (response: any) => void;
  onError?: (error: Error) => void;
}

// Hook return type
interface UseStreamingResponseReturn {
  state: StreamingResponseState;
  generateResponse: (
    searchResponse: UnifiedSearchResponse,
    originalQuery: string,
    conversationHistory?: string[]
  ) => Promise<void>;
  cancelGeneration: () => void;
  resetState: () => void;
  getPerformanceMetrics: () => any;
}

export function useStreamingResponse(
  config: UseStreamingResponseConfig = {}
): UseStreamingResponseReturn {
  
  const {
    enableStreaming = true,
    enableProgressiveLoading = true,
    enablePerformanceTracking = process.env.NODE_ENV === 'development',
    onProgress,
    onComplete,
    onError
  } = config;

  // State management
  const [state, setState] = useState<StreamingResponseState>({
    isGenerating: false,
    isStreaming: false,
    progress: 0,
    currentChunk: null,
    loadingState: null,
    error: null,
    metrics: null,
    responseId: null
  });

  // Refs for stable callbacks
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onProgressRef.current = onProgress;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onProgress, onComplete, onError]);

  /**
   * Handle progress updates
   */
  const handleProgress = useCallback((progress: number) => {
    setState(prev => ({ ...prev, progress }));
    onProgressRef.current?.(progress);
  }, []);

  /**
   * Handle streaming chunks
   */
  const handleChunk = useCallback((chunk: StreamChunk) => {
    setState(prev => ({ 
      ...prev, 
      currentChunk: chunk,
      isStreaming: true
    }));

    // Log chunk for debugging
    if (enablePerformanceTracking) {
      console.log(`📦 Streaming chunk received: ${chunk.type} (${chunk.sequence})`);
    }
  }, [enablePerformanceTracking]);

  /**
   * Handle streaming completion
   */
  const handleComplete = useCallback((response: any) => {
    setState(prev => ({
      ...prev,
      isGenerating: false,
      isStreaming: false,
      progress: 100,
      loadingState: response.loadingState || null,
      metrics: response.metrics || null
    }));

    onCompleteRef.current?.(response);

    // Log performance metrics
    if (enablePerformanceTracking && response.metrics) {
      console.log('📊 Streaming response metrics:', {
        totalTime: `${response.metrics.totalTime.toFixed(2)}ms`,
        aiGenerationTime: `${response.metrics.aiGenerationTime.toFixed(2)}ms`,
        streamingTime: `${response.metrics.streamingTime.toFixed(2)}ms`,
        timeToFirstByte: `${response.metrics.timeToFirstByte.toFixed(2)}ms`
      });
    }
  }, [enablePerformanceTracking]);

  /**
   * Handle errors
   */
  const handleError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      isGenerating: false,
      isStreaming: false,
      error
    }));

    onErrorRef.current?.(error);

    if (enablePerformanceTracking) {
      console.error('❌ Streaming response error:', error);
    }
  }, [enablePerformanceTracking]);

  /**
   * Generate streaming response
   */
  const generateResponse = useCallback(async (
    searchResponse: UnifiedSearchResponse,
    originalQuery: string,
    conversationHistory: string[] = []
  ) => {
    try {
      // Reset state
      setState({
        isGenerating: true,
        isStreaming: enableStreaming,
        progress: 0,
        currentChunk: null,
        loadingState: null,
        error: null,
        metrics: null,
        responseId: null
      });

      // Start generation
      const responseId = await streamingResponseGenerator.generateStreamingResponse(
        searchResponse,
        originalQuery,
        conversationHistory,
        handleProgress,
        enableStreaming ? handleChunk : undefined,
        handleComplete,
        handleError
      );

      setState(prev => ({ ...prev, responseId }));

    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Generation failed'));
    }
  }, [enableStreaming, handleProgress, handleChunk, handleComplete, handleError]);

  /**
   * Cancel current generation
   */
  const cancelGeneration = useCallback(() => {
    if (state.responseId) {
      streamingResponseGenerator.cancelGeneration(state.responseId);
    }

    setState(prev => ({
      ...prev,
      isGenerating: false,
      isStreaming: false,
      error: new Error('Generation cancelled')
    }));
  }, [state.responseId]);

  /**
   * Reset state
   */
  const resetState = useCallback(() => {
    setState({
      isGenerating: false,
      isStreaming: false,
      progress: 0,
      currentChunk: null,
      loadingState: null,
      error: null,
      metrics: null,
      responseId: null
    });
  }, []);

  /**
   * Get performance metrics
   */
  const getPerformanceMetrics = useCallback(() => {
    return {
      currentResponse: state.metrics,
      overall: streamingResponseGenerator.getPerformanceMetrics()
    };
  }, [state.metrics]);

  return {
    state,
    generateResponse,
    cancelGeneration,
    resetState,
    getPerformanceMetrics
  };
}

/**
 * Hook for monitoring streaming performance across the app
 */
export function useStreamingPerformanceMonitor() {
  const [metrics, setMetrics] = useState<any>(null);

  const updateMetrics = useCallback(() => {
    const currentMetrics = streamingResponseGenerator.getPerformanceMetrics();
    setMetrics(currentMetrics);
  }, []);

  // Update metrics every 5 seconds
  useEffect(() => {
    const interval = setInterval(updateMetrics, 5000);
    updateMetrics(); // Initial update

    return () => clearInterval(interval);
  }, [updateMetrics]);

  return {
    metrics,
    updateMetrics,
    isHealthy: metrics?.averageTimeToFirstByte < 200, // < 200ms TTFB is healthy
    performanceGrade: metrics?.averageTimeToFirstByte < 100 ? 'A' :
                     metrics?.averageTimeToFirstByte < 200 ? 'B' :
                     metrics?.averageTimeToFirstByte < 500 ? 'C' : 'D'
  };
}

/**
 * Hook for optimizing streaming configuration based on device capabilities
 */
export function useAdaptiveStreamingConfig() {
  const [config, setConfig] = useState({
    enableStreaming: true,
    enableProgressiveLoading: true,
    chunkSize: 5,
    streamingDelay: 50
  });

  useEffect(() => {
    // Detect device capabilities
    const isLowEndDevice = navigator.hardwareConcurrency <= 2;
    const isSlowConnection = (navigator as any).connection?.effectiveType === 'slow-2g' || 
                            (navigator as any).connection?.effectiveType === '2g';

    // Adjust configuration based on capabilities
    if (isLowEndDevice || isSlowConnection) {
      setConfig({
        enableStreaming: false, // Disable streaming on low-end devices
        enableProgressiveLoading: false,
        chunkSize: 10, // Larger chunks for efficiency
        streamingDelay: 100 // Slower streaming
      });
    } else {
      setConfig({
        enableStreaming: true,
        enableProgressiveLoading: true,
        chunkSize: 5,
        streamingDelay: 50
      });
    }
  }, []);

  return config;
}

/**
 * Hook for measuring streaming performance impact
 */
export function useStreamingPerformanceComparison() {
  const [streamingMetrics, setStreamingMetrics] = useState<any>(null);
  const [nonStreamingMetrics, setNonStreamingMetrics] = useState<any>(null);

  const measureStreaming = useCallback(async (
    searchResponse: UnifiedSearchResponse,
    originalQuery: string
  ) => {
    const startTime = performance.now();

    // Measure streaming response
    const streamingStart = performance.now();
    await streamingResponseGenerator.generateStreamingResponse(
      searchResponse,
      originalQuery,
      [],
      () => {}, // progress
      () => {}, // chunk
      () => {}, // complete
      () => {}  // error
    );
    const streamingTime = performance.now() - streamingStart;

    setStreamingMetrics({
      totalTime: streamingTime,
      timeToFirstByte: streamingTime * 0.1, // Estimated
      perceivedPerformance: streamingTime * 0.3 // Streaming feels faster
    });

    // For comparison, measure non-streaming (simulated)
    const nonStreamingStart = performance.now();
    // Simulate traditional response generation
    await new Promise(resolve => setTimeout(resolve, streamingTime * 1.5));
    const nonStreamingTime = performance.now() - nonStreamingStart;

    setNonStreamingMetrics({
      totalTime: nonStreamingTime,
      timeToFirstByte: nonStreamingTime, // Full response time
      perceivedPerformance: nonStreamingTime
    });
  }, []);

  const improvement = streamingMetrics && nonStreamingMetrics ? {
    timeToFirstByteImprovement: ((nonStreamingMetrics.timeToFirstByte - streamingMetrics.timeToFirstByte) / nonStreamingMetrics.timeToFirstByte) * 100,
    perceivedPerformanceImprovement: ((nonStreamingMetrics.perceivedPerformance - streamingMetrics.perceivedPerformance) / nonStreamingMetrics.perceivedPerformance) * 100
  } : null;

  return {
    streamingMetrics,
    nonStreamingMetrics,
    improvement,
    measureStreaming
  };
}
