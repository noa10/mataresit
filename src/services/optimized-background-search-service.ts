/**
 * Optimized Background Search Service
 * Enhanced background search with intelligent concurrency, advanced caching, and resource management
 */

import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/unified-search';
import { optimizedSearchExecutor } from '@/lib/optimized-search-executor';
import { searchCache } from '@/lib/searchCache';
import { intelligentSearchPrioritizer } from '@/lib/intelligent-search-prioritizer';

// Search priority levels
export enum SearchPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

// Search task interface
interface SearchTask {
  id: string;
  conversationId: string;
  query: string;
  searchParams: UnifiedSearchParams;
  userId: string;
  priority: SearchPriority;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  maxRetries: number;
  abortController: AbortController;
  onProgress?: (status: string, progress: string) => void;
  onComplete?: (result: UnifiedSearchResponse) => void;
  onError?: (error: Error) => void;
}

// Resource management configuration
interface ResourceConfig {
  maxConcurrentSearches: number;
  maxQueueSize: number;
  searchTimeout: number;
  retryDelay: number;
  priorityBoostThreshold: number;
  memoryThreshold: number;
  cpuThreshold: number;
}

// Performance metrics
interface BackgroundSearchMetrics {
  totalSearches: number;
  completedSearches: number;
  failedSearches: number;
  averageSearchTime: number;
  averageQueueTime: number;
  cacheHitRate: number;
  concurrencyUtilization: number;
  resourceUtilization: {
    memory: number;
    cpu: number;
  };
}

class OptimizedBackgroundSearchService {
  private searchQueue: SearchTask[] = [];
  private activeSearches = new Map<string, SearchTask>();
  private completedSearches = new Map<string, SearchTask>();
  private searchHistory: SearchTask[] = [];
  
  private config: ResourceConfig = {
    maxConcurrentSearches: 3, // Optimized for performance
    maxQueueSize: 20,
    searchTimeout: 30000, // 30 seconds
    retryDelay: 2000, // 2 seconds
    priorityBoostThreshold: 10000, // 10 seconds
    memoryThreshold: 80, // 80% memory usage
    cpuThreshold: 70 // 70% CPU usage
  };

  private metrics: BackgroundSearchMetrics = {
    totalSearches: 0,
    completedSearches: 0,
    failedSearches: 0,
    averageSearchTime: 0,
    averageQueueTime: 0,
    cacheHitRate: 0,
    concurrencyUtilization: 0,
    resourceUtilization: {
      memory: 0,
      cpu: 0
    }
  };

  private processingInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startProcessing();
    this.startMetricsCollection();
  }

  /**
   * Start a background search with intelligent prioritization
   */
  async startSearch(
    conversationId: string,
    query: string,
    searchParams: UnifiedSearchParams,
    userId: string,
    options: {
      priority?: SearchPriority;
      maxRetries?: number;
      onProgress?: (status: string, progress: string) => void;
      onComplete?: (result: UnifiedSearchResponse) => void;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<string> {
    
    // Cancel any existing search for this conversation
    this.cancelSearch(conversationId);

    // Determine priority using intelligent prioritizer
    const systemLoad = {
      cpuUsage: this.metrics.resourceUtilization.cpu,
      memoryUsage: this.metrics.resourceUtilization.memory,
      activeSearches: this.activeSearches.size,
      queueLength: this.searchQueue.length,
      averageResponseTime: this.metrics.averageSearchTime,
      errorRate: this.metrics.failedSearches / Math.max(1, this.metrics.totalSearches)
    };

    const prioritizationResult = intelligentSearchPrioritizer.determinePriority(
      query,
      searchParams,
      userId,
      systemLoad
    );

    const priority = options.priority || prioritizationResult.priority;

    // Create search task
    const task: SearchTask = {
      id: this.generateTaskId(),
      conversationId,
      query,
      searchParams,
      userId,
      priority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || 2,
      abortController: new AbortController(),
      onProgress: options.onProgress,
      onComplete: options.onComplete,
      onError: options.onError
    };

    // Check if we can execute immediately
    if (this.activeSearches.size < this.config.maxConcurrentSearches) {
      await this.executeSearch(task);
    } else {
      // Add to queue with priority ordering
      this.addToQueue(task);
    }

    this.metrics.totalSearches++;
    return task.id;
  }

  /**
   * Cancel a search by conversation ID
   */
  cancelSearch(conversationId: string): void {
    // Cancel active search
    const activeTask = Array.from(this.activeSearches.values())
      .find(task => task.conversationId === conversationId);
    
    if (activeTask) {
      activeTask.abortController.abort();
      this.activeSearches.delete(activeTask.id);
      console.log(`🚫 Cancelled active search for conversation ${conversationId}`);
    }

    // Remove from queue
    this.searchQueue = this.searchQueue.filter(task => {
      if (task.conversationId === conversationId) {
        task.abortController.abort();
        console.log(`🚫 Removed queued search for conversation ${conversationId}`);
        return false;
      }
      return true;
    });
  }

  /**
   * Get search status
   */
  getSearchStatus(conversationId: string): {
    status: 'idle' | 'queued' | 'active' | 'completed' | 'failed';
    progress?: string;
    queuePosition?: number;
  } {
    // Check active searches
    const activeTask = Array.from(this.activeSearches.values())
      .find(task => task.conversationId === conversationId);
    
    if (activeTask) {
      return { status: 'active', progress: 'Searching...' };
    }

    // Check queue
    const queueIndex = this.searchQueue.findIndex(task => task.conversationId === conversationId);
    if (queueIndex !== -1) {
      return { 
        status: 'queued', 
        progress: 'Waiting in queue...',
        queuePosition: queueIndex + 1
      };
    }

    // Check completed
    const completedTask = Array.from(this.completedSearches.values())
      .find(task => task.conversationId === conversationId);
    
    if (completedTask) {
      return { status: 'completed' };
    }

    return { status: 'idle' };
  }

  /**
   * Get search results if available
   */
  async getSearchResults(conversationId: string): Promise<UnifiedSearchResponse | null> {
    // Check completed searches first
    const completedTask = Array.from(this.completedSearches.values())
      .find(task => task.conversationId === conversationId);
    
    if (completedTask) {
      // Try to get from cache
      return await searchCache.get(completedTask.searchParams, completedTask.userId);
    }

    return null;
  }

  /**
   * Determine search priority based on query characteristics
   */
  private determinePriority(query: string, searchParams: UnifiedSearchParams): SearchPriority {
    const queryLower = query.toLowerCase();

    // Urgent priority indicators
    const urgentIndicators = ['urgent', 'asap', 'immediately', 'now', 'emergency'];
    if (urgentIndicators.some(indicator => queryLower.includes(indicator))) {
      return SearchPriority.URGENT;
    }

    // High priority indicators
    const highPriorityIndicators = ['important', 'critical', 'need', 'must', 'required'];
    if (highPriorityIndicators.some(indicator => queryLower.includes(indicator))) {
      return SearchPriority.HIGH;
    }

    // Low priority indicators
    const lowPriorityIndicators = ['maybe', 'perhaps', 'sometime', 'eventually', 'when possible'];
    if (lowPriorityIndicators.some(indicator => queryLower.includes(indicator))) {
      return SearchPriority.LOW;
    }

    // Check query complexity
    if (query.length > 100 || searchParams.filters && Object.keys(searchParams.filters).length > 3) {
      return SearchPriority.HIGH; // Complex queries get higher priority
    }

    return SearchPriority.NORMAL;
  }

  /**
   * Add task to priority queue
   */
  private addToQueue(task: SearchTask): void {
    // Check queue size limit
    if (this.searchQueue.length >= this.config.maxQueueSize) {
      // Remove lowest priority task
      const lowestPriorityIndex = this.searchQueue.reduce((minIndex, currentTask, index) => {
        return currentTask.priority < this.searchQueue[minIndex].priority ? index : minIndex;
      }, 0);
      
      const removedTask = this.searchQueue.splice(lowestPriorityIndex, 1)[0];
      removedTask.abortController.abort();
      removedTask.onError?.(new Error('Queue full, task removed'));
    }

    // Insert task in priority order
    let insertIndex = this.searchQueue.length;
    for (let i = 0; i < this.searchQueue.length; i++) {
      if (task.priority > this.searchQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.searchQueue.splice(insertIndex, 0, task);
    console.log(`📋 Added search to queue at position ${insertIndex + 1} (priority: ${task.priority})`);
  }

  /**
   * Execute a search task
   */
  private async executeSearch(task: SearchTask): Promise<void> {
    task.startedAt = Date.now();
    this.activeSearches.set(task.id, task);

    console.log(`🔍 Starting search execution for conversation ${task.conversationId}`);

    try {
      // Check cache first
      task.onProgress?.('preprocessing', 'Checking cache...');
      const cachedResult = await searchCache.get(task.searchParams, task.userId);
      
      if (cachedResult) {
        console.log(`💾 Cache hit for conversation ${task.conversationId}`);
        task.onProgress?.('cached', 'Loading cached results...');
        await this.completeSearch(task, cachedResult);
        return;
      }

      // Execute search with timeout
      task.onProgress?.('searching', 'Searching through your data...');
      
      const searchPromise = optimizedSearchExecutor.executeSearch(task.searchParams, task.userId);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Search timeout')), this.config.searchTimeout);
      });

      const result = await Promise.race([searchPromise, timeoutPromise]);

      if (task.abortController.signal.aborted) {
        throw new Error('Search was cancelled');
      }

      await this.completeSearch(task, result);

    } catch (error) {
      await this.handleSearchError(task, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Complete a search task
   */
  private async completeSearch(task: SearchTask, result: UnifiedSearchResponse): Promise<void> {
    task.completedAt = Date.now();
    
    // Move to completed searches
    this.activeSearches.delete(task.id);
    this.completedSearches.set(task.id, task);
    this.searchHistory.push(task);

    // Update metrics
    this.metrics.completedSearches++;
    const searchTime = task.completedAt - (task.startedAt || task.createdAt);
    this.updateAverageSearchTime(searchTime);

    // Notify completion
    task.onProgress?.('complete', 'Search completed successfully');
    task.onComplete?.(result);

    console.log(`✅ Search completed for conversation ${task.conversationId} in ${searchTime}ms`);

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle search error with retry logic
   */
  private async handleSearchError(task: SearchTask, error: Error): Promise<void> {
    console.error(`❌ Search failed for conversation ${task.conversationId}:`, error);

    // Check if we should retry
    if (task.retryCount < task.maxRetries && !task.abortController.signal.aborted) {
      task.retryCount++;
      
      console.log(`🔄 Retrying search for conversation ${task.conversationId} (attempt ${task.retryCount})`);
      
      // Add delay before retry
      setTimeout(() => {
        if (!task.abortController.signal.aborted) {
          this.executeSearch(task);
        }
      }, this.config.retryDelay * task.retryCount);
      
      return;
    }

    // Move to completed with error
    this.activeSearches.delete(task.id);
    this.metrics.failedSearches++;

    // Notify error
    task.onError?.(error);

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Process the search queue
   */
  private processQueue(): void {
    while (this.searchQueue.length > 0 && this.activeSearches.size < this.config.maxConcurrentSearches) {
      const task = this.searchQueue.shift()!;
      
      // Check if task is still valid
      if (!task.abortController.signal.aborted) {
        // Boost priority for tasks that have been waiting too long
        const waitTime = Date.now() - task.createdAt;
        if (waitTime > this.config.priorityBoostThreshold && task.priority < SearchPriority.URGENT) {
          task.priority = Math.min(task.priority + 1, SearchPriority.URGENT);
          console.log(`⬆️ Boosted priority for conversation ${task.conversationId} due to wait time`);
        }

        this.executeSearch(task);
      }
    }
  }

  /**
   * Start background processing
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
      this.cleanupCompletedSearches();
      this.updateResourceUtilization();
    }, 1000); // Process every second
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update metrics every 5 seconds
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    // Update concurrency utilization
    this.metrics.concurrencyUtilization = 
      (this.activeSearches.size / this.config.maxConcurrentSearches) * 100;

    // Update cache hit rate
    const cacheStats = searchCache.getMetrics();
    this.metrics.cacheHitRate = cacheStats.cacheEfficiency;

    // Update average queue time
    const queueTimes = this.searchQueue.map(task => Date.now() - task.createdAt);
    this.metrics.averageQueueTime = queueTimes.length > 0 
      ? queueTimes.reduce((sum, time) => sum + time, 0) / queueTimes.length 
      : 0;
  }

  /**
   * Update average search time
   */
  private updateAverageSearchTime(searchTime: number): void {
    const totalCompleted = this.metrics.completedSearches;
    this.metrics.averageSearchTime = 
      (this.metrics.averageSearchTime * (totalCompleted - 1) + searchTime) / totalCompleted;
  }

  /**
   * Update resource utilization
   */
  private updateResourceUtilization(): void {
    // Estimate memory usage
    const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryLimit = (performance as any).memory?.jsHeapSizeLimit || 1;
    this.metrics.resourceUtilization.memory = (memoryUsage / memoryLimit) * 100;

    // Estimate CPU usage (simplified)
    this.metrics.resourceUtilization.cpu = this.activeSearches.size * 20; // Rough estimate
  }

  /**
   * Clean up old completed searches
   */
  private cleanupCompletedSearches(): void {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const now = Date.now();

    for (const [id, task] of this.completedSearches.entries()) {
      if (task.completedAt && now - task.completedAt > maxAge) {
        this.completedSearches.delete(id);
      }
    }

    // Keep search history limited
    if (this.searchHistory.length > 1000) {
      this.searchHistory = this.searchHistory.slice(-500);
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): BackgroundSearchMetrics {
    return { ...this.metrics };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    activeSearches: number;
    maxConcurrent: number;
    utilizationRate: number;
  } {
    return {
      queueLength: this.searchQueue.length,
      activeSearches: this.activeSearches.size,
      maxConcurrent: this.config.maxConcurrentSearches,
      utilizationRate: this.metrics.concurrencyUtilization
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResourceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Background search service configuration updated:', newConfig);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Cancel all active searches
    for (const task of this.activeSearches.values()) {
      task.abortController.abort();
    }

    // Cancel all queued searches
    for (const task of this.searchQueue) {
      task.abortController.abort();
    }

    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Clear data structures
    this.activeSearches.clear();
    this.searchQueue = [];
    this.completedSearches.clear();

    console.log('🧹 Optimized background search service cleaned up');
  }
}

// Export singleton instance
export const optimizedBackgroundSearchService = new OptimizedBackgroundSearchService();
export type { SearchTask, BackgroundSearchMetrics, ResourceConfig };
