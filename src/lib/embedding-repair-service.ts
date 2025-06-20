/**
 * Embedding Repair Service for Mataresit
 * Handles auditing and fixing embedding generation issues
 */

import { callEdgeFunction } from './edge-function-utils';
import { supabase } from './supabase';

export interface EmbeddingAuditResult {
  totalReceipts: number;
  receiptsWithOldEmbeddings: number;
  receiptsWithUnifiedEmbeddings: number;
  receiptsMissingEmbeddings: number;
  migrationNeeded: boolean;
  embeddingHealthByType: Array<{
    source_type: string;
    content_type: string;
    total_embeddings: number;
    empty_content: number;
    has_content: number;
    content_health_percentage: number;
  }>;
  missingEmbeddingsSample: Array<{
    receipt_id: string;
    merchant: string;
    date: string;
    missing_content_types: string[];
  }>;
}

export interface EmbeddingRepairProgress {
  phase: 'audit' | 'migrate' | 'fix_content' | 'generate_missing' | 'complete';
  progress: number;
  message: string;
  details?: any;
}

export class EmbeddingRepairService {
  private progressCallback?: (progress: EmbeddingRepairProgress) => void;

  constructor(progressCallback?: (progress: EmbeddingRepairProgress) => void) {
    this.progressCallback = progressCallback;
  }

  /**
   * Perform comprehensive embedding audit
   */
  async auditEmbeddings(): Promise<EmbeddingAuditResult> {
    this.updateProgress('audit', 10, 'Starting embedding audit...');

    try {
      const response = await callEdgeFunction('audit-embeddings', 'POST', {
        action: 'audit'
      });

      if (!response.success) {
        throw new Error(response.error || 'Audit failed');
      }

      this.updateProgress('audit', 100, 'Audit completed');
      return response.audit;

    } catch (error) {
      console.error('Embedding audit failed:', error);
      throw new Error(`Audit failed: ${error.message}`);
    }
  }

  /**
   * Perform complete embedding repair process
   */
  async repairEmbeddings(): Promise<{
    success: boolean;
    audit: EmbeddingAuditResult;
    migrationResult?: any;
    fixResult?: any;
    generationResult?: any;
    summary: string;
  }> {
    try {
      // Step 1: Audit current state
      this.updateProgress('audit', 0, 'Auditing current embedding state...');
      const audit = await this.auditEmbeddings();

      let migrationResult = null;
      let fixResult = null;
      let generationResult = null;

      // Step 2: Migrate old embeddings if needed
      if (audit.migrationNeeded) {
        this.updateProgress('migrate', 25, 'Migrating old embeddings to unified format...');
        migrationResult = await this.migrateEmbeddings();
      }

      // Step 3: Fix content issues
      const hasContentIssues = audit.embeddingHealthByType.some(
        type => type.content_health_percentage < 80
      );

      if (hasContentIssues) {
        this.updateProgress('fix_content', 50, 'Fixing embedding content issues...');
        fixResult = await this.fixEmbeddingContent();
      }

      // Step 4: Generate missing embeddings
      if (audit.receiptsMissingEmbeddings > 0) {
        this.updateProgress('generate_missing', 75, 'Generating missing embeddings...');
        generationResult = await this.generateMissingEmbeddings();
      }

      this.updateProgress('complete', 100, 'Embedding repair completed successfully');

      // Generate summary
      const summary = this.generateRepairSummary(audit, migrationResult, fixResult, generationResult);

      return {
        success: true,
        audit,
        migrationResult,
        fixResult,
        generationResult,
        summary
      };

    } catch (error) {
      console.error('Embedding repair failed:', error);
      throw new Error(`Repair failed: ${error.message}`);
    }
  }

  /**
   * Migrate existing receipt embeddings to unified format
   */
  async migrateEmbeddings(): Promise<any> {
    try {
      const response = await callEdgeFunction('audit-embeddings', 'POST', {
        action: 'migrate'
      });

      if (!response.success) {
        throw new Error(response.error || 'Migration failed');
      }

      return response.migration;

    } catch (error) {
      console.error('Embedding migration failed:', error);
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Fix embedding content issues
   */
  async fixEmbeddingContent(): Promise<any> {
    try {
      const response = await callEdgeFunction('audit-embeddings', 'POST', {
        action: 'fix_content'
      });

      if (!response.success) {
        throw new Error(response.error || 'Content fix failed');
      }

      return response.fixes;

    } catch (error) {
      console.error('Embedding content fix failed:', error);
      throw new Error(`Content fix failed: ${error.message}`);
    }
  }

  /**
   * Generate missing embeddings
   */
  async generateMissingEmbeddings(): Promise<any> {
    try {
      const response = await callEdgeFunction('audit-embeddings', 'POST', {
        action: 'generate_missing'
      });

      if (!response.success) {
        throw new Error(response.error || 'Generation failed');
      }

      return response;

    } catch (error) {
      console.error('Missing embedding generation failed:', error);
      throw new Error(`Generation failed: ${error.message}`);
    }
  }

  /**
   * Get current embedding statistics
   */
  async getEmbeddingStats(): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_unified_search_stats');

      if (error) {
        throw new Error(`Stats error: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error('Failed to get embedding stats:', error);
      throw new Error(`Stats failed: ${error.message}`);
    }
  }

  /**
   * Check if embeddings are healthy
   */
  async checkEmbeddingHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const audit = await this.auditEmbeddings();
      
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check for missing embeddings
      if (audit.receiptsMissingEmbeddings > 0) {
        issues.push(`${audit.receiptsMissingEmbeddings} receipts missing embeddings`);
        recommendations.push('Run embedding generation for missing receipts');
      }

      // Check for migration needs
      if (audit.migrationNeeded) {
        issues.push('Old embeddings need migration to unified format');
        recommendations.push('Run embedding migration');
      }

      // Check content health
      const unhealthyTypes = audit.embeddingHealthByType.filter(
        type => type.content_health_percentage < 80
      );

      if (unhealthyTypes.length > 0) {
        issues.push(`${unhealthyTypes.length} content types have health issues`);
        recommendations.push('Run content fix for unhealthy embeddings');
      }

      // Check if search will work
      if (audit.totalReceipts > 0 && audit.receiptsWithUnifiedEmbeddings === 0) {
        issues.push('No unified embeddings found - search will not work');
        recommendations.push('Generate embeddings for all receipts');
      }

      return {
        healthy: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error) {
      console.error('Health check failed:', error);
      return {
        healthy: false,
        issues: ['Health check failed'],
        recommendations: ['Check system logs and try again']
      };
    }
  }

  /**
   * Update progress callback
   */
  private updateProgress(phase: EmbeddingRepairProgress['phase'], progress: number, message: string, details?: any) {
    if (this.progressCallback) {
      this.progressCallback({ phase, progress, message, details });
    }
  }

  /**
   * Generate repair summary
   */
  private generateRepairSummary(
    audit: EmbeddingAuditResult,
    migrationResult: any,
    fixResult: any,
    generationResult: any
  ): string {
    const parts: string[] = [];

    parts.push(`Audit found ${audit.totalReceipts} total receipts`);

    if (migrationResult) {
      parts.push(`Migrated ${migrationResult.migrated_count || 0} embeddings to unified format`);
    }

    if (fixResult && Array.isArray(fixResult)) {
      const fixed = fixResult.filter((r: any) => r.success).length;
      parts.push(`Fixed content for ${fixed} embeddings`);
    }

    if (generationResult) {
      parts.push(`Queued ${generationResult.queued || 0} receipts for embedding generation`);
    }

    if (parts.length === 1) {
      parts.push('No repairs were needed - system is healthy');
    }

    return parts.join('. ') + '.';
  }
}

// Export singleton instance
export const embeddingRepairService = new EmbeddingRepairService();
