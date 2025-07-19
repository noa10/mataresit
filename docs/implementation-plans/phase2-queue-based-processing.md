# Phase 2: Queue-Based Embedding Processing System

## Technical Specifications & Architecture

### 2.1 Enhanced Queue System Architecture

The existing `embedding_queue` table provides a foundation, but we need to enhance it for production-scale processing:

```sql
-- Migration: 20250717000002_enhance_embedding_queue_system.sql

-- Enhance existing embedding_queue table
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS worker_id TEXT;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS estimated_tokens INTEGER;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS actual_tokens INTEGER;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS rate_limit_delay_ms INTEGER DEFAULT 0;

-- Add new status values
ALTER TABLE public.embedding_queue DROP CONSTRAINT IF EXISTS embedding_queue_status_check;
ALTER TABLE public.embedding_queue ADD CONSTRAINT embedding_queue_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rate_limited', 'cancelled'));

-- Queue worker management table
CREATE TABLE IF NOT EXISTS public.embedding_queue_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'idle', 'stopped', 'error')),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  current_task_id UUID REFERENCES public.embedding_queue(id),
  tasks_processed INTEGER DEFAULT 0,
  total_processing_time_ms BIGINT DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  rate_limit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Queue configuration table
CREATE TABLE IF NOT EXISTS public.embedding_queue_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO public.embedding_queue_config (config_key, config_value, description) VALUES
('max_concurrent_workers', '3', 'Maximum number of concurrent embedding workers'),
('batch_size', '5', 'Number of items to process in each batch'),
('rate_limit_delay_ms', '1000', 'Delay between API calls to avoid rate limiting'),
('max_retries', '3', 'Maximum retry attempts for failed items'),
('worker_heartbeat_interval_ms', '30000', 'Worker heartbeat interval'),
('queue_cleanup_interval_hours', '24', 'Interval for cleaning up old completed items'),
('priority_weights', '{"high": 3, "medium": 2, "low": 1}', 'Priority weights for queue processing'),
('api_quota_per_minute', '60', 'API calls allowed per minute'),
('token_quota_per_minute', '100000', 'Tokens allowed per minute')
ON CONFLICT (config_key) DO NOTHING;

-- Enhanced indexes for queue performance
CREATE INDEX IF NOT EXISTS idx_embedding_queue_priority_status ON public.embedding_queue(priority, status, created_at);
CREATE INDEX IF NOT EXISTS idx_embedding_queue_worker_processing ON public.embedding_queue(worker_id, processing_started_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_embedding_queue_batch_id ON public.embedding_queue(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_embedding_queue_rate_limited ON public.embedding_queue(status, rate_limit_delay_ms) WHERE status = 'rate_limited';

-- Worker management indexes
CREATE INDEX IF NOT EXISTS idx_embedding_workers_status ON public.embedding_queue_workers(status, last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_embedding_workers_active ON public.embedding_queue_workers(worker_id) WHERE status = 'active';
```

### 2.2 Queue Management Functions

```sql
-- Function to get next batch of items for processing
CREATE OR REPLACE FUNCTION get_next_embedding_batch(
  worker_id_param TEXT,
  batch_size_param INTEGER DEFAULT 5
) RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  operation TEXT,
  priority TEXT,
  metadata JSONB,
  estimated_tokens INTEGER
) AS $$
DECLARE
  priority_weights JSONB;
  current_time TIMESTAMPTZ := NOW();
BEGIN
  -- Get priority weights from config
  SELECT config_value INTO priority_weights 
  FROM public.embedding_queue_config 
  WHERE config_key = 'priority_weights';
  
  -- Update worker heartbeat
  INSERT INTO public.embedding_queue_workers (worker_id, status, last_heartbeat)
  VALUES (worker_id_param, 'active', current_time)
  ON CONFLICT (worker_id) DO UPDATE SET
    status = 'active',
    last_heartbeat = current_time;
  
  -- Get next batch with priority weighting
  RETURN QUERY
  WITH prioritized_queue AS (
    SELECT 
      q.id,
      q.source_type,
      q.source_id,
      q.operation,
      q.priority,
      q.metadata,
      q.estimated_tokens,
      -- Calculate priority score
      CASE q.priority
        WHEN 'high' THEN (priority_weights->>'high')::INTEGER
        WHEN 'medium' THEN (priority_weights->>'medium')::INTEGER
        WHEN 'low' THEN (priority_weights->>'low')::INTEGER
        ELSE 1
      END as priority_score,
      -- Add age factor (older items get higher priority)
      EXTRACT(EPOCH FROM (current_time - q.created_at)) / 3600 as age_hours
    FROM public.embedding_queue q
    WHERE q.status = 'pending'
      AND (q.rate_limit_delay_ms = 0 OR 
           q.updated_at + (q.rate_limit_delay_ms || ' milliseconds')::INTERVAL < current_time)
    ORDER BY 
      priority_score DESC,
      age_hours DESC,
      q.created_at ASC
    LIMIT batch_size_param
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.embedding_queue 
  SET 
    status = 'processing',
    worker_id = worker_id_param,
    processing_started_at = current_time,
    updated_at = current_time
  FROM prioritized_queue
  WHERE public.embedding_queue.id = prioritized_queue.id
  RETURNING 
    public.embedding_queue.id,
    public.embedding_queue.source_type,
    public.embedding_queue.source_id,
    public.embedding_queue.operation,
    public.embedding_queue.priority,
    public.embedding_queue.metadata,
    public.embedding_queue.estimated_tokens;
END;
$$ LANGUAGE plpgsql;

-- Function to complete queue item
CREATE OR REPLACE FUNCTION complete_embedding_queue_item(
  item_id UUID,
  worker_id_param TEXT,
  success BOOLEAN,
  actual_tokens_param INTEGER DEFAULT NULL,
  error_message_param TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  current_time TIMESTAMPTZ := NOW();
  processing_time_ms BIGINT;
BEGIN
  -- Calculate processing time
  SELECT EXTRACT(EPOCH FROM (current_time - processing_started_at)) * 1000
  INTO processing_time_ms
  FROM public.embedding_queue
  WHERE id = item_id;
  
  IF success THEN
    -- Mark as completed
    UPDATE public.embedding_queue
    SET 
      status = 'completed',
      processing_completed_at = current_time,
      actual_tokens = actual_tokens_param,
      updated_at = current_time
    WHERE id = item_id AND worker_id = worker_id_param;
    
    -- Update worker stats
    UPDATE public.embedding_queue_workers
    SET 
      tasks_processed = tasks_processed + 1,
      total_processing_time_ms = total_processing_time_ms + COALESCE(processing_time_ms, 0),
      current_task_id = NULL,
      updated_at = current_time
    WHERE worker_id = worker_id_param;
  ELSE
    -- Handle failure with retry logic
    UPDATE public.embedding_queue
    SET 
      status = CASE 
        WHEN retry_count + 1 >= max_retries THEN 'failed'
        ELSE 'pending'
      END,
      retry_count = retry_count + 1,
      error_message = error_message_param,
      worker_id = NULL,
      processing_started_at = NULL,
      updated_at = current_time
    WHERE id = item_id AND worker_id = worker_id_param;
    
    -- Update worker error count
    UPDATE public.embedding_queue_workers
    SET 
      error_count = error_count + 1,
      current_task_id = NULL,
      updated_at = current_time
    WHERE worker_id = worker_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to handle rate limiting
CREATE OR REPLACE FUNCTION handle_rate_limit(
  item_id UUID,
  worker_id_param TEXT,
  delay_ms INTEGER
) RETURNS VOID AS $$
DECLARE
  current_time TIMESTAMPTZ := NOW();
BEGIN
  -- Mark item as rate limited with delay
  UPDATE public.embedding_queue
  SET 
    status = 'rate_limited',
    rate_limit_delay_ms = delay_ms,
    worker_id = NULL,
    processing_started_at = NULL,
    updated_at = current_time
  WHERE id = item_id AND worker_id = worker_id_param;
  
  -- Update worker rate limit count
  UPDATE public.embedding_queue_workers
  SET 
    rate_limit_count = rate_limit_count + 1,
    current_task_id = NULL,
    updated_at = current_time
  WHERE worker_id = worker_id_param;
  
  -- Reset rate limited items back to pending after delay
  UPDATE public.embedding_queue
  SET 
    status = 'pending',
    rate_limit_delay_ms = 0
  WHERE status = 'rate_limited'
    AND updated_at + (rate_limit_delay_ms || ' milliseconds')::INTERVAL < current_time;
END;
$$ LANGUAGE plpgsql;
```

## Implementation Steps

### Priority 1: Queue Infrastructure Enhancement (Week 1)

1. **Database Migration**
   - Deploy enhanced queue schema
   - Create management functions
   - Set up monitoring indexes

2. **Queue Worker Framework**
   - Create base worker class
   - Implement heartbeat mechanism
   - Add worker registration system

3. **Configuration Management**
   - Implement dynamic configuration
   - Create admin interface for queue settings
   - Add configuration validation

### Priority 2: Worker Implementation (Week 2)

1. **Embedding Worker Service**
   - Create dedicated worker process
   - Implement batch processing logic
   - Add error handling and retry mechanisms

2. **Rate Limiting Integration**
   - Implement API quota management
   - Add intelligent backoff strategies
   - Create rate limit monitoring

3. **Worker Orchestration**
   - Auto-scaling worker management
   - Load balancing across workers
   - Health monitoring and recovery

### Priority 3: Integration with Existing System (Week 3)

1. **Process Receipt Integration**
   - Modify `triggerPostProcessing` to use queue
   - Add fallback to direct processing
   - Implement queue priority assignment

2. **Batch Upload Optimization**
   - Group batch uploads into queue batches
   - Implement batch-aware processing
   - Add progress tracking for batches

## Code Changes Required

### 1. New Queue Worker Service

File: `supabase/functions/embedding-queue-worker/index.ts`
```typescript
// New Edge Function for queue processing
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

class EmbeddingQueueWorker {
  private workerId: string
  private supabase: any
  private isRunning: boolean = false
  private batchSize: number = 5
  private heartbeatInterval: number = 30000

  constructor() {
    this.workerId = `worker-${crypto.randomUUID()}`
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
  }

  async start() {
    this.isRunning = true
    console.log(`Starting embedding queue worker: ${this.workerId}`)
    
    // Start heartbeat
    this.startHeartbeat()
    
    // Main processing loop
    while (this.isRunning) {
      try {
        await this.processBatch()
        await this.sleep(1000) // 1 second between batches
      } catch (error) {
        console.error('Error in worker loop:', error)
        await this.sleep(5000) // 5 second delay on error
      }
    }
  }

  private async processBatch() {
    // Get next batch from queue
    const { data: batch, error } = await this.supabase
      .rpc('get_next_embedding_batch', {
        worker_id_param: this.workerId,
        batch_size_param: this.batchSize
      })

    if (error || !batch?.length) {
      return // No items to process
    }

    console.log(`Processing batch of ${batch.length} items`)

    // Process each item in the batch
    for (const item of batch) {
      try {
        await this.processEmbeddingItem(item)
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error)
        await this.completeItem(item.id, false, null, error.message)
      }
    }
  }

  private async processEmbeddingItem(item: any) {
    // Call the generate-embeddings function
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embeddings`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receiptId: item.source_id,
          processAllFields: true,
          processLineItems: true,
          useImprovedDimensionHandling: true,
          queueMode: true,
          workerId: this.workerId
        })
      }
    )

    if (response.status === 429) {
      // Rate limited - handle with backoff
      await this.handleRateLimit(item.id, 60000) // 1 minute delay
      return
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    const result = await response.json()
    await this.completeItem(item.id, true, result.totalTokens)
  }

  private async completeItem(
    itemId: string, 
    success: boolean, 
    tokens?: number, 
    errorMessage?: string
  ) {
    await this.supabase.rpc('complete_embedding_queue_item', {
      item_id: itemId,
      worker_id_param: this.workerId,
      success,
      actual_tokens_param: tokens,
      error_message_param: errorMessage
    })
  }

  private async handleRateLimit(itemId: string, delayMs: number) {
    await this.supabase.rpc('handle_rate_limit', {
      item_id: itemId,
      worker_id_param: this.workerId,
      delay_ms: delayMs
    })
  }

  private startHeartbeat() {
    setInterval(async () => {
      try {
        await this.supabase
          .from('embedding_queue_workers')
          .upsert({
            worker_id: this.workerId,
            status: 'active',
            last_heartbeat: new Date().toISOString()
          })
      } catch (error) {
        console.error('Heartbeat error:', error)
      }
    }, this.heartbeatInterval)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  stop() {
    this.isRunning = false
    console.log(`Stopping worker: ${this.workerId}`)
  }
}

serve(async (req) => {
  if (req.method === 'POST') {
    const worker = new EmbeddingQueueWorker()
    worker.start()
    
    return new Response(JSON.stringify({ 
      success: true, 
      workerId: worker.workerId 
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response('Method not allowed', { status: 405 })
})
```

### 2. Modified Process Receipt Integration

File: `supabase/functions/process-receipt/index.ts` (modifications)
```typescript
// Add to triggerPostProcessing function
async function triggerPostProcessing(receiptId: string, supabase: any, logger: ProcessingLogger): Promise<void> {
  try {
    // Check if queue-based processing is enabled
    const { data: queueConfig } = await supabase
      .from('embedding_queue_config')
      .select('config_value')
      .eq('config_key', 'queue_enabled')
      .single()

    const useQueue = queueConfig?.config_value === true

    if (useQueue) {
      // Add to queue for asynchronous processing
      await logger.log("Adding embedding generation to queue", "EMBEDDING")
      
      const { error } = await supabase
        .from('embedding_queue')
        .insert({
          source_type: 'receipts',
          source_id: receiptId,
          operation: 'INSERT',
          priority: 'high', // Receipt processing gets high priority
          metadata: {
            triggered_by: 'process_receipt',
            upload_context: 'direct_processing'
          }
        })

      if (error) {
        await logger.log(`Queue insertion error: ${error.message}`, "WARNING")
        // Fallback to direct processing
        await directEmbeddingProcessing(receiptId, supabase, logger)
      } else {
        await logger.log("Successfully queued for embedding generation", "EMBEDDING")
      }
    } else {
      // Direct processing (existing behavior)
      await directEmbeddingProcessing(receiptId, supabase, logger)
    }
  } catch (error) {
    await logger.log(`Embedding processing error: ${error.message}`, "WARNING")
  }
}

// Extract existing direct processing logic
async function directEmbeddingProcessing(receiptId: string, supabase: any, logger: ProcessingLogger) {
  // Existing triggerPostProcessing logic here
  // ... (current implementation)
}
```

## Testing Strategy

### Unit Tests
- Queue management function testing
- Worker lifecycle testing
- Rate limiting logic validation
- Priority calculation testing

### Integration Tests
- End-to-end queue processing
- Worker failure and recovery
- Rate limit handling
- Batch processing validation

### Load Tests
- High-volume queue processing
- Multiple worker coordination
- Database performance under load
- API rate limit compliance

## Performance Impact Analysis

### Expected Benefits
- **Scalability**: Handle 10x more concurrent uploads
- **Reliability**: Retry failed embeddings automatically
- **Rate Limiting**: Prevent API quota exhaustion
- **Monitoring**: Better visibility into processing status

### Resource Requirements
- **Database**: Additional 20-30% storage for queue tables
- **Compute**: Dedicated worker processes
- **Memory**: Queue state management overhead

## Timeline Estimate

- **Week 1**: Queue infrastructure and database enhancements
- **Week 2**: Worker implementation and orchestration
- **Week 3**: Integration with existing system and testing

**Total Duration**: 3 weeks
**Team Size**: 2-3 developers
**Dependencies**: Database migration capabilities, worker deployment infrastructure
