
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar, CreditCard, DollarSign, Plus, Minus, Receipt, Send, RotateCw, ZoomIn, ZoomOut, History, Loader2, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ReceiptWithDetails, ReceiptLineItem } from "@/types/receipt";
import { updateReceipt, processReceiptWithOCR } from "@/services/receiptService";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ReceiptViewerProps {
  receipt: ReceiptWithDetails;
}

export default function ReceiptViewer({ receipt }: ReceiptViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [editedReceipt, setEditedReceipt] = useState(receipt);
  const [imageError, setImageError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFullTextData, setShowFullTextData] = useState(false);
  const queryClient = useQueryClient();
  
  // Update editedReceipt when receipt changes
  useEffect(() => {
    setEditedReceipt(receipt);
  }, [receipt]);
  
  const updateMutation = useMutation({
    mutationFn: () => updateReceipt(
      receipt.id,
      {
        merchant: editedReceipt.merchant,
        date: editedReceipt.date,
        total: editedReceipt.total,
        tax: editedReceipt.tax,
        currency: editedReceipt.currency,
        payment_method: editedReceipt.payment_method,
        status: "reviewed"
      },
      editedReceipt.lineItems?.map(item => ({
        description: item.description,
        amount: item.amount
      }))
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success("Receipt updated successfully!");
    },
    onError: (error) => {
      console.error("Failed to update receipt:", error);
      toast.error("Failed to update receipt");
    }
  });
  
  const reprocessMutation = useMutation({
    mutationFn: () => processReceiptWithOCR(receipt.id),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
        toast.success("Receipt processed successfully!");
        
        // Update the edited receipt with the new data to reflect changes immediately
        setEditedReceipt(prev => ({
          ...prev,
          merchant: data.merchant || prev.merchant,
          date: data.date || prev.date,
          total: data.total || prev.total,
          tax: data.tax || prev.tax,
          payment_method: data.payment_method || prev.payment_method,
          lineItems: data.line_items?.map(item => ({
            id: `temp-${Date.now()}-${Math.random()}`,
            receipt_id: receipt.id,
            description: item.description,
            amount: item.amount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })) || prev.lineItems
        }));
      }
    },
    onError: (error) => {
      console.error("Failed to process receipt:", error);
      toast.error("Failed to process receipt with OCR");
    }
  });
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: receipt.currency || 'USD',
    }).format(amount);
  };
  
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };
  
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };
  
  const getConfidenceColor = (value?: number) => {
    if (!value) return "bg-gray-300";
    if (value >= 80) return "bg-green-500";
    if (value >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  const handleInputChange = (field: string, value: string | number) => {
    setEditedReceipt(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updatedLineItems = [...(editedReceipt.lineItems || [])];
    updatedLineItems[index] = {
      ...updatedLineItems[index],
      [field]: value
    };
    
    setEditedReceipt(prev => ({
      ...prev,
      lineItems: updatedLineItems
    }));
  };
  
  const handleSaveChanges = () => {
    updateMutation.mutate();
  };
  
  const handleAddLineItem = () => {
    const newLineItem: ReceiptLineItem = {
      id: `temp-${Date.now()}`,
      receipt_id: receipt.id,
      description: "New item",
      amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setEditedReceipt(prev => ({
      ...prev,
      lineItems: [...(prev.lineItems || []), newLineItem]
    }));
  };
  
  const handleRemoveLineItem = (index: number) => {
    const updatedLineItems = [...(editedReceipt.lineItems || [])];
    updatedLineItems.splice(index, 1);
    
    setEditedReceipt(prev => ({
      ...prev,
      lineItems: updatedLineItems
    }));
  };
  
  const handleSyncToZoho = () => {
    // Update status to synced
    updateReceipt(receipt.id, { status: "synced" })
      .then(() => {
        toast.success("Receipt synced to Zoho successfully!");
        queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
      })
      .catch(() => {
        toast.error("Failed to sync with Zoho");
      });
  };
  
  const handleReprocessReceipt = () => {
    setIsProcessing(true);
    reprocessMutation.mutate(undefined, {
      onSettled: () => {
        setIsProcessing(false);
      }
    });
  };
  
  const handleToggleShowFullText = () => {
    setShowFullTextData(!showFullTextData);
  };

  // Function to format image URL if needed
  const getFormattedImageUrl = (url: string | undefined) => {
    if (!url) return "";
    
    // Handle URLs with storage URL format
    if (url.includes('supabase.co') && !url.includes('/public/')) {
      // Add 'public' to the URL path if it's missing
      return url.replace('/object/', '/object/public/');
    }
    
    return url;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      {/* Left side - Receipt Image */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card p-4 overflow-hidden"
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium">Receipt Image</h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
            >
              <ZoomOut size={18} />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleZoomIn}
              disabled={zoom >= 3}
            >
              <ZoomIn size={18} />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleRotate}
            >
              <RotateCw size={18} />
            </Button>
          </div>
        </div>
        
        <div className="overflow-auto h-[500px] flex items-center justify-center bg-secondary/30 rounded-lg">
          {receipt.image_url && !imageError ? (
            <div 
              className="min-h-full flex items-center justify-center p-4 transition-transform duration-200"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            >
              <img 
                src={getFormattedImageUrl(receipt.image_url)} 
                alt={`Receipt from ${receipt.merchant}`}
                className="max-w-full max-h-full object-contain shadow-lg"
                onError={(e) => {
                  console.error("Error loading receipt image:", e);
                  setImageError(true);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
              {imageError ? (
                <>
                  <AlertTriangle size={64} className="mb-4 text-amber-500" />
                  <p className="text-center mb-2">Failed to load receipt image</p>
                  <p className="text-xs text-center text-muted-foreground mb-4">
                    The image URL may be invalid or the image may no longer exist.
                  </p>
                  <p className="text-xs break-all text-muted-foreground mb-4">
                    URL: {receipt.image_url || "No URL provided"}
                  </p>
                </>
              ) : (
                <>
                  <Receipt size={64} className="mb-4 opacity-30" />
                  <p>No receipt image available</p>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="mt-4">
          <Button 
            variant="outline" 
            className="w-full gap-2" 
            onClick={handleReprocessReceipt}
            disabled={isProcessing || !receipt.image_url}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RotateCw size={16} />
                Reprocess with OCR
              </>
            )}
          </Button>
          
          {receipt.fullText && (
            <div className="mt-4">
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleToggleShowFullText}
              >
                {showFullTextData ? "Hide Raw OCR Text" : "Show Raw OCR Text"}
              </Button>
              
              {showFullTextData && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                  {receipt.fullText}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
      
      {/* Right side - Receipt Data */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card p-4"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Receipt Details</h3>
          <Button 
            onClick={handleSyncToZoho} 
            className="gap-2"
            disabled={receipt.status === "synced"}
          >
            <Send size={16} />
            {receipt.status === "synced" ? "Synced to Zoho" : "Sync to Zoho"}
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="merchant">Merchant</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Confidence:</span>
                <span className={`inline-block w-4 h-1 rounded ${getConfidenceColor(receipt.confidence?.merchant)}`}></span>
                <span className="text-xs">{receipt.confidence?.merchant || 0}%</span>
              </div>
            </div>
            <Input
              id="merchant"
              value={editedReceipt.merchant || ""}
              onChange={(e) => handleInputChange('merchant', e.target.value)}
              className="bg-background/50"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="date">Date</Label>
                <div className="flex items-center gap-1">
                  <span className={`inline-block w-4 h-1 rounded ${getConfidenceColor(receipt.confidence?.date)}`}></span>
                  <span className="text-xs">{receipt.confidence?.date || 0}%</span>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="date"
                  type="date"
                  value={typeof editedReceipt.date === 'string' ? editedReceipt.date.split('T')[0] : editedReceipt.date || ""}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="bg-background/50 pl-9"
                />
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="total">Total Amount</Label>
                <div className="flex items-center gap-1">
                  <span className={`inline-block w-4 h-1 rounded ${getConfidenceColor(receipt.confidence?.total)}`}></span>
                  <span className="text-xs">{receipt.confidence?.total || 0}%</span>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="total"
                  type="number"
                  step="0.01"
                  value={editedReceipt.total || 0}
                  onChange={(e) => handleInputChange('total', parseFloat(e.target.value))}
                  className="bg-background/50 pl-9"
                />
                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={editedReceipt.currency || "USD"}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="bg-background/50"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <div className="flex items-center gap-1">
                  <span className={`inline-block w-4 h-1 rounded ${getConfidenceColor(receipt.confidence?.payment_method)}`}></span>
                  <span className="text-xs">{receipt.confidence?.payment_method || 0}%</span>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="paymentMethod"
                  value={editedReceipt.payment_method || ""}
                  onChange={(e) => handleInputChange('payment_method', e.target.value)}
                  className="bg-background/50 pl-9"
                />
                <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Label>Line Items</Label>
                <div className="flex items-center gap-1">
                  <span className={`inline-block w-4 h-1 rounded ${getConfidenceColor(receipt.confidence?.line_items)}`}></span>
                  <span className="text-xs">{receipt.confidence?.line_items || 0}%</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1 h-7"
                onClick={handleAddLineItem}
              >
                <Plus size={14} />
                Add Item
              </Button>
            </div>
            
            <Card className="bg-background/50 border border-border/50">
              <div className="p-3 max-h-[200px] overflow-y-auto space-y-2">
                {editedReceipt.lineItems && editedReceipt.lineItems.length > 0 ? (
                  editedReceipt.lineItems.map((item, index) => (
                    <div 
                      key={item.id}
                      className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                    >
                      <Input
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        className="bg-transparent border-0 focus-visible:ring-0 px-0 text-sm flex-1 mr-2"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => handleLineItemChange(index, 'amount', parseFloat(e.target.value))}
                          className="bg-transparent border-0 focus-visible:ring-0 px-0 text-sm text-right w-24"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveLineItem(index)}
                        >
                          <Minus size={14} />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-muted-foreground">
                    <Receipt size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No line items detected</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
          
          <div className="pt-4 border-t border-border/50">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency(editedReceipt.total - (editedReceipt.tax || 0))}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Tax:</span>
                <span className={`inline-block w-2 h-1 rounded ${getConfidenceColor(receipt.confidence?.tax)}`}></span>
              </div>
              <div className="relative w-24">
                <Input
                  type="number"
                  step="0.01"
                  value={editedReceipt.tax || 0}
                  onChange={(e) => handleInputChange('tax', parseFloat(e.target.value))}
                  className="bg-transparent border-0 focus-visible:ring-0 px-0 text-sm text-right"
                />
              </div>
            </div>
            <div className="flex justify-between items-center font-semibold mt-2">
              <span>Total:</span>
              <span>{formatCurrency(editedReceipt.total || 0)}</span>
            </div>
          </div>
          
          <div className="pt-4 flex justify-between">
            <Button variant="outline" className="gap-2">
              <History size={16} />
              View History
            </Button>
            <Button 
              variant="default" 
              onClick={handleSaveChanges}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : "Save Changes"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
