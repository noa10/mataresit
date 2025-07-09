import React from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  Share2, 
  Filter, 
  BookmarkPlus,
  MoreHorizontal,
  FileText,
  Calculator,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface SearchResultsActionsProps {
  results: any[];
  searchQuery: string;
  totalAmount?: number;
  currency?: string;
  onExport?: (format: 'csv' | 'pdf') => void;
  onCreateClaim?: () => void;
  onSaveSearch?: () => void;
  className?: string;
}

export function SearchResultsActions({
  results,
  searchQuery,
  totalAmount = 0,
  currency = 'MYR',
  onExport,
  onCreateClaim,
  onSaveSearch,
  className = ''
}: SearchResultsActionsProps) {
  const handleShare = async () => {
    try {
      const shareData = {
        title: `Search Results: ${searchQuery}`,
        text: `Found ${results.length} receipts with total amount ${currency} ${totalAmount.toFixed(2)}`,
        url: window.location.href
      };

      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Search results shared successfully');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success('Search results copied to clipboard');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share search results');
    }
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (onExport) {
      onExport(format);
    } else {
      toast.info(`Export to ${format.toUpperCase()} feature coming soon`);
    }
  };

  const handleCreateClaim = () => {
    if (onCreateClaim) {
      onCreateClaim();
    } else {
      toast.info('Create claim feature coming soon');
    }
  };

  const handleSaveSearch = () => {
    if (onSaveSearch) {
      onSaveSearch();
    } else {
      // Default save to localStorage
      const savedSearches = JSON.parse(localStorage.getItem('saved_searches') || '[]');
      const newSearch = {
        id: Date.now().toString(),
        query: searchQuery,
        resultCount: results.length,
        totalAmount,
        currency,
        timestamp: new Date().toISOString()
      };
      
      savedSearches.push(newSearch);
      localStorage.setItem('saved_searches', JSON.stringify(savedSearches));
      toast.success('Search saved successfully');
    }
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center justify-between p-4 bg-muted/30 rounded-lg border ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Total: {currency} {totalAmount.toFixed(2)}
          </span>
        </div>
        <Badge variant="outline" className="text-xs">
          {results.length} receipt{results.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {/* Quick Actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="hidden sm:flex"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveSearch}
          className="hidden sm:flex"
        >
          <BookmarkPlus className="h-4 w-4 mr-2" />
          Save
        </Button>

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileText className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCreateClaim}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Create Claim
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleShare} className="sm:hidden">
              <Share2 className="h-4 w-4 mr-2" />
              Share Results
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSaveSearch} className="sm:hidden">
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Save Search
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
