/**
 * Progressive Response Streaming System
 * High-performance streaming for search responses with chunked delivery and progressive loading
 */

import { UnifiedSearchResponse, UnifiedSearchResult } from '@/types/unified-search';

// Streaming configuration
interface StreamingConfig {
  chunkSize: number;
  chunkDelay: number;
  enableProgressiveLoading: boolean;
  enableDataCompression: boolean;
  maxConcurrentStreams: number;
  timeToFirstByte: number;
}

// Stream chunk types
interface StreamChunk {
  id: string;
  type: 'metadata' | 'partial_results' | 'ai_response' | 'ui_components' | 'complete';
  data: any;
  timestamp: number;
  sequence: number;
  isLast: boolean;
}

// Stream state
interface StreamState {
  streamId: string;
  totalChunks: number;
  receivedChunks: number;
  startTime: number;
  lastChunkTime: number;
  isComplete: boolean;
  error?: string;
}

// Progressive loading state
interface ProgressiveLoadingState {
  searchMetadata: any;
  partialResults: UnifiedSearchResult[];
  aiResponse: string;
  uiComponents: any[];
  isComplete: boolean;
  loadingProgress: number;
}

class ProgressiveResponseStreamer {
  private activeStreams = new Map<string, StreamState>();
  private streamCallbacks = new Map<string, (chunk: StreamChunk) => void>();
  private config: StreamingConfig = {
    chunkSize: 5, // Results per chunk
    chunkDelay: 50, // ms between chunks
    enableProgressiveLoading: true,
    enableDataCompression: false, // Disabled for now
    maxConcurrentStreams: 10,
    timeToFirstByte: 100 // Target TTFB in ms
  };

  /**
   * Start streaming a search response progressively
   */
  async streamSearchResponse(
    searchResponse: UnifiedSearchResponse,
    aiResponse: string,
    uiComponents: any[],
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (state: ProgressiveLoadingState) => void,
    onError: (error: Error) => void
  ): Promise<string> {
    const streamId = this.generateStreamId();
    
    try {
      // Initialize stream state
      const streamState: StreamState = {
        streamId,
        totalChunks: this.calculateTotalChunks(searchResponse, aiResponse, uiComponents),
        receivedChunks: 0,
        startTime: performance.now(),
        lastChunkTime: performance.now(),
        isComplete: false
      };

      this.activeStreams.set(streamId, streamState);
      this.streamCallbacks.set(streamId, onChunk);

      // Start progressive streaming
      await this.executeProgressiveStreaming(
        streamId,
        searchResponse,
        aiResponse,
        uiComponents,
        onComplete,
        onError
      );

      return streamId;

    } catch (error) {
      console.error('Failed to start progressive streaming:', error);
      onError(error instanceof Error ? error : new Error('Streaming failed'));
      return streamId;
    }
  }

  /**
   * Execute progressive streaming with optimized chunking
   */
  private async executeProgressiveStreaming(
    streamId: string,
    searchResponse: UnifiedSearchResponse,
    aiResponse: string,
    uiComponents: any[],
    onComplete: (state: ProgressiveLoadingState) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const state: ProgressiveLoadingState = {
      searchMetadata: null,
      partialResults: [],
      aiResponse: '',
      uiComponents: [],
      isComplete: false,
      loadingProgress: 0
    };

    let sequence = 0;

    try {
      // Chunk 1: Send metadata immediately (TTFB optimization)
      await this.sendChunk(streamId, {
        id: `${streamId}_metadata`,
        type: 'metadata',
        data: {
          totalResults: searchResponse.totalResults,
          queryTime: searchResponse.searchMetadata?.queryTime,
          sourcesSearched: searchResponse.searchMetadata?.sourcesSearched,
          searchMethod: searchResponse.searchMetadata?.searchMethod
        },
        timestamp: Date.now(),
        sequence: sequence++,
        isLast: false
      });

      state.searchMetadata = searchResponse.searchMetadata;
      state.loadingProgress = 10;

      // Chunk 2: Start AI response streaming (word by word)
      if (aiResponse) {
        await this.streamAIResponse(streamId, aiResponse, state, sequence);
        sequence += Math.ceil(aiResponse.split(' ').length / 10); // Estimate chunks
        state.loadingProgress = 40;
      }

      // Chunk 3: Stream search results progressively
      if (searchResponse.results && searchResponse.results.length > 0) {
        await this.streamSearchResults(streamId, searchResponse.results, state, sequence);
        sequence += Math.ceil(searchResponse.results.length / this.config.chunkSize);
        state.loadingProgress = 80;
      }

      // Chunk 4: Stream UI components
      if (uiComponents && uiComponents.length > 0) {
        await this.streamUIComponents(streamId, uiComponents, state, sequence);
        sequence += uiComponents.length;
        state.loadingProgress = 95;
      }

      // Final chunk: Mark as complete
      await this.sendChunk(streamId, {
        id: `${streamId}_complete`,
        type: 'complete',
        data: { message: 'Stream complete' },
        timestamp: Date.now(),
        sequence: sequence++,
        isLast: true
      });

      state.isComplete = true;
      state.loadingProgress = 100;

      // Update stream state
      const streamState = this.activeStreams.get(streamId);
      if (streamState) {
        streamState.isComplete = true;
        streamState.receivedChunks = sequence;
      }

      onComplete(state);

    } catch (error) {
      console.error('Progressive streaming failed:', error);
      onError(error instanceof Error ? error : new Error('Streaming execution failed'));
    } finally {
      // Cleanup
      this.activeStreams.delete(streamId);
      this.streamCallbacks.delete(streamId);
    }
  }

  /**
   * Stream AI response word by word for smooth typing effect
   */
  private async streamAIResponse(
    streamId: string,
    aiResponse: string,
    state: ProgressiveLoadingState,
    startSequence: number
  ): Promise<void> {
    const words = aiResponse.split(' ');
    const wordsPerChunk = 10; // Stream 10 words at a time
    let sequence = startSequence;

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ');
      const isLastChunk = i + wordsPerChunk >= words.length;
      
      await this.sendChunk(streamId, {
        id: `${streamId}_ai_${sequence}`,
        type: 'ai_response',
        data: {
          chunk,
          isPartial: !isLastChunk,
          totalWords: words.length,
          currentWord: Math.min(i + wordsPerChunk, words.length)
        },
        timestamp: Date.now(),
        sequence: sequence++,
        isLast: false
      });

      // Update state
      state.aiResponse = words.slice(0, i + wordsPerChunk).join(' ');

      // Add delay for smooth streaming effect
      if (!isLastChunk) {
        await this.delay(this.config.chunkDelay);
      }
    }
  }

  /**
   * Stream search results in optimized chunks
   */
  private async streamSearchResults(
    streamId: string,
    results: UnifiedSearchResult[],
    state: ProgressiveLoadingState,
    startSequence: number
  ): Promise<void> {
    let sequence = startSequence;

    // Sort results by relevance for better perceived performance
    const sortedResults = [...results].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    for (let i = 0; i < sortedResults.length; i += this.config.chunkSize) {
      const chunk = sortedResults.slice(i, i + this.config.chunkSize);
      const isLastChunk = i + this.config.chunkSize >= sortedResults.length;

      await this.sendChunk(streamId, {
        id: `${streamId}_results_${sequence}`,
        type: 'partial_results',
        data: {
          results: chunk,
          startIndex: i,
          endIndex: Math.min(i + this.config.chunkSize, sortedResults.length),
          totalResults: sortedResults.length,
          isLastChunk
        },
        timestamp: Date.now(),
        sequence: sequence++,
        isLast: false
      });

      // Update state
      state.partialResults = [...state.partialResults, ...chunk];

      // Add delay between chunks
      if (!isLastChunk) {
        await this.delay(this.config.chunkDelay);
      }
    }
  }

  /**
   * Stream UI components progressively
   */
  private async streamUIComponents(
    streamId: string,
    uiComponents: any[],
    state: ProgressiveLoadingState,
    startSequence: number
  ): Promise<void> {
    let sequence = startSequence;

    // Prioritize components by type (summary first, then details)
    const prioritizedComponents = this.prioritizeUIComponents(uiComponents);

    for (const component of prioritizedComponents) {
      await this.sendChunk(streamId, {
        id: `${streamId}_ui_${sequence}`,
        type: 'ui_components',
        data: {
          component,
          componentType: component.type,
          priority: component.priority || 0
        },
        timestamp: Date.now(),
        sequence: sequence++,
        isLast: false
      });

      // Update state
      state.uiComponents.push(component);

      // Add delay for smooth loading
      await this.delay(this.config.chunkDelay * 2); // Slower for UI components
    }
  }

  /**
   * Send a chunk to the stream callback
   */
  private async sendChunk(streamId: string, chunk: StreamChunk): Promise<void> {
    const callback = this.streamCallbacks.get(streamId);
    const streamState = this.activeStreams.get(streamId);

    if (callback && streamState) {
      // Update stream state
      streamState.receivedChunks++;
      streamState.lastChunkTime = performance.now();

      // Send chunk
      callback(chunk);

      // Log performance for first chunk (TTFB)
      if (chunk.sequence === 0) {
        const ttfb = performance.now() - streamState.startTime;
        console.log(`🚀 Time to first byte: ${ttfb.toFixed(2)}ms (target: ${this.config.timeToFirstByte}ms)`);
      }
    }
  }

  /**
   * Calculate total chunks for progress tracking
   */
  private calculateTotalChunks(
    searchResponse: UnifiedSearchResponse,
    aiResponse: string,
    uiComponents: any[]
  ): number {
    let totalChunks = 1; // Metadata chunk

    // AI response chunks
    if (aiResponse) {
      const words = aiResponse.split(' ');
      totalChunks += Math.ceil(words.length / 10);
    }

    // Search result chunks
    if (searchResponse.results) {
      totalChunks += Math.ceil(searchResponse.results.length / this.config.chunkSize);
    }

    // UI component chunks
    if (uiComponents) {
      totalChunks += uiComponents.length;
    }

    totalChunks += 1; // Complete chunk

    return totalChunks;
  }

  /**
   * Prioritize UI components for optimal loading order
   */
  private prioritizeUIComponents(components: any[]): any[] {
    const priorityOrder = {
      'summary-card': 1,
      'quick-stats': 2,
      'chart': 3,
      'table': 4,
      'detailed-view': 5
    };

    return [...components].sort((a, b) => {
      const priorityA = priorityOrder[a.type] || 999;
      const priorityB = priorityOrder[b.type] || 999;
      return priorityA - priorityB;
    });
  }

  /**
   * Generate unique stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility for streaming control
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get stream statistics
   */
  getStreamStats(streamId: string): StreamState | null {
    return this.activeStreams.get(streamId) || null;
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): StreamState[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Cancel a stream
   */
  cancelStream(streamId: string): void {
    this.activeStreams.delete(streamId);
    this.streamCallbacks.delete(streamId);
  }

  /**
   * Update streaming configuration
   */
  updateConfig(newConfig: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageStreamTime: number;
    averageTTFB: number;
    activeStreamCount: number;
    totalStreamsProcessed: number;
  } {
    const activeStreams = Array.from(this.activeStreams.values());
    const completedStreams = activeStreams.filter(s => s.isComplete);

    const avgStreamTime = completedStreams.length > 0
      ? completedStreams.reduce((sum, s) => sum + (s.lastChunkTime - s.startTime), 0) / completedStreams.length
      : 0;

    return {
      averageStreamTime: avgStreamTime,
      averageTTFB: this.config.timeToFirstByte, // Would track actual TTFB
      activeStreamCount: activeStreams.length,
      totalStreamsProcessed: completedStreams.length
    };
  }
}

// Export singleton instance
export const progressiveResponseStreamer = new ProgressiveResponseStreamer();
export type { StreamChunk, StreamState, ProgressiveLoadingState, StreamingConfig };
