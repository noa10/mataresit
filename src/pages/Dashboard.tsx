
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import ReceiptCard from "@/components/ReceiptCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockReceipts, ReceiptData } from "@/utils/mockData";
import { Link } from "react-router-dom";
import { Upload, Search, Filter, SlidersHorizontal, PlusCircle } from "lucide-react";

export default function Dashboard() {
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setReceipts(mockReceipts);
    }, 500);
  }, []);
  
  const filteredReceipts = receipts.filter(receipt => {
    const matchesSearch = receipt.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    return matchesSearch && receipt.status === activeTab;
  });
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      
      <main className="container px-4 py-8">
        {/* Dashboard Header */}
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
              <Link to="/">
                <Upload size={16} />
                Upload New
              </Link>
            </Button>
          </motion.div>
        </div>
        
        {/* Filters and Search */}
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
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal size={16} />
              Filters
            </Button>
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
        
        {/* Receipts Grid */}
        {receipts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="glass-card p-12 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Receipt size={24} className="text-primary" />
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
        ) : filteredReceipts.length === 0 ? (
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
            <Button variant="outline" onClick={() => {
              setSearchQuery("");
              setActiveTab("all");
            }}>
              Clear Filters
            </Button>
          </motion.div>
        ) : (
          <div className="receipt-container">
            {filteredReceipts.map((receipt, index) => (
              <motion.div
                key={receipt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
              >
                <ReceiptCard
                  id={receipt.id}
                  merchant={receipt.merchant}
                  date={receipt.date}
                  total={receipt.total}
                  currency={receipt.currency}
                  imageUrl={receipt.imageUrl}
                  status={receipt.status}
                  confidence={receipt.confidence.merchant}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>
      
      {/* Footer */}
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

function Receipt(props: any) {
  return <PlusCircle {...props} />;
}
