import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Info,
  UserCircle,
  CreditCard,
  Cog,
  UserCheck,
  Shield,
  Copyright,
  Server,
  XCircle,
  ExclamationTriangle,
  Scale,
  RefreshCw,
  Mail,
  CheckCircle,
  Users,
  Settings,
  Upload,
  Brain,
  BarChart3,
  Clock,
  Sparkles,
  Search,
  Zap,
  Crown,
  Star,
  AlertTriangle,
  Gavel,
  Globe,
  Building,
  Phone,
  MapPin,
  Home,
  ArrowLeft
} from "lucide-react";

export default function TermsConditionsPage() {
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
              <FileText className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-xl text-blue-600 dark:text-blue-400 mb-2">Mataresit - AI-Powered Receipt Management Platform</p>
          <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground"><strong>Last Updated:</strong> January 2025</p>
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
                Introduction and Acceptance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Welcome to Mataresit, an AI-powered Software as a Service (SaaS) platform that automates receipt data extraction and organization for businesses. These Terms of Service ("Terms") govern your access to and use of Mataresit's services, website, and applications (collectively, the "Service") operated by Mataresit ("we," "us," or "our").
              </p>
              <p className="text-muted-foreground">
                By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access the Service.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="font-semibold text-foreground mb-2">Our Service provides:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>AI-powered receipt processing and data extraction</li>
                  <li>Automated expense categorization and organization</li>
                  <li>Export capabilities to Excel, QuickBooks, and other accounting software</li>
                  <li>Team collaboration and real-time sharing features</li>
                  <li>Smart search and natural language querying</li>
                  <li>API access for third-party integrations</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <Separator className="my-8" />

        {/* User Accounts */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <UserCircle className="h-8 w-8 text-green-600" />
            User Accounts and Registration
          </h2>

          <div className="space-y-6">
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-green-800 dark:text-green-300">Account Creation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">To use our Service, you must create an account by providing:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>A valid email address</li>
                  <li>A secure password</li>
                </ul>
                <p className="mt-4 text-muted-foreground">Alternatively, you may register using Google authentication services.</p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-300">Account Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">You are responsible for:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Notifying us immediately of any unauthorized access</li>
                  <li>Using strong, unique passwords</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="text-purple-800 dark:text-purple-300">Account Eligibility</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  You must be at least 18 years old to use our Service. By creating an account, you represent and warrant that you meet this age requirement and have the legal capacity to enter into these Terms.
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Subscription and Billing */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-purple-600" />
            Subscription Plans and Billing
          </h2>

          <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-foreground">Service Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-background border border-green-200 dark:border-green-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h4 className="font-bold text-green-600">Free Plan</h4>
                    </div>
                    <p className="text-2xl font-bold mb-2 text-foreground">RM 0<span className="text-sm font-normal">/month</span></p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• 5 receipts per month</li>
                      <li>• 100MB storage</li>
                      <li>• Basic features</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-background border border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-blue-600" />
                      <h4 className="font-bold text-blue-600">Pro Plan</h4>
                    </div>
                    <p className="text-2xl font-bold mb-2 text-foreground">RM 10<span className="text-sm font-normal">/month</span></p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• 50 receipts per month</li>
                      <li>• 5GB storage</li>
                      <li>• Advanced features</li>
                      <li>• 14-day free trial</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-background border border-red-200 dark:border-red-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="h-5 w-5 text-red-600" />
                      <h4 className="font-bold text-red-600">Max Plan</h4>
                    </div>
                    <p className="text-2xl font-bold mb-2 text-foreground">RM 20<span className="text-sm font-normal">/month</span></p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• 100 receipts per month</li>
                      <li>• 20GB storage</li>
                      <li>• Premium features</li>
                      <li>• API access</li>
                      <li>• 14-day free trial</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-300">Billing Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li><strong>Billing Cycles:</strong> Monthly or annual subscriptions available</li>
                  <li><strong>Annual Discount:</strong> Save 20% with annual billing</li>
                  <li><strong>Payment Processing:</strong> Payments processed securely through Stripe</li>
                  <li><strong>Auto-Renewal:</strong> Subscriptions automatically renew unless cancelled</li>
                  <li><strong>Plan Changes:</strong> You may upgrade, downgrade, or cancel anytime</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-green-800 dark:text-green-300">Free Trial and Refunds</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li><strong>Free Trial:</strong> Pro and Max plans include a 14-day free trial with no credit card required</li>
                  <li><strong>Money-Back Guarantee:</strong> 30-day money-back guarantee for all paid plans</li>
                  <li><strong>Refund Processing:</strong> Refunds processed within 5-10 business days</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Service Features */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Cog className="h-8 w-8 text-blue-600" />
            Service Features and Usage
          </h2>

          <div className="space-y-6">
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-blue-800 dark:text-blue-300">
                  <Brain className="h-6 w-6 text-blue-600" />
                  AI-Powered Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Our Service utilizes advanced AI technology, including Google Gemini models, to:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Extract data from receipts with 99% accuracy guarantee</li>
                  <li>Automatically categorize expenses</li>
                  <li>Process batch uploads efficiently</li>
                  <li>Provide confidence scores for data accuracy</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-green-800 dark:text-green-300">
                  <Upload className="h-6 w-6 text-green-600" />
                  Data Processing and Storage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>Receipt images up to 5MB are supported</li>
                  <li>Data is processed using AI vision technology</li>
                  <li>Processed data is stored securely with bank-level encryption</li>
                  <li>Export capabilities to Excel, QuickBooks, and other accounting software</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-purple-800 dark:text-purple-300">
                  <Users className="h-6 w-6 text-purple-600" />
                  Team Collaboration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">Our platform provides:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Real-time collaboration features</li>
                  <li>Role-based permissions (admin/user)</li>
                  <li>Audit trails for accountability</li>
                  <li>Shared receipt management</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* User Obligations */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-orange-600" />
            User Obligations and Acceptable Use
          </h2>

          <div className="space-y-6">
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-green-800 dark:text-green-300">Permitted Use</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">You may use our Service only for:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Legitimate business expense management</li>
                  <li>Personal receipt organization</li>
                  <li>Tax preparation and financial reporting</li>
                  <li>Authorized team collaboration</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-red-800 dark:text-red-300">Prohibited Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">You agree NOT to:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Upload fraudulent, altered, or illegal receipts</li>
                  <li>Attempt to circumvent usage limits or security measures</li>
                  <li>Share account credentials with unauthorized users</li>
                  <li>Use the Service for money laundering or tax fraud</li>
                  <li>Reverse engineer, modify, or distribute our software</li>
                  <li>Upload malicious content or malware</li>
                  <li>Violate any applicable laws or regulations</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-300">Data Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">While our AI provides 99% accuracy, you are responsible for:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Reviewing and approving extracted data</li>
                  <li>Ensuring receipt authenticity</li>
                  <li>Correcting any inaccuracies before export</li>
                  <li>Compliance with accounting and tax requirements</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Data and Privacy */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <Shield className="h-8 w-8 text-green-600" />
            Data Handling and Privacy
          </h2>

          <div className="space-y-6">
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-green-800 dark:text-green-300">Data Collection</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">We collect and process:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Account information (email, authentication data)</li>
                  <li>Receipt images and extracted financial data</li>
                  <li>Usage analytics and service interactions</li>
                  <li>Payment and billing information (processed by Stripe)</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-300">Security Measures</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">We implement:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>SOC 2 compliance standards</li>
                  <li>End-to-end encryption for data protection</li>
                  <li>Bank-level security protocols</li>
                  <li>Secure AI processing through Google Gemini</li>
                  <li>Regular security audits and updates</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="text-purple-800 dark:text-purple-300">Third-Party Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">Our Service integrates with:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li><strong>Google Services:</strong> Authentication and Gemini AI processing</li>
                  <li><strong>Stripe:</strong> Payment processing and subscription management</li>
                  <li><strong>OpenRouter:</strong> Optional additional AI provider access</li>
                  <li><strong>Accounting Software:</strong> Excel, QuickBooks, and other export integrations</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-400">
              <CardContent className="p-4">
                <p className="text-blue-800 dark:text-blue-300">
                  <strong>Privacy Policy:</strong> For detailed information about data collection, use, and sharing practices, please review our Privacy Policy, which forms an integral part of these Terms.
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Disclaimers */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            Disclaimers and Limitations of Liability
          </h2>

          <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 mb-6">
            <CardContent className="p-4">
              <p className="text-yellow-800 dark:text-yellow-300 font-semibold">IMPORTANT: PLEASE READ THIS SECTION CAREFULLY</p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-red-800 dark:text-red-300">Service Disclaimers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4 font-semibold">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING:
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Accuracy of AI-extracted data (despite 99% accuracy goals)</li>
                  <li>Uninterrupted or error-free service operation</li>
                  <li>Compatibility with all devices or software</li>
                  <li>Results obtained from using the Service</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="text-orange-800 dark:text-orange-300">Limitation of Liability</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4 font-semibold">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR LIABILITY IS LIMITED TO:
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>The amount you paid for the Service in the 12 months preceding the claim</li>
                  <li>Direct damages only (no indirect, consequential, or punitive damages)</li>
                  <li>Issues directly caused by our Service</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-300">User Responsibilities</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">You acknowledge that:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>AI processing may contain errors requiring human review</li>
                  <li>You are responsible for data accuracy verification</li>
                  <li>Financial and tax compliance is your responsibility</li>
                  <li>You should maintain backup copies of important data</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <Separator className="my-8" />

        {/* Contact Information */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mb-12"
        >
          <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-foreground">
                <Mail className="h-6 w-6 text-purple-600" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-xl font-semibold text-foreground mb-4">Get in Touch</h3>
              <p className="text-muted-foreground mb-4">If you have questions about these Terms or need support, please contact us:</p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Customer Support</h4>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    support@mataresit.com
                  </p>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Response within 24 hours
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Legal Inquiries</h4>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    legal@mataresit.com
                  </p>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    https://mataresit.vercel.app
                  </p>
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
            <p className="text-muted-foreground mb-2">
              <strong>Mataresit Terms of Service</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Last Updated: January 2025 | Version 1.0
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              By using Mataresit, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>

            {/* Navigation Links */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4 border-t border-gray-300 dark:border-gray-600">
              <Link to="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <Home className="h-4 w-4" />
                  Home
                </Button>
              </Link>
              <Link to="/privacy-policy">
                <Button variant="ghost" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Privacy Policy
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
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
