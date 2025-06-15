import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Receipt } from '@/types/receipt';
import { Claim } from '@/types/claims';
import { 
  checkReceiptClaimUsage, 
  getClaimsForReceipt, 
  addReceiptToClaim, 
  removeReceiptFromClaim,
  ReceiptClaimUsage 
} from '@/services/receiptClaimService';

/**
 * Custom hook for managing receipt-claim integration
 */
export function useReceiptClaimIntegration() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  /**
   * Check if receipts are used in claims
   */
  const useReceiptUsage = (receiptIds: string[]) => {
    return useQuery({
      queryKey: ['receipt-usage', receiptIds],
      queryFn: () => checkReceiptClaimUsage(receiptIds),
      enabled: receiptIds.length > 0,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  /**
   * Get claims that use a specific receipt
   */
  const useReceiptClaims = (receiptId: string) => {
    return useQuery({
      queryKey: ['receipt-claims', receiptId],
      queryFn: () => getClaimsForReceipt(receiptId),
      enabled: !!receiptId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  /**
   * Add a receipt to a claim
   */
  const addReceiptToClaimMutation = useCallback(async (claimId: string, receipt: Receipt) => {
    setIsLoading(true);
    try {
      const success = await addReceiptToClaim(claimId, receipt);
      if (success) {
        toast.success('Receipt added to claim successfully');
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['claims'] });
        queryClient.invalidateQueries({ queryKey: ['receipt-usage'] });
        queryClient.invalidateQueries({ queryKey: ['receipt-claims', receipt.id] });
        return true;
      } else {
        toast.error('Failed to add receipt to claim');
        return false;
      }
    } catch (error) {
      console.error('Error adding receipt to claim:', error);
      toast.error('Failed to add receipt to claim');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  /**
   * Remove a receipt from a claim
   */
  const removeReceiptFromClaimMutation = useCallback(async (claimId: string, receiptId: string) => {
    setIsLoading(true);
    try {
      const success = await removeReceiptFromClaim(claimId, receiptId);
      if (success) {
        toast.success('Receipt removed from claim successfully');
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['claims'] });
        queryClient.invalidateQueries({ queryKey: ['receipt-usage'] });
        queryClient.invalidateQueries({ queryKey: ['receipt-claims', receiptId] });
        return true;
      } else {
        toast.error('Failed to remove receipt from claim');
        return false;
      }
    } catch (error) {
      console.error('Error removing receipt from claim:', error);
      toast.error('Failed to remove receipt from claim');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  /**
   * Create a claim from a receipt with pre-filled data
   */
  const createClaimFromReceipt = useCallback((receipt: Receipt) => {
    return {
      title: `Expense - ${receipt.merchant}`,
      description: `Expense claim for ${receipt.merchant} on ${new Date(receipt.date).toLocaleDateString()}`,
      amount: receipt.total,
      currency: receipt.currency,
      category: receipt.predicted_category || undefined,
      attachedReceipts: [receipt],
    };
  }, []);

  /**
   * Get receipt usage summary for display
   */
  const getReceiptUsageSummary = useCallback((usage: ReceiptClaimUsage[]) => {
    const totalReceipts = usage.length;
    const usedReceipts = usage.filter(u => u.isUsedInClaim).length;
    const availableReceipts = totalReceipts - usedReceipts;

    return {
      total: totalReceipts,
      used: usedReceipts,
      available: availableReceipts,
      usagePercentage: totalReceipts > 0 ? Math.round((usedReceipts / totalReceipts) * 100) : 0,
    };
  }, []);

  /**
   * Filter receipts based on usage status
   */
  const filterReceiptsByUsage = useCallback((
    receipts: Receipt[], 
    usage: ReceiptClaimUsage[], 
    showUsed: boolean = true
  ) => {
    const usageMap = new Map(usage.map(u => [u.receiptId, u]));
    
    return receipts.filter(receipt => {
      const receiptUsage = usageMap.get(receipt.id);
      const isUsed = receiptUsage?.isUsedInClaim || false;
      return showUsed ? true : !isUsed;
    });
  }, []);

  /**
   * Get receipts with usage information
   */
  const enrichReceiptsWithUsage = useCallback((
    receipts: Receipt[], 
    usage: ReceiptClaimUsage[]
  ) => {
    const usageMap = new Map(usage.map(u => [u.receiptId, u]));
    
    return receipts.map(receipt => {
      const receiptUsage = usageMap.get(receipt.id);
      return {
        ...receipt,
        isUsedInClaim: receiptUsage?.isUsedInClaim || false,
        claimTitle: receiptUsage?.claimTitle,
        claimId: receiptUsage?.claimId,
        claimStatus: receiptUsage?.claimStatus,
      };
    });
  }, []);

  return {
    // Queries
    useReceiptUsage,
    useReceiptClaims,
    
    // Mutations
    addReceiptToClaimMutation,
    removeReceiptFromClaimMutation,
    
    // Utilities
    createClaimFromReceipt,
    getReceiptUsageSummary,
    filterReceiptsByUsage,
    enrichReceiptsWithUsage,
    
    // State
    isLoading,
  };
}

/**
 * Hook for managing receipt selection in claim creation
 */
export function useReceiptSelection(initialSelection: string[] = []) {
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>(initialSelection);
  const [attachedReceipts, setAttachedReceipts] = useState<Receipt[]>([]);

  const addReceipt = useCallback((receipt: Receipt) => {
    if (!selectedReceiptIds.includes(receipt.id)) {
      setSelectedReceiptIds(prev => [...prev, receipt.id]);
      setAttachedReceipts(prev => [...prev, receipt]);
    }
  }, [selectedReceiptIds]);

  const removeReceipt = useCallback((receiptId: string) => {
    setSelectedReceiptIds(prev => prev.filter(id => id !== receiptId));
    setAttachedReceipts(prev => prev.filter(receipt => receipt.id !== receiptId));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedReceiptIds([]);
    setAttachedReceipts([]);
  }, []);

  const setSelection = useCallback((receiptIds: string[], receipts: Receipt[] = []) => {
    setSelectedReceiptIds(receiptIds);
    setAttachedReceipts(receipts);
  }, []);

  return {
    selectedReceiptIds,
    attachedReceipts,
    addReceipt,
    removeReceipt,
    clearSelection,
    setSelection,
    hasSelection: selectedReceiptIds.length > 0,
    selectionCount: selectedReceiptIds.length,
  };
}
