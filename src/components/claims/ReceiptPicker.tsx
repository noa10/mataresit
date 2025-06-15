import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, X, Receipt, Calendar, DollarSign, Building2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Receipt as ReceiptType } from '@/types/receipt';
import { fetchReceipts } from '@/services/receiptService';
import { checkReceiptClaimUsage, ReceiptClaimUsage } from '@/services/receiptClaimService';
import { formatCurrencySafe } from '@/utils/currency';
import { getFormattedImageUrlSync } from '@/utils/imageUtils';
import { useQuery } from '@tanstack/react-query';

interface ReceiptPickerProps {
  selectedReceiptIds: string[];
  onSelectionChange: (receiptIds: string[]) => void;
  multiSelect?: boolean;
  excludeReceiptIds?: string[]; // Receipts already used in other claims
  className?: string;
}

interface ReceiptWithUsage extends ReceiptType {
  isUsedInClaim?: boolean;
  claimTitle?: string;
  claimId?: string;
  claimStatus?: string;
}

export function ReceiptPicker({
  selectedReceiptIds,
  onSelectionChange,
  multiSelect = true,
  excludeReceiptIds = [],
  className = '',
}: ReceiptPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [showUsedReceipts, setShowUsedReceipts] = useState(false);

  // Fetch receipts
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: fetchReceipts,
  });

  // Memoize receipt IDs to prevent infinite loops
  const receiptIds = useMemo(() => receipts.map(r => r.id), [receipts]);

  // Fetch receipt usage information
  const { data: receiptUsage = [], isLoading: usageLoading } = useQuery({
    queryKey: ['receipt-usage', receiptIds],
    queryFn: () => checkReceiptClaimUsage(receiptIds),
    enabled: receiptIds.length > 0,
  });

  // Filter and search receipts
  const filteredReceipts = useMemo(() => {
    // Create usage map for quick lookup
    const usageMap = new Map<string, ReceiptClaimUsage>();
    receiptUsage.forEach(usage => {
      usageMap.set(usage.receiptId, usage);
    });

    let filtered = receipts.filter((receipt) => {
      // Exclude receipts that are already used in other claims
      if (excludeReceiptIds.includes(receipt.id)) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          receipt.merchant.toLowerCase().includes(query) ||
          receipt.total.toString().includes(query) ||
          receipt.date.includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && receipt.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const receiptDate = new Date(receipt.date);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case 'week':
            if (daysDiff > 7) return false;
            break;
          case 'month':
            if (daysDiff > 30) return false;
            break;
          case 'quarter':
            if (daysDiff > 90) return false;
            break;
        }
      }

      return true;
    });

    // Sort by date (newest first) and add usage information
    const sortedWithUsage = filtered
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(receipt => {
        const usage = usageMap.get(receipt.id);
        return {
          ...receipt,
          isUsedInClaim: usage?.isUsedInClaim || false,
          claimTitle: usage?.claimTitle,
          claimId: usage?.claimId,
          claimStatus: usage?.claimStatus,
        } as ReceiptWithUsage;
      });

    return sortedWithUsage;
  }, [receipts, receiptUsage, searchQuery, statusFilter, dateFilter, excludeReceiptIds]);

  const handleReceiptToggle = useCallback((receiptId: string) => {
    console.log('🔄 Receipt toggle clicked:', receiptId);
    console.log('📋 Current selectedReceiptIds:', selectedReceiptIds);
    console.log('🔧 multiSelect:', multiSelect);
    console.log('📞 onSelectionChange function:', typeof onSelectionChange);

    if (multiSelect) {
      const newSelection = selectedReceiptIds.includes(receiptId)
        ? selectedReceiptIds.filter(id => id !== receiptId)
        : [...selectedReceiptIds, receiptId];
      console.log('✅ New selection (multi):', newSelection);
      onSelectionChange(newSelection);
    } else {
      const newSelection = selectedReceiptIds.includes(receiptId) ? [] : [receiptId];
      console.log('✅ New selection (single):', newSelection);
      onSelectionChange(newSelection);
    }
  }, [multiSelect, selectedReceiptIds, onSelectionChange]);

  const clearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  if (isLoading || usageLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-sm text-muted-foreground">
          {isLoading ? 'Loading receipts...' : 'Checking usage...'}
        </span>
      </div>
    );
  }

  // Debug logging
  console.log('🔍 ReceiptPicker render:', {
    selectedReceiptIds,
    receiptsCount: receipts.length,
    filteredCount: filteredReceipts.length,
    onSelectionChange: typeof onSelectionChange,
    multiSelect
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with selection info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          <h3 className="font-medium">Select Receipts</h3>
          {selectedReceiptIds.length > 0 && (
            <Badge variant="secondary">
              {selectedReceiptIds.length} selected
            </Badge>
          )}
        </div>
        {selectedReceiptIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Search and filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search receipts by merchant, amount, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unreviewed">Unreviewed</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Receipt list */}
      <ScrollArea className="h-[300px] sm:h-[400px] border rounded-lg">
        <div className="p-2 space-y-2">
          <AnimatePresence>
            {filteredReceipts.map((receipt) => (
              <ReceiptPickerItem
                key={receipt.id}
                receipt={receipt}
                isSelected={selectedReceiptIds.includes(receipt.id)}
                onToggle={() => handleReceiptToggle(receipt.id)}
                multiSelect={multiSelect}
              />
            ))}
          </AnimatePresence>

          {filteredReceipts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No receipts found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ReceiptPickerItemProps {
  receipt: ReceiptWithUsage;
  isSelected: boolean;
  onToggle: () => void;
  multiSelect: boolean;
}

function ReceiptPickerItem({ receipt, isSelected, onToggle, multiSelect }: ReceiptPickerItemProps) {
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');

  useEffect(() => {
    if (receipt.image_url) {
      // Use the proper callback approach but memoize the callback to prevent loops
      const updateImageUrl = (updatedUrl: string) => {
        setImageUrl(updatedUrl);
      };

      try {
        const initialUrl = getFormattedImageUrlSync(receipt.image_url, updateImageUrl);
        setImageUrl(initialUrl || '/placeholder.svg');
      } catch (error) {
        console.warn('Error formatting image URL:', error);
        setImageUrl('/placeholder.svg');
      }
    }
  }, [receipt.image_url]);

  const handleClick = () => {
    console.log('🖱️ ReceiptPickerItem clicked:', receipt.id);
    console.log('🎯 isSelected:', isSelected);
    console.log('📞 onToggle function:', typeof onToggle);
    onToggle();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/50 active:bg-accent/70 touch-manipulation ${
        isSelected ? 'bg-primary/10 border-primary' : 'bg-background'
      } ${receipt.isUsedInClaim ? 'opacity-60' : ''}`}
      onClick={handleClick}
      onTouchStart={() => {}} // Enable touch feedback
    >
      {/* Selection indicator */}
      <div className="flex-shrink-0">
        {multiSelect ? (
          <div className={`w-4 h-4 rounded border ${
            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
          } flex items-center justify-center`}>
            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
        ) : (
          <div className={`w-4 h-4 rounded-full border-2 ${
            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
          }`}>
            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
        )}
      </div>

      {/* Receipt thumbnail */}
      <div className="flex-shrink-0">
        <img
          src={imageUrl}
          alt={`Receipt from ${receipt.merchant}`}
          className="w-12 h-12 object-cover rounded border"
          onError={() => setImageUrl('/placeholder.svg')}
        />
      </div>

      {/* Receipt details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium truncate">{receipt.merchant}</span>
          <Badge variant="outline" className="text-xs">
            {receipt.status}
          </Badge>
          {receipt.isUsedInClaim && (
            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
              Used in Claim
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(receipt.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span>{formatCurrencySafe(receipt.total, receipt.currency)}</span>
          </div>
        </div>

        {/* Show claim info if used */}
        {receipt.isUsedInClaim && receipt.claimTitle && (
          <div className="mt-2 text-xs text-muted-foreground">
            Used in: <span className="font-medium">{receipt.claimTitle}</span>
            {receipt.claimStatus && (
              <Badge variant="outline" className="ml-1 text-xs">
                {receipt.claimStatus}
              </Badge>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
