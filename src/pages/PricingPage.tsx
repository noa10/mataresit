import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { PRICE_IDS } from "@/config/stripe";
import { toast } from "sonner";
import {
  Check,
  X,
  Zap,
  Crown,
  Star,
  Upload,
  Brain,
  BarChart3,
  Shield,
  Clock,
  Database,
  Sparkles,
  Loader2
} from "lucide-react";

interface PricingTier {
  id: string;
  name: string;
  price: {
    monthly: number;
    annual: number;
  };
  description: string;
  icon: React.ReactNode;
  popular?: boolean;
  features: {
    uploads: string;
    processing: string;
    retention: string;
    storage: string;
    models: string[];
    capabilities: string[];
    analytics: string[];
    support?: string;
  };
  limitations?: string[];
}

const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: { monthly: 0, annual: 0 },
    description: "Perfect for getting started with AI-powered receipt processing",
    icon: <Upload className="h-6 w-6" />,
    features: {
      uploads: "25 receipts per month",
      processing: "Basic OCR with AI enhancement",
      retention: "7-day data retention",
      storage: "100MB storage limit",
      models: ["Free OpenRouter models", "Gemma 3n", "Devstral Small"],
      capabilities: [
        "Basic merchant normalization",
        "Simple currency detection",
        "Basic confidence scoring",
        "Single processing method"
      ],
      analytics: ["Basic receipt summary", "Simple monthly overview"]
    },
    limitations: ["No batch processing", "Limited field validation", "No currency conversion"]
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: 9.99, annual: 99.99 },
    description: "Advanced features for regular users and small businesses",
    icon: <Zap className="h-6 w-6" />,
    popular: true,
    features: {
      uploads: "200 receipts per month",
      processing: "Advanced OCR + AI processing",
      retention: "90-day data retention",
      storage: "2GB storage limit",
      models: [
        "All Free tier models",
        "Gemini 1.5 Flash",
        "Gemini 2.0 Flash Lite",
        "Limited Gemini 1.5 Pro (50/month)"
      ],
      capabilities: [
        "Full merchant normalization",
        "Currency detection with conversion",
        "Advanced confidence scoring",
        "Dual processing methods",
        "Batch processing (up to 5)"
      ],
      analytics: [
        "Detailed spending reports",
        "Merchant analysis",
        "Monthly/quarterly trends",
        "Basic data export (CSV)"
      ],
      support: "Priority support"
    }
  },
  {
    id: "max",
    name: "Max",
    price: { monthly: 19.99, annual: 199.99 },
    description: "Ultimate solution for power users and businesses",
    icon: <Crown className="h-6 w-6" />,
    features: {
      uploads: "Unlimited receipts",
      processing: "Priority processing queue",
      retention: "1-year retention + archiving",
      storage: "10GB storage limit",
      models: [
        "All Pro tier models",
        "Unlimited premium models",
        "Gemini 2.5 Flash Preview",
        "Custom API key support"
      ],
      capabilities: [
        "Advanced merchant learning",
        "Full currency conversion",
        "Premium confidence scoring",
        "Automatic dual processing",
        "Advanced batch processing (up to 20)",
        "Line item extraction"
      ],
      analytics: [
        "Advanced reporting dashboard",
        "Custom category creation",
        "Year-over-year comparisons",
        "Tax deduction identification",
        "Full data export (CSV, JSON, PDF)",
        "API access"
      ],
      support: "Dedicated support"
    }
  }
];

export default function PricingPage() {
  const { user } = useAuth();
  const { createCheckoutSession, isLoading, subscriptionData } = useStripe();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    document.title = "Pricing - ReceiptScan";
  }, []);

  const formatPrice = (price: number) => {
    return price === 0 ? "Free" : `$${price}`;
  };

  const getAnnualSavings = (monthly: number, annual: number) => {
    if (monthly === 0) return 0;
    const monthlyCost = monthly * 12;
    const savings = ((monthlyCost - annual) / monthlyCost) * 100;
    return Math.round(savings);
  };

  const handleSubscribe = async (tierId: string) => {
    if (!user) {
      toast.error("Please sign in to subscribe");
      return;
    }

    if (tierId === 'free') {
      toast.success("You're already on the Free plan!");
      return;
    }

    try {
      // Get the appropriate price ID based on tier and billing interval
      const priceId = PRICE_IDS[tierId as 'pro' | 'max'][billingInterval];
      await createCheckoutSession(priceId, billingInterval);
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error("Failed to process subscription. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <Navbar />

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Unlock the power of AI-driven receipt processing with flexible pricing that scales with your needs
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>14-day free trial</span>
            </div>
          </div>
        </motion.div>

        {/* Billing Interval Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-muted p-1 rounded-lg">
            <ToggleGroup
              type="single"
              value={billingInterval}
              onValueChange={(value) => value && setBillingInterval(value as 'monthly' | 'annual')}
              className="flex items-center"
            >
              <ToggleGroupItem value="monthly" className="px-4">
                Monthly
              </ToggleGroupItem>
              <ToggleGroupItem value="annual" className="px-4">
                Yearly <Badge variant="outline" className="ml-2 text-green-600 border-green-200">Save up to 20%</Badge>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative ${tier.popular ? 'md:scale-105 pt-6' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-1 shadow-lg">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <Card className={`h-full glass-card ${tier.popular ? 'border-primary/50 shadow-lg pt-4' : ''}`}>
                <CardHeader className="text-center pb-8">
                  <div className="flex items-center justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      tier.id === 'free' ? 'bg-green-100 text-green-600' :
                      tier.id === 'pro' ? 'bg-blue-100 text-blue-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {tier.icon}
                    </div>
                  </div>
                  <h2 className="text-2xl font-semibold leading-none tracking-tight font-bold">{tier.name}</h2>
                  <CardDescription className="text-sm">{tier.description}</CardDescription>

                  <div className="mt-6">
                    <div className="text-4xl font-bold">
                      {billingInterval === 'monthly'
                        ? formatPrice(tier.price.monthly)
                        : formatPrice(tier.price.annual)
                      }
                      {(billingInterval === 'monthly' ? tier.price.monthly : tier.price.annual) > 0 && (
                        <span className="text-lg font-normal text-muted-foreground">
                          /{billingInterval === 'monthly' ? 'month' : 'year'}
                        </span>
                      )}
                    </div>
                    {billingInterval === 'annual' && tier.price.annual > 0 && (
                      <div className="text-sm text-muted-foreground mt-2">
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Save {getAnnualSavings(tier.price.monthly, tier.price.annual)}% vs monthly
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Core Features */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Core Features
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{tier.features.uploads}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{tier.features.processing}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{tier.features.retention}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{tier.features.storage}</span>
                      </li>
                    </ul>
                  </div>

                  {/* AI Models */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      AI Models
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {tier.features.models.map((model, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{model}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Processing Capabilities */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Processing
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {tier.features.capabilities.map((capability, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{capability}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Analytics */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {tier.features.analytics.map((analytic, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{analytic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Limitations */}
                  {tier.limitations && (
                    <div>
                      <h3 className="font-semibold mb-3 text-muted-foreground">Limitations</h3>
                      <ul className="space-y-1 text-sm">
                        {tier.limitations.map((limitation, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                            <X className="h-4 w-4 text-red-500 flex-shrink-0" />
                            <span>{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Support */}
                  {tier.features.support && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{tier.features.support}</span>
                      </div>
                    </div>
                  )}

                  {/* CTA Button */}
                  <div className="pt-6">
                    {user ? (
                      <Button
                        onClick={() => handleSubscribe(tier.id)}
                        disabled={isLoading || (subscriptionData?.status === 'active' && tier.id === subscriptionData?.tier)}
                        className={`w-full ${tier.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                        variant={tier.popular ? 'default' : 'outline'}
                      >
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : subscriptionData?.status === 'active' && tier.id === subscriptionData?.tier ? (
                          'Current Plan'
                        ) : tier.id === 'free' ? (
                          'Downgrade to Free'
                        ) : (
                          `Upgrade to ${tier.name}`
                        )}
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className={`w-full ${tier.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                        variant={tier.popular ? 'default' : 'outline'}
                      >
                        <Link to="/auth">
                          {tier.id === 'free' ? 'Get Started Free' : 'Start Free Trial'}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-24 text-center"
        >
          <h2 className="text-3xl font-bold mb-8">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="glass-card text-left">
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately,
                  and we'll prorate any billing differences.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card text-left">
              <CardHeader>
                <CardTitle className="text-lg">What happens to my data if I downgrade?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your data remains safe. However, you may lose access to advanced features and
                  older data beyond your plan's retention period.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card text-left">
              <CardHeader>
                <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We offer a 14-day free trial for all paid plans. If you're not satisfied,
                  contact us within 30 days for a full refund.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card text-left">
              <CardHeader>
                <CardTitle className="text-lg">Is my data secure?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Absolutely. We use enterprise-grade encryption and follow industry best practices
                  to keep your receipt data safe and private.
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Need a custom solution or have questions?
          </p>
          <Button variant="outline" asChild>
            <Link to="/contact">Contact Sales</Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
