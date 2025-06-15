import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { claimService } from '@/services/claimService';
import {
  Claim,
  CLAIM_STATUS_COLORS,
  CLAIM_PRIORITY_COLORS,
  getClaimStatusDisplayName,
  getClaimPriorityDisplayName,
} from '@/types/claims';
import { cn } from '@/lib/utils';
import {
  Send,
  DollarSign,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface ClaimSubmissionDialogProps {
  claim: Claim | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ClaimSubmissionDialog({
  claim,
  open,
  onOpenChange,
  onSuccess,
}: ClaimSubmissionDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSubmit = async () => {
    if (!claim) return;

    try {
      setLoading(true);
      
      await claimService.submitClaim(claim.id);

      toast({
        title: 'Success',
        description: 'Claim submitted for review successfully',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit claim',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!claim) return null;

  // Validation checks
  const hasTitle = claim.title && claim.title.trim().length > 0;
  const hasAmount = claim.amount > 0;
  const isValid = hasTitle && hasAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            Submit Claim for Review
          </DialogTitle>
          <DialogDescription>
            Review your claim details before submitting for approval. Once submitted, you won't be able to edit the claim.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Claim Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{claim.title}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(CLAIM_STATUS_COLORS[claim.status])}>
                  {getClaimStatusDisplayName(claim.status)}
                </Badge>
                <Badge variant="outline" className={cn(CLAIM_PRIORITY_COLORS[claim.priority])}>
                  {getClaimPriorityDisplayName(claim.priority)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Amount:</span>
                <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                  {formatCurrency(claim.amount, claim.currency)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Claimant:</span>
                <span className="text-gray-900 dark:text-gray-100">{claim.claimant_name || 'You'}</span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Created:</span>
                <span className="text-gray-900 dark:text-gray-100">{formatDate(claim.created_at)}</span>
              </div>

              {claim.category && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Category:</span>
                  <span className="text-gray-900 dark:text-gray-100">{claim.category}</span>
                </div>
              )}
            </div>

            {claim.description && (
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">Description:</span>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{claim.description}</p>
              </div>
            )}

            {claim.attachments && claim.attachments.length > 0 && (
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">Attachments:</span>
                <p className="mt-1 text-gray-700 dark:text-gray-300">
                  {claim.attachments.length} file(s) attached
                </p>
              </div>
            )}
          </div>

          {/* Validation Status */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Submission Checklist</h4>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {hasTitle ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={hasTitle ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                  Claim has a title
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasAmount ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={hasAmount ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                  Amount is greater than zero
                </span>
              </div>
            </div>
          </div>

          {/* Submission Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Send className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">Submission Notice</p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  Once submitted, your claim will be reviewed by team administrators.
                  You will receive notifications about the approval status.
                  You won't be able to edit the claim after submission.
                </p>
              </div>
            </div>
          </div>

          {!isValid && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-800 dark:text-red-200">Cannot Submit</p>
                  <p className="text-red-700 dark:text-red-300 mt-1">
                    Please fix the issues above before submitting your claim.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !isValid}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit for Review
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
