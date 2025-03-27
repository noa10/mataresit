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
  PlusCircle, XCircle, Calendar, DollarSign 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchReceipts } from "@/services/receiptService";
import { Receipt } from "@/types/receipt";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function Dashboard() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [filterByCurrency, setFilterByCurrency] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  
  const { data: receipts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['receipts'],
    queryFn: fetchReceipts,
    enabled: !!user, // Only run if user is logged in
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
            <Button asChild className="gap-2">
              <Link to="/upload">
                <Upload size={16} />
                Upload New
              </Link>
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
              <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
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
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-background/50">
                <TabsTrigger value="all">All Receipts</TabsTrigger>
                <TabsTrigger value="unreviewed">Unreviewed</TabsTrigger>
                <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                <TabsTrigger value="synced">Synced to Zoho</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </motion.div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
          </div>
        ) : error ? (
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
        ) : receipts.length === 0 ? (
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
            <Button asChild>
              <Link to="/" className="gap-2">
                <PlusCircle size={16} />
                Upload Receipt
              </Link>
            </Button>
          </motion.div>
        ) : processedReceipts.length === 0 ? (
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
        ) : (
          <div className="receipt-container">
            {processedReceipts.map((receipt, index) => {
              const confidenceScore = 
                receipt.confidence_scores && 
                receipt.confidence_scores.merchant ? 
                Math.round(receipt.confidence_scores.merchant * 100) : 0;
              
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
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
      
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
