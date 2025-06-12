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
  TrendingUp,
  Brain,
  Search,
  Zap,
  Shield,
  Clock,
  DollarSign,
  Target
} from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from "@/components/ui/separator";

// Business-focused features array inspired by Dext
const featuresList = [
  {
    icon: <Clock className="h-8 w-8 text-primary" />,
    title: "Save Hours Every Week",
    description: "Eliminate manual data entry forever. Our AI processes receipts in seconds, not hours, giving you time to focus on growing your business."
  },
  {
    icon: <Target className="h-8 w-8 text-primary" />,
    title: "99% Accuracy Guaranteed",
    description: "Advanced AI with confidence scoring ensures your financial data is always accurate. Catch errors before they become problems."
  },
  {
    icon: <Search className="h-8 w-8 text-primary" />,
    title: "Find Any Receipt Instantly",
    description: "Smart search that understands natural language. Find receipts by asking 'coffee expenses last month' or 'client dinner receipts'."
  },
  {
    icon: <DollarSign className="h-8 w-8 text-primary" />,
    title: "Maximize Tax Deductions",
    description: "Never miss a deductible expense again. Automatically categorize and organize receipts for tax season and financial reporting."
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Team Collaboration Made Easy",
    description: "Share receipts and reports with your team or accountant. Real-time collaboration with role-based permissions and audit trails."
  },
  {
    icon: <Shield className="h-8 w-8 text-primary" />,
    title: "Bank-Level Security",
    description: "Your financial data is protected with enterprise-grade security. SOC 2 compliant with end-to-end encryption."
  }
];

// How it works steps
const howItWorksSteps = [
  {
    step: "1",
    icon: <Upload className="h-8 w-8 text-primary" />,
    title: "Upload",
    description: "Snap a photo or upload files. Drag and drop multiple receipts for batch processing."
  },
  {
    step: "2",
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: "AI Processing",
    description: "Our AI extracts all data with confidence scores. Review and approve in seconds."
  },
  {
    step: "3",
    icon: <CheckCircle className="h-8 w-8 text-primary" />,
    title: "Export & Analyze",
    description: "Export to Excel, QuickBooks, or your favorite accounting software. Generate reports instantly."
  }
];

export default function Index() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "More Business, Less Paperwork - Mataresit";
  }, []);



  // Business-focused stats
  const stats = [
    { value: "10,000+", label: "Businesses Trust Us", icon: <Users className="h-6 w-6 text-primary mb-2" /> },
    { value: "99%", label: "Accuracy Rate", icon: <Target className="h-6 w-6 text-primary mb-2" /> },
    { value: "5 Hours", label: "Saved Per Week", icon: <Clock className="h-6 w-6 text-primary mb-2" /> },
  ];

  return (
    <>
      <div className="relative overflow-hidden">
        {/* Enhanced background pattern */}
        <div className="absolute inset-0 overflow-hidden z-0">
          <div className="w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>
        </div>

        <main className="relative z-10 container py-16 space-y-32">
          {/* Enhanced Hero Section with business focus */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight">
                More Business, <span className="text-primary">Less Paperwork</span>
              </h1>
              <p className="mt-4 text-xl text-muted-foreground lg:text-2xl">
                Transform your receipts into organized data instantly. Save hours every week and never miss a tax deduction again.
              </p>
              {/* Business benefits highlight */}
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Save 5+ Hours/Week</span>
                </div>
                <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1 text-sm">
                  <Target className="h-4 w-4 text-primary" />
                  <span>99% Accuracy</span>
                </div>
                <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1 text-sm">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>Bank-Level Security</span>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-4">
                {!user ? (
                  <>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button asChild size="lg" className="group bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                        <Link to="/auth" className="flex items-center justify-center sm:justify-start">
                          Get Started Free
                          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                        <Link to="/pricing" className="flex items-center justify-center sm:justify-start">
                          View Pricing
                        </Link>
                      </Button>
                    </motion.div>
                  </>
                ) : (
                  <>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button asChild size="lg" className="group bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                        <Link to="/dashboard" className="flex items-center justify-center sm:justify-start">
                          Go to Dashboard
                          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                        <Link to="/semantic-search" className="flex items-center justify-center sm:justify-start">
                          Try Smart Search
                        </Link>
                      </Button>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Keep existing hero image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="hidden lg:flex justify-center items-center"
            >
              <div className="relative max-w-lg rounded-xl overflow-hidden border border-border shadow-2xl">
                <img
                  src="/receipt-scanner.png"
                  alt="AI Receipt Processing"
                  width="500"
                  height="600"
                  className="block w-full h-auto object-cover"
                />

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                  <div className="flex items-center">
                    <div>
                      <p className="text-white font-medium">Transform Your Business</p>
                      <p className="text-white/80 text-sm">Save time, increase accuracy</p>
                    </div>
                    <Button size="sm" variant="secondary" className="ml-auto" asChild>
                      <Link to="/dashboard">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Start Now
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* How It Works Section */}
          <motion.section
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="py-20"
          >
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-3xl md:text-4xl font-bold mb-4"
              >
                How It Works
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-lg text-muted-foreground max-w-2xl mx-auto"
              >
                From receipt to organized data in three simple steps. No training required.
              </motion.p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {howItWorksSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                  className="text-center relative"
                >
                  {/* Step connector line */}
                  {index < howItWorksSteps.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent z-0" />
                  )}

                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                      {step.icon}
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                        {step.step}
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>



          {/* Enhanced Stats Section */}
          <motion.section
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="py-20 text-center"
          >
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold mb-16"
            >
              Join thousands of businesses saving time and money
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="text-center flex flex-col items-center p-6 rounded-lg hover:bg-primary/5 transition-all duration-300"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                  >
                    {stat.icon}
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                    className="text-5xl font-bold text-primary"
                  >
                    {stat.value}
                  </motion.h3>
                  <p className="text-muted-foreground mt-2 font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Enhanced Features Section */}
          <motion.section
            id="features"
            className="scroll-mt-16 py-20"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything you need to <span className="text-primary">transform your business</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Stop wasting time on manual data entry. Our intelligent platform handles everything from receipt capture to financial reporting.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuresList.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -5 }}
                  className="h-full"
                >
                  <Card className="h-full hover:bg-primary/5 transition-all duration-300 border-border/60 bg-card hover:shadow-lg">
                    <CardContent className="pt-8">
                      <motion.div
                        className="mb-6 rounded-full w-16 h-16 flex items-center justify-center bg-primary/10"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ duration: 0.2 }}
                      >
                        {feature.icon}
                      </motion.div>
                      <h4 className="text-xl font-semibold mb-3">{feature.title}</h4>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Enhanced CTA Section */}
          <motion.section
            className="text-center py-20 px-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl relative overflow-hidden"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 z-0 opacity-5">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="a" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="scale(2) rotate(45)"><rect x="0" y="0" width="100%" height="100%" fill="hsla(0,0%,100%,0)"/><path d="M10-5C10 5 10 5 0 5A10 10 0 0 1 10-5M10 15c0 10 0 10-10 10a10 10 0 0 1 10-10" strokeWidth="0.5" stroke="hsla(215, 28%, 17%, 0.2)" fill="none"/></pattern></defs><rect width="800%" height="800%" transform="translate(0,0)" fill="url(#a)"/></svg>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto relative z-10"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to transform your business?</h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-8">
                Join thousands of businesses already saving hours every week. Start your free trial today.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="group w-full sm:w-auto">
                    <Link to={user ? '/dashboard' : '/auth'} className="flex items-center justify-center sm:justify-start">
                      {user ? 'Go to Dashboard' : 'Start Free Trial'}
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </motion.div>
                {!user && (
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                      <Link to="/pricing" className="flex items-center justify-center sm:justify-start">
                        View Pricing
                      </Link>
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.section>
        </main>
      </div>

      {/* Keep existing footer */}
      <footer className="border-t py-12 bg-background/80 backdrop-blur-sm">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img src="/mataresit-icon.png" alt="Mataresit Logo" className="h-8" />
                <h4 className="font-semibold text-lg">Mataresit</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Transform your receipts into organized data. Save time, increase accuracy, and never miss a deduction.
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
              © {new Date().getFullYear()} Mataresit. All rights reserved.
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
    </>
  );
}
