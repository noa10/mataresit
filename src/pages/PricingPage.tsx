import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Sparkles,
  Loader2,
  CheckCircle,
  ChevronDown
} from "lucide-react";
import { SubscriptionStatusRefresh } from "@/components/SubscriptionStatusRefresh";

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
    description: "Perfect for individuals and freelancers getting started with automated expense tracking.",
    icon: <Upload className="h-6 w-6" />,
    features: {
      uploads: "Up to 50 receipts per month",
      processing: "AI-powered data extraction",
      retention: "Unlimited retention",
      storage: "1GB secure storage",
      models: [
        "Default AI Models",
        "Bring Your Own API Key (BYOK) support",
        "• Google Gemini",
        "• OpenAI",
        "• Claude",
        "• Open Router",
        "• Grok"
      ],
      capabilities: [
        "Smart merchant normalization",
        "Automatic line item extraction",
        "Multi-currency detection",
        "Confidence scoring",
        "Single processing method",
        "Single user access"
      ],
      analytics: ["Basic receipt summary", "Simple monthly overview", "Basic data export (CSV)"]
    },
    limitations: ["Batch upload limit: 5 files", "No version control", "No integrations", "Basic support only"]
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: 10, annual: 108 },
    description: "For growing businesses and teams who need more power and collaboration.",
    icon: <Zap className="h-6 w-6" />,
    popular: true,
    features: {
      uploads: "Everything in Free, plus:",
      processing: "500 receipts per month",
      retention: "Unlimited retention",
      storage: "10GB secure storage",
      models: [
        "Access to premium AI models",
        "Google Gemini 2.5 Flash (default)",
        "BYOK (bring your own key) for:",
        "• Google Gemini",
        "• OpenAI",
        "• Claude",
        "• Open Router",
        "• Grok"
      ],
      capabilities: [
        "All Free tier processing",
        "Batch processing (up to 50 files)",
        "Team access for up to 5 users",
        "Version control",
        "Basic integrations",
        "Custom branding options"
      ],
      analytics: [
        "Advanced search with filters and tags",
        "Detailed spending reports",
        "Merchant analysis",
        "Monthly/quarterly trends",
        "Basic data export (CSV, XLSX)"
      ],
      support: "Standard support"
    }
  },
  {
    id: "max",
    name: "Max",
    price: { monthly: 20, annual: 216 },
    description: "Enterprise-grade solution for scaling businesses with unlimited potential.",
    icon: <Crown className="h-6 w-6" />,
    features: {
      uploads: "Everything in Pro, plus:",
      processing: "Unlimited receipts with priority processing",
      retention: "Unlimited retention + archiving",
      storage: "Unlimited secure storage",
      models: [
        "Premium AI models with priority access",
        "Google Gemini 2.5 Flash (default)",
        "BYOK (bring your own key) for:",
        "• Google Gemini",
        "• OpenAI",
        "• Claude",
        "• Open Router",
        "• Grok"
      ],
      capabilities: [
        "All Pro Processing",
        "Advanced batch processing (up to 100 files)",
        "Unlimited team members",
        "Advanced version control",
        "Enterprise integrations",
        "Full custom branding"
      ],
      analytics: [
        "Advanced search with all features",
        "Advanced reporting dashboard",
        "Custom category creation",
        "Year-over-year comparisons",
        "Tax deduction identification",
        "Full data export (CSV, JSON, PDF)",
        "API access"
      ],
      support: "Priority support"
    }
  }
];

// Feature Comparison Table Component
const FeatureComparisonTable = ({ tiers }: { tiers: PricingTier[] }) => {
  const allFeatures = [
    { key: "uploads", label: "Monthly Receipts" },
    { key: "processing", label: "Processing Type" },
    { key: "retention", label: "Data Retention" },
    { key: "storage", label: "Storage" },
    { key: "models", label: "AI Models" },
    { key: "capabilities", label: "Processing Capabilities" },
    { key: "analytics", label: "Analytics & Reporting" },
    { key: "support", label: "Support Level" }
  ];

  const getFeatureValue = (tier: PricingTier, featureKey: string) => {
    const feature = tier.features[featureKey as keyof typeof tier.features];
    if (Array.isArray(feature)) {
      return feature.slice(0, 3).join(", ") + (feature.length > 3 ? "..." : "");
    }
    return feature || "Not included";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Feature</TableHead>
            {tiers.map(tier => (
              <TableHead key={tier.id} className="text-center min-w-[200px]">
                <div className="flex flex-col items-center gap-2">
                  <div className={`p-2 rounded-full ${
                    tier.id === 'free' ? 'bg-green-100 text-green-600' :
                    tier.id === 'pro' ? 'bg-blue-100 text-blue-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {tier.icon}
                  </div>
                  <span className="font-semibold">{tier.name}</span>
                  {tier.popular && (
                    <Badge className="bg-primary text-primary-foreground">
                      <Star className="h-3 w-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allFeatures.map(feature => (
            <TableRow key={feature.key}>
              <TableCell className="font-medium">{feature.label}</TableCell>
              {tiers.map(tier => (
                <TableCell key={tier.id} className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{getFeatureValue(tier, feature.key)}</span>
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default function PricingPage() {
  const { user } = useAuth();
  const { createCheckoutSession, downgradeSubscription, isLoading, subscriptionData } = useStripe();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [downgradeDialog, setDowngradeDialog] = useState<{
    isOpen: boolean;
    targetTier: 'free' | 'pro' | 'max' | null;
    tierName: string;
    isProcessing: boolean;
  }>({
    isOpen: false,
    targetTier: null,
    tierName: '',
    isProcessing: false
  });

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

    const currentTier = subscriptionData?.tier || 'free';
    const tierHierarchy = { 'free': 0, 'pro': 1, 'max': 2 };

    // Check if this is a downgrade
    if (tierHierarchy[tierId as keyof typeof tierHierarchy] < tierHierarchy[currentTier]) {
      // This is a downgrade - show confirmation dialog
      const tierNames = { 'free': 'Free', 'pro': 'Pro', 'max': 'Max' };
      setDowngradeDialog({
        isOpen: true,
        targetTier: tierId as 'free' | 'pro' | 'max',
        tierName: tierNames[tierId as keyof typeof tierNames],
        isProcessing: false
      });
      return;
    }

    // Handle same tier
    if (tierId === currentTier) {
      toast.success(`You're already on the ${tierId.charAt(0).toUpperCase() + tierId.slice(1)} plan!`);
      return;
    }

    // Handle free tier for new users
    if (tierId === 'free' && currentTier === 'free') {
      toast.success("You're already on the Free plan!");
      return;
    }

    // Handle upgrades
    try {
      // Get the appropriate price ID based on tier and billing interval
      const priceId = PRICE_IDS[tierId as 'pro' | 'max'][billingInterval];
      await createCheckoutSession(priceId, billingInterval);
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error("Failed to process subscription. Please try again.");
    }
  };

  const handleDowngradeConfirm = async (immediate: boolean = true) => {
    if (!downgradeDialog.targetTier) return;

    setDowngradeDialog(prev => ({ ...prev, isProcessing: true }));

    try {
      await downgradeSubscription(downgradeDialog.targetTier, immediate);
      setDowngradeDialog({ isOpen: false, targetTier: null, tierName: '', isProcessing: false });
    } catch (error) {
      console.error('Error downgrading:', error);
      setDowngradeDialog(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleDowngradeCancel = () => {
    if (downgradeDialog.isProcessing) return; // Prevent closing during processing
    setDowngradeDialog({ isOpen: false, targetTier: null, tierName: '', isProcessing: false });
  };

  return (
    <>
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
          {/* Enhanced Trust Signals */}
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>No setup fees</span>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Billing Interval Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.6,
            delay: 0.2,
            type: "spring",
            stiffness: 200,
            damping: 20
          }}
          className="flex justify-center mb-12"
        >
          <div className="relative bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-1.5 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
            {/* Sliding Background Indicator */}
            <motion.div
              className="absolute top-1.5 h-[calc(100%-12px)] bg-gradient-to-r from-white to-slate-50 dark:from-slate-700 dark:to-slate-600 rounded-xl shadow-lg border border-slate-200 dark:border-slate-500"
              style={{
                boxShadow: billingInterval === 'annual'
                  ? '0 4px 20px rgba(34, 197, 94, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)'
                  : '0 4px 15px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05)'
              }}
              initial={false}
              animate={{
                left: billingInterval === 'monthly' ? '6px' : '50%',
                width: billingInterval === 'monthly' ? 'calc(50% - 6px)' : 'calc(50% - 6px)',
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
            />

            {/* Toggle Buttons */}
            <div className="relative flex">
              {/* Monthly Button */}
              <motion.button
                onClick={() => setBillingInterval('monthly')}
                className={`relative z-10 flex items-center justify-center px-8 py-3.5 text-sm font-semibold rounded-xl transition-all duration-300 min-w-[140px] h-[52px] ${
                  billingInterval === 'monthly'
                    ? 'text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                initial={false}
                animate={{
                  fontWeight: billingInterval === 'monthly' ? 600 : 500,
                }}
              >
                <motion.span
                  initial={false}
                  animate={{
                    textShadow: billingInterval === 'monthly'
                      ? '0 1px 2px rgba(0, 0, 0, 0.1)'
                      : '0 0 0px rgba(0, 0, 0, 0)'
                  }}
                  className="text-center"
                >
                  Monthly
                </motion.span>
              </motion.button>

              {/* Yearly Button */}
              <motion.button
                onClick={() => setBillingInterval('annual')}
                className={`relative z-10 flex items-center justify-center px-8 py-3.5 text-sm font-semibold rounded-xl transition-all duration-300 min-w-[140px] h-[52px] ${
                  billingInterval === 'annual'
                    ? 'text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                initial={false}
                animate={{
                  fontWeight: billingInterval === 'annual' ? 600 : 500,
                }}
              >
                {/* Main text container - centered */}
                <div className="flex flex-col items-center justify-center">
                  <motion.span
                    initial={false}
                    animate={{
                      textShadow: billingInterval === 'annual'
                        ? '0 1px 2px rgba(0, 0, 0, 0.1)'
                        : '0 0 0px rgba(0, 0, 0, 0)'
                    }}
                    className="text-center leading-none"
                  >
                    Yearly
                  </motion.span>

                  {/* Badge positioned below text */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                    }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    whileHover={{ scale: 1.05 }}
                    className="mt-1"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut",
                      }}
                    >
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-400 shadow-sm font-medium px-1.5 py-0.5 leading-none"
                      >
                        Save 20%
                      </Badge>
                    </motion.div>
                  </motion.div>
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10, transition: { duration: 0.2 } }}
              className={`relative ${tier.popular ? 'md:scale-105' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground shadow-lg">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <Card className={`h-full ${tier.popular ? 'border-primary shadow-lg pt-4' : ''}`}>
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
                        ) : (() => {
                          const currentTier = subscriptionData?.tier || 'free';
                          const tierHierarchy = { 'free': 0, 'pro': 1, 'max': 2 };
                          const isCurrentPlan = subscriptionData?.status === 'active' && tier.id === currentTier;
                          const isDowngrade = tierHierarchy[tier.id as keyof typeof tierHierarchy] < tierHierarchy[currentTier];
                          const isUpgrade = tierHierarchy[tier.id as keyof typeof tierHierarchy] > tierHierarchy[currentTier];

                          if (isCurrentPlan) {
                            return 'Current Plan';
                          } else if (isDowngrade) {
                            return `Downgrade to ${tier.name}`;
                          } else if (isUpgrade) {
                            return `Upgrade to ${tier.name}`;
                          } else {
                            return tier.id === 'free' ? 'Get Started Free' : `Get ${tier.name}`;
                          }
                        })()}
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

        {/* Feature Comparison Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <Collapsible open={isComparisonOpen} onOpenChange={setIsComparisonOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="text-lg">
                Compare all features
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isComparisonOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-8">
              <Card className="p-6">
                <FeatureComparisonTable tiers={pricingTiers} />
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>

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

      {/* Downgrade Confirmation Dialog */}
      <Dialog open={downgradeDialog.isOpen} onOpenChange={(open) => !open && !downgradeDialog.isProcessing && handleDowngradeCancel()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Downgrade</DialogTitle>
            <DialogDescription>
              Are you sure you want to downgrade to the {downgradeDialog.tierName} plan?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">What happens when you downgrade:</h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {downgradeDialog.targetTier === 'free' ? (
                    <>
                      <li>• Your subscription will be canceled</li>
                      <li>• You'll lose access to premium features</li>
                      <li>• Data retention will be limited to 7 days</li>
                      <li>• Monthly receipt limit will be reduced to 50</li>
                    </>
                  ) : (
                    <>
                      <li>• You'll lose access to higher-tier features</li>
                      <li>• Your monthly limits will be reduced</li>
                      <li>• You'll receive a prorated credit for unused time</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Choose when you'd like the downgrade to take effect:
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleDowngradeCancel}
              disabled={downgradeDialog.isProcessing}
              className="w-full sm:w-auto order-3 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDowngradeConfirm(false)}
              disabled={downgradeDialog.isProcessing}
              className="w-full sm:w-auto order-2 sm:order-2"
            >
              {downgradeDialog.isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Downgrade at Period End'
              )}
            </Button>
            <Button
              onClick={() => handleDowngradeConfirm(true)}
              disabled={downgradeDialog.isProcessing}
              className="w-full sm:w-auto order-1 sm:order-3"
            >
              {downgradeDialog.isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Downgrade Now'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
