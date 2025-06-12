import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Rocket,
  Wrench,
  Cpu,
  BarChart,
  HelpCircle,
  Book,
  Upload,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const sections = [
  { id: '1-overview', title: 'Overview', icon: BookOpen },
  { id: '2-getting-started', title: 'Getting Started', icon: Rocket },
  { id: '3-core-features', title: 'Core Features', icon: Wrench },
  { id: '4-troubleshooting', title: 'Troubleshooting & FAQ', icon: HelpCircle },
  { id: '5-glossary', title: 'Glossary', icon: Book },
];

export default function DocumentationPage() {
  useEffect(() => {
    document.title = "Documentation - Mataresit";
  }, []);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Application Documentation</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Your complete guide to using Mataresit.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Sticky Sidebar Navigation */}
        <aside className="lg:col-span-1 lg:sticky lg:top-24 h-max">
          <h3 className="text-lg font-semibold mb-4">On this page</h3>
          <ul className="space-y-2">
            {sections.map(section => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-3 space-y-16">
          {/* Section 1: Overview */}
          <section id="1-overview" className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">1. Overview</h2>
            <div className="space-y-4 text-muted-foreground">
              <h3 className="text-2xl font-semibold text-foreground">What is Mataresit?</h3>
              <p>
                Mataresit is an intelligent application designed to eliminate the manual data entry associated with receipt and expense management. By leveraging Optical Character Recognition (OCR) and advanced AI models like Google's Gemini, it automatically extracts, categorizes, and normalizes your receipt data, saving you hours of work and ensuring your financial records are accurate and organized.
              </p>
              <h3 className="text-2xl font-semibold text-foreground mt-6">Key Features</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Automated Data Extraction</strong>: Upload a receipt image (JPEG, PNG, PDF), and our system automatically pulls key information like merchant, date, total, and line items.</li>
                <li><strong>AI-Powered Enhancement</strong>: Goes beyond simple OCR. Our AI normalizes merchant names, standardizes payment methods, predicts expense categories, and even suggests corrections for potential OCR errors.</li>
                <li><strong>Confidence Scoring</strong>: Every extracted field is given a confidence score, so you can see at a glance which data points are highly accurate and which may need a quick review.</li>
                <li><strong>Real-time Processing Feedback</strong>: Watch your receipts get processed in real-time with a detailed status timeline, from upload to completion.</li>
                <li><strong>Intelligent Semantic Search</strong>: Find any receipt or line item by asking questions in natural language, like "coffee expenses from last month" or "what did I buy at Walmart?".</li>
                <li><strong>Batch Processing</strong>: Upload multiple receipts at once and let the system process them in parallel, with full control over the queue.</li>
                <li><strong>Analysis & Reporting</strong>: Visualize your spending habits with our analysis dashboard and generate detailed PDF reports summarized by category or payer.</li>
                <li><strong>Flexible AI Model Selection</strong>: Choose between different AI processing methods (AI Vision vs. OCR + AI) and models to balance speed, cost, and accuracy.</li>
              </ul>
            </div>
          </section>

          {/* Section 2: Getting Started */}
          <section id="2-getting-started" className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">2. Getting Started</h2>
            <div className="space-y-4 text-muted-foreground">
              <h3 className="text-2xl font-semibold text-foreground">Your First Upload</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li><strong>Navigate to the Dashboard</strong>: After signing in, you'll land on your main dashboard.</li>
                <li><strong>Open the Upload Modal</strong>: Click the "Upload" button. This will open a modal with two tabs: "Single Upload" and "Batch Upload".</li>
                <li><strong>Select a File</strong>: In the "Single Upload" tab, you can either drag and drop a receipt file (JPG, PNG, or PDF) into the designated area or click to browse your computer.</li>
                <li><strong>Processing Begins</strong>: Once a file is selected, the upload and processing begin automatically. You can monitor the progress in real-time via the Processing Timeline.</li>
                <li><strong>Review and Save</strong>: After processing is complete, you will be automatically redirected to the Receipt Viewer page to review, edit, and save your receipt.</li>
              </ol>
              <h3 className="text-2xl font-semibold text-foreground mt-6">Understanding the Dashboard</h3>
              <p>Your dashboard is your central hub for managing receipts.</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Receipt Cards</strong>: Each card represents a receipt, showing the merchant, date, total, and a thumbnail of the image.</li>
                <li><strong>Status Indicators</strong>: "Unreviewed" (Yellow) means the receipt needs your approval; "Reviewed" (Blue) means it's confirmed.</li>
                <li><strong>Filtering & Sorting</strong>: Use the controls at the top to search, filter, and sort your receipts.</li>
                <li><strong>View Mode</strong>: Switch between Grid, List, and Table views.</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Core Features */}
          <section id="3-core-features" className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">3. Core Features in Detail</h2>
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Uploading Receipts (Single & Batch)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Mataresit supports both single and multiple file uploads. The **Batch Upload** feature allows you to process multiple receipts in parallel, with controls to start, pause, and retry failed uploads, making it ideal for handling large volumes of receipts efficiently.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Suggestions & Confidence Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Our AI provides insights to ensure accuracy. If it detects a potential OCR error, it will offer a suggestion you can accept with one click. Every key field also has a confidence score, visually represented by a colored bar:</p>
                  <ul className="list-none space-y-2">
                    <li><span className="text-green-500 font-semibold">■ Green (80-100%):</span> High confidence.</li>
                    <li><span className="text-yellow-500 font-semibold">■ Yellow (60-79%):</span> Medium confidence, may need a quick look.</li>
                    <li><span className="text-red-500 font-semibold">■ Red (&lt;60%):</span> Low confidence, should be reviewed.</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">Editing a field manually sets its confidence to 100%.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Processing: Vision vs. OCR</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">In **Settings → Processing**, you can choose your preferred method:</p>
                  <ul className="list-disc list-inside space-y-2 mt-2">
                    <li><strong>AI Vision (Default)</strong>: The AI model directly analyzes the receipt image, offering superior accuracy for complex or handwritten receipts.</li>
                    <li><strong>Compare with Alternative</strong>: For maximum accuracy, the system runs both AI Vision and a traditional OCR + AI method, highlighting any differences for your review.</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Search</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Navigate to the **AI Search** page to find any receipt or line item using natural language. For example, you can ask: "coffee expenses from last month" or "grocery items over $20".</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 4: Troubleshooting */}
          <section id="4-troubleshooting" className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">4. Troubleshooting & FAQ</h2>
            <div className="space-y-4 text-muted-foreground">
              <h3 className="text-xl font-semibold text-foreground">Why is my receipt processing stuck or has failed?</h3>
              <p>The `processing_status` on the receipt card or in the viewer will show the current stage. If it's `failed_ocr` or `failed_ai`, an error occurred. This can happen with low-quality images. You can either try reprocessing the receipt or manually enter the data.</p>

              <h3 className="text-xl font-semibold text-foreground mt-4">Why are my search results not what I expected?</h3>
              <p>Our semantic search relies on "embeddings". If you've uploaded receipts before this feature was enabled, you may need to generate embeddings for them. Admins can do this from the **Admin → Settings** page.</p>

              <h3 className="text-xl font-semibold text-foreground mt-4">How do I change my subscription?</h3>
              <p>You can manage your subscription, view invoices, and update payment methods from the **Stripe Billing Portal**. Access it from the **Features** page or the **Payment Success** page after a transaction.</p>
            </div>
          </section>

          {/* Section 5: Glossary */}
          <section id="5-glossary" className="scroll-mt-24">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">5. Glossary</h2>
            <div className="space-y-4 text-muted-foreground">
              <p><strong>OCR (Optical Character Recognition):</strong> Technology to convert images of text into machine-readable text.</p>
              <p><strong>AI Vision:</strong> A processing method where an AI model directly analyzes an image to understand its content.</p>
              <p><strong>Embedding:</strong> A numerical representation of text that captures its semantic meaning, powering our AI Search.</p>
              <p><strong>Semantic Search:</strong> A search technique that understands the user's intent and the contextual meaning of words.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
