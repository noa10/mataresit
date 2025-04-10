import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import ReceiptCard from "@/components/ReceiptCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { 
  Upload, Search, Filter, SlidersHorizontal, 
  PlusCircle, XCircle, Calendar, DollarSign, X,
  LayoutGrid, LayoutList, Table as TableIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchReceipts } from "@/services/receiptService";
import { Receipt, ReceiptStatus } from "@/types/receipt";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UploadZone from "@/components/UploadZone";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

// Define view mode types
type ViewMode = "grid" | "list" | "table";

// Add this function before the Dashboard component
const calculateAggregateConfidence = (receipt: Receipt) => {
  if (!receipt.confidence_scores) return 0;
  
  // Define weights for each field (total = 1.0)
  const weights = {
    merchant: 0.3,  // 30% weight for merchant name
    date: 0.2,      // 20% weight for date
    total: 0.3,     // 30% weight for total amount
    payment_method: 0.1,  // 10% weight for payment method
    tax: 0.1        // 10% weight for tax
  };

  // Calculate weighted average
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [field, weight] of Object.entries(weights)) {
    if (receipt.confidence_scores[field] !== undefined) {
      weightedSum += (receipt.confidence_scores[field] * weight);
      totalWeight += weight;
    }
  }

  // If we have no valid scores, return 0
  if (totalWeight === 0) return 0;

  // Return rounded percentage
  return Math.round((weightedSum / totalWeight) * 100);
};

export default function Dashboard() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | ReceiptStatus>("all");
  const [filterByCurrency, setFilterByCurrency] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid"); // Default view mode
  
  const { data: receipts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['receipts'],
    queryFn: fetchReceipts,
    enabled: !!user,
  });
  
  const processedReceipts = receipts
    .filter(receipt => {
      const matchesSearch = receipt.merchant.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === "all" || receipt.status === activeTab;
      const matchesCurrency = !filterByCurrency || receipt.currency === filterByCurrency;
      return matchesSearch && matchesTab && matchesCurrency;
    })
    .sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortOrder === "oldest") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortOrder === "highest") {
        return b.total - a.total;
      } else {
        return a.total - b.total;
      }
    });
  
  const currencies = [...new Set(receipts.map(r => r.currency))];
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const clearFilters = () => {
    setSearchQuery("");
    setActiveTab("all");
    setFilterByCurrency(null);
    setSortOrder("newest");
  };

  // Render different view modes
  const renderReceiptContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
        </div>
      );
    }
    
    if (error) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="glass-card p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <XCircle size={24} className="text-destructive" />
          </div>
          <h3 className="text-xl font-medium mb-2">Error loading receipts</h3>
          <p className="text-muted-foreground mb-6">
            There was a problem loading your receipts. Please try again.
          </p>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </motion.div>
      );
    }
    
    if (receipts.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="glass-card p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <PlusCircle size={24} className="text-primary" />
          </div>
          <h3 className="text-xl font-medium mb-2">No receipts yet</h3>
          <p className="text-muted-foreground mb-6">
            Upload your first receipt to get started
          </p>
          <Button onClick={() => setIsUploadDialogOpen(true)} className="gap-2">
            <PlusCircle size={16} />
            Upload Receipt
          </Button>
        </motion.div>
      );
    }
    
    if (processedReceipts.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="glass-card p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-primary" />
          </div>
          <h3 className="text-xl font-medium mb-2">No matching receipts</h3>
          <p className="text-muted-foreground mb-6">
            Try adjusting your search or filters
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </motion.div>
      );
    }
    
    // Grid view (original card layout)
    if (viewMode === "grid") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {processedReceipts.map((receipt, index) => {
            const confidenceScore = calculateAggregateConfidence(receipt);
            
            return (
              <motion.div
                key={receipt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
              >
                <ReceiptCard
                  id={receipt.id}
                  merchant={receipt.merchant}
                  date={formatDate(receipt.date)}
                  total={receipt.total}
                  currency={receipt.currency}
                  imageUrl={receipt.image_url || "/placeholder.svg"}
                  status={receipt.status}
                  confidence={confidenceScore}
                  processingStatus={receipt.processing_status}
                />
              </motion.div>
            );
          })}
        </div>
      );
    }
    
    // List view
    else if (viewMode === "list") {
      return (
        <div className="flex flex-col gap-3">
          {processedReceipts.map((receipt, index) => {
            const confidenceScore = calculateAggregateConfidence(receipt);
            
            return (
              <motion.div
                key={receipt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 + index * 0.03 }}
                className="border rounded-lg overflow-hidden bg-card hover:bg-accent/5 transition-colors"
              >
                <Link to={`/receipt/${receipt.id}`} className="flex items-center p-4 gap-4">
                  <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                    <img 
                      src={receipt.image_url || "/placeholder.svg"} 
                      alt={receipt.merchant} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium truncate">{receipt.merchant}</h3>
                      <span className="font-semibold whitespace-nowrap">
                        {receipt.currency} {receipt.total.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                      <span>{formatDate(receipt.date)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          receipt.status === 'unreviewed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          receipt.status === 'reviewed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                        </span>
                        <span className={`text-xs ${
                          confidenceScore >= 80 ? 'text-green-600' :
                          confidenceScore >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {confidenceScore}% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      );
    }
    
    // Table view
    else {
      return (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedReceipts.map((receipt) => {
                const confidenceScore = calculateAggregateConfidence(receipt);
                
                return (
                  <TableRow key={receipt.id} className="cursor-pointer hover:bg-accent/10" onClick={() => window.location.href = `/receipt/${receipt.id}`}>
                    <TableCell className="font-medium">{receipt.merchant}</TableCell>
                    <TableCell>{formatDate(receipt.date)}</TableCell>
                    <TableCell>{receipt.currency} {receipt.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        receipt.status === 'unreviewed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        receipt.status === 'reviewed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${
                        confidenceScore >= 80 ? 'text-green-600' :
                        confidenceScore >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {confidenceScore}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      
      <main className="container px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-3xl font-bold">Receipts Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track all your receipts in one place
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex gap-3"
          >
            <ToggleGroup 
              type="single" 
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as ViewMode)}
              className="border rounded-md bg-background/60 backdrop-blur-sm"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view" title="Grid view">
                <LayoutGrid size={18} />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view" title="List view">
                <LayoutList size={18} />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view" title="Table view">
                <TableIcon size={18} />
              </ToggleGroupItem>
            </ToggleGroup>

            <Button 
              className="gap-2"
              onClick={() => setIsUploadDialogOpen(true)}
            >
              <Upload size={16} />
              Upload New
            </Button>
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="glass-card p-4 mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by merchant..."
                className="pl-9 bg-background/50"
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 whitespace-nowrap">
                  <SlidersHorizontal size={16} />
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] bg-background/95 backdrop-blur-sm border border-border">
                <div className="space-y-4">
                  <h4 className="font-medium">Sort by</h4>
                  <ToggleGroup 
                    type="single" 
                    value={sortOrder} 
                    onValueChange={(value) => value && setSortOrder(value as any)}
                    className="flex flex-wrap justify-start gap-2"
                  >
                    <ToggleGroupItem value="newest" aria-label="Sort by newest first" className="flex-grow-0">
                      <Calendar className="h-4 w-4 mr-2" />
                      Newest
                    </ToggleGroupItem>
                    <ToggleGroupItem value="oldest" aria-label="Sort by oldest first" className="flex-grow-0">
                      <Calendar className="h-4 w-4 mr-2" />
                      Oldest
                    </ToggleGroupItem>
                    <ToggleGroupItem value="highest" aria-label="Sort by highest amount" className="flex-grow-0">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Highest
                    </ToggleGroupItem>
                    <ToggleGroupItem value="lowest" aria-label="Sort by lowest amount" className="flex-grow-0">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Lowest
                    </ToggleGroupItem>
                  </ToggleGroup>
                  
                  {currencies.length > 0 && (
                    <>
                      <h4 className="font-medium pt-2">Currency</h4>
                      <ToggleGroup 
                        type="single" 
                        value={filterByCurrency || "all"} 
                        onValueChange={(value) => setFilterByCurrency(value === "all" ? null : value)}
                        className="flex flex-wrap justify-start gap-2"
                      >
                        <ToggleGroupItem value="all" aria-label="Show all currencies" className="flex-grow-0">
                          All
                        </ToggleGroupItem>
                        {currencies.map(currency => (
                          <ToggleGroupItem 
                            key={currency} 
                            value={currency} 
                            aria-label={`Filter by ${currency}`}
                            className="flex-grow-0"
                          >
                            {currency}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </>
                  )}
                  
                  <div className="pt-2">
                    <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="mt-4">
            <Tabs defaultValue="all" value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | ReceiptStatus)}>
              <TabsList className="bg-background/50">
                <TabsTrigger value="all">All Receipts</TabsTrigger>
                <TabsTrigger value="unreviewed">Unreviewed</TabsTrigger>
                <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                <TabsTrigger value="synced">Synced to Zoho</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </motion.div>
        
        {renderReceiptContent()}
      </main>
      
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Receipt</DialogTitle>
          </DialogHeader>
          <UploadZone onUploadComplete={() => {
            setIsUploadDialogOpen(false);
            refetch();
          }} />
        </DialogContent>
      </Dialog>
      
      <footer className="border-t border-border/40 mt-12">
        <div className="container px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
