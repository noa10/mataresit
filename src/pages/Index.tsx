
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
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Users,
  LineChart,
  Layers
} from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from "@/components/ui/separator";

export default function Index() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Smart Receipt Processing";
  }, []);

  // Workflow-organized features
  const featureGroups = [
    {
      title: "1. Upload & Process",
      features: [
        {
          icon: <Upload className="h-8 w-8 text-primary" />,
          title: "Upload Receipts",
          description: "Drag-and-drop interface supporting multiple formats including images and PDFs.",
          link: "/upload"
        },
      ]
    },
    {
      title: "2. OCR & AI Enhancement",
      features: [
        {
          icon: <Sparkles className="h-8 w-8 text-primary" />,
          title: "AI-Powered OCR",
          description: "Advanced OCR with Amazon Textract and Google Gemini enhancement for high-accuracy data extraction.",
          link: "/dashboard"
        },
        {
          icon: <BarChart4 className="h-8 w-8 text-primary" />,
          title: "Confidence Scoring",
          description: "Field-level confidence indicators help identify potential OCR issues. Real-time feedback on data quality.",
          link: "/dashboard"
        },
      ]
    },
    {
      title: "3. Verify & Manage",
      features: [
        {
          icon: <FileText className="h-8 w-8 text-primary" />,
          title: "Smart Verification",
          description: "Interactive review interface with side-by-side image and data comparison. AI suggestions for quick corrections.",
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
      ]
    },
  ];

  // Stats for social proof section
  const stats = [
    { value: "500+", label: "Finance Teams" },
    { value: "10,000+", label: "Receipts Processed" },
    { value: "99%", label: "Average Accuracy" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      
      <div className="relative">
        {/* Background pattern */}
        <div className="absolute inset-0 overflow-hidden z-0">
          <div className="w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>
        </div>

        <main className="relative z-10 container py-16 space-y-24">
          {/* Hero Section with clearer CTAs */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pt-8">
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
                {!user ? (
                  <>
                    <Button asChild size="lg" className="group animate-pulse">
                      <Link to="/auth" className="flex items-center">
                        Sign Up Free
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                      <Link to="/auth?mode=signin">
                        Log In
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" className="group">
                      <Link to="/upload" className="flex items-center">
                        Upload Receipt
                        <Upload className="ml-2 h-5 w-5 transition-transform group-hover:translate-y-[-2px]" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                      <Link to="/dashboard">
                        View Dashboard
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
            
            {/* Interactive Hero Visual */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative rounded-lg overflow-hidden shadow-xl border border-border/60 bg-card">
                <img 
                  src="/receipt-processing-preview.png" 
                  alt="Receipt Processing Demo" 
                  className="w-full rounded-lg"
                  onError={(e) => {
                    // Fallback if image doesn't exist
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-4">
                  <div className="flex items-center">
                    <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">AI Enhanced</span>
                    <span className="ml-2 text-sm text-muted-foreground">Side-by-side verification</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* How It Works Section */}
          <section id="how-it-works" className="scroll-mt-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center justify-center">
                <Separator className="w-8 bg-primary h-1" />
                <h2 className="text-lg font-medium px-4">How It Works</h2>
                <Separator className="w-8 bg-primary h-1" />
              </div>
              <h3 className="text-3xl font-bold mt-4">Simple 3-Step Process</h3>
              <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
                Our application offers a streamlined workflow from upload to verification
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              {featureGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="relative">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: groupIndex * 0.2 }}
                    className="mb-6"
                  >
                    <h3 className="text-xl font-semibold text-primary mb-2">{group.title}</h3>
                    <p className="text-muted-foreground">{groupIndex === 0 ? "Start by uploading your receipts" : 
                                                        groupIndex === 1 ? "AI extracts and enhances data" : 
                                                        "Review, correct, and manage your data"}</p>
                  </motion.div>
                  
                  <div className="space-y-4">
                    {group.features.map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: (groupIndex * 0.2) + (index * 0.1) }}
                        whileHover={{ scale: 1.02 }}
                        className="h-full"
                      >
                        <Link to={feature.link} className="block h-full">
                          <Card className="h-full hover:bg-primary/5 hover:shadow-md transition-all duration-300 cursor-pointer border-border/60">
                            <CardContent className="pt-6">
                              <div className="mb-4 rounded-full w-16 h-16 flex items-center justify-center bg-primary/10">
                                {feature.icon}
                              </div>
                              <h4 className="text-xl font-medium mb-2">{feature.title}</h4>
                              <p className="text-muted-foreground">{feature.description}</p>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Only add connecting line if not the last group */}
                  {groupIndex < featureGroups.length - 1 && (
                    <div className="hidden md:flex absolute top-1/2 right-[-1.5rem] transform -translate-y-1/2">
                      <ArrowRight className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
          
          {/* Stats Section / Social Proof */}
          <section className="py-16 px-4 bg-secondary/10 backdrop-blur-sm rounded-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <h2 className="text-3xl font-bold">
                Trusted by <span className="text-primary">Finance Teams</span> Worldwide
              </h2>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="text-center"
                >
                  <h3 className="text-4xl font-bold text-primary">{stat.value}</h3>
                  <p className="text-muted-foreground">{stat.label}</p>
                </motion.div>
              ))}
            </div>
            
            <div className="flex justify-center mt-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Button asChild>
                  <Link to="/dashboard" className="flex items-center">
                    Explore the Dashboard
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </section>
          
          {/* Features Section with clearer hierarchy */}
          <section id="features" className="scroll-mt-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center justify-center">
                <Separator className="w-8 bg-primary h-1" />
                <h2 className="text-lg font-medium px-4">Features</h2>
                <Separator className="w-8 bg-primary h-1" />
              </div>
              <h3 className="text-3xl font-bold mt-4">Smart Processing Features</h3>
              <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
                Leverage advanced OCR and AI technology to automate your receipt processing workflow.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <Layers className="h-8 w-8 text-primary" />,
                  title: "Multi-Format Support",
                  description: "Upload receipt images or PDFs with our drag-and-drop interface. Supports single and batch uploads."
                },
                {
                  icon: <Sparkles className="h-8 w-8 text-primary" />,
                  title: "Dual-Method OCR",
                  description: "Choose between Amazon Textract and Google Gemini AI for the best extraction results."
                },
                {
                  icon: <CheckCircle className="h-8 w-8 text-primary" />,
                  title: "Confidence Indicators",
                  description: "Visual feedback on extraction accuracy with AI-powered suggestions for corrections."
                },
                {
                  icon: <Users className="h-8 w-8 text-primary" />,
                  title: "Team Collaboration",
                  description: "Share receipt data and processing results with your team members securely."
                },
                {
                  icon: <LineChart className="h-8 w-8 text-primary" />,
                  title: "Expense Analytics",
                  description: "Track spending patterns and generate reports for financial planning and analysis."
                },
                {
                  icon: <FileText className="h-8 w-8 text-primary" />,
                  title: "PDF Reporting",
                  description: "Generate comprehensive PDF reports of your receipt data for compliance and record-keeping."
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                >
                  <Card className="h-full hover:bg-primary/5 transition-all duration-300">
                    <CardContent className="pt-6">
                      <div className="mb-4 rounded-full w-16 h-16 flex items-center justify-center bg-primary/10">
                        {feature.icon}
                      </div>
                      <h4 className="text-xl font-medium mb-2">{feature.title}</h4>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
          
          {/* CTA Section */}
          <section className="text-center py-16 px-4 bg-primary/5 backdrop-blur-sm rounded-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-3xl font-bold mb-4">Ready to streamline your receipt processing?</h2>
              <p className="text-xl text-muted-foreground mb-8">
                Join hundreds of companies saving time with our AI-powered receipt processing solution.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" className="animate-pulse">
                  <Link to={user ? '/upload' : '/auth'}>
                    {user ? 'Upload Your First Receipt' : 'Sign Up Free'}
                  </Link>
                </Button>
                {!user && (
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/auth?mode=signin">
                      Log In
                    </Link>
                  </Button>
                )}
              </div>
            </motion.div>
          </section>
        </main>
      </div>

      {/* Enhanced Footer */}
      <footer className="border-t py-12 bg-background/80 backdrop-blur-sm">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h4 className="font-medium text-lg">ReceiptScan</h4>
              <p className="text-sm text-muted-foreground">
                AI-powered receipt processing for modern businesses.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Product</h4>
              <ul className="space-y-2">
                <li><Link to="/features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link></li>
                <li><Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link></li>
                <li><Link to="/api" className="text-sm text-muted-foreground hover:text-foreground">API Reference</Link></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Resources</h4>
              <ul className="space-y-2">
                <li><Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground">Documentation</Link></li>
                <li><Link to="/help" className="text-sm text-muted-foreground hover:text-foreground">Help Center</Link></li>
                <li><Link to="/status" className="text-sm text-muted-foreground hover:text-foreground">System Status</Link></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Legal</h4>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</Link></li>
                <li><Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center mt-12 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="GitHub">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
