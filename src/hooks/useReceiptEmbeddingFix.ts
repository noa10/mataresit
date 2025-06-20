/**
 * React Hook for Receipt Embedding Fix
 * Manages the process of fixing receipt content storage issues
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalysisResult {
  analysis: {
    totalEmbeddings: number;
    emptyContentCount: number;
    hasContentCount: number;
    emptyContentPercentage: number;
    contentTypeBreakdown: Record<string, { total: number; empty: number; hasContent: number }>;
  };
  sampleReceipts: Array<{
    id: string;
    merchant: string;
    hasFullText: boolean;
    fullTextLength: number;
  }>;
  recommendations: string[];
}

interface FixResult {
  totalReceipts: number;
  processedReceipts: number;
  totalFixes: number;
  successfulFixes: number;
  failedFixes: number;
  successRate: number;
  dryRun: boolean;
}

interface VerificationResult {
  verification: {
    totalEmbeddings: number;
    emptyContentCount: number;
    hasContentCount: number;
    fixSuccessRate: number;
    contentTypeBreakdown: Record<string, { total: number; empty: number; hasContent: number }>;
  };
  status: 'FULLY_FIXED' | 'PARTIALLY_FIXED';
  remainingIssues: number;
}

interface UseReceiptEmbeddingFixReturn {
  // State
  analysis: AnalysisResult | null;
  fixResult: FixResult | null;
  verification: VerificationResult | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  analyzeIssue: () => Promise<void>;
  fixAllEmbeddings: (dryRun?: boolean, batchSize?: number) => Promise<void>;
  fixSpecificReceipts: (receiptIds: string[], dryRun?: boolean) => Promise<void>;
  verifyFixes: () => Promise<void>;
  clearResults: () => void;
  
  // Utilities
  getFixProgress: () => {
    isComplete: boolean;
    progressPercentage: number;
    statusMessage: string;
  };
}

export function useReceiptEmbeddingFix(): UseReceiptEmbeddingFixReturn {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Call the fix-receipt-embeddings Edge Function
   */
  const callFixFunction = useCallback(async (action: string, params: any = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke('fix-receipt-embeddings', {
        body: { action, ...params }
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Function call failed');
      }

      return data.data;
    } catch (err) {
      console.error('Fix function error:', err);
      throw err;
    }
  }, []);

  /**
   * Analyze the current content storage issue
   */
  const analyzeIssue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Analyzing receipt content storage issue...');
      const result = await callFixFunction('analyze');
      
      setAnalysis(result);
      
      toast.info(`Analysis complete: ${result.analysis.emptyContentCount} embeddings need fixing`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze issue';
      setError(errorMessage);
      toast.error(`Analysis failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [callFixFunction]);

  /**
   * Fix all receipt embeddings
   */
  const fixAllEmbeddings = useCallback(async (dryRun: boolean = false, batchSize: number = 10) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`🔧 ${dryRun ? 'Simulating' : 'Executing'} fix for all receipt embeddings...`);
      
      const result = await callFixFunction('fix_all', {
        batchSize,
        dryRun
      });
      
      setFixResult(result);
      
      if (dryRun) {
        toast.info(`Dry run complete: ${result.successfulFixes}/${result.totalFixes} fixes would succeed`);
      } else {
        toast.success(`Fix complete: ${result.successfulFixes}/${result.totalFixes} embeddings fixed (${result.successRate}% success rate)`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fix embeddings';
      setError(errorMessage);
      toast.error(`Fix failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [callFixFunction]);

  /**
   * Fix specific receipt embeddings
   */
  const fixSpecificReceipts = useCallback(async (receiptIds: string[], dryRun: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`🔧 ${dryRun ? 'Simulating' : 'Executing'} fix for ${receiptIds.length} specific receipts...`);
      
      const result = await callFixFunction('fix_batch', {
        receiptIds,
        dryRun
      });
      
      setFixResult(result);
      
      if (dryRun) {
        toast.info(`Dry run complete: ${result.successfulFixes}/${result.totalFixes} fixes would succeed`);
      } else {
        toast.success(`Fix complete: ${result.successfulFixes}/${result.totalFixes} embeddings fixed`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fix specific receipts';
      setError(errorMessage);
      toast.error(`Fix failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [callFixFunction]);

  /**
   * Verify that fixes were successful
   */
  const verifyFixes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('✅ Verifying receipt embedding fixes...');
      const result = await callFixFunction('verify');
      
      setVerification(result);
      
      if (result.status === 'FULLY_FIXED') {
        toast.success(`Verification complete: All embeddings fixed! (${result.verification.fixSuccessRate}% success rate)`);
      } else {
        toast.warning(`Verification complete: ${result.remainingIssues} issues remain (${result.verification.fixSuccessRate}% fixed)`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify fixes';
      setError(errorMessage);
      toast.error(`Verification failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [callFixFunction]);

  /**
   * Clear all results
   */
  const clearResults = useCallback(() => {
    setAnalysis(null);
    setFixResult(null);
    setVerification(null);
    setError(null);
    console.log('🗑️ Cleared all fix results');
  }, []);

  /**
   * Get fix progress information
   */
  const getFixProgress = useCallback(() => {
    if (!analysis && !fixResult && !verification) {
      return {
        isComplete: false,
        progressPercentage: 0,
        statusMessage: 'Ready to analyze receipt embedding issues'
      };
    }

    if (analysis && !fixResult) {
      return {
        isComplete: false,
        progressPercentage: 25,
        statusMessage: `Analysis complete: ${analysis.analysis.emptyContentCount} embeddings need fixing`
      };
    }

    if (fixResult && !verification) {
      return {
        isComplete: false,
        progressPercentage: 75,
        statusMessage: `Fix ${fixResult.dryRun ? 'simulated' : 'executed'}: ${fixResult.successfulFixes}/${fixResult.totalFixes} successful (${fixResult.successRate}%)`
      };
    }

    if (verification) {
      const isFullyFixed = verification.status === 'FULLY_FIXED';
      return {
        isComplete: isFullyFixed,
        progressPercentage: 100,
        statusMessage: isFullyFixed 
          ? `All embeddings fixed! (${verification.verification.fixSuccessRate}% success rate)`
          : `${verification.remainingIssues} issues remain (${verification.verification.fixSuccessRate}% fixed)`
      };
    }

    return {
      isComplete: false,
      progressPercentage: 0,
      statusMessage: 'Unknown status'
    };
  }, [analysis, fixResult, verification]);

  return {
    // State
    analysis,
    fixResult,
    verification,
    loading,
    error,
    
    // Actions
    analyzeIssue,
    fixAllEmbeddings,
    fixSpecificReceipts,
    verifyFixes,
    clearResults,
    
    // Utilities
    getFixProgress
  };
}

export default useReceiptEmbeddingFix;
