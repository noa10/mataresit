
import React, { useState, useEffect } from 'react';
import { Receipt } from '@/types/receipt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Store, CreditCard, Receipt as ReceiptIcon, Trash2, Loader2, Sparkles } from 'lucide-react';
import { deleteReceipt, generateEmbeddingsForReceipt } from '@/services/receiptService';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface ReceiptViewerProps {
  receipt: Receipt;
  onDelete: (receiptId: string) => void;
  onUpdate?: (updatedReceipt: Receipt) => void;
}

interface Item {
  description: string;
  amount: number;
  quantity?: number;
}

export default function ReceiptViewer({ receipt, onDelete, onUpdate }: ReceiptViewerProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);

  const handleDelete = async () => {
    if (!receipt?.id) return;

    setIsDeleting(true);
    try {
      await deleteReceipt(receipt.id);
      toast.success('Receipt deleted successfully!');
      onDelete(receipt.id);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete receipt');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'No Date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount: number | undefined, currency: string | undefined): string => {
    if (amount === undefined) return '$0.00';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount);
    } catch (error) {
      console.error('Error formatting currency:', error);
      return '$0.00';
    }
  };

  const handleGenerateEmbeddings = async () => {
    if (!receipt?.id) return;
    
    setIsGeneratingEmbeddings(true);
    try {
      await generateEmbeddingsForReceipt(receipt.id);
      toast.success('Embeddings generated successfully!');
    } catch (error) {
      console.error('Error generating embeddings:', error);
      toast.error('Failed to generate embeddings');
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Main Details Card */}
      <Card className="bg-card text-card-foreground shadow-md overflow-hidden">
        <CardHeader className="px-4 py-5">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5" />
            Receipt Details
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-6">
          <div className="space-y-4">
            {/* Merchant */}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Merchant</div>
              <div className="text-gray-900">{receipt?.merchant || 'N/A'}</div>
            </div>

            {/* Date */}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Date</div>
              <div className="text-gray-900">{formatDate(receipt?.date)}</div>
            </div>

            {/* Total */}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total</div>
              <div className="text-gray-900">{formatCurrency(receipt?.total, receipt?.currency)}</div>
            </div>

            {/* Payment Method */}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Payment Method</div>
              <div className="text-gray-900">{receipt?.payment_method || 'N/A'}</div>
            </div>

            {/* Predicted Category */}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Category</div>
              <div className="text-gray-900">{receipt?.predicted_category || 'N/A'}</div>
            </div>

            {/* Notes - using fullText as fallback since notes doesn't exist */}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Notes</div>
              <div className="text-gray-900">{receipt?.fullText || 'N/A'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Card - using a placeholder since items don't exist in Receipt type */}
      <Card className="bg-card text-card-foreground shadow-md overflow-hidden">
        <CardHeader className="px-4 py-5">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Store className="w-5 h-5" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-6">
          <div className="text-muted-foreground">No items listed on this receipt.</div>
        </CardContent>
      </Card>

      {/* Additional Info Card */}
      <Card className="bg-card text-card-foreground shadow-md overflow-hidden">
        <CardHeader className="px-4 py-5">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Additional Information
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-6">
          <div className="space-y-4">
            {/* Raw Text */}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Raw Text</div>
              <div className="text-gray-900 break-words">{receipt?.fullText || 'N/A'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image Card */}
      {receipt?.image_url && (
        <Card className="bg-card text-card-foreground shadow-md overflow-hidden">
          <CardHeader className="px-4 py-5">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Image Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-6">
            <img src={receipt.image_url} alt="Receipt" className="w-full h-auto rounded-md" />
          </CardContent>
        </Card>
      )}

      {/* Actions Card */}
      <Card className="bg-card text-card-foreground shadow-md overflow-hidden">
        <CardHeader className="px-4 py-5">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-6 flex flex-col gap-4">
          <Button
            variant="destructive"
            className="gap-2"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Receipt
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={handleGenerateEmbeddings}
            disabled={isGeneratingEmbeddings}
          >
            {isGeneratingEmbeddings ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Embeddings...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Embeddings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
