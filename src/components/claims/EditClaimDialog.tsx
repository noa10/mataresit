import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { claimService } from '@/services/claimService';
import { Claim } from '@/types/claims';
import { Edit } from 'lucide-react';
import { useClaimsTranslation } from '@/contexts/LanguageContext';

type EditClaimFormData = {
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
};

interface EditClaimDialogProps {
  claim: Claim | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditClaimDialog({ claim, open, onOpenChange, onSuccess }: EditClaimDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useClaimsTranslation();

  const editClaimSchema = z.object({
    title: z
      .string()
      .min(3, t('edit.validation.titleMin'))
      .max(255, t('edit.validation.titleMax')),
    description: z.string().optional(),
    amount: z.number().min(0.01, t('edit.validation.amountMin')),
    currency: z.string().min(3, t('edit.validation.currency')),
    category: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
  });

  const form = useForm<EditClaimFormData>({
    resolver: zodResolver(editClaimSchema),
    defaultValues: {
      title: '',
      description: '',
      amount: 0,
      currency: 'MYR',
      category: '',
      priority: 'medium',
    },
  });

  // Update form when claim changes
  useEffect(() => {
    if (claim && open) {
      form.reset({
        title: claim.title,
        description: claim.description || '',
        amount: claim.amount,
        currency: claim.currency,
        category: claim.category || '',
        priority: claim.priority,
      });
    }
  }, [claim, open, form]);

  const onSubmit = async (data: EditClaimFormData) => {
    if (!claim) return;

    try {
      setLoading(true);
      
      await claimService.updateClaim(claim.id, {
        title: data.title,
        description: data.description || undefined,
        amount: data.amount,
        currency: data.currency,
        category: data.category || undefined,
        priority: data.priority,
      });

      toast({
        title: t('notifications.success'),
        description: t('edit.notifications.updated'),
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating claim:', error);
      toast({
        title: t('errors.title'),
        description: t('edit.errors.updateFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (claim) {
      form.reset({
        title: claim.title,
        description: claim.description || '',
        amount: claim.amount,
        currency: claim.currency,
        category: claim.category || '',
        priority: claim.priority,
      });
    }
    onOpenChange(false);
  };

  if (!claim) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            {t('edit.title')}
          </DialogTitle>
          <DialogDescription>
            {t('edit.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('edit.form.title')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('edit.placeholders.title')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('edit.form.amount')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('edit.form.currency')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('edit.placeholders.currency')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MYR">MYR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                        <SelectItem value="AUD">AUD</SelectItem>
                        <SelectItem value="JPY">JPY</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('edit.form.category')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('edit.placeholders.category')} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('edit.descriptions.category')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('edit.form.priority')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('edit.placeholders.priority')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">{t('create.priority.low')}</SelectItem>
                        <SelectItem value="medium">{t('create.priority.medium')}</SelectItem>
                        <SelectItem value="high">{t('create.priority.high')}</SelectItem>
                        <SelectItem value="urgent">{t('create.priority.urgent')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('edit.form.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('edit.placeholders.description')}
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('edit.descriptions.description')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {t('edit.actions.cancel')}
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('edit.actions.updating')}
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                {t('edit.actions.update')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
