// Phase 2: Embedding Queue Worker Edge Function
// Processes embedding queue items in batches with heartbeat mechanism and error handling

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface QueueItem {
  id: string;
  source_type: string;
  source_id: string;
  operation: string;
  priority: string;
  metadata: any;
  estimated_tokens?: number;
}

interface WorkerConfig {
  batchSize: number;
  heartbeatInterval: number;
  maxProcessingTime: number;
  rateLimitDelay: number;
}

class EmbeddingQueueWorker {
  private workerId: string
  private supabase: any
  private isRunning: boolean = false
  private config: WorkerConfig
  private heartbeatTimer?: number
  private processedCount: number = 0
  private errorCount: number = 0

  constructor() {
    this.workerId = `worker-${crypto.randomUUID()}`
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Default configuration (will be loaded from database)
    this.config = {
      batchSize: 5,
      heartbeatInterval: 30000, // 30 seconds
      maxProcessingTime: 600000, // 10 minutes
      rateLimitDelay: 1000 // 1 second
    }
  }

  async start(): Promise<{ success: boolean; workerId: string; message: string }> {
    try {
      console.log(`Starting embedding queue worker: ${this.workerId}`)
      
      // Load configuration from database
      await this.loadConfiguration()
      
      // Register worker and start heartbeat
      await this.registerWorker()
      this.startHeartbeat()
      
      this.isRunning = true
      
      // Start main processing loop
      this.processLoop()
      
      return {
        success: true,
        workerId: this.workerId,
        message: `Worker ${this.workerId} started successfully`
      }
    } catch (error) {
      console.error('Error starting worker:', error)
      return {
        success: false,
        workerId: this.workerId,
        message: `Failed to start worker: ${error.message}`
      }
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const { data: configs } = await this.supabase
        .from('embedding_queue_config')
        .select('config_key, config_value')
        .in('config_key', ['batch_size', 'worker_heartbeat_interval_ms', 'rate_limit_delay_ms'])

      if (configs) {
        for (const config of configs) {
          switch (config.config_key) {
            case 'batch_size':
              this.config.batchSize = parseInt(config.config_value)
              break
            case 'worker_heartbeat_interval_ms':
              this.config.heartbeatInterval = parseInt(config.config_value)
              break
            case 'rate_limit_delay_ms':
              this.config.rateLimitDelay = parseInt(config.config_value)
              break
          }
        }
      }
      
      console.log('Worker configuration loaded:', this.config)
    } catch (error) {
      console.warn('Failed to load configuration, using defaults:', error)
    }
  }

  private async registerWorker(): Promise<void> {
    await this.supabase
      .from('embedding_queue_workers')
      .upsert({
        worker_id: this.workerId,
        status: 'active',
        last_heartbeat: new Date().toISOString()
      })
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.supabase.rpc('update_worker_heartbeat', {
          worker_id_param: this.workerId,
          worker_status: 'active'
        })
      } catch (error) {
        console.error('Heartbeat error:', error)
        this.errorCount++
      }
    }, this.config.heartbeatInterval)
  }

  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processBatch()
        
        // Brief pause between batches
        await this.sleep(this.config.rateLimitDelay)
        
      } catch (error) {
        console.error('Error in processing loop:', error)
        this.errorCount++
        
        // Longer pause on error
        await this.sleep(5000)
      }
    }
  }

  private async processBatch(): Promise<void> {
    try {
      // Get next batch from queue
      const { data: batch, error } = await this.supabase
        .rpc('get_next_embedding_batch', {
          worker_id_param: this.workerId,
          batch_size_param: this.config.batchSize
        })

      if (error) {
        throw new Error(`Failed to get batch: ${error.message}`)
      }

      if (!batch || batch.length === 0) {
        // No items to process, worker goes idle
        await this.updateWorkerStatus('idle')
        return
      }

      console.log(`Processing batch of ${batch.length} items`)
      await this.updateWorkerStatus('active')

      // Process each item in the batch
      for (const item of batch) {
        try {
          await this.processEmbeddingItem(item)
          this.processedCount++
        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error)
          await this.completeItem(item.id, false, null, error.message)
          this.errorCount++
        }
      }

    } catch (error) {
      console.error('Error in processBatch:', error)
      throw error
    }
  }

  private async processEmbeddingItem(item: QueueItem): Promise<void> {
    const startTime = Date.now()
    
    try {
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
            workerId: this.workerId,
            metadata: item.metadata
          })
        }
      )

      if (response.status === 429) {
        // Rate limited - handle with backoff
        console.log(`Rate limited for item ${item.id}, applying delay`)
        await this.handleRateLimit(item.id, this.config.rateLimitDelay * 2) // Double the delay
        return
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      const processingTime = Date.now() - startTime
      
      console.log(`Successfully processed item ${item.id} in ${processingTime}ms`)
      await this.completeItem(item.id, true, result.totalTokens)

    } catch (error) {
      const processingTime = Date.now() - startTime
      console.error(`Failed to process item ${item.id} after ${processingTime}ms:`, error)
      throw error
    }
  }

  private async completeItem(
    itemId: string, 
    success: boolean, 
    tokens?: number, 
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.supabase.rpc('complete_embedding_queue_item', {
        item_id: itemId,
        worker_id_param: this.workerId,
        success,
        actual_tokens_param: tokens,
        error_message_param: errorMessage
      })
    } catch (error) {
      console.error(`Failed to complete item ${itemId}:`, error)
      throw error
    }
  }

  private async handleRateLimit(itemId: string, delayMs: number): Promise<void> {
    try {
      await this.supabase.rpc('handle_rate_limit', {
        item_id: itemId,
        worker_id_param: this.workerId,
        delay_ms: delayMs
      })
    } catch (error) {
      console.error(`Failed to handle rate limit for item ${itemId}:`, error)
      throw error
    }
  }

  private async updateWorkerStatus(status: string): Promise<void> {
    try {
      await this.supabase.rpc('update_worker_heartbeat', {
        worker_id_param: this.workerId,
        worker_status: status
      })
    } catch (error) {
      console.error('Failed to update worker status:', error)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async stop(): Promise<void> {
    console.log(`Stopping worker: ${this.workerId}`)
    this.isRunning = false
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    
    // Update worker status to stopped
    await this.updateWorkerStatus('stopped')
    
    console.log(`Worker ${this.workerId} stopped. Processed: ${this.processedCount}, Errors: ${this.errorCount}`)
  }

  getStats() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      config: this.config
    }
  }
}

// Global worker instance
let globalWorker: EmbeddingQueueWorker | null = null

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'start'

    switch (action) {
      case 'start':
        if (globalWorker && globalWorker.getStats().isRunning) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Worker is already running',
            stats: globalWorker.getStats()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        globalWorker = new EmbeddingQueueWorker()
        const startResult = await globalWorker.start()
        
        return new Response(JSON.stringify(startResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'stop':
        if (globalWorker) {
          await globalWorker.stop()
          const stats = globalWorker.getStats()
          globalWorker = null
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Worker stopped successfully',
            stats
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({
          success: false,
          message: 'No worker is running'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'status':
        const stats = globalWorker ? globalWorker.getStats() : null
        
        return new Response(JSON.stringify({
          success: true,
          worker: stats,
          isRunning: !!stats?.isRunning
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      default:
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid action. Use: start, stop, or status'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Worker function error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
