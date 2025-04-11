
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Receipt, FileText, Upload, PieChart, Settings, ZoomIn, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import UploadZone from "@/components/UploadZone";
import { StorageStatus } from "@/components/StorageStatus";
import Navbar from "@/components/Navbar";

export default function Index() {
  useEffect(() => {
    document.title = "Receipt Scanner - Home";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      
      <div className="container max-w-5xl py-8 space-y-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 py-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Smart Receipt Processing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your receipts and our AI will automatically extract key information including merchant details, 
            dates, totals, and itemized entries with high confidence scoring.
          </p>
          
          {/* Storage Status Check */}
          <div className="max-w-xl mx-auto mt-4 mb-6">
            <StorageStatus />
          </div>
        </motion.div>
        
        <UploadZone />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16"
        >
          <div className="bg-card rounded-xl p-6 shadow-sm border">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Intelligent Upload</h3>
            <p className="text-muted-foreground mb-4">
              Drag & drop receipts in various formats with real-time processing status updates as our AI works.
            </p>
            <Link to="/dashboard">
              <Button variant="link" className="px-0 text-primary">
                Start Scanning <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="bg-card rounded-xl p-6 shadow-sm border">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Confidence Scoring</h3>
            <p className="text-muted-foreground mb-4">
              Our AI provides confidence scores for each extracted field, so you know what needs verification.
            </p>
            <Link to="/dashboard">
              <Button variant="link" className="px-0 text-primary">
                See Examples <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="bg-card rounded-xl p-6 shadow-sm border">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Processing Options</h3>
            <p className="text-muted-foreground mb-4">
              Choose between OCR+AI or Vision AI methods, select model accuracy, and customize processing.
            </p>
            <Link to="/settings">
              <Button variant="link" className="px-0 text-primary">
                Configure Settings <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="bg-card rounded-xl p-6 shadow-sm border">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <ZoomIn className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Interactive Viewing</h3>
            <p className="text-muted-foreground mb-4">
              Zoom, rotate, and examine receipt images with powerful tools while editing extracted data.
            </p>
            <Link to="/dashboard">
              <Button variant="link" className="px-0 text-primary">
                Try It Out <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="bg-card rounded-xl p-6 shadow-sm border">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <History className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Edit History</h3>
            <p className="text-muted-foreground mb-4">
              Track changes and processing steps with detailed history for each receipt.
            </p>
            <Link to="/dashboard">
              <Button variant="link" className="px-0 text-primary">
                View Dashboard <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="bg-card rounded-xl p-6 shadow-sm border">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">External Integration</h3>
            <p className="text-muted-foreground mb-4">
              Sync processed receipts with Zoho Expense for seamless expense management and tracking.
            </p>
            <Link to="/dashboard">
              <Button variant="link" className="px-0 text-primary">
                Explore Integrations <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
      
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
