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
import { useClaimsTranslation } from '@/contexts/LanguageContext';
import { claimService } from '@/services/claimService';
import {
  Claim,
  CLAIM_STATUS_COLORS,
  getClaimStatusDisplayName,
} from '@/types/claims';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  DollarSign,
  User,
  FileText,
} from 'lucide-react';

const approvalSchema = z.object({
  comment: z.string().optional(),
});

type ApprovalFormData = z.infer<typeof approvalSchema>;

interface ClaimApprovalDialogProps {
  claim: Claim | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ClaimApprovalDialog({
  claim,
  open,
  onOpenChange,
  onSuccess,
}: ClaimApprovalDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useClaimsTranslation();

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      comment: '',
    },
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const onSubmit = async (data: ApprovalFormData) => {
    if (!claim) return;

    try {
      setLoading(true);
      
      await claimService.approveClaim({
        claim_id: claim.id,
        comment: data.comment || undefined,
      });

      toast({
        title: t('notifications.success'),
        description: t('notifications.claimApproved'),
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error approving claim:', error);
      toast({
        title: t('errors.title'),
        description: t('errors.approveFailed'),
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
            <CheckCircle className="h-5 w-5 text-green-600" />
            {t('approval.title')}
          </DialogTitle>
          <DialogDescription>
            {t('approval.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Claim Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{claim.title}</h3>
              <Badge variant="outline" className={cn(CLAIM_STATUS_COLORS[claim.status])}>
                {getClaimStatusDisplayName(claim.status)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t('approval.details.amount')}:</span>
                <span className="font-semibold text-lg">
                  {formatCurrency(claim.amount, claim.currency)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t('approval.details.claimant')}:</span>
                <span>{claim.claimant_name || t('approval.details.unknown')}</span>
              </div>
            </div>

            {claim.category && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{t('approval.details.category')}:</span>
                <span>{claim.category}</span>
              </div>
            )}

            {claim.description && (
              <div className="text-sm">
                <span className="font-medium">{t('approval.details.description')}:</span>
                <p className="mt-1 text-muted-foreground">{claim.description}</p>
              </div>
            )}
          </div>

          {/* Approval Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('approval.form.comment')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('approval.placeholders.comment')}
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('approval.descriptions.comment')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          {/* Warning */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-800 dark:text-green-200">{t('approval.confirmation.title')}</p>
                <p className="text-green-700 dark:text-green-300 mt-1">
                  {t('approval.confirmation.message')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {t('approval.actions.cancel')}
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('approval.actions.approving')}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('approval.actions.approve')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
