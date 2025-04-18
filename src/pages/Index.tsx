
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import { 
  Upload,
  FileText,
  Sparkles,
  BarChart4,
  History,
  Settings2,
} from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Smart Receipt Processing";
  }, []);

  const features = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: "Upload & Process",
      description: "Upload receipt images or PDFs with our drag-and-drop interface. Supports multiple formats and batch uploading.",
      link: "/upload"
    },
    {
      icon: <Sparkles className="h-8 w-8 text-primary" />,
      title: "AI-Powered OCR",
      description: "Advanced OCR with Amazon Textract and Google Gemini enhancement for high-accuracy data extraction.",
      link: "/dashboard"
    },
    {
      icon: <FileText className="h-8 w-8 text-primary" />,
      title: "Smart Verification",
      description: "Interactive review interface with side-by-side image and data comparison. AI suggestions for quick corrections.",
      link: "/dashboard"
    },
    {
      icon: <BarChart4 className="h-8 w-8 text-primary" />,
      title: "Confidence Scoring",
      description: "Field-level confidence indicators help identify potential OCR issues. Real-time feedback on data quality.",
      link: "/dashboard"
    },
    {
      icon: <History className="h-8 w-8 text-primary" />,
      title: "Processing History",
      description: "Track every step of receipt processing, from upload through OCR and AI enhancement to final verification.",
      link: "/dashboard"
    },
    {
      icon: <Settings2 className="h-8 w-8 text-primary" />,
      title: "Custom Settings",
      description: "Choose between OCR-AI and AI Vision methods. Configure processing options for your specific needs.",
      link: "/settings"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      
      <div className="relative">
        <main className="relative z-10 container py-16 md:py-24 space-y-16">
          {/* Hero Section */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Intelligent <span className="text-primary">Receipt Processing</span>
              </h1>
              <p className="mt-4 text-xl text-muted-foreground">
                Automate receipt data extraction with our dual-method approach using OCR technology and AI vision models.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link to={user ? '/upload' : '/auth'}>
                    Get Started
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/dashboard">
                    View Dashboard
                  </Link>
                </Button>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="hidden lg:block"
            >
              <img 
                src="/receipt-processing-preview.png" 
                alt="Receipt Processing Demo" 
                className="w-full rounded-lg shadow-xl"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </motion.div>
          </section>

          {/* Features Section */}
          <section className="py-16 bg-secondary/10 backdrop-blur-sm rounded-2xl">
            <div className="container">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl font-bold">Smart Processing Features</h2>
                <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
                  Leverage advanced OCR and AI technology to automate your receipt processing workflow.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Link to={feature.link}>
                      <Card className="h-full hover:bg-primary/5 transition-colors cursor-pointer">
                        <CardContent className="pt-6">
                          <div className="mb-4 rounded-full w-16 h-16 flex items-center justify-center bg-primary/10">
                            {feature.icon}
                          </div>
                          <h3 className="text-xl font-medium mb-2">{feature.title}</h3>
                          <p className="text-muted-foreground">{feature.description}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </div>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </Link>
              <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground">
                Help
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
