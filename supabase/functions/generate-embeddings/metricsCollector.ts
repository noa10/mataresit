// metricsCollector.ts
// Metrics collection system for embedding generation performance monitoring
// Phase 1: Embedding Success Rate Monitoring Dashboard

interface EmbeddingMetricsData {
  receiptId: string;
  userId?: string;
  teamId?: string;
  uploadContext: 'single' | 'batch';
  modelUsed: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'timeout';
  errorType?: 'api_limit' | 'network' | 'validation' | 'timeout' | 'unknown';
  errorMessage?: string;
  contentTypesProcessed: string[];
  apiCallsMade: number;
  apiTokensUsed: number;
  apiRateLimited: boolean;
  contentLength: number;
  syntheticContentUsed: boolean;
}

interface MetricsCollectionContext {
  receiptId: string;
  uploadContext?: 'single' | 'batch';
  modelUsed?: string;
  userId?: string;
  teamId?: string;
}

export class EmbeddingMetricsCollector {
  private supabaseClient: any;
  private activeMetrics: Map<string, EmbeddingMetricsData> = new Map();

  constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient;
  }

  /**
   * Start metrics collection for an embedding operation
   */
  async startMetricsCollection(context: MetricsCollectionContext): Promise<string> {
    const metricId = crypto.randomUUID();
    const startTime = new Date();

    // Get receipt and user information
    const { receiptData, userData } = await this.getContextualData(context.receiptId);

    const metricsData: EmbeddingMetricsData = {
      receiptId: context.receiptId,
      userId: context.userId || receiptData?.user_id,
      teamId: context.teamId || receiptData?.team_id,
      uploadContext: context.uploadContext || 'single',
      modelUsed: context.modelUsed || 'gemini-embedding-001',
      startTime,
      status: 'pending',
      contentTypesProcessed: [],
      apiCallsMade: 0,
      apiTokensUsed: 0,
      apiRateLimited: false,
      contentLength: 0,
      syntheticContentUsed: false
    };

    this.activeMetrics.set(metricId, metricsData);

    try {
      // Record initial metrics in database
      const { error } = await this.supabaseClient.rpc('record_embedding_metrics', {
        p_receipt_id: metricsData.receiptId,
        p_user_id: metricsData.userId,
        p_team_id: metricsData.teamId,
        p_upload_context: metricsData.uploadContext,
        p_model_used: metricsData.modelUsed,
        p_start_time: metricsData.startTime.toISOString(),
        p_status: 'processing',
        p_content_types: metricsData.contentTypesProcessed,
        p_api_calls: metricsData.apiCallsMade,
        p_api_tokens: metricsData.apiTokensUsed,
        p_rate_limited: metricsData.apiRateLimited,
        p_content_length: metricsData.contentLength,
        p_synthetic_content: metricsData.syntheticContentUsed
      });

      if (error) {
        console.error('Error recording initial metrics:', error);
      }
    } catch (error) {
      console.error('Error in startMetricsCollection:', error);
    }

    return metricId;
  }

  /**
   * Update metrics during processing
   */
  updateMetrics(metricId: string, updates: Partial<EmbeddingMetricsData>): void {
    const metrics = this.activeMetrics.get(metricId);
    if (!metrics) {
      console.warn(`Metrics not found for ID: ${metricId}`);
      return;
    }

    // Update the metrics data
    Object.assign(metrics, updates);
    this.activeMetrics.set(metricId, metrics);
  }

  /**
   * Record API call metrics
   */
  recordApiCall(metricId: string, tokensUsed: number, rateLimited: boolean = false): void {
    const metrics = this.activeMetrics.get(metricId);
    if (!metrics) return;

    metrics.apiCallsMade += 1;
    metrics.apiTokensUsed += tokensUsed;
    if (rateLimited) {
      metrics.apiRateLimited = true;
    }

    this.activeMetrics.set(metricId, metrics);
  }

  /**
   * Record content processing
   */
  recordContentProcessing(
    metricId: string, 
    contentType: string, 
    contentLength: number, 
    syntheticContent: boolean = false
  ): void {
    const metrics = this.activeMetrics.get(metricId);
    if (!metrics) return;

    if (!metrics.contentTypesProcessed.includes(contentType)) {
      metrics.contentTypesProcessed.push(contentType);
    }
    metrics.contentLength += contentLength;
    if (syntheticContent) {
      metrics.syntheticContentUsed = true;
    }

    this.activeMetrics.set(metricId, metrics);
  }

  /**
   * Complete metrics collection with success
   */
  async completeMetricsCollection(metricId: string): Promise<void> {
    const metrics = this.activeMetrics.get(metricId);
    if (!metrics) {
      console.warn(`Metrics not found for completion: ${metricId}`);
      return;
    }

    metrics.endTime = new Date();
    metrics.status = 'success';

    await this.finalizeMetrics(metricId, metrics);
    this.activeMetrics.delete(metricId);
  }

  /**
   * Complete metrics collection with failure
   */
  async failMetricsCollection(
    metricId: string, 
    errorType: 'api_limit' | 'network' | 'validation' | 'timeout' | 'unknown',
    errorMessage: string
  ): Promise<void> {
    const metrics = this.activeMetrics.get(metricId);
    if (!metrics) {
      console.warn(`Metrics not found for failure: ${metricId}`);
      return;
    }

    metrics.endTime = new Date();
    metrics.status = 'failed';
    metrics.errorType = errorType;
    metrics.errorMessage = errorMessage;

    await this.finalizeMetrics(metricId, metrics);
    this.activeMetrics.delete(metricId);
  }

  /**
   * Handle timeout scenarios
   */
  async timeoutMetricsCollection(metricId: string): Promise<void> {
    const metrics = this.activeMetrics.get(metricId);
    if (!metrics) return;

    metrics.endTime = new Date();
    metrics.status = 'timeout';
    metrics.errorType = 'timeout';
    metrics.errorMessage = 'Operation timed out';

    await this.finalizeMetrics(metricId, metrics);
    this.activeMetrics.delete(metricId);
  }

  /**
   * Classify error type based on error message
   */
  classifyError(error: Error | string): 'api_limit' | 'network' | 'validation' | 'timeout' | 'unknown' {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('rate limit') || lowerMessage.includes('quota') || lowerMessage.includes('429')) {
      return 'api_limit';
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('fetch')) {
      return 'network';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || lowerMessage.includes('400')) {
      return 'validation';
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('408')) {
      return 'timeout';
    }
    return 'unknown';
  }

  /**
   * Get contextual data for metrics
   */
  private async getContextualData(receiptId: string): Promise<{ receiptData: any; userData: any }> {
    try {
      const { data: receiptData, error: receiptError } = await this.supabaseClient
        .from('receipts')
        .select('user_id, team_id, upload_context, model_used')
        .eq('id', receiptId)
        .single();

      if (receiptError) {
        console.warn('Could not fetch receipt data for metrics:', receiptError);
        return { receiptData: null, userData: null };
      }

      return { receiptData, userData: null };
    } catch (error) {
      console.warn('Error fetching contextual data:', error);
      return { receiptData: null, userData: null };
    }
  }

  /**
   * Finalize metrics in database
   */
  private async finalizeMetrics(metricId: string, metrics: EmbeddingMetricsData): Promise<void> {
    try {
      const { error } = await this.supabaseClient.rpc('record_embedding_metrics', {
        p_receipt_id: metrics.receiptId,
        p_user_id: metrics.userId,
        p_team_id: metrics.teamId,
        p_upload_context: metrics.uploadContext,
        p_model_used: metrics.modelUsed,
        p_start_time: metrics.startTime.toISOString(),
        p_end_time: metrics.endTime?.toISOString(),
        p_status: metrics.status,
        p_error_type: metrics.errorType,
        p_error_message: metrics.errorMessage,
        p_content_types: metrics.contentTypesProcessed,
        p_api_calls: metrics.apiCallsMade,
        p_api_tokens: metrics.apiTokensUsed,
        p_rate_limited: metrics.apiRateLimited,
        p_content_length: metrics.contentLength,
        p_synthetic_content: metrics.syntheticContentUsed
      });

      if (error) {
        console.error('Error finalizing metrics:', error);
      } else {
        console.log(`Metrics finalized for receipt ${metrics.receiptId}: ${metrics.status}`);
      }
    } catch (error) {
      console.error('Error in finalizeMetrics:', error);
    }
  }

  /**
   * Get current metrics for a metric ID (for debugging)
   */
  getMetrics(metricId: string): EmbeddingMetricsData | undefined {
    return this.activeMetrics.get(metricId);
  }

  /**
   * Clean up stale metrics (called periodically)
   */
  cleanupStaleMetrics(): void {
    const now = new Date();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [metricId, metrics] of this.activeMetrics.entries()) {
      const age = now.getTime() - metrics.startTime.getTime();
      if (age > staleThreshold) {
        console.warn(`Cleaning up stale metrics for ${metricId}`);
        this.timeoutMetricsCollection(metricId);
      }
    }
  }
}

/**
 * Utility function to create a metrics collector instance
 */
export function createMetricsCollector(supabaseClient: any): EmbeddingMetricsCollector {
  return new EmbeddingMetricsCollector(supabaseClient);
}

/**
 * Wrapper function to add metrics collection to any async function
 */
export async function withMetricsCollection<T>(
  metricsCollector: EmbeddingMetricsCollector,
  context: MetricsCollectionContext,
  operation: (metricId: string) => Promise<T>
): Promise<T> {
  const metricId = await metricsCollector.startMetricsCollection(context);
  
  try {
    const result = await operation(metricId);
    await metricsCollector.completeMetricsCollection(metricId);
    return result;
  } catch (error) {
    const errorType = metricsCollector.classifyError(error as Error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await metricsCollector.failMetricsCollection(metricId, errorType, errorMessage);
    throw error;
  }
}
