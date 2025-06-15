import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useTeam } from '@/contexts/TeamContext';
import { claimService } from '@/services/claimService';
import { ClaimPriority } from '@/types/claims';
import { Receipt } from '@/types/receipt';
import { ReceiptPicker } from './ReceiptPicker';
import { ReceiptPreview } from './ReceiptPreview';
import { fetchReceipts } from '@/services/receiptService';
import { useQuery } from '@tanstack/react-query';

const createClaimSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255, 'Title must be less than 255 characters'),
  description: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.string().min(3, 'Currency is required'),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type CreateClaimFormData = z.infer<typeof createClaimSchema>;

interface PrefilledClaimData {
  title?: string;
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  priority?: ClaimPriority;
  attachedReceipts?: Receipt[];
}

interface CreateClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prefilledData?: PrefilledClaimData;
}

export function CreateClaimDialog({
  open,
  onOpenChange,
  onSuccess,
  prefilledData
}: CreateClaimDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const { currentTeam } = useTeam();
  const { toast } = useToast();

  const form = useForm<CreateClaimFormData>({
    resolver: zodResolver(createClaimSchema),
    defaultValues: {
      title: '',
      description: '',
      amount: 0,
      currency: 'USD',
      category: '',
      priority: 'medium',
    },
  });

  // Fetch all receipts for selection
  const { data: allReceipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: fetchReceipts,
    enabled: open, // Only fetch when dialog is open
  });

  // Get attached receipts based on selected IDs
  const attachedReceipts = useMemo(() => {
    return allReceipts.filter(receipt => selectedReceiptIds.includes(receipt.id));
  }, [allReceipts, selectedReceiptIds]);

  // Handle prefilled data - use useCallback to prevent infinite loops
  const handlePrefilledData = useCallback(() => {
    if (prefilledData && open) {
      if (prefilledData.title) form.setValue('title', prefilledData.title);
      if (prefilledData.description) form.setValue('description', prefilledData.description);
      if (prefilledData.amount) form.setValue('amount', prefilledData.amount);
      if (prefilledData.currency) form.setValue('currency', prefilledData.currency);
      if (prefilledData.category) form.setValue('category', prefilledData.category);
      if (prefilledData.priority) form.setValue('priority', prefilledData.priority);
      if (prefilledData.attachedReceipts) {
        setSelectedReceiptIds(prefilledData.attachedReceipts.map(r => r.id));
      }
    }
  }, [prefilledData, open, form]);

  // Apply prefilled data when dialog opens or prefilled data changes
  useEffect(() => {
    handlePrefilledData();
  }, [handlePrefilledData]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setSelectedReceiptIds([]);
    }
  }, [open, form]);

  // Handle receipt selection changes - use useCallback to prevent infinite loops
  const handleReceiptSelectionChange = useCallback((receiptIds: string[]) => {
    console.log('🎯 CreateClaimDialog received selection change:', receiptIds);
    console.log('📋 Previous selectedReceiptIds:', selectedReceiptIds);
    setSelectedReceiptIds(receiptIds);
    console.log('✅ Updated selectedReceiptIds to:', receiptIds);
  }, [selectedReceiptIds]);

  // Handle removing a receipt - use useCallback to prevent infinite loops
  const handleRemoveReceipt = useCallback((receiptId: string) => {
    setSelectedReceiptIds(prev => prev.filter(id => id !== receiptId));
  }, []);

  const onSubmit = async (data: CreateClaimFormData) => {
    if (!currentTeam) {
      toast({
        title: 'Error',
        description: 'No team selected',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // Prepare attachments array with receipt metadata
      const attachments = attachedReceipts.map(receipt => ({
        type: 'receipt',
        receiptId: receipt.id,
        url: receipt.image_url,
        metadata: {
          merchant: receipt.merchant,
          date: receipt.date,
          total: receipt.total,
          currency: receipt.currency,
        }
      }));

      await claimService.createClaim({
        team_id: currentTeam.id,
        title: data.title,
        description: data.description || undefined,
        amount: data.amount,
        currency: data.currency,
        category: data.category || undefined,
        priority: data.priority,
        attachments: attachments.length > 0 ? attachments.map(a => JSON.stringify(a)) : undefined,
      });

      toast({
        title: 'Success',
        description: 'Claim created successfully',
      });

      form.reset();
      setSelectedReceiptIds([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating claim:', error);
      toast({
        title: 'Error',
        description: 'Failed to create claim',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[800px] h-[95vh] max-h-[800px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle>Create New Claim</DialogTitle>
          <DialogDescription>
            Create a new expense claim for review and approval.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              <Tabs defaultValue="details" className="flex flex-col h-full">
                <div className="px-4 py-2 border-b shrink-0">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">Claim Details</TabsTrigger>
                    <TabsTrigger value="receipts">
                      Receipts {attachedReceipts.length > 0 && `(${attachedReceipts.length})`}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <TabsContent value="details" className="space-y-4 p-4 m-0 h-full">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter claim title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter claim description (optional)"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
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
                            <FormLabel>Currency</FormLabel>
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
                                <SelectItem value="MYR">MYR</SelectItem>
                                <SelectItem value="SGD">SGD</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                        Optional category for organizing claims
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
                  </TabsContent>

                  <TabsContent value="receipts" className="space-y-4 p-4 m-0 h-full">
                    {receiptsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-2 text-sm text-muted-foreground">Loading receipts...</span>
                      </div>
                    ) : (
                      <>
                        <ReceiptPicker
                          selectedReceiptIds={selectedReceiptIds}
                          onSelectionChange={handleReceiptSelectionChange}
                          multiSelect={true}
                        />

                        {attachedReceipts.length > 0 && (
                          <>
                            <Separator />
                            <ReceiptPreview
                              receipts={attachedReceipts}
                              onRemoveReceipt={handleRemoveReceipt}
                              showRemoveButton={true}
                            />
                          </>
                        )}
                      </>
                    )}
                  </TabsContent>
                </div>
              </Tabs>

              <DialogFooter className="px-4 py-3 border-t shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  {loading ? 'Creating...' : 'Create Claim'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
