
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import ReceiptViewer from "@/components/ReceiptViewer";
import { Button } from "@/components/ui/button";
import { getReceiptById, ReceiptData } from "@/utils/mockData";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ViewReceipt() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      if (id) {
        const foundReceipt = getReceiptById(id);
        if (foundReceipt) {
          setReceipt(foundReceipt);
        } else {
          toast.error("Receipt not found");
          navigate("/dashboard");
        }
      }
      setLoading(false);
    }, 800);
  }, [id, navigate]);
  
  const handleDelete = () => {
    toast.success("Receipt deleted successfully");
    navigate("/dashboard");
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <Navbar />
        <div className="container flex items-center justify-center min-h-[80vh]">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
        </div>
      </div>
    );
  }
  
  if (!receipt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <Navbar />
        <div className="container flex flex-col items-center justify-center min-h-[80vh] text-center">
          <h2 className="text-2xl font-bold mb-4">Receipt Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The receipt you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <a href="/dashboard">Go Back to Dashboard</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      
      <main className="container px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{receipt.merchant}</h1>
              <p className="text-muted-foreground">
                {receipt.date} • {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: receipt.currency,
                }).format(receipt.total)}
              </p>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Button 
              variant="outline" 
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 size={16} />
              Delete Receipt
            </Button>
          </motion.div>
        </div>
        
        {/* Receipt Viewer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <ReceiptViewer receipt={receipt} />
        </motion.div>
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
