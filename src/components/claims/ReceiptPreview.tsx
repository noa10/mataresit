import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Eye, 
  Calendar, 
  DollarSign, 
  Building2, 
  FileText, 
  ExternalLink,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Receipt } from '@/types/receipt';
import { formatCurrencySafe } from '@/utils/currency';
import { getFormattedImageUrlSync } from '@/utils/imageUtils';
import { useNavigate } from 'react-router-dom';

interface ReceiptPreviewProps {
  receipts: Receipt[];
  onRemoveReceipt?: (receiptId: string) => void;
  showRemoveButton?: boolean;
  className?: string;
}

export function ReceiptPreview({ 
  receipts, 
  onRemoveReceipt, 
  showRemoveButton = true,
  className = '' 
}: ReceiptPreviewProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const navigate = useNavigate();

  if (receipts.length === 0) {
    return null;
  }

  const openReceiptViewer = (receipt: Receipt) => {
    navigate(`/receipt/${receipt.id}`);
  };

  const openImageViewer = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setImageViewerOpen(true);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-muted-foreground">
          Attached Receipts ({receipts.length})
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {receipts.map((receipt) => (
          <ReceiptPreviewCard
            key={receipt.id}
            receipt={receipt}
            onRemove={showRemoveButton ? onRemoveReceipt : undefined}
            onViewReceipt={() => openReceiptViewer(receipt)}
            onViewImage={() => openImageViewer(receipt)}
          />
        ))}
      </div>

      {/* Image viewer dialog */}
      <ReceiptImageViewer
        receipt={selectedReceipt}
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
      />
    </div>
  );
}

interface ReceiptPreviewCardProps {
  receipt: Receipt;
  onRemove?: (receiptId: string) => void;
  onViewReceipt: () => void;
  onViewImage: () => void;
}

function ReceiptPreviewCard({ 
  receipt, 
  onRemove, 
  onViewReceipt, 
  onViewImage 
}: ReceiptPreviewCardProps) {
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');

  useEffect(() => {
    if (receipt.image_url) {
      const url = getFormattedImageUrlSync(receipt.image_url, (updatedUrl) => {
        setImageUrl(updatedUrl);
      });
      setImageUrl(url);
    }
  }, [receipt.image_url]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-0">
          {/* Receipt image */}
          <div className="relative h-32 bg-muted">
            <img
              src={imageUrl}
              alt={`Receipt from ${receipt.merchant}`}
              className="w-full h-full object-cover"
              onError={() => setImageUrl('/placeholder.svg')}
            />
            
            {/* Action buttons overlay */}
            <div className="absolute top-2 right-2 flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewImage();
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View full image</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {onRemove && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 w-7 p-0 bg-destructive/80 backdrop-blur-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(receipt.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Remove receipt</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Status badge */}
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-xs bg-background/80 backdrop-blur-sm">
                {receipt.status}
              </Badge>
            </div>
          </div>

          {/* Receipt details */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm truncate">{receipt.merchant}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{new Date(receipt.date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span className="font-medium">
                  {formatCurrencySafe(receipt.total, receipt.currency)}
                </span>
              </div>
            </div>

            {/* View receipt button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={onViewReceipt}
            >
              <FileText className="h-3 w-3 mr-1" />
              View Details
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface ReceiptImageViewerProps {
  receipt: Receipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ReceiptImageViewer({ receipt, open, onOpenChange }: ReceiptImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');

  useEffect(() => {
    if (receipt?.image_url) {
      const url = getFormattedImageUrlSync(receipt.image_url, (updatedUrl) => {
        setImageUrl(updatedUrl);
      });
      setImageUrl(url);
    }
  }, [receipt?.image_url]);

  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Receipt from {receipt.merchant}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 pt-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Image */}
            <div className="flex-1">
              <div className="relative bg-muted rounded-lg overflow-hidden">
                <img
                  src={imageUrl}
                  alt={`Receipt from ${receipt.merchant}`}
                  className="w-full h-auto max-h-[60vh] object-contain"
                  onError={() => setImageUrl('/placeholder.svg')}
                />
              </div>
            </div>

            {/* Receipt details */}
            <div className="lg:w-80 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Merchant</label>
                  <p className="text-sm">{receipt.merchant}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date</label>
                  <p className="text-sm">{new Date(receipt.date).toLocaleDateString()}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total</label>
                  <p className="text-sm font-medium">
                    {formatCurrencySafe(receipt.total, receipt.currency)}
                  </p>
                </div>
                
                {receipt.tax && receipt.tax > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tax</label>
                    <p className="text-sm">
                      {formatCurrencySafe(receipt.tax, receipt.currency)}
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge variant="outline">{receipt.status}</Badge>
                  </div>
                </div>
                
                {receipt.payment_method && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                    <p className="text-sm">{receipt.payment_method}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
