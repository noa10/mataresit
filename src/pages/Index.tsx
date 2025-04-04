
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import UploadZone from "@/components/UploadZone";

export default function Index() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      
      <main className="container px-4 py-8 md:py-16">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Automated Receipt Processing
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Streamline your expense management with AI-powered receipt extraction
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/dashboard")} 
                className="gap-2"
              >
                <FileText size={20} />
                Go to Dashboard
                <ArrowRight size={16} className="ml-1" />
              </Button>
            </div>
          </motion.div>
          
          {/* Upload Receipt Section - Added back */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 w-full max-w-3xl"
          >
            <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl shadow-sm">
              <h2 className="text-2xl font-bold mb-6 text-center">Upload Your Receipt</h2>
              <UploadZone />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 text-left w-full max-w-5xl"
          >
            <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl shadow-sm">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <FileText size={24} className="text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Upload & Process</h3>
              <p className="text-muted-foreground">
                Upload your receipts in JPEG, PNG, or PDF format and let our AI extract the data automatically.
              </p>
            </div>
            
            <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl shadow-sm">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <FileText size={24} className="text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Verify & Edit</h3>
              <p className="text-muted-foreground">
                Review the extracted data with our powerful image viewer and edit if needed.
              </p>
            </div>
            
            <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl shadow-sm">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <FileText size={24} className="text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Sync & Track</h3>
              <p className="text-muted-foreground">
                Sync your verified receipts with Zoho Expense for seamless expense management.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
      
      <footer className="border-t border-border/40 mt-auto">
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
