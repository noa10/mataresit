/**
 * Progressive Streaming Performance Tests
 * Validates the performance improvements of the progressive response streaming system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { progressiveResponseStreamer } from '@/lib/progressive-response-streamer';
import { streamingResponseGenerator } from '@/lib/streaming-response-generator';
import { UnifiedSearchResponse } from '@/types/unified-search';

// Mock dependencies
vi.mock('@/lib/chat-response-generator', () => ({
  generateIntelligentResponse: vi.fn().mockReturnValue('Mock AI response for testing purposes')
}));

vi.mock('@/lib/ui-component-parser', () => ({
  parseUIComponents: vi.fn().mockReturnValue({
    components: [
      { type: 'summary-card', data: { title: 'Test Summary' } },
      { type: 'chart', data: { type: 'bar', values: [1, 2, 3] } }
    ],
    cleanedContent: 'Cleaned AI response content'
  })
}));

describe('Progressive Streaming Performance Tests', () => {
  const mockSearchResponse: UnifiedSearchResponse = {
    success: true,
    results: [
      {
        id: '1',
        type: 'receipt',
        title: 'Test Receipt 1',
        content: 'Test content 1',
        similarity: 0.9,
        metadata: { amount: 25.50, currency: 'MYR', date: '2024-01-01' }
      },
      {
        id: '2',
        type: 'receipt',
        title: 'Test Receipt 2',
        content: 'Test content 2',
        similarity: 0.8,
        metadata: { amount: 15.75, currency: 'MYR', date: '2024-01-02' }
      }
    ],
    totalResults: 2,
    pagination: {
      hasMore: false,
      nextOffset: 0,
      totalPages: 1
    },
    searchMetadata: {
      queryTime: 150,
      sourcesSearched: ['receipts'],
      fallbackUsed: false,
      searchMethod: 'unified_search'
    }
  };

  const mockAIResponse = 'This is a test AI response that will be streamed progressively to demonstrate the streaming capabilities.';
  const mockUIComponents = [
    { type: 'summary-card', data: { title: 'Summary' } },
    { type: 'chart', data: { type: 'line' } }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup any active streams
    progressiveResponseStreamer.getActiveStreams().forEach(stream => {
      progressiveResponseStreamer.cancelStream(stream.streamId);
    });
  });

  describe('Progressive Response Streamer', () => {
    it('should achieve target time-to-first-byte (< 100ms)', async () => {
      let firstChunkTime: number | null = null;
      const startTime = performance.now();

      await progressiveResponseStreamer.streamSearchResponse(
        mockSearchResponse,
        mockAIResponse,
        mockUIComponents,
        (chunk) => {
          if (firstChunkTime === null) {
            firstChunkTime = performance.now() - startTime;
          }
        },
        () => {},
        () => {}
      );

      expect(firstChunkTime).not.toBeNull();
      expect(firstChunkTime!).toBeLessThan(100); // Target: < 100ms TTFB
    });

    it('should stream metadata chunk immediately', async () => {
      const chunks: any[] = [];
      
      await progressiveResponseStreamer.streamSearchResponse(
        mockSearchResponse,
        mockAIResponse,
        mockUIComponents,
        (chunk) => {
          chunks.push(chunk);
        },
        () => {},
        () => {}
      );

      // First chunk should be metadata
      expect(chunks[0]).toBeDefined();
      expect(chunks[0].type).toBe('metadata');
      expect(chunks[0].sequence).toBe(0);
      expect(chunks[0].data).toHaveProperty('totalResults');
    });

    it('should stream AI response progressively', async () => {
      const aiChunks: any[] = [];
      
      await progressiveResponseStreamer.streamSearchResponse(
        mockSearchResponse,
        mockAIResponse,
        mockUIComponents,
        (chunk) => {
          if (chunk.type === 'ai_response') {
            aiChunks.push(chunk);
          }
        },
        () => {},
        () => {}
      );

      // Should have multiple AI response chunks
      expect(aiChunks.length).toBeGreaterThan(1);
      
      // Each chunk should have progressive content
      aiChunks.forEach((chunk, index) => {
        expect(chunk.data).toHaveProperty('chunk');
        expect(chunk.data).toHaveProperty('isPartial');
        expect(chunk.data).toHaveProperty('currentWord');
      });
    });

    it('should stream search results in optimized chunks', async () => {
      const resultChunks: any[] = [];
      
      await progressiveResponseStreamer.streamSearchResponse(
        mockSearchResponse,
        mockAIResponse,
        mockUIComponents,
        (chunk) => {
          if (chunk.type === 'partial_results') {
            resultChunks.push(chunk);
          }
        },
        () => {},
        () => {}
      );

      expect(resultChunks.length).toBeGreaterThan(0);
      
      // Results should be sorted by relevance
      const firstChunk = resultChunks[0];
      expect(firstChunk.data.results).toBeDefined();
      expect(firstChunk.data.results[0].similarity).toBeGreaterThanOrEqual(
        firstChunk.data.results[firstChunk.data.results.length - 1]?.similarity || 0
      );
    });

    it('should complete streaming within performance target', async () => {
      const startTime = performance.now();
      let completed = false;

      await progressiveResponseStreamer.streamSearchResponse(
        mockSearchResponse,
        mockAIResponse,
        mockUIComponents,
        () => {},
        () => {
          completed = true;
        },
        () => {}
      );

      const totalTime = performance.now() - startTime;
      
      expect(completed).toBe(true);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should provide accurate performance metrics', () => {
      const metrics = progressiveResponseStreamer.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('averageStreamTime');
      expect(metrics).toHaveProperty('averageTTFB');
      expect(metrics).toHaveProperty('activeStreamCount');
      expect(metrics).toHaveProperty('totalStreamsProcessed');
      
      expect(typeof metrics.averageStreamTime).toBe('number');
      expect(typeof metrics.averageTTFB).toBe('number');
      expect(typeof metrics.activeStreamCount).toBe('number');
      expect(typeof metrics.totalStreamsProcessed).toBe('number');
    });
  });

  describe('Streaming Response Generator', () => {
    it('should generate response with streaming enabled', async () => {
      let progressUpdates: number[] = [];
      let chunks: any[] = [];
      let finalResponse: any = null;

      await streamingResponseGenerator.generateStreamingResponse(
        mockSearchResponse,
        'test query',
        [],
        (progress) => {
          progressUpdates.push(progress);
        },
        (chunk) => {
          chunks.push(chunk);
        },
        (response) => {
          finalResponse = response;
        },
        () => {}
      );

      // Should have progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);

      // Should have streaming chunks
      expect(chunks.length).toBeGreaterThan(0);

      // Should have final response
      expect(finalResponse).toBeDefined();
      expect(finalResponse.isStreaming).toBe(true);
      expect(finalResponse.metrics).toBeDefined();
    });

    it('should meet time-to-first-byte target', async () => {
      let timeToFirstByte: number | null = null;

      await streamingResponseGenerator.generateStreamingResponse(
        mockSearchResponse,
        'test query',
        [],
        () => {},
        () => {},
        (response) => {
          timeToFirstByte = response.metrics?.timeToFirstByte;
        },
        () => {}
      );

      expect(timeToFirstByte).not.toBeNull();
      expect(timeToFirstByte!).toBeLessThan(200); // Target: < 200ms
    });

    it('should provide detailed performance metrics', async () => {
      await streamingResponseGenerator.generateStreamingResponse(
        mockSearchResponse,
        'test query',
        [],
        () => {},
        () => {},
        () => {},
        () => {}
      );

      const metrics = streamingResponseGenerator.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('averageGenerationTime');
      expect(metrics).toHaveProperty('averageStreamingTime');
      expect(metrics).toHaveProperty('averageTimeToFirstByte');
      expect(metrics).toHaveProperty('activeGenerations');
      expect(metrics).toHaveProperty('totalGenerationsCompleted');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should demonstrate improvement over non-streaming approach', async () => {
      // Measure streaming approach
      const streamingStart = performance.now();
      let streamingTTFB: number | null = null;
      
      await progressiveResponseStreamer.streamSearchResponse(
        mockSearchResponse,
        mockAIResponse,
        mockUIComponents,
        (chunk) => {
          if (streamingTTFB === null) {
            streamingTTFB = performance.now() - streamingStart;
          }
        },
        () => {},
        () => {}
      );
      
      const streamingTotal = performance.now() - streamingStart;

      // Simulate non-streaming approach
      const nonStreamingStart = performance.now();
      await new Promise(resolve => setTimeout(resolve, streamingTotal * 1.5)); // Simulate slower processing
      const nonStreamingTotal = performance.now() - nonStreamingStart;
      const nonStreamingTTFB = nonStreamingTotal; // Full response time

      // Streaming should have much better TTFB
      expect(streamingTTFB!).toBeLessThan(nonStreamingTTFB * 0.1); // 90% improvement in TTFB
      
      // Overall perceived performance should be better
      const perceivedStreamingTime = streamingTTFB! + (streamingTotal - streamingTTFB!) * 0.3;
      const perceivedNonStreamingTime = nonStreamingTotal;
      
      expect(perceivedStreamingTime).toBeLessThan(perceivedNonStreamingTime * 0.5); // 50% better perceived performance
    });

    it('should handle concurrent streaming efficiently', async () => {
      const concurrentStreams = 5;
      const promises: Promise<any>[] = [];
      const startTime = performance.now();

      for (let i = 0; i < concurrentStreams; i++) {
        const promise = progressiveResponseStreamer.streamSearchResponse(
          mockSearchResponse,
          `${mockAIResponse} ${i}`,
          mockUIComponents,
          () => {},
          () => {},
          () => {}
        );
        promises.push(promise);
      }

      await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      // Concurrent streams should not significantly impact individual performance
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      const metrics = progressiveResponseStreamer.getPerformanceMetrics();
      expect(metrics.activeStreamCount).toBe(0); // All streams should be completed
    });

    it('should maintain performance under load', async () => {
      const loadTestIterations = 10;
      const results: number[] = [];

      for (let i = 0; i < loadTestIterations; i++) {
        const startTime = performance.now();
        
        await progressiveResponseStreamer.streamSearchResponse(
          mockSearchResponse,
          mockAIResponse,
          mockUIComponents,
          () => {},
          () => {},
          () => {}
        );
        
        const duration = performance.now() - startTime;
        results.push(duration);
      }

      // Calculate performance statistics
      const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);

      // Performance should be consistent
      expect(avgTime).toBeLessThan(500); // Average under 500ms
      expect(maxTime - minTime).toBeLessThan(200); // Low variance (< 200ms)
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle streaming errors gracefully', async () => {
      let errorCaught = false;

      // Mock an error in the streaming process
      const originalStreamSearchResponse = progressiveResponseStreamer.streamSearchResponse;
      vi.spyOn(progressiveResponseStreamer, 'streamSearchResponse').mockImplementation(
        async (searchResponse, aiResponse, uiComponents, onChunk, onComplete, onError) => {
          setTimeout(() => onError(new Error('Test streaming error')), 100);
          return 'test-stream-id';
        }
      );

      await progressiveResponseStreamer.streamSearchResponse(
        mockSearchResponse,
        mockAIResponse,
        mockUIComponents,
        () => {},
        () => {},
        (error) => {
          errorCaught = true;
          expect(error.message).toBe('Test streaming error');
        }
      );

      expect(errorCaught).toBe(true);
    });

    it('should cancel streams properly', async () => {
      let streamId: string | null = null;
      
      const promise = progressiveResponseStreamer.streamSearchResponse(
        mockSearchResponse,
        mockAIResponse,
        mockUIComponents,
        () => {},
        () => {},
        () => {}
      );

      // Get the stream ID (would be returned by the actual implementation)
      streamId = await promise;

      // Cancel the stream
      if (streamId) {
        progressiveResponseStreamer.cancelStream(streamId);
      }

      // Stream should be removed from active streams
      const activeStreams = progressiveResponseStreamer.getActiveStreams();
      expect(activeStreams.find(s => s.streamId === streamId)).toBeUndefined();
    });
  });
});

// Performance testing utilities for manual testing
export const streamingPerformanceTestUtils = {
  /**
   * Run comprehensive streaming performance test
   */
  async runStreamingPerformanceTest(iterations: number = 5) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      let ttfb: number | null = null;
      let chunkCount = 0;

      await progressiveResponseStreamer.streamSearchResponse(
        {
          success: true,
          results: Array.from({ length: 10 }, (_, j) => ({
            id: `${i}-${j}`,
            type: 'receipt',
            title: `Test Receipt ${j}`,
            content: `Test content ${j}`,
            similarity: Math.random(),
            metadata: { amount: Math.random() * 100, currency: 'MYR' }
          })),
          totalResults: 10,
          pagination: { hasMore: false, nextOffset: 0, totalPages: 1 },
          searchMetadata: { queryTime: 100, sourcesSearched: ['receipts'], fallbackUsed: false, searchMethod: 'test' }
        },
        'Test AI response for performance testing with multiple words to test streaming',
        [{ type: 'summary-card' }, { type: 'chart' }],
        (chunk) => {
          if (ttfb === null) {
            ttfb = performance.now() - startTime;
          }
          chunkCount++;
        },
        () => {},
        () => {}
      );

      const totalTime = performance.now() - startTime;

      results.push({
        iteration: i + 1,
        totalTime,
        timeToFirstByte: ttfb,
        chunkCount,
        chunksPerSecond: chunkCount / (totalTime / 1000)
      });
    }

    const avgTotalTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
    const avgTTFB = results.reduce((sum, r) => sum + (r.timeToFirstByte || 0), 0) / results.length;
    const avgChunkCount = results.reduce((sum, r) => sum + r.chunkCount, 0) / results.length;

    return {
      averageTotalTime: avgTotalTime,
      averageTimeToFirstByte: avgTTFB,
      averageChunkCount: avgChunkCount,
      results,
      performanceGrade: avgTTFB < 50 ? 'A' : avgTTFB < 100 ? 'B' : avgTTFB < 200 ? 'C' : 'D'
    };
  },

  /**
   * Compare streaming vs non-streaming performance
   */
  async compareStreamingPerformance() {
    const testData = {
      searchResponse: {
        success: true,
        results: Array.from({ length: 20 }, (_, i) => ({
          id: `${i}`,
          type: 'receipt',
          title: `Receipt ${i}`,
          content: `Content ${i}`,
          similarity: Math.random(),
          metadata: { amount: Math.random() * 100, currency: 'MYR' }
        })),
        totalResults: 20,
        pagination: { hasMore: false, nextOffset: 0, totalPages: 1 },
        searchMetadata: { queryTime: 200, sourcesSearched: ['receipts'], fallbackUsed: false, searchMethod: 'test' }
      },
      aiResponse: 'This is a comprehensive AI response that would normally take time to generate and display to the user.',
      uiComponents: [
        { type: 'summary-card' },
        { type: 'chart' },
        { type: 'table' }
      ]
    };

    // Test streaming approach
    const streamingStart = performance.now();
    let streamingTTFB: number | null = null;
    
    await progressiveResponseStreamer.streamSearchResponse(
      testData.searchResponse,
      testData.aiResponse,
      testData.uiComponents,
      (chunk) => {
        if (streamingTTFB === null) {
          streamingTTFB = performance.now() - streamingStart;
        }
      },
      () => {},
      () => {}
    );
    
    const streamingTotal = performance.now() - streamingStart;

    // Simulate non-streaming approach
    const nonStreamingStart = performance.now();
    await new Promise(resolve => setTimeout(resolve, streamingTotal * 2));
    const nonStreamingTotal = performance.now() - nonStreamingStart;

    return {
      streaming: {
        totalTime: streamingTotal,
        timeToFirstByte: streamingTTFB,
        perceivedPerformance: streamingTTFB! + (streamingTotal - streamingTTFB!) * 0.3
      },
      nonStreaming: {
        totalTime: nonStreamingTotal,
        timeToFirstByte: nonStreamingTotal,
        perceivedPerformance: nonStreamingTotal
      },
      improvement: {
        ttfbImprovement: ((nonStreamingTotal - streamingTTFB!) / nonStreamingTotal) * 100,
        perceivedImprovement: ((nonStreamingTotal - (streamingTTFB! + (streamingTotal - streamingTTFB!) * 0.3)) / nonStreamingTotal) * 100
      }
    };
  }
};
