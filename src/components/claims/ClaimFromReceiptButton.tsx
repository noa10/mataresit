import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateClaimDialog } from './CreateClaimDialog';
import { Receipt } from '@/types/receipt';
import { formatCurrencySafe } from '@/utils/currency';

interface ClaimFromReceiptButtonProps {
  receipt: Receipt;
  onClaimCreated?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function ClaimFromReceiptButton({
  receipt,
  onClaimCreated,
  variant = 'outline',
  size = 'sm',
  className = '',
}: ClaimFromReceiptButtonProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateClaim = () => {
    setShowPreview(false);
    setShowCreateDialog(true);
  };

  const handleClaimSuccess = () => {
    setShowCreateDialog(false);
    onClaimCreated?.();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowPreview(true)}
      >
        <FileText className="h-4 w-4 mr-2" />
        Create Claim
      </Button>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Create Claim from Receipt
            </DialogTitle>
            <DialogDescription>
              Review the receipt details that will be used to create your claim.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Receipt preview */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3">Receipt Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merchant:</span>
                  <span className="font-medium">{receipt.merchant}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{new Date(receipt.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {formatCurrencySafe(receipt.total, receipt.currency)}
                  </span>
                </div>
                {receipt.payment_method && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment:</span>
                    <span>{receipt.payment_method}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Claim preview */}
            <div className="border rounded-lg p-4 bg-primary/5">
              <h4 className="font-medium mb-3">Claim to be Created</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Title:</span>
                  <span className="font-medium">Expense - {receipt.merchant}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {formatCurrencySafe(receipt.total, receipt.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <span>{receipt.predicted_category || 'General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attachments:</span>
                  <span>1 receipt</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowPreview(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateClaim}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Claim
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create claim dialog with pre-filled data */}
      <CreateClaimDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleClaimSuccess}
        prefilledData={{
          title: `Expense - ${receipt.merchant}`,
          description: `Expense claim for ${receipt.merchant} on ${new Date(receipt.date).toLocaleDateString()}`,
          amount: receipt.total,
          currency: receipt.currency,
          category: receipt.predicted_category || undefined,
          attachedReceipts: [receipt],
        }}
      />
    </>
  );
}

interface QuickClaimFromReceiptProps {
  receipt: Receipt;
  onClaimCreated?: () => void;
  className?: string;
}

export function QuickClaimFromReceipt({
  receipt,
  onClaimCreated,
  className = '',
}: QuickClaimFromReceiptProps) {
  const [isCreating, setIsCreating] = useState(false);

  const handleQuickCreate = async () => {
    setIsCreating(true);
    try {
      // This would directly create a claim without showing dialogs
      // Implementation would depend on your specific requirements
      // For now, we'll use the regular flow
      onClaimCreated?.();
    } catch (error) {
      console.error('Error creating quick claim:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`text-xs ${className}`}
      onClick={handleQuickCreate}
      disabled={isCreating}
    >
      {isCreating ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <Plus className="h-3 w-3 mr-1" />
      )}
      Quick Claim
    </Button>
  );
}

// Hook for checking if a receipt is already used in claims
export function useReceiptClaimStatus(receiptId: string) {
  // This would query the claims to see if this receipt is already attached
  // For now, returning a placeholder
  return {
    isUsedInClaim: false,
    claimId: null,
    claimTitle: null,
    isLoading: false,
  };
}
