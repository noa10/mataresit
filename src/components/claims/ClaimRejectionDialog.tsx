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
  getClaimStatusDisplayName,
} from '@/types/claims';
import { cn } from '@/lib/utils';
import {
  XCircle,
  DollarSign,
  User,
  AlertTriangle,
} from 'lucide-react';

const rejectionSchema = z.object({
  rejection_reason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500, 'Rejection reason must be less than 500 characters'),
});

type RejectionFormData = z.infer<typeof rejectionSchema>;

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

  const form = useForm<RejectionFormData>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: {
      rejection_reason: '',
    },
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const onSubmit = async (data: RejectionFormData) => {
    if (!claim) return;

    try {
      setLoading(true);
      
      await claimService.rejectClaim({
        claim_id: claim.id,
        rejection_reason: data.rejection_reason,
      });

      toast({
        title: 'Success',
        description: 'Claim rejected successfully',
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject claim',
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
            Reject Claim
          </DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting this expense claim. The claimant will be notified.
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
                <span className="font-medium">Amount:</span>
                <span className="font-semibold text-lg">
                  {formatCurrency(claim.amount, claim.currency)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Claimant:</span>
                <span>{claim.claimant_name || 'Unknown'}</span>
              </div>
            </div>

            {claim.category && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Category:</span>
                <span>{claim.category}</span>
              </div>
            )}

            {claim.description && (
              <div className="text-sm">
                <span className="font-medium">Description:</span>
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
                    <FormLabel>Rejection Reason *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide a clear reason for rejecting this claim..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific about why the claim is being rejected. This will help the claimant understand what needs to be corrected.
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
                <p className="font-medium text-red-800 dark:text-red-200">Rejection Notice</p>
                <p className="text-red-700 dark:text-red-300 mt-1">
                  Rejecting this claim will notify the claimant via email and in-app notification. 
                  They may resubmit the claim after addressing the issues mentioned in your rejection reason.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={form.handleSubmit(onSubmit)} 
            disabled={loading || !form.formState.isValid}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Rejecting...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Reject Claim
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
