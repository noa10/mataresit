/**
 * Streaming Response Generator
 * Optimized response generation with progressive streaming and efficient data serialization
 */

import { UnifiedSearchResponse, UnifiedSearchResult } from '@/types/unified-search';
import { generateIntelligentResponse } from './chat-response-generator';
import { parseUIComponents } from './ui-component-parser';
import { progressiveResponseStreamer } from './progressive-response-streamer';

// Response generation configuration
interface ResponseGenerationConfig {
  enableStreaming: boolean;
  enableProgressiveLoading: boolean;
  enableDataCompression: boolean;
  maxResponseLength: number;
  chunkSize: number;
  streamingDelay: number;
}

// Response generation metrics
interface ResponseGenerationMetrics {
  totalTime: number;
  aiGenerationTime: number;
  uiParsingTime: number;
  streamingTime: number;
  compressionRatio?: number;
  timeToFirstByte: number;
  timestamp: number;
}

// Streaming response state
interface StreamingResponseState {
  responseId: string;
  isGenerating: boolean;
  isStreaming: boolean;
  progress: number;
  startTime: number;
  metrics?: ResponseGenerationMetrics;
}

class StreamingResponseGenerator {
  private activeGenerations = new Map<string, StreamingResponseState>();
  private config: ResponseGenerationConfig = {
    enableStreaming: true,
    enableProgressiveLoading: true,
    enableDataCompression: false,
    maxResponseLength: 10000,
    chunkSize: 100,
    streamingDelay: 50
  };

  /**
   * Generate streaming response from search results
   */
  async generateStreamingResponse(
    searchResponse: UnifiedSearchResponse,
    originalQuery: string,
    conversationHistory: string[] = [],
    onProgress?: (progress: number) => void,
    onChunk?: (chunk: any) => void,
    onComplete?: (response: any) => void,
    onError?: (error: Error) => void
  ): Promise<string> {
    const responseId = this.generateResponseId();
    const startTime = performance.now();

    try {
      // Initialize generation state
      const state: StreamingResponseState = {
        responseId,
        isGenerating: true,
        isStreaming: this.config.enableStreaming,
        progress: 0,
        startTime
      };

      this.activeGenerations.set(responseId, state);

      // Phase 1: Generate AI response (30% of progress)
      onProgress?.(10);
      const aiGenerationStart = performance.now();
      
      const aiResponse = await this.generateOptimizedAIResponse(
        searchResponse,
        originalQuery,
        conversationHistory
      );
      
      const aiGenerationTime = performance.now() - aiGenerationStart;
      onProgress?.(30);

      // Phase 2: Parse UI components (20% of progress)
      const uiParsingStart = performance.now();
      
      const { components: uiComponents, cleanedContent } = parseUIComponents(aiResponse);
      
      const uiParsingTime = performance.now() - uiParsingStart;
      onProgress?.(50);

      // Phase 3: Prepare streaming data (20% of progress)
      const streamingData = await this.prepareStreamingData(
        searchResponse,
        cleanedContent || aiResponse,
        uiComponents
      );
      
      onProgress?.(70);

      // Phase 4: Start progressive streaming (30% of progress)
      if (this.config.enableStreaming && onChunk) {
        const streamingStart = performance.now();
        
        await this.startProgressiveStreaming(
          responseId,
          streamingData,
          onChunk,
          (progress) => onProgress?.(70 + progress * 0.3)
        );
        
        const streamingTime = performance.now() - streamingStart;
        
        // Record metrics
        const metrics: ResponseGenerationMetrics = {
          totalTime: performance.now() - startTime,
          aiGenerationTime,
          uiParsingTime,
          streamingTime,
          timeToFirstByte: aiGenerationTime, // First meaningful content
          timestamp: Date.now()
        };

        state.metrics = metrics;
        onProgress?.(100);

        // Complete response
        const completeResponse = {
          id: responseId,
          content: cleanedContent || aiResponse,
          searchResults: searchResponse,
          uiComponents,
          isStreaming: true,
          streamId: responseId,
          metrics
        };

        onComplete?.(completeResponse);

      } else {
        // Non-streaming response
        const completeResponse = {
          id: responseId,
          content: cleanedContent || aiResponse,
          searchResults: searchResponse,
          uiComponents,
          isStreaming: false,
          metrics: {
            totalTime: performance.now() - startTime,
            aiGenerationTime,
            uiParsingTime,
            streamingTime: 0,
            timeToFirstByte: aiGenerationTime,
            timestamp: Date.now()
          }
        };

        onProgress?.(100);
        onComplete?.(completeResponse);
      }

      return responseId;

    } catch (error) {
      console.error('Response generation failed:', error);
      this.activeGenerations.delete(responseId);
      onError?.(error instanceof Error ? error : new Error('Response generation failed'));
      return responseId;
    }
  }

  /**
   * Generate optimized AI response with context awareness
   */
  private async generateOptimizedAIResponse(
    searchResponse: UnifiedSearchResponse,
    originalQuery: string,
    conversationHistory: string[]
  ): Promise<string> {
    
    // Convert unified response to legacy format for compatibility
    const legacySearchResult = {
      results: searchResponse.results?.map(result => ({
        id: result.id,
        merchant: result.title,
        total: result.metadata?.amount || 0,
        date: result.metadata?.date,
        notes: result.content,
        similarity_score: result.similarity
      })) || [],
      total: searchResponse.totalResults,
      count: searchResponse.results?.length || 0
    };

    // Generate intelligent response with context
    const baseResponse = generateIntelligentResponse(
      legacySearchResult,
      originalQuery
    );

    // Enhance response with conversation context
    if (conversationHistory.length > 0) {
      return this.enhanceResponseWithContext(baseResponse, conversationHistory, originalQuery);
    }

    return baseResponse;
  }

  /**
   * Enhance response with conversation context
   */
  private enhanceResponseWithContext(
    baseResponse: string,
    conversationHistory: string[],
    currentQuery: string
  ): string {
    // Simple context enhancement - could be improved with LLM
    const recentQueries = conversationHistory.slice(-3);
    const hasRelatedQueries = recentQueries.some(query => 
      this.areQueriesRelated(query, currentQuery)
    );

    if (hasRelatedQueries) {
      return `Based on your recent searches, ${baseResponse.toLowerCase()}`;
    }

    return baseResponse;
  }

  /**
   * Check if queries are related
   */
  private areQueriesRelated(query1: string, query2: string): boolean {
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    const similarity = intersection.size / union.size;
    return similarity > 0.3; // 30% word overlap
  }

  /**
   * Prepare data for streaming
   */
  private async prepareStreamingData(
    searchResponse: UnifiedSearchResponse,
    aiResponse: string,
    uiComponents: any[]
  ): Promise<any> {
    
    // Optimize search results for streaming
    const optimizedResults = this.optimizeSearchResults(searchResponse.results || []);
    
    // Prepare UI components for progressive loading
    const optimizedComponents = this.optimizeUIComponents(uiComponents);

    return {
      searchResponse: {
        ...searchResponse,
        results: optimizedResults
      },
      aiResponse,
      uiComponents: optimizedComponents
    };
  }

  /**
   * Optimize search results for streaming
   */
  private optimizeSearchResults(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
    // Sort by relevance for better perceived performance
    return [...results]
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .map(result => ({
        ...result,
        // Compress metadata if needed
        metadata: this.compressMetadata(result.metadata)
      }));
  }

  /**
   * Optimize UI components for progressive loading
   */
  private optimizeUIComponents(components: any[]): any[] {
    // Sort by priority and optimize data
    const priorityOrder = {
      'summary-card': 1,
      'quick-stats': 2,
      'chart': 3,
      'table': 4,
      'detailed-view': 5
    };

    return [...components]
      .sort((a, b) => {
        const priorityA = priorityOrder[a.type] || 999;
        const priorityB = priorityOrder[b.type] || 999;
        return priorityA - priorityB;
      })
      .map(component => ({
        ...component,
        // Add streaming metadata
        priority: priorityOrder[component.type] || 999,
        optimized: true
      }));
  }

  /**
   * Compress metadata for efficient streaming
   */
  private compressMetadata(metadata: any): any {
    if (!metadata || !this.config.enableDataCompression) {
      return metadata;
    }

    // Simple compression - remove null/undefined values
    const compressed = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined && value !== '') {
        compressed[key] = value;
      }
    }

    return compressed;
  }

  /**
   * Start progressive streaming
   */
  private async startProgressiveStreaming(
    responseId: string,
    streamingData: any,
    onChunk: (chunk: any) => void,
    onProgress: (progress: number) => void
  ): Promise<void> {
    
    return progressiveResponseStreamer.streamSearchResponse(
      streamingData.searchResponse,
      streamingData.aiResponse,
      streamingData.uiComponents,
      onChunk,
      (finalState) => {
        onProgress(1.0);
        console.log('✅ Progressive streaming completed:', finalState);
      },
      (error) => {
        console.error('❌ Progressive streaming failed:', error);
        throw error;
      }
    );
  }

  /**
   * Generate unique response ID
   */
  private generateResponseId(): string {
    return `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get generation state
   */
  getGenerationState(responseId: string): StreamingResponseState | null {
    return this.activeGenerations.get(responseId) || null;
  }

  /**
   * Cancel response generation
   */
  cancelGeneration(responseId: string): void {
    this.activeGenerations.delete(responseId);
    progressiveResponseStreamer.cancelStream(responseId);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResponseGenerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageGenerationTime: number;
    averageStreamingTime: number;
    averageTimeToFirstByte: number;
    activeGenerations: number;
    totalGenerationsCompleted: number;
  } {
    const generations = Array.from(this.activeGenerations.values());
    const completedGenerations = generations.filter(g => g.metrics);

    const avgGenerationTime = completedGenerations.length > 0
      ? completedGenerations.reduce((sum, g) => sum + (g.metrics?.totalTime || 0), 0) / completedGenerations.length
      : 0;

    const avgStreamingTime = completedGenerations.length > 0
      ? completedGenerations.reduce((sum, g) => sum + (g.metrics?.streamingTime || 0), 0) / completedGenerations.length
      : 0;

    const avgTTFB = completedGenerations.length > 0
      ? completedGenerations.reduce((sum, g) => sum + (g.metrics?.timeToFirstByte || 0), 0) / completedGenerations.length
      : 0;

    return {
      averageGenerationTime: avgGenerationTime,
      averageStreamingTime: avgStreamingTime,
      averageTimeToFirstByte: avgTTFB,
      activeGenerations: generations.filter(g => g.isGenerating).length,
      totalGenerationsCompleted: completedGenerations.length
    };
  }

  /**
   * Clear completed generations
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [id, state] of this.activeGenerations.entries()) {
      // Remove generations older than 5 minutes
      if (now - state.startTime > 300000) {
        expiredKeys.push(id);
      }
    }

    expiredKeys.forEach(id => this.activeGenerations.delete(id));
  }
}

// Export singleton instance
export const streamingResponseGenerator = new StreamingResponseGenerator();
export type { ResponseGenerationMetrics, StreamingResponseState, ResponseGenerationConfig };
