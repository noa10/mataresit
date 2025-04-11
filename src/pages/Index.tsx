
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { TransactionSummary } from '@/components/dashboard/TransactionSummary';
import Navbar from '@/components/Navbar';
import { ArrowRight, Upload, FileSpreadsheet, AreaChart, RotateCw, Settings, HistoryIcon } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import backgroundPattern from '@/assets/background-pattern.svg';

export default function Index() {
  const { user } = useAuth();
  
  const features = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: 'Upload Receipts',
      description: 'Quickly upload receipt images from your computer or mobile device.',
      link: '/upload'
    },
    {
      icon: <RotateCw className="h-8 w-8 text-primary" />,
      title: 'AI Processing',
      description: 'Advanced AI extracts data from receipts with high accuracy.',
      link: '/upload'
    },
    {
      icon: <FileSpreadsheet className="h-8 w-8 text-primary" />,
      title: 'Categorize Expenses',
      description: 'Auto-categorize and organize your expenses for better tracking.',
      link: '/dashboard'
    },
    {
      icon: <AreaChart className="h-8 w-8 text-primary" />,
      title: 'Visualize Spending',
      description: 'See spending patterns with interactive charts and analytics.',
      link: '/dashboard'
    },
    {
      icon: <HistoryIcon className="h-8 w-8 text-primary" />,
      title: 'Track History',
      description: 'View complete history of your receipt processing and changes.',
      link: '/dashboard'
    },
    {
      icon: <Settings className="h-8 w-8 text-primary" />,
      title: 'Custom Settings',
      description: 'Configure processing options to fit your specific needs.',
      link: '/settings'
    }
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Using the shared Navbar component */}
      <Navbar />
      
      <div className="relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden z-0">
          <img 
            src={backgroundPattern} 
            alt="" 
            className="w-full h-full object-cover opacity-5"
          />
        </div>
        
        {/* Hero Section */}
        <section className="relative z-10 py-16 md:py-24 container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Receipt Processing <span className="text-primary">Automated</span>
              </h1>
              <p className="mt-4 text-xl text-muted-foreground">
                Upload, extract, verify, and manage receipt data with AI-powered accuracy.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link to={user ? '/upload' : '/auth'}>
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
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
                src="/images/receipt-hero.png" 
                alt="Receipt Processing" 
                className="w-full rounded-lg shadow-xl"
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.currentTarget.style.display = 'none';
                }}
              />
            </motion.div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="relative z-10 py-16 bg-secondary/10 backdrop-blur-sm">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold">Powerful Features</h2>
              <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
                Our application offers cutting-edge tools to streamline your receipt management workflow.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
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
        
        {/* Dashboard Preview Section (only if logged in) */}
        {user && (
          <section className="relative z-10 py-16 container">
            <div className="grid grid-cols-1 gap-6">
              <h2 className="text-3xl font-bold">Recent Activity</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <RecentTransactions limit={5} />
                </div>
                <div>
                  <TransactionSummary />
                </div>
              </div>
              <div className="flex justify-center mt-8">
                <Button asChild>
                  <Link to="/dashboard">View Full Dashboard</Link>
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
      
      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">Privacy</Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">Terms</Link>
              <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground">Help</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
