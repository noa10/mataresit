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
  Layers,
  TrendingUp
} from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from "@/components/ui/separator";

// Define features array separately for clarity in the Features section
const featuresList = [
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
];

export default function Index() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Smart Receipt Processing - ReceiptScan";
    // Consider adding favicon link handling here if not done globally
  }, []);

  // Workflow-organized features
  const featureGroups = [
    {
      title: "Upload & Process",
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
      title: "OCR & AI Enhancement",
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
      title: "Verify & Manage",
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
    { value: "500+", label: "Finance Teams", icon: <Users className="h-6 w-6 text-primary mb-2" /> },
    { value: "10,000+", label: "Receipts Processed", icon: <FileText className="h-6 w-6 text-primary mb-2" /> },
    { value: "99%", label: "Average Accuracy", icon: <TrendingUp className="h-6 w-6 text-primary mb-2" /> }, // Using TrendingUp for accuracy
  ];

  return (
    // Simplified background and increased spacing
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80"> 
      <Navbar />
      
      <div className="relative overflow-hidden"> {/* Added overflow-hidden */}
        {/* Background pattern - subtle */}
        <div className="absolute inset-0 overflow-hidden z-0">
          <div className="w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>
        </div>

        {/* Increased spacing */}
        <main className="relative z-10 container py-16 space-y-32"> 
          {/* Enhanced Hero Section */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Larger headline */}
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight">
                Intelligent <span className="text-primary">Receipt Processing</span>
              </h1>
              {/* Added subheading */}
              <p className="mt-4 text-xl text-muted-foreground lg:text-2xl">
                Transform receipts into actionable data in seconds.
              </p>
              {/* Enhanced CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-4">
                {!user ? (
                  <>
                    <Button asChild size="lg" className="group bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                      <Link to="/auth" className="flex items-center justify-center sm:justify-start">
                        Sign Up Free
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="lg" asChild className="w-full sm:w-auto">
                      <Link to="/auth?mode=signin" className="flex items-center justify-center sm:justify-start">
                        Log In
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" className="group bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                      <Link to="/upload" className="flex items-center justify-center sm:justify-start">
                        Upload Receipt
                        <Upload className="ml-2 h-5 w-5 transition-transform group-hover:translate-y-[-2px]" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="lg" asChild className="w-full sm:w-auto">
                      <Link to="/dashboard" className="flex items-center justify-center sm:justify-start">
                        View Dashboard
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
            
            {/* Receipt Scanning Hero Image */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="hidden lg:flex justify-center items-center"
            >
              <div className="relative max-w-lg rounded-xl overflow-hidden border border-border shadow-2xl">
                <img 
                  src="/receipt-scanner.png" 
                  alt="Receipt Scanning on Mobile Phone" 
                  width="500"
                  height="600"
                  className="block w-full h-auto object-cover"
                />
                
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                  <div className="flex items-center">
                    <div>
                      <p className="text-white font-medium">Transform your receipts</p>
                      <p className="text-white/80 text-sm">Quick, accurate, and effortless</p>
                    </div>
                    <Button size="sm" variant="secondary" className="ml-auto" asChild>
                      <Link to="/upload">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Improved Workflow Section */}
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
                Our application offers a streamlined workflow from upload to verification.
              </p>
            </motion.div>

            {/* Timeline-style layout */}
            <div className="flex flex-col md:flex-row gap-8 mt-12 items-start relative">
              {featureGroups.map((group, groupIndex) => (
                <motion.div 
                  key={groupIndex} 
                  className="flex-1 relative pb-8 md:pb-0" // Added padding bottom for mobile
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: groupIndex * 0.2 }}
                >
                  {/* Step Number and Title */}
                  <div className="flex items-center mb-6">
                    <span className="bg-primary/10 text-primary rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold shrink-0">
                      {groupIndex + 1}
                    </span>
                    <h3 className="ml-4 text-xl font-semibold text-primary">{group.title}</h3>
                  </div>
                  
                  {/* Feature Cards */}
                  <div className="space-y-4 pl-2 md:pl-0"> 
                    {group.features.map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: (groupIndex * 0.2) + (index * 0.1) + 0.2 }}
                        whileHover={{ scale: 1.02, z: 10 }} // Added z-index on hover
                        className="relative" // Added relative for z-index
                      >
                        <Link to={feature.link} className="block h-full">
                          <Card className="h-full hover:bg-primary/5 hover:shadow-lg transition-all duration-300 cursor-pointer border-border/60 bg-card">
                            <CardContent className="pt-6">
                              <div className="mb-4 rounded-full w-16 h-16 flex items-center justify-center bg-primary/10 scale-110"> {/* Increased icon background size */}
                                {React.cloneElement(feature.icon, { className: "h-10 w-10 text-primary" })} {/* Larger icon */}
                              </div>
                              <h4 className="text-lg font-medium mb-2">{feature.title}</h4>
                              {/* Simplified description - using first sentence as example */}
                              <p className="text-muted-foreground text-sm">
                                {feature.description.split('.')[0]}.
                              </p>
                              {/* Example using bullet points if description allows */}
                              {/* <ul className="text-muted-foreground list-disc pl-5 text-sm space-y-1 mt-2">
                                {feature.description.split('. ').map((point, i) => point && <li key={i}>{point}</li>)}
                              </ul> */}
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Connecting Line/Arrow (Visible on MD+) */}
                  {groupIndex < featureGroups.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 right-[-2rem] transform -translate-y-1/2 z-0">
                      <ArrowRight className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Vertical connector line for mobile */}
                  {groupIndex < featureGroups.length - 1 && (
                    <div className="absolute left-[23px] top-16 bottom-0 w-px bg-border md:hidden" /> 
                  )}
                </motion.div>
              ))}
            </div>
          </section>
          
          {/* Enhanced Stats Section */}
          <section className="py-16 px-4 bg-secondary/10 backdrop-blur-sm rounded-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12" // Increased bottom margin
            >
              <h2 className="text-3xl font-bold">
                Trusted by <span className="text-primary">Finance Teams</span> Worldwide
              </h2>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"> {/* Increased max-width */}
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="text-center flex flex-col items-center"
                >
                  {/* Added Icon */}
                  {stat.icon}
                  {/* Increased value font size & added simple count-up via transition */}
                  <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.2 }} // Slight delay for effect
                    className="text-5xl font-bold text-primary" // Increased size
                  >
                    {stat.value}
                  </motion.h3>
                  <p className="text-muted-foreground mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>
            
            {/* Keep Explore Dashboard button */}
            <div className="flex justify-center mt-16"> {/* Increased top margin */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                whileHover={{ scale: 1.05 }}
              >
                <Button asChild size="lg">
                  <Link to="/dashboard" className="flex items-center">
                    Explore the Dashboard
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </section>
          
          {/* Refined Features Section */}
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
              <h3 className="text-3xl font-bold mt-4">Smart Processing Powerhouse</h3> {/* Changed title slightly */}
              <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
                Leverage advanced OCR and AI technology to automate your receipt processing workflow efficiently.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Using the featuresList defined at the top */}
              {featuresList.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -5, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }} // Enhanced hover
                  className="h-full" // Ensure motion div takes full height for consistent card height
                >
                  <Card className="h-full hover:bg-primary/5 transition-all duration-300 border-border/60 bg-card">
                    {/* Increased padding */}
                    <CardContent className="pt-8"> 
                      <div className="mb-6 rounded-full w-16 h-16 flex items-center justify-center bg-primary/10">
                        {feature.icon}
                      </div>
                      <h4 className="text-xl font-semibold mb-2">{feature.title}</h4>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
          
          {/* Strengthened CTA Section */}
          <section className="text-center py-20 px-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl relative overflow-hidden"> {/* Increased padding, added gradient */}
             {/* Optional: Add a subtle background pattern or shapes */}
            <div className="absolute inset-0 z-0 opacity-5">
              {/* Example subtle pattern */}
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="a" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="scale(2) rotate(45)"><rect x="0" y="0" width="100%" height="100%" fill="hsla(0,0%,100%,0)"/><path d="M10-5C10 5 10 5 0 5A10 10 0 0110-5M10 15c0 10 0 10-10 10a10 10 0 0110-10" stroke-width="0.5" stroke="hsla(215, 28%, 17%, 0.2)" fill="none"/></pattern></defs><rect width="800%" height="800%" transform="translate(0,0)" fill="url(#a)"/></svg>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto relative z-10" // Ensure content is above pattern
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to streamline your receipt processing?</h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-8">
                Join hundreds of companies saving time with our AI-powered receipt processing solution.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                {/* Larger CTA button */}
                <Button asChild size="lg" className="group w-full sm:w-auto">
                  <Link to={user ? '/upload' : '/auth'} className="flex items-center justify-center sm:justify-start">
                    {user ? 'Upload Your First Receipt' : 'Sign Up Free'}
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                {!user && (
                  <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                    <Link to="/auth?mode=signin" className="flex items-center justify-center sm:justify-start">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12"> {/* Added mb */}
            <div className="space-y-4">
              {/* Placeholder for Logo */}
              {/* <img src="/logo.svg" alt="ReceiptScan Logo" className="h-8 mb-2" /> */}
              <h4 className="font-semibold text-lg">ReceiptScan</h4> {/* Increased weight */}
              <p className="text-sm text-muted-foreground">
                AI-powered receipt processing for modern businesses.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Product</h4>
              <ul className="space-y-2">
                {/* Added hover:text-primary */}
                <li><Link to="#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">Features</Link></li>
                <li><Link to="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors">Dashboard</Link></li>
                {/* Placeholder links - update as needed */}
                <li><Link to="/api" className="text-sm text-muted-foreground hover:text-primary transition-colors">API Reference</Link></li>
                <li><Link to="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li> 
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Resources</h4>
              <ul className="space-y-2">
                {/* Added hover:text-primary */}
                <li><Link to="/docs" className="text-sm text-muted-foreground hover:text-primary transition-colors">Documentation</Link></li>
                <li><Link to="/help" className="text-sm text-muted-foreground hover:text-primary transition-colors">Help Center</Link></li>
                <li><Link to="/status" className="text-sm text-muted-foreground hover:text-primary transition-colors">System Status</Link></li>
                <li><Link to="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">Blog</Link></li> 
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Legal</h4>
              <ul className="space-y-2">
                 {/* Added hover:text-primary */}
                <li><Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          
          {/* Newsletter/Contact Placeholder - Adding this requires backend/form handling */}
          {/* 
          <div className="mb-12 pt-8 border-t">
             <h4 className="font-medium text-lg mb-4 text-center md:text-left">Stay Updated</h4>
             <form className="flex flex-col md:flex-row gap-2 max-w-md mx-auto md:mx-0">
                <Input type="email" placeholder="Enter your email" className="flex-grow" />
                <Button type="submit">Subscribe</Button>
             </form>
          </div>
          */}

          <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t">
            <p className="text-sm text-muted-foreground order-2 md:order-1 mt-4 md:mt-0">
              © {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </p>
            {/* Increased icon size and added hover effect */}
            <div className="flex space-x-6 order-1 md:order-2">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> {/* Size 24x24 */}
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="GitHub">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> {/* Size 24x24 */}
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> {/* Size 24x24 */}
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
