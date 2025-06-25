import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Database,
  Bot,
  Users,
  BarChart,
  Mail,
  Globe,
  Edit,
  Contact,
  Info,
  User,
  Receipt,
  CreditCard,
  Key,
  Award,
  Lock,
  Server,
  ShieldCheck,
  Eye,
  HardDrive,
  Clock,
  Download,
  Trash,
  Ban,
  XCircle,
  Handshake,
  Gavel,
  Cookie,
  Cog,
  ChartPie,
  SlidersHorizontal,

  CheckCircle,
  Archive,
  TriangleAlert,
  Bell,
  History,
  Lightbulb,
  Headphones,
  MapPin,
  User2,
  Scale,
  Home,
  ArrowLeft,
  Star,
  FileText
} from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Back Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <Link to="/">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 rounded-full">
              <Shield className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-xl text-blue-600 dark:text-blue-400 mb-2">Mataresit - AI-Powered Receipt Management</p>
          <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground"><strong>Effective Date:</strong> January 15, 2025</p>
            <p className="text-sm text-muted-foreground"><strong>Last Updated:</strong> January 15, 2025</p>
          </div>
        </motion.div>

        {/* Introduction */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-12"
        >
          <Card className="border-l-4 border-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Info className="h-6 w-6 text-blue-600" />
                Introduction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Mataresit ("we," "our," or "us") is committed to protecting your privacy and ensuring the security of your personal and financial data. This Privacy Policy explains how we collect, use, process, and protect your information when you use our AI-powered receipt management platform.
              </p>
              <p className="text-muted-foreground">
                Our service transforms receipts into organized data using advanced artificial intelligence, enabling automated expense tracking, categorization, and financial reporting for businesses of all sizes.
              </p>
              <p className="font-semibold text-blue-700 dark:text-blue-400">
                By using Mataresit, you consent to the practices described in this Privacy Policy.
              </p>
            </CardContent>
          </Card>
        </motion.section>

        <Separator className="my-8" />

        {/* Information We Collect */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Database className="h-8 w-8 text-green-600" />
            Information We Collect
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-green-800 dark:text-green-300">
                  <User className="h-5 w-5 text-green-600" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-foreground">
                <div><strong>Email Address:</strong> For account creation and communication</div>
                <div><strong>Password:</strong> Securely hashed and stored</div>
                <div><strong>Authentication Data:</strong> Google OAuth tokens when using Google sign-in</div>
                <div><strong>Account Settings:</strong> Preferences, categories, and configurations</div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-purple-800 dark:text-purple-300">
                  <Receipt className="h-5 w-5 text-purple-600" />
                  Receipt Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-foreground">
                <div><strong>Receipt Images:</strong> Photos and scanned documents you upload</div>
                <div><strong>Extracted Information:</strong> Merchant names, dates, amounts, line items</div>
                <div><strong>Categories:</strong> Expense classifications and tags</div>
                <div><strong>Metadata:</strong> Upload timestamps, processing status, confidence scores</div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-orange-800 dark:text-orange-300">
                  <BarChart className="h-5 w-5 text-orange-600" />
                  Usage Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-foreground">
                <div><strong>Platform Usage:</strong> Features accessed, frequency of use</div>
                <div><strong>Processing Statistics:</strong> Receipt volumes, AI model performance</div>
                <div><strong>Error Logs:</strong> Technical issues for service improvement</div>
                <div><strong>Performance Metrics:</strong> Response times, accuracy scores</div>
              </CardContent>
            </Card>

            <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-red-800 dark:text-red-300">
                  <CreditCard className="h-5 w-5 text-red-600" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-foreground">
                <div><strong>Billing Details:</strong> Name, billing address</div>
                <div><strong>Payment Processing:</strong> Handled securely by Stripe</div>
                <div><strong>Transaction Records:</strong> Subscription history, invoices</div>
                <div><strong>Usage Tracking:</strong> Monthly limits, overage monitoring</div>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* AI Processing and Third-Party Services */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Bot className="h-8 w-8 text-indigo-600" />
            AI Processing and Third-Party Services
          </h2>

          <Card className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-indigo-800 dark:text-indigo-300">
                <Bot className="h-6 w-6 text-indigo-600" />
                Google Gemini AI Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Data Processing:</h4>
                  <ul className="space-y-2 text-muted-foreground text-sm">
                    <li>• Receipt images processed using Gemini 2.0 Flash models</li>
                    <li>• Advanced vision AI extracts text, amounts, and metadata</li>
                    <li>• Processing includes confidence scoring and validation</li>
                    <li>• Batch processing capabilities for multiple receipts</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Data Security:</h4>
                  <ul className="space-y-2 text-muted-foreground text-sm">
                    <li>• Server-side processing with enterprise-grade security</li>
                    <li>• Data transmitted via encrypted connections</li>
                    <li>• Google's data protection standards apply</li>
                    <li>• No long-term storage by Google Gemini services</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-800 dark:text-gray-200">
                  <Key className="h-5 w-5 text-gray-600" />
                  OpenRouter Integration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-sm">
                  Optional third-party AI provider integration requiring user-provided API keys.
                </p>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• User-controlled API key management</li>
                  <li>• Direct user-to-OpenRouter data transmission</li>
                  <li>• We don't store or access your OpenRouter API keys</li>
                  <li>• Subject to OpenRouter's privacy policies</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-blue-800 dark:text-blue-300">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  Stripe Payment Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3 text-sm">
                  All payment processing handled by Stripe, a PCI DSS compliant payment processor.
                </p>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• Secure payment data handling by Stripe</li>
                  <li>• We don't store credit card information</li>
                  <li>• Subscription and billing management</li>
                  <li>• Subject to Stripe's privacy policies</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* How We Use Your Information */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Cog className="h-8 w-8 text-purple-600" />
            How We Use Your Information
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-b from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-purple-800 dark:text-purple-300">
                  <Bot className="h-5 w-5 text-purple-600" />
                  Service Provision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• AI-powered receipt processing and data extraction</li>
                  <li>• Automated categorization and organization</li>
                  <li>• Export functionality to accounting software</li>
                  <li>• Search and retrieval capabilities</li>
                  <li>• Team collaboration features</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-b from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-green-800 dark:text-green-300">
                  <BarChart className="h-5 w-5 text-green-600" />
                  Analytics & Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• Service performance monitoring</li>
                  <li>• AI model accuracy improvements</li>
                  <li>• Feature usage analytics</li>
                  <li>• Bug identification and resolution</li>
                  <li>• User experience optimization</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-b from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-200 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-orange-800 dark:text-orange-300">
                  <Mail className="h-5 w-5 text-orange-600" />
                  Communication
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• Account notifications and updates</li>
                  <li>• Billing and subscription communications</li>
                  <li>• Technical support and assistance</li>
                  <li>• Service announcements</li>
                  <li>• Security alerts when necessary</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Data Storage and Security */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Shield className="h-8 w-8 text-red-600" />
            Data Storage and Security
          </h2>

          <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 mb-6">
            <CardHeader>
              <div className="flex items-center mb-4">
                <Award className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <h3 className="text-xl font-semibold text-red-800 dark:text-red-300">Bank-Level Security</h3>
                  <p className="text-red-700 dark:text-red-400">SOC 2 Compliant with Enterprise-Grade Protection</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Security Measures:</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center"><Lock className="h-4 w-4 text-green-500 mr-2" />End-to-end encryption</li>
                    <li className="flex items-center"><Server className="h-4 w-4 text-blue-500 mr-2" />Secure cloud infrastructure</li>
                    <li className="flex items-center"><ShieldCheck className="h-4 w-4 text-purple-500 mr-2" />Role-based access control</li>
                    <li className="flex items-center"><Eye className="h-4 w-4 text-orange-500 mr-2" />Continuous monitoring</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Data Protection:</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center"><HardDrive className="h-4 w-4 text-indigo-500 mr-2" />Encrypted data storage</li>
                    <li className="flex items-center"><Archive className="h-4 w-4 text-green-500 mr-2" />Regular backups</li>
                    <li className="flex items-center"><TriangleAlert className="h-4 w-4 text-red-500 mr-2" />Vulnerability assessments</li>
                    <li className="flex items-center"><Award className="h-4 w-4 text-blue-500 mr-2" />SOC 2 compliance</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <HardDrive className="h-5 w-5 text-gray-600" />
                  Data Storage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• Secure cloud infrastructure</li>
                  <li>• Encrypted at rest and in transit</li>
                  <li>• Geographically distributed backups</li>
                  <li>• Access logging and monitoring</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <Users className="h-5 w-5 text-gray-600" />
                  Access Control
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• Role-based permissions</li>
                  <li>• Multi-factor authentication</li>
                  <li>• Regular access reviews</li>
                  <li>• Audit trail maintenance</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <Clock className="h-5 w-5 text-gray-600" />
                  Data Retention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• Receipt data: 7 years</li>
                  <li>• Account data: Account lifetime</li>
                  <li>• Usage logs: 2 years</li>
                  <li>• Backup data: 1 year</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Your Rights and Controls */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            Your Rights and Controls
          </h2>

          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 mb-6">
            <CardContent className="p-6">
              <p className="text-blue-800 dark:text-blue-300">
                You have comprehensive control over your personal data and how it's used within our platform.
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="bg-background border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Eye className="h-5 w-5 text-blue-500" />
                    Access Rights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-2">Request access to all personal data we hold about you.</p>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• Download your receipt data</li>
                    <li>• View account information</li>
                    <li>• Access processing history</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-background border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Edit className="h-5 w-5 text-green-500" />
                    Correction Rights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-2">Update or correct inaccurate personal information.</p>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• Edit account details</li>
                    <li>• Correct receipt data</li>
                    <li>• Update preferences</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-background border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Ban className="h-5 w-5 text-orange-500" />
                    Restriction Rights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-2">Limit how we process your personal data.</p>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• Pause data processing</li>
                    <li>• Limit sharing permissions</li>
                    <li>• Control analytics participation</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="bg-background border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Download className="h-5 w-5 text-purple-500" />
                    Portability Rights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-2">Export your data in a structured, machine-readable format.</p>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• JSON/CSV data exports</li>
                    <li>• Receipt image downloads</li>
                    <li>• Migration assistance</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-background border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Trash className="h-5 w-5 text-red-500" />
                    Deletion Rights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-2">Request deletion of your personal data.</p>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• Delete individual receipts</li>
                    <li>• Close account completely</li>
                    <li>• Remove processing history</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-background border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <XCircle className="h-5 w-5 text-gray-500" />
                    Objection Rights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-2">Object to certain types of data processing.</p>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• Opt out of analytics</li>
                    <li>• Limit marketing communications</li>
                    <li>• Restrict data sharing</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Data Sharing and Disclosure */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Handshake className="h-8 w-8 text-yellow-600" />
            Data Sharing and Disclosure
          </h2>

          <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center mb-3">
                <Info className="h-6 w-6 text-yellow-600 mr-3" />
                <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">Our Commitment</h3>
              </div>
              <p className="text-yellow-800 dark:text-yellow-300">
                We do not sell, rent, or trade your personal information. Data sharing is limited to essential service providers and legal requirements only.
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-background border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-foreground">
                  <Handshake className="h-6 w-6 text-blue-600" />
                  Service Providers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold text-foreground">Google Gemini AI</h4>
                  <p className="text-muted-foreground text-sm">Receipt processing and data extraction</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-foreground">Stripe</h4>
                  <p className="text-muted-foreground text-sm">Payment processing and billing</p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-foreground">Cloud Infrastructure</h4>
                  <p className="text-muted-foreground text-sm">Secure hosting and data storage</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-foreground">
                  <Gavel className="h-6 w-6 text-red-600" />
                  Legal Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  We may disclose your information when required by law or to protect our rights and users.
                </p>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li className="flex items-center">
                    <Scale className="h-4 w-4 text-red-500 mr-2" />
                    Legal compliance and court orders
                  </li>
                  <li className="flex items-center">
                    <Shield className="h-4 w-4 text-orange-500 mr-2" />
                    Fraud prevention and security
                  </li>
                  <li className="flex items-center">
                    <Users className="h-4 w-4 text-blue-500 mr-2" />
                    Protecting user rights and safety
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Cookies and Tracking */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.75 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Cookie className="h-8 w-8 text-orange-600" />
            Cookies and Tracking Technologies
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-orange-800 dark:text-orange-300">
                  <Cog className="h-5 w-5 text-orange-600" />
                  Essential Cookies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-3">Required for basic platform functionality.</p>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• Authentication sessions</li>
                  <li>• Security tokens</li>
                  <li>• User preferences</li>
                  <li>• Platform stability</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-blue-800 dark:text-blue-300">
                  <ChartPie className="h-5 w-5 text-blue-600" />
                  Analytics Cookies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-3">Help us understand platform usage and performance.</p>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• Usage patterns</li>
                  <li>• Performance metrics</li>
                  <li>• Feature adoption</li>
                  <li>• Error tracking</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-green-800 dark:text-green-300">
                  <SlidersHorizontal className="h-5 w-5 text-green-600" />
                  Cookie Controls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-3">Manage your cookie preferences through browser settings.</p>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• Browser controls</li>
                  <li>• Opt-out options</li>
                  <li>• Preference management</li>
                  <li>• Regular reviews</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Changes to Privacy Policy */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.77 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Edit className="h-8 w-8 text-indigo-600" />
            Changes to This Privacy Policy
          </h2>

          <Card className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800">
            <CardContent className="p-6 space-y-4">
              <p className="text-muted-foreground">
                We may update this Privacy Policy periodically to reflect changes in our practices, technology, legal requirements, or other factors.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-background border-indigo-200 dark:border-indigo-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-indigo-800 dark:text-indigo-300">
                      <Bell className="h-5 w-5 text-indigo-600" />
                      Notification Process
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-muted-foreground text-sm">
                      <li>• Email notification for material changes</li>
                      <li>• In-platform announcements</li>
                      <li>• 30-day advance notice period</li>
                      <li>• Clear explanation of changes</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-background border-indigo-200 dark:border-indigo-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-indigo-800 dark:text-indigo-300">
                      <History className="h-5 w-5 text-indigo-600" />
                      Version Control
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-muted-foreground text-sm">
                      <li>• Dated policy versions</li>
                      <li>• Archive of previous versions</li>
                      <li>• Change log maintenance</li>
                      <li>• Effective date tracking</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-4">
                  <p className="text-yellow-800 dark:text-yellow-300 text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                    <strong>Your continued use of Mataresit after policy updates constitutes acceptance of the revised terms.</strong>
                    If you disagree with changes, you may discontinue use and request data deletion.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </motion.section>

        <Separator className="my-8" />

        {/* Contact Information */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mb-12"
        >
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-green-800 dark:text-green-300">
                <Contact className="h-6 w-6 text-green-600" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center mb-6">
                <Headphones className="h-8 w-8 text-green-600 mr-4" />
                <div>
                  <h3 className="text-xl font-semibold text-green-800 dark:text-green-300">Data Protection & Privacy Inquiries</h3>
                  <p className="text-green-700 dark:text-green-400">We're here to help with all your privacy-related questions</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Card className="bg-background border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                        <Mail className="h-4 w-4 text-green-600" />
                        Email Contact
                      </h4>
                      <p className="text-muted-foreground text-sm mb-2">For privacy-related inquiries:</p>
                      <p className="text-blue-600 dark:text-blue-400 font-semibold">privacy@mataresit.com</p>
                      <p className="text-muted-foreground text-sm mt-2">Response time: Within 72 hours</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-background border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                        <Headphones className="h-4 w-4 text-green-600" />
                        General Support
                      </h4>
                      <p className="text-muted-foreground text-sm mb-2">For technical and account support:</p>
                      <p className="text-blue-600 dark:text-blue-400 font-semibold">support@mataresit.com</p>
                      <p className="text-muted-foreground text-sm mt-2">Response time: Within 24 hours</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="bg-background border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-green-600" />
                        Business Address
                      </h4>
                      <p className="text-muted-foreground text-sm">
                        Mataresit Sdn Bhd<br />
                        Kuala Lumpur, Malaysia<br />
                        <span className="text-muted-foreground">Registration: To be updated</span>
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-background border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                        <User2 className="h-4 w-4 text-green-600" />
                        Data Protection Officer
                      </h4>
                      <p className="text-muted-foreground text-sm mb-2">Khairul Anwar</p>
                      <p className="text-blue-600 dark:text-blue-400 text-sm">dpo@mataresit.com</p>
                      <p className="text-muted-foreground text-sm mt-1">Available for consultation on privacy matters</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
        >
          <div className="text-center">
            <div className="flex justify-center items-center mb-4">
              <Shield className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Mataresit Privacy Policy</h3>
                <p className="text-muted-foreground text-sm">Effective Date: January 15, 2025</p>
              </div>
            </div>

            <Separator className="my-4" />

            <p className="text-muted-foreground text-sm mb-2">
              This Privacy Policy is part of our commitment to transparency and data protection.
            </p>
            <p className="text-muted-foreground text-xs mb-6">
              © 2025 Mataresit. All rights reserved. This document is governed by Malaysian privacy laws and international best practices.
            </p>

            {/* Navigation Links */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6 pt-4 border-t border-gray-300 dark:border-gray-600">
              <Link to="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <Home className="h-4 w-4" />
                  Home
                </Button>
              </Link>
              <Link to="/terms-conditions">
                <Button variant="ghost" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Terms & Conditions
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Star className="h-4 w-4" />
                  Pricing
                </Button>
              </Link>
              <Link to="/help">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Info className="h-4 w-4" />
                  Help Center
                </Button>
              </Link>
            </div>

            <div className="flex justify-center space-x-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Award className="h-3 w-3" />
                SOC 2 Compliant
              </span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Bank-Level Security
              </span>
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Enterprise Grade
              </span>
            </div>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
