
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Receipt, FileText, Upload, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import UploadZone from "@/components/UploadZone";
import { StorageStatus } from "@/components/StorageStatus";

export default function Index() {
  useEffect(() => {
    document.title = "Receipt Scanner - Home";
  }, []);

  return (
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
          Upload your receipt, and we'll automatically extract key information like merchant, date, 
          total amount, and line items using OCR technology.
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
          <h3 className="text-xl font-semibold mb-2">Fast Upload</h3>
          <p className="text-muted-foreground mb-4">
            Upload receipt images or PDFs in seconds with our drag-and-drop interface.
          </p>
          <Link to="/dashboard">
            <Button variant="link" className="px-0 text-primary">
              Get Started <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
        
        <div className="bg-card rounded-xl p-6 shadow-sm border">
          <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">OCR Extraction</h3>
          <p className="text-muted-foreground mb-4">
            Our AI automatically extracts merchant info, date, amount, and line items.
          </p>
          <Link to="/dashboard">
            <Button variant="link" className="px-0 text-primary">
              Learn More <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
        
        <div className="bg-card rounded-xl p-6 shadow-sm border">
          <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
            <PieChart className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Easy Tracking</h3>
          <p className="text-muted-foreground mb-4">
            View all your receipts in one place, with analytics and export options.
          </p>
          <Link to="/dashboard">
            <Button variant="link" className="px-0 text-primary">
              Go to Dashboard <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
