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
import { useClaimsTranslation } from '@/contexts/LanguageContext';
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
  const { t } = useClaimsTranslation();

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
        title: t('notifications.success'),
        description: t('notifications.claimSubmitted'),
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast({
        title: t('errors.title'),
        description: t('errors.submissionFailed'),
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
            {t('submission.title')}
          </DialogTitle>
          <DialogDescription>
            {t('submission.subtitle')}
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
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('submission.details.amount')}:</span>
                <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                  {formatCurrency(claim.amount, claim.currency)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('submission.details.claimant')}:</span>
                <span className="text-gray-900 dark:text-gray-100">{claim.claimant_name || t('submission.details.you')}</span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('submission.details.created')}:</span>
                <span className="text-gray-900 dark:text-gray-100">{formatDate(claim.created_at)}</span>
              </div>

              {claim.category && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{t('submission.details.category')}:</span>
                  <span className="text-gray-900 dark:text-gray-100">{claim.category}</span>
                </div>
              )}
            </div>

            {claim.description && (
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('submission.details.description')}:</span>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{claim.description}</p>
              </div>
            )}

            {claim.attachments && claim.attachments.length > 0 && (
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('submission.details.attachments')}:</span>
                <p className="mt-1 text-gray-700 dark:text-gray-300">
                  {t('submission.details.attachmentCount', { count: claim.attachments.length })}
                </p>
              </div>
            )}
          </div>

          {/* Validation Status */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('submission.checklist.title')}</h4>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {hasTitle ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={hasTitle ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                  {t('submission.checklist.hasTitle')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasAmount ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={hasAmount ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                  {t('submission.checklist.hasAmount')}
                </span>
              </div>
            </div>
          </div>

          {/* Submission Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Send className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">{t('submission.notice.title')}</p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  {t('submission.notice.message')}
                </p>
              </div>
            </div>
          </div>

          {!isValid && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-800 dark:text-red-200">{t('submission.validation.cannotSubmit')}</p>
                  <p className="text-red-700 dark:text-red-300 mt-1">
                    {t('submission.validation.fixIssues')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {t('submission.actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !isValid}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('submission.actions.submitting')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t('submission.actions.submit')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
