import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import {
  Brain,
  Upload,
  Search,
  BarChart3,
  Eye,
  Shield,
  Zap,
  MessageSquare,
  FileText,
  Settings,
  Users,
  Crown,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Camera,
  PieChart,
  Download,
  Clock,
  Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FeaturesPage() {
  const { getCurrentTier, isFeatureAvailable } = useSubscription();
  const tier = getCurrentTier();

  const coreFeatures = [
    {
      icon: <Brain className="h-8 w-8 text-blue-500" />,
      title: "AI-Powered Receipt Processing",
      description: "Advanced AI models extract data from your receipts with high accuracy, supporting multiple currencies and formats.",
      benefits: ["Gemini 2.0 Flash Lite processing", "Confidence scoring", "Multi-currency support", "Real-time processing feedback"],
      available: true
    },
    {
      icon: <Upload className="h-8 w-8 text-green-500" />,
      title: "Smart Upload & Management",
      description: "Upload receipts individually or in batches with intelligent processing and organization.",
      benefits: ["Batch upload support (5-100 files based on plan)", "Real-time progress tracking", "Image optimization", "Automatic categorization"],
      available: true
    },
    {
      icon: <Eye className="h-8 w-8 text-purple-500" />,
      title: "Interactive Receipt Viewer",
      description: "Review and edit receipt data with side-by-side image viewing and AI-powered suggestions.",
      benefits: ["Side-by-side editing", "AI correction suggestions", "Image manipulation tools", "Confidence indicators"],
      available: true
    },
    {
      icon: <Search className="h-8 w-8 text-orange-500" />,
      title: "Semantic Search",
      description: "Find receipts using natural language queries with our ChatGPT-like search interface.",
      benefits: ["Natural language search", "Conversational interface", "Smart filtering", "Context-aware results"],
      available: true
    }
  ];

  const analyticsFeatures = [
    {
      icon: <BarChart3 className="h-8 w-8 text-indigo-500" />,
      title: "Spending Analytics",
      description: "Visualize your expenses with interactive charts and detailed breakdowns.",
      benefits: ["Category pie charts", "Spending trends", "Date range analysis", "Export capabilities"],
      available: true
    },
    {
      icon: <FileText className="h-8 w-8 text-red-500" />,
      title: "PDF Report Generation",
      description: "Generate comprehensive PDF reports of your expenses for any date range.",
      benefits: ["Custom date ranges", "Detailed summaries", "Professional formatting", "Download & share"],
      available: true
    },
    {
      icon: <PieChart className="h-8 w-8 text-teal-500" />,
      title: "Dashboard Overview",
      description: "Get a complete view of your receipts with filtering, search, and bulk operations.",
      benefits: ["Multi-select operations", "Advanced filtering", "Status tracking", "Export options"],
      available: true
    }
  ];

  const platformFeatures = [
    {
      icon: <Shield className="h-8 w-8 text-green-600" />,
      title: "Secure Authentication",
      description: "Google OAuth integration with Supabase for secure, hassle-free access.",
      benefits: ["Google OAuth", "Secure data storage", "User privacy protection", "Session management"],
      available: true
    },
    {
      icon: <Settings className="h-8 w-8 text-gray-600" />,
      title: "Profile & Settings",
      description: "Customize your experience with personal preferences and account management.",
      benefits: ["User preferences", "Currency settings", "Account management", "Privacy controls"],
      available: true
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-blue-600" />,
      title: "Help & Support",
      description: "Comprehensive help center with searchable FAQ and category-based assistance.",
      benefits: ["Searchable FAQ", "Category organization", "Step-by-step guides", "Quick answers"],
      available: true
    }
  ];

  const renderFeatureCard = (feature: any, index: number) => (
    <motion.div
      key={feature.title}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-transparent hover:border-l-primary">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-background/50">
              {feature.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                {feature.available && (
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Available
                  </Badge>
                )}
              </div>
              <CardDescription className="text-sm leading-relaxed">
                {feature.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {feature.benefits.map((benefit: string, idx: number) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Mataresit Features</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover what you can do with our AI-powered receipt management platform
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge className={`${
              tier === 'pro' ? 'bg-blue-500 text-white' :
              tier === 'max' ? 'bg-purple-500 text-white' :
              'bg-green-500 text-white'
            } px-3 py-1`}>
              {tier === 'pro' ? (
                <>
                  <Zap className="h-4 w-4 mr-1" />
                  Pro Plan
                </>
              ) : tier === 'max' ? (
                <>
                  <Crown className="h-4 w-4 mr-1" />
                  Max Plan
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  Free Plan
                </>
              )}
            </Badge>
          </div>
        </motion.div>

        {/* Core Features Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Core Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your receipts efficiently with AI-powered automation
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coreFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* Analytics & Reporting Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Analytics & Reporting</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Gain insights into your spending patterns with powerful analytics and reporting tools
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {analyticsFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* Platform Features Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Platform & Security</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built with security, usability, and support in mind
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {platformFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* Subscription Tiers Overview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Subscription Benefits</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Unlock additional capabilities with our Pro and Max plans
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Tier */}
            <Card className={`${tier === 'free' ? 'ring-2 ring-green-500 bg-green-50/50' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="h-6 w-6 text-green-500" />
                  <CardTitle>Free Plan</CardTitle>
                  {tier === 'free' && <Badge className="bg-green-500 text-white">Current</Badge>}
                </div>
                <CardDescription>Perfect for getting started</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    50 receipts per month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Batch upload (up to 5 files)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Basic AI processing
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Standard analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Email support
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Pro Tier */}
            <Card className={`${tier === 'pro' ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-6 w-6 text-blue-500" />
                  <CardTitle>Pro Plan</CardTitle>
                  {tier === 'pro' && <Badge className="bg-blue-500 text-white">Current</Badge>}
                </div>
                <CardDescription>For regular users</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    500 receipts per month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    Batch upload (up to 50 files)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    Advanced AI models
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    Enhanced analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    Priority support
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Max Tier */}
            <Card className={`${tier === 'max' ? 'ring-2 ring-purple-500 bg-purple-50/50' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-6 w-6 text-purple-500" />
                  <CardTitle>Max Plan</CardTitle>
                  {tier === 'max' && <Badge className="bg-purple-500 text-white">Current</Badge>}
                </div>
                <CardDescription>For power users</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Unlimited receipts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Batch upload (up to 100 files)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Premium AI models
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Advanced analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Dedicated support
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* Call to Action */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="text-center"
        >
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Ready to Get Started?
              </CardTitle>
              <CardDescription className="text-lg">
                Experience the power of AI-driven receipt management today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/dashboard">
                    <Upload className="h-5 w-5" />
                    Start Uploading Receipts
                  </Link>
                </Button>
                {tier === 'free' && (
                  <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link to="/pricing">
                      <Crown className="h-5 w-5" />
                      Upgrade Plan
                    </Link>
                  </Button>
                )}
                <Button asChild variant="ghost" size="lg" className="gap-2">
                  <Link to="/help">
                    <MessageSquare className="h-5 w-5" />
                    Get Help
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Coming Soon Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mt-16 text-center"
        >
          <h2 className="text-2xl font-bold mb-4 text-muted-foreground">Coming Soon</h2>
          <p className="text-muted-foreground mb-6">
            We're constantly working on new features to enhance your experience
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">API Access</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Integrate with your existing systems
                </p>
              </CardContent>
            </Card>
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">Team Collaboration</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Share and collaborate on receipts
                </p>
              </CardContent>
            </Card>
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">Advanced Exports</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Export to accounting software
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
