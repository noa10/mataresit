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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { claimService } from '@/services/claimService';
import {
  Claim,
  CLAIM_STATUS_COLORS,
} from '@/types/claims';
import { cn } from '@/lib/utils';
import { formatCurrencySafe } from '@/utils/currency';
import { useClaimsTranslation } from '@/contexts/LanguageContext';
import {
  XCircle,
  Banknote,
  User,
  AlertTriangle,
} from 'lucide-react';

type RejectionFormData = {
  rejection_reason: string;
};

interface ClaimRejectionDialogProps {
  claim: Claim | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ClaimRejectionDialog({
  claim,
  open,
  onOpenChange,
  onSuccess,
}: ClaimRejectionDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useClaimsTranslation();

  const rejectionSchema = z.object({
    rejection_reason: z
      .string()
      .min(10, t('rejection.validation.min'))
      .max(500, t('rejection.validation.max')),
  });

  const form = useForm<RejectionFormData>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: {
      rejection_reason: '',
    },
  });

  const formatCurrency = (amount: number, currency: string) =>
    formatCurrencySafe(amount, currency);

  const onSubmit = async (data: RejectionFormData) => {
    if (!claim) return;

    try {
      setLoading(true);
      
      await claimService.rejectClaim({
        claim_id: claim.id,
        rejection_reason: data.rejection_reason,
      });

      toast({
        title: t('notifications.success'),
        description: t('notifications.claimRejected'),
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast({
        title: t('errors.title'),
        description: t('errors.rejectFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  if (!claim) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            {t('rejection.title')}
          </DialogTitle>
          <DialogDescription>
            {t('rejection.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Claim Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{claim.title}</h3>
              <Badge variant="outline" className={cn(CLAIM_STATUS_COLORS[claim.status])}>
                {t(`list.status.${claim.status}`)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t('details.information.amount')}:</span>
                <span className="font-semibold text-lg">
                  {formatCurrency(claim.amount, claim.currency)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t('details.information.claimant')}:</span>
                <span>{claim.claimant_name || t('approval.details.unknown')}</span>
              </div>
            </div>

            {claim.category && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{t('details.information.category')}:</span>
                <span>{claim.category}</span>
              </div>
            )}

            {claim.description && (
              <div className="text-sm">
                <span className="font-medium">{t('details.information.description')}:</span>
                <p className="mt-1 text-muted-foreground">{claim.description}</p>
              </div>
            )}
          </div>

          {/* Rejection Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="rejection_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rejection.reasonLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('rejection.reasonPlaceholder')}
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('rejection.reasonHint')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          {/* Warning */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-800 dark:text-red-200">{t('rejection.noticeTitle')}</p>
                <p className="text-red-700 dark:text-red-300 mt-1">
                  {t('rejection.noticeMessage')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {t('rejection.actions.cancel')}
          </Button>
          <Button 
            variant="destructive"
            onClick={form.handleSubmit(onSubmit)} 
            disabled={loading || !form.formState.isValid}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('rejection.actions.rejecting')}
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                {t('rejection.actions.reject')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
