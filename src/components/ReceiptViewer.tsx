
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar, CreditCard, DollarSign, Plus, Minus, Receipt, Send, RotateCw, ZoomIn, ZoomOut, History } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface ReceiptViewerProps {
  receipt: {
    id: string;
    merchant: string;
    date: string;
    total: number;
    tax?: number;
    currency: string;
    paymentMethod?: string;
    lineItems?: Array<{
      id: string;
      description: string;
      amount: number;
    }>;
    imageUrl: string;
    status: string;
    confidence: {
      merchant: number;
      date: number;
      total: number;
      tax?: number;
      lineItems?: number;
    };
  };
}

export default function ReceiptViewer({ receipt }: ReceiptViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [editedReceipt, setEditedReceipt] = useState(receipt);
  
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
  
  const getConfidenceColor = (value: number) => {
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
  
  const handleSyncToZoho = () => {
    toast.success("Receipt synced to Zoho successfully!");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
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
          <div 
            className="min-h-full flex items-center justify-center p-4 transition-transform duration-200"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          >
            <img 
              src={receipt.imageUrl} 
              alt={`Receipt from ${receipt.merchant}`}
              className="max-w-full max-h-full object-contain shadow-lg"
            />
          </div>
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
          <Button onClick={handleSyncToZoho} className="gap-2">
            <Send size={16} />
            Sync to Zoho
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="merchant">Merchant</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Confidence:</span>
                <span className={`inline-block w-4 h-1 rounded ${getConfidenceColor(receipt.confidence.merchant)}`}></span>
                <span className="text-xs">{receipt.confidence.merchant}%</span>
              </div>
            </div>
            <Input
              id="merchant"
              value={editedReceipt.merchant}
              onChange={(e) => handleInputChange('merchant', e.target.value)}
              className="bg-background/50"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="date">Date</Label>
                <div className="flex items-center gap-1">
                  <span className={`inline-block w-4 h-1 rounded ${getConfidenceColor(receipt.confidence.date)}`}></span>
                  <span className="text-xs">{receipt.confidence.date}%</span>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="date"
                  value={editedReceipt.date}
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
                  <span className={`inline-block w-4 h-1 rounded ${getConfidenceColor(receipt.confidence.total)}`}></span>
                  <span className="text-xs">{receipt.confidence.total}%</span>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="total"
                  type="number"
                  step="0.01"
                  value={editedReceipt.total}
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
                value={editedReceipt.currency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="bg-background/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <div className="relative">
                <Input
                  id="paymentMethod"
                  value={editedReceipt.paymentMethod || ""}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className="bg-background/50 pl-9"
                />
                <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Line Items</Label>
              <Button variant="outline" size="sm" className="gap-1 h-7">
                <Plus size={14} />
                Add Item
              </Button>
            </div>
            
            <Card className="bg-background/50 border border-border/50">
              <div className="p-3 max-h-[200px] overflow-y-auto space-y-2">
                {editedReceipt.lineItems && editedReceipt.lineItems.length > 0 ? (
                  editedReceipt.lineItems.map((item) => (
                    <div 
                      key={item.id}
                      className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                    >
                      <p className="text-sm">{item.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatCurrency(item.amount)}
                        </span>
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
              <span className="text-muted-foreground">Tax:</span>
              <span>{formatCurrency(editedReceipt.tax || 0)}</span>
            </div>
            <div className="flex justify-between items-center font-semibold mt-2">
              <span>Total:</span>
              <span>{formatCurrency(editedReceipt.total)}</span>
            </div>
          </div>
          
          <div className="pt-4 flex justify-between">
            <Button variant="outline" className="gap-2">
              <History size={16} />
              View History
            </Button>
            <Button variant="default">Save Changes</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
