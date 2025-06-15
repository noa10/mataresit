import { supabase } from '@/integrations/supabase/client';
import { Claim } from '@/types/claims';
import { Receipt } from '@/types/receipt';

export interface ReceiptClaimUsage {
  receiptId: string;
  isUsedInClaim: boolean;
  claimId?: string;
  claimTitle?: string;
  claimStatus?: string;
}

/**
 * Check if receipts are already used in claims
 */
export async function checkReceiptClaimUsage(receiptIds: string[]): Promise<ReceiptClaimUsage[]> {
  if (receiptIds.length === 0) {
    return [];
  }

  try {
    // Fetch all claims that might contain these receipts
    const { data: claims, error } = await supabase
      .from('claims')
      .select('id, title, status, attachments')
      .not('attachments', 'is', null);

    if (error) {
      console.error('Error fetching claims for receipt usage check:', error);
      return receiptIds.map(id => ({
        receiptId: id,
        isUsedInClaim: false,
      }));
    }

    // Create a map to track receipt usage
    const usageMap = new Map<string, ReceiptClaimUsage>();
    
    // Initialize all receipts as unused
    receiptIds.forEach(id => {
      usageMap.set(id, {
        receiptId: id,
        isUsedInClaim: false,
      });
    });

    // Check each claim's attachments for receipt references
    claims?.forEach(claim => {
      if (!claim.attachments || claim.attachments.length === 0) return;

      claim.attachments.forEach((attachment: string) => {
        try {
          const parsed = JSON.parse(attachment);
          if (parsed.type === 'receipt' && parsed.receiptId) {
            const receiptId = parsed.receiptId;
            if (usageMap.has(receiptId)) {
              usageMap.set(receiptId, {
                receiptId,
                isUsedInClaim: true,
                claimId: claim.id,
                claimTitle: claim.title,
                claimStatus: claim.status,
              });
            }
          }
        } catch (e) {
          // Handle legacy string attachments or other formats
          console.log('Could not parse attachment for usage check:', attachment);
        }
      });
    });

    return Array.from(usageMap.values());
  } catch (error) {
    console.error('Error checking receipt claim usage:', error);
    return receiptIds.map(id => ({
      receiptId: id,
      isUsedInClaim: false,
    }));
  }
}

/**
 * Get all receipts that are used in claims for a specific user
 */
export async function getUsedReceiptIds(): Promise<string[]> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return [];

    // Get all claims for the user's teams
    const { data: claims, error } = await supabase
      .from('claims')
      .select('attachments')
      .not('attachments', 'is', null);

    if (error) {
      console.error('Error fetching used receipt IDs:', error);
      return [];
    }

    const usedReceiptIds = new Set<string>();

    claims?.forEach(claim => {
      if (!claim.attachments || claim.attachments.length === 0) return;

      claim.attachments.forEach((attachment: string) => {
        try {
          const parsed = JSON.parse(attachment);
          if (parsed.type === 'receipt' && parsed.receiptId) {
            usedReceiptIds.add(parsed.receiptId);
          }
        } catch (e) {
          // Handle legacy string attachments
          console.log('Could not parse attachment for used receipt check:', attachment);
        }
      });
    });

    return Array.from(usedReceiptIds);
  } catch (error) {
    console.error('Error getting used receipt IDs:', error);
    return [];
  }
}

/**
 * Get claims that use a specific receipt
 */
export async function getClaimsForReceipt(receiptId: string): Promise<Claim[]> {
  try {
    const { data: claims, error } = await supabase
      .from('claims')
      .select(`
        *,
        claimant_name:claimant_id(full_name),
        reviewer_name:reviewed_by(full_name),
        approver_name:approved_by(full_name)
      `)
      .not('attachments', 'is', null);

    if (error) {
      console.error('Error fetching claims for receipt:', error);
      return [];
    }

    const matchingClaims: Claim[] = [];

    claims?.forEach(claim => {
      if (!claim.attachments || claim.attachments.length === 0) return;

      const hasReceipt = claim.attachments.some((attachment: string) => {
        try {
          const parsed = JSON.parse(attachment);
          return parsed.type === 'receipt' && parsed.receiptId === receiptId;
        } catch (e) {
          return false;
        }
      });

      if (hasReceipt) {
        matchingClaims.push(claim as Claim);
      }
    });

    return matchingClaims;
  } catch (error) {
    console.error('Error getting claims for receipt:', error);
    return [];
  }
}

/**
 * Remove a receipt from a claim's attachments
 */
export async function removeReceiptFromClaim(claimId: string, receiptId: string): Promise<boolean> {
  try {
    // First, get the current claim
    const { data: claim, error: fetchError } = await supabase
      .from('claims')
      .select('attachments')
      .eq('id', claimId)
      .single();

    if (fetchError || !claim) {
      console.error('Error fetching claim for receipt removal:', fetchError);
      return false;
    }

    if (!claim.attachments || claim.attachments.length === 0) {
      return true; // Nothing to remove
    }

    // Filter out the receipt attachment
    const updatedAttachments = claim.attachments.filter((attachment: string) => {
      try {
        const parsed = JSON.parse(attachment);
        return !(parsed.type === 'receipt' && parsed.receiptId === receiptId);
      } catch (e) {
        // Keep non-receipt attachments
        return true;
      }
    });

    // Update the claim with the filtered attachments
    const { error: updateError } = await supabase
      .from('claims')
      .update({ attachments: updatedAttachments })
      .eq('id', claimId);

    if (updateError) {
      console.error('Error updating claim attachments:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error removing receipt from claim:', error);
    return false;
  }
}

/**
 * Add a receipt to a claim's attachments
 */
export async function addReceiptToClaim(claimId: string, receipt: Receipt): Promise<boolean> {
  try {
    // First, get the current claim
    const { data: claim, error: fetchError } = await supabase
      .from('claims')
      .select('attachments')
      .eq('id', claimId)
      .single();

    if (fetchError || !claim) {
      console.error('Error fetching claim for receipt addition:', fetchError);
      return false;
    }

    // Create the receipt attachment object
    const receiptAttachment = {
      type: 'receipt',
      receiptId: receipt.id,
      url: receipt.image_url,
      metadata: {
        merchant: receipt.merchant,
        date: receipt.date,
        total: receipt.total,
        currency: receipt.currency,
      }
    };

    // Add to existing attachments
    const currentAttachments = claim.attachments || [];
    const updatedAttachments = [...currentAttachments, JSON.stringify(receiptAttachment)];

    // Update the claim
    const { error: updateError } = await supabase
      .from('claims')
      .update({ attachments: updatedAttachments })
      .eq('id', claimId);

    if (updateError) {
      console.error('Error updating claim with new receipt:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding receipt to claim:', error);
    return false;
  }
}
