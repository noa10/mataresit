// Batch processor for embedding generation
// Phase 4: Embedding Generation System Enhancement

import { ContentExtractor, ContentExtractionResult } from './contentExtractors.ts';

export interface BatchProcessingResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
  results: any[];
}

export interface QueueItem {
  id: string;
  source_type: string;
  source_id: string;
  operation: string;
  priority: string;
  metadata: any;
}

export class BatchProcessor {
  private supabase: any;
  private generateEmbedding: (text: string) => Promise<number[]>;

  constructor(supabase: any, generateEmbedding: (text: string) => Promise<number[]>) {
    this.supabase = supabase;
    this.generateEmbedding = generateEmbedding;
  }

  /**
   * Process a batch of queue items
   */
  async processBatch(queueItems: QueueItem[], batchSize: number = 5): Promise<BatchProcessingResult> {
    const results: any[] = [];
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    // Process items in smaller chunks to avoid overwhelming the system
    for (let i = 0; i < queueItems.length; i += batchSize) {
      const chunk = queueItems.slice(i, i + batchSize);
      
      const chunkResults = await Promise.allSettled(
        chunk.map(item => this.processQueueItem(item))
      );

      for (let j = 0; j < chunkResults.length; j++) {
        const result = chunkResults[j];
        const item = chunk[j];

        if (result.status === 'fulfilled') {
          results.push(result.value);
          processed++;
          
          // Mark queue item as completed
          await this.updateQueueItemStatus(item.id, 'completed');
        } else {
          failed++;
          const errorMessage = result.reason?.message || String(result.reason);
          errors.push(`${item.source_type}:${item.source_id} - ${errorMessage}`);
          
          // Mark queue item as failed and increment retry count
          await this.updateQueueItemStatus(item.id, 'failed', errorMessage);
        }
      }

      // Small delay between chunks to avoid rate limiting
      if (i + batchSize < queueItems.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      success: failed === 0,
      processed,
      failed,
      errors,
      results
    };
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: QueueItem): Promise<any> {
    const { source_type, source_id, operation } = item;

    if (operation === 'DELETE') {
      // Remove embeddings for deleted records
      return await this.deleteEmbeddings(source_type, source_id);
    }

    // Get the source record
    const sourceRecord = await this.getSourceRecord(source_type, source_id);
    if (!sourceRecord) {
      throw new Error(`Source record not found: ${source_type}:${source_id}`);
    }

    // Extract content based on source type
    const contentResults = await this.extractContent(source_type, sourceRecord);
    
    if (contentResults.length === 0) {
      throw new Error(`No content extracted from ${source_type}:${source_id}`);
    }

    // Generate and store embeddings for each content piece
    const embeddingResults = [];
    for (const content of contentResults) {
      try {
        const embedding = await this.generateEmbedding(content.contentText);
        
        // Validate content_text before storing
        if (!content.contentText || content.contentText.trim() === '') {
          console.error(`❌ Empty content_text for ${source_type}:${source_id}:${content.contentType}`);
          throw new Error(`Content text is empty for ${content.contentType} embedding`);
        }

        console.log(`📝 Storing embedding with content: "${content.contentText.substring(0, 100)}..."`);

        const { error } = await this.supabase.rpc('add_unified_embedding', {
          p_source_type: source_type.replace(/s$/, ''), // Remove plural 's'
          p_source_id: source_id,
          p_content_type: content.contentType,
          p_content_text: content.contentText,
          p_embedding: embedding,
          p_metadata: content.metadata,
          p_user_id: content.userId,
          p_team_id: content.teamId,
          p_language: content.language
        });

        if (error) throw error;

        embeddingResults.push({
          contentType: content.contentType,
          dimensions: embedding.length,
          success: true
        });
      } catch (error) {
        embeddingResults.push({
          contentType: content.contentType,
          error: error.message,
          success: false
        });
      }
    }

    return {
      sourceType: source_type,
      sourceId: source_id,
      operation,
      embeddingResults
    };
  }

  /**
   * Extract content from source record based on type
   */
  private async extractContent(sourceType: string, sourceRecord: any): Promise<ContentExtractionResult[]> {
    switch (sourceType) {
      case 'receipts':
        return ContentExtractor.extractReceiptContent(sourceRecord);
        
      case 'claims':
        return ContentExtractor.extractClaimContent(sourceRecord);
        
      case 'team_members':
        // Need to fetch profile data for team members
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', sourceRecord.user_id)
          .single();
        
        return ContentExtractor.extractTeamMemberContent(sourceRecord, profile);
        
      case 'custom_categories':
        return ContentExtractor.extractCustomCategoryContent(sourceRecord);
        
      case 'malaysian_business_directory':
        return ContentExtractor.extractBusinessDirectoryContent(sourceRecord);
        
      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }
  }

  /**
   * Get source record from database
   */
  private async getSourceRecord(sourceType: string, sourceId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from(sourceType)
      .select('*')
      .eq('id', sourceId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete embeddings for a source record
   */
  private async deleteEmbeddings(sourceType: string, sourceId: string): Promise<any> {
    const { error } = await this.supabase
      .from('unified_embeddings')
      .delete()
      .eq('source_type', sourceType.replace(/s$/, '')) // Remove plural 's'
      .eq('source_id', sourceId);

    if (error) throw error;

    return {
      sourceType,
      sourceId,
      operation: 'DELETE',
      success: true
    };
  }

  /**
   * Update queue item status
   */
  private async updateQueueItemStatus(queueId: string, status: string, errorMessage?: string): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    };

    if (status === 'failed') {
      updateData.error_message = errorMessage;
      
      // Increment retry count
      const { data: currentItem } = await this.supabase
        .from('embedding_queue')
        .select('retry_count, max_retries')
        .eq('id', queueId)
        .single();

      if (currentItem) {
        updateData.retry_count = (currentItem.retry_count || 0) + 1;
        
        // If max retries reached, mark as permanently failed
        if (updateData.retry_count >= (currentItem.max_retries || 3)) {
          updateData.status = 'permanently_failed';
        }
      }
    }

    await this.supabase
      .from('embedding_queue')
      .update(updateData)
      .eq('id', queueId);
  }

  /**
   * Get pending queue items
   */
  async getPendingQueueItems(limit: number = 50): Promise<QueueItem[]> {
    const { data, error } = await this.supabase
      .from('embedding_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('retry_count', 3)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Process maintenance tasks (find and queue missing embeddings)
   */
  async processMaintenanceTasks(): Promise<any> {
    const sourceTypes = ['receipts', 'claims', 'team_members', 'custom_categories', 'malaysian_business_directory'];
    let totalQueued = 0;

    for (const sourceType of sourceTypes) {
      try {
        const { data: missingRecords } = await this.supabase.rpc('find_missing_embeddings', {
          source_table: sourceType,
          limit_count: 100
        });

        if (missingRecords && missingRecords.length > 0) {
          // Add to queue
          const queueItems = missingRecords.map((record: any) => ({
            source_type: sourceType,
            source_id: record.id,
            operation: 'INSERT',
            priority: 'low',
            metadata: {
              maintenance_task: true,
              missing_content_types: record.missing_content_types
            }
          }));

          const { error } = await this.supabase
            .from('embedding_queue')
            .insert(queueItems);

          if (!error) {
            totalQueued += queueItems.length;
          }
        }
      } catch (error) {
        console.error(`Error processing maintenance for ${sourceType}:`, error);
      }
    }

    return { maintenanceTasksQueued: totalQueued };
  }
}
