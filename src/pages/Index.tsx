
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import UploadZone from "@/components/UploadZone";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, ChevronRight, Check, ShieldCheck, Clock } from "lucide-react";

export default function Index() {
  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };
  
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const features = [
    {
      icon: <Upload className="h-5 w-5 text-primary" />,
      title: "Easy Upload",
      description: "Upload receipts in JPEG, PNG, or PDF formats with our intuitive interface",
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-primary" />,
      title: "Accurate OCR",
      description: "Extract receipt data with high precision using Amazon Textract",
    },
    {
      icon: <Clock className="h-5 w-5 text-primary" />,
      title: "Time Saving",
      description: "Save hours on manual data entry with automated processing",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <Navbar />
      
      <main className="container px-4 py-8 md:py-12 lg:py-16">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-4xl mx-auto pt-8 md:pt-12 pb-12 md:pb-16"
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-block mb-4"
          >
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              Simple Receipt Processing
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance"
          >
            Automate Your <span className="text-primary">Receipt Processing</span> Workflow
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto text-balance"
          >
            Extract and digitize receipt data effortlessly with our advanced OCR technology.
            Save time and reduce errors in your expense tracking.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button asChild size="lg" className="gap-2">
              <Link to="/dashboard">
                View Dashboard
                <ArrowRight size={16} />
              </Link>
            </Button>
          </motion.div>
        </motion.section>
        
        {/* Upload Section */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="glass-card p-6 md:p-8 max-w-4xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold">Upload Your Receipt</h2>
            <p className="text-muted-foreground mt-2">
              Start by uploading your receipt image or PDF
            </p>
          </div>
          
          <UploadZone />
        </motion.section>
        
        {/* Features Section */}
        <motion.section 
          variants={container}
          initial="hidden"
          animate="show"
          className="py-16 max-w-4xl mx-auto"
        >
          <motion.h2 
            variants={item}
            className="text-2xl md:text-3xl font-semibold text-center mb-12"
          >
            Key Features
          </motion.h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={item}
                className="glass-card p-6 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
        
        {/* CTA Section */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="py-12 text-center max-w-2xl mx-auto"
        >
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">
            Ready to Streamline Your Expense Tracking?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of users who save time with automated receipt processing.
          </p>
          <Button asChild size="lg">
            <Link to="/dashboard" className="gap-2">
              Get Started
              <ChevronRight size={16} />
            </Link>
          </Button>
        </motion.section>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="container px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-2">
                <span className="font-semibold">R</span>
              </div>
              <span className="font-medium">ReceiptScan</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
