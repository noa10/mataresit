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
import { Claim, ClaimPriority } from '@/types/claims';
import { Edit } from 'lucide-react';

const editClaimSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255, 'Title must be less than 255 characters'),
  description: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.string().min(3, 'Currency is required'),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type EditClaimFormData = z.infer<typeof editClaimSchema>;

interface EditClaimDialogProps {
  claim: Claim | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditClaimDialog({ claim, open, onOpenChange, onSuccess }: EditClaimDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditClaimFormData>({
    resolver: zodResolver(editClaimSchema),
    defaultValues: {
      title: '',
      description: '',
      amount: 0,
      currency: 'USD',
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
        title: 'Success',
        description: 'Claim updated successfully',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating claim:', error);
      toast({
        title: 'Error',
        description: 'Failed to update claim',
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
            Edit Claim
          </DialogTitle>
          <DialogDescription>
            Update the details of your expense claim. Only draft claims can be edited.
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
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter claim title" {...field} />
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
                    <FormLabel>Amount *</FormLabel>
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
                    <FormLabel>Currency *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                        <SelectItem value="AUD">AUD</SelectItem>
                        <SelectItem value="JPY">JPY</SelectItem>
                        <SelectItem value="MYR">MYR</SelectItem>
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
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Travel, Meals, Office Supplies" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional expense category for better organization
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
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide details about this expense claim..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description to provide more context about the expense
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Updating...
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Update Claim
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
