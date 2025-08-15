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
import { usePricingTranslation } from "@/contexts/LanguageContext";
import { useMalaysianCulture } from "@/hooks/useMalaysianCulture";
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
  ChevronDown,
  Users
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
    storage: string;
    models: string[];
    capabilities: string[];
    collaboration: string[];
    analytics: string[];
    support?: string;
  };
  limitations?: string[];
}

// Function to generate pricing tiers with translations
const getPricingTiers = (t: (key: string, options?: any) => string): PricingTier[] => [
  {
    id: "free",
    name: t('plans.free.name'),
    price: { monthly: 0, annual: 0 },
    description: t('plans.free.description'),
    icon: <Upload className="h-6 w-6" />,
    features: {
      uploads: t('plans.free.features.receipts'),
      processing: t('plans.free.features.processing'),
      storage: t('plans.free.features.storage'),
      models: [
        "Google Gemini (default AI processing)",
        "Consistent AI processing across all plans"
      ],
      capabilities: [
        t('plans.free.features.exports'),
        t('plans.free.features.categories'),
        "Multi-currency detection",
        "Confidence scoring",
        "Single processing method"
      ],
      collaboration: [
        "Single user access",
        "No team features"
      ],
      analytics: [t('plans.free.features.exports'), "Basic data export (CSV)"]
    }
  },
  {
    id: "pro",
    name: t('plans.pro.name'),
    price: { monthly: 10, annual: 108 },
    description: t('plans.pro.description'),
    icon: <Zap className="h-6 w-6" />,
    popular: true,
    features: {
      uploads: t('plans.pro.features.receipts'),
      processing: t('plans.pro.features.processing'),
      storage: t('plans.pro.features.storage'),
      models: [
        "Google Gemini (default AI processing)",
        "Consistent AI processing across all plans"
      ],
      capabilities: [
        t('plans.pro.features.batch'),
        t('plans.pro.features.search'),
        t('plans.pro.features.categories'),
        t('plans.pro.features.exports'),
        "Custom branding options"
      ],
      collaboration: [
        t('plans.pro.features.team'),
        "Team member invitations",
        "Shared receipt access"
      ],
      analytics: [
        t('plans.pro.features.search'),
        t('plans.pro.features.exports'),
        "Merchant analysis",
        "Monthly/quarterly trends"
      ],
      support: t('plans.pro.features.support')
    }
  },
  {
    id: "max",
    name: t('plans.max.name'),
    price: { monthly: 20, annual: 216 },
    description: t('plans.max.description'),
    icon: <Crown className="h-6 w-6" />,
    features: {
      uploads: t('plans.max.features.receipts'),
      processing: t('plans.max.features.processing'),
      storage: t('plans.max.features.storage'),
      models: [
        "Google Gemini (default AI processing)",
        "Consistent AI processing across all plans"
      ],
      capabilities: [
        t('plans.max.features.batch'),
        t('plans.max.features.search'),
        t('plans.max.features.categories'),
        t('plans.max.features.exports'),
        t('plans.max.features.api'),
        t('plans.max.features.integrations')
      ],
      collaboration: [
        t('plans.max.features.team'),
        "Team member invitations",
        "Shared receipt access",
        "Claims management",
        "Role-based permissions"
      ],
      analytics: [
        t('plans.max.features.search'),
        t('plans.max.features.exports'),
        t('plans.max.features.api'),
        "Year-over-year comparisons",
        "Tax deduction identification"
      ],
      support: t('plans.max.features.support')
    }
  }
];

// Feature Comparison Table Component
const FeatureComparisonTable = ({ tiers, t }: { tiers: PricingTier[], t: (key: string, options?: any) => string }) => {
  const allFeatures = [
    { key: "uploads", label: t('features.list.aiProcessing.title') },
    { key: "processing", label: t('features.list.smartSearch.title') },
    { key: "storage", label: t('features.list.storage.title') },
    { key: "models", label: t('features.list.aiProcessing.title') },
    { key: "capabilities", label: t('features.list.categories.title') },
    { key: "collaboration", label: t('features.list.collaboration.title') },
    { key: "analytics", label: t('features.list.exports.title') },
    { key: "support", label: t('features.list.support.title') }
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
                      {t('plans.pro.popular')}
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
  const { t, language } = usePricingTranslation();
  const { formatCurrency } = useMalaysianCulture();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  // Generate pricing tiers with translations
  const pricingTiers = getPricingTiers(t);
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
    document.title = t('meta.title');
  }, [t]);

  const formatPrice = (price: number) => {
    return price === 0 ? t('plans.free.price') : formatCurrency(price);
  };

  const getAnnualSavings = (monthly: number, annual: number) => {
    if (monthly === 0) return 0;
    const monthlyCost = monthly * 12;
    const savings = ((monthlyCost - annual) / monthlyCost) * 100;
    return Math.round(savings);
  };

  const handleSubscribe = async (tierId: string) => {
    if (!user) {
      toast.error(t('cta.contact'));
      return;
    }

    const currentTier = subscriptionData?.tier || 'free';
    const tierHierarchy = { 'free': 0, 'pro': 1, 'max': 2 };

    // Check if this is a downgrade
    if (tierHierarchy[tierId as keyof typeof tierHierarchy] < tierHierarchy[currentTier]) {
      // This is a downgrade - show confirmation dialog
      const tierNames = {
        'free': t('plans.free.name'),
        'pro': t('plans.pro.name'),
        'max': t('plans.max.name')
      };
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
      const tierName = tierNames[tierId as keyof typeof tierNames];
      toast.success(t('cta.button', { plan: tierName }));
      return;
    }

    // Handle free tier for new users
    if (tierId === 'free' && currentTier === 'free') {
      toast.success(t('cta.button', { plan: t('plans.free.name') }));
      return;
    }

    // Handle upgrades
    try {
      // Get the appropriate price ID based on tier and billing interval
      const priceId = PRICE_IDS[tierId as 'pro' | 'max'][billingInterval];
      await createCheckoutSession(priceId, billingInterval);
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error(t('faq.items.refund.answer'));
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
            {t('hero.title')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            {t('hero.subtitle')}
          </p>
          {/* Enhanced Trust Signals */}
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{t('faq.items.trial.answer')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{t('faq.items.billing.answer')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{t('hero.subtitle')}</span>
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
          <div className="relative bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-2 md:p-2.5 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
            {/* Sliding Background Indicator */}
            <motion.div
              className="absolute top-2 md:top-2.5 h-[calc(100%-16px)] md:h-[calc(100%-20px)] bg-gradient-to-r from-white to-slate-50 dark:from-slate-700 dark:to-slate-600 rounded-xl shadow-lg border border-slate-200 dark:border-slate-500"
              style={{
                boxShadow: billingInterval === 'annual'
                  ? '0 4px 24px rgba(34, 197, 94, 0.18), 0 1px 3px rgba(0, 0, 0, 0.12)'
                  : '0 4px 18px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06)'
              }}
              initial={false}
              animate={{
                left: billingInterval === 'monthly' ? '8px' : '50%',
                width: billingInterval === 'monthly' ? 'calc(50% - 8px)' : 'calc(50% - 8px)',
              }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 28,
              }}
            />

            {/* Toggle Buttons */}
            <div className="relative flex">
              {/* Monthly Button */}
              <motion.button
                onClick={() => setBillingInterval('monthly')}
                className={`relative z-10 flex items-center justify-center px-6 md:px-8 py-3.5 text-sm font-semibold rounded-xl transition-all duration-300 min-w-[150px] md:min-w-[170px] h-[60px] ${
                  billingInterval === 'monthly'
                    ? 'text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-slate-300/30'
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
                  {t('hero.monthlyBilling')}
                </motion.span>
              </motion.button>

              {/* Yearly Button */}
              <motion.button
                onClick={() => setBillingInterval('annual')}
                className={`relative z-10 flex items-center justify-center px-6 md:px-8 py-2.5 md:py-3.5 pb-7 md:pb-6 text-sm font-semibold rounded-xl transition-all duration-300 min-w-[150px] md:min-w-[170px] h-[60px] ${
                  billingInterval === 'annual'
                    ? 'text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-emerald-300/30'
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
                {/* Label centered; badge absolutely anchored to bottom to avoid layout shifts */}
                <motion.span
                  initial={false}
                  animate={{
                    textShadow: billingInterval === 'annual'
                      ? '0 1px 2px rgba(0, 0, 0, 0.1)'
                      : '0 0 0px rgba(0, 0, 0, 0)'
                  }}
                  className="text-center leading-none"
                >
                  {t('hero.annualBilling')}
                </motion.span>

                {/* Discount badge: absolute, centered, non-wrapping for consistent alignment */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 20 }}
                  whileHover={{ scale: 1.05 }}
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-2"
                >
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                  >
                    <Badge
                      variant="outline"
                      className="whitespace-nowrap text-[9px] xs:text-[10px] bg-gradient-to-r from-emerald-500 to-green-500 text-white border-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.25)] font-semibold px-2 py-0.5 xs:px-2.5 leading-none rounded-full"
                    >
                      {language === 'ms' ? 'Jimat 20%' : 'Save 20%'}
                    </Badge>
                  </motion.div>
                </motion.div>
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
                    {t('plans.pro.popular')}
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
                          /{billingInterval === 'monthly' ? t('plans.free.period') : t('plans.pro.period')}
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
                      {t('features.title')}
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
                        <span>{tier.features.storage}</span>
                      </li>
                    </ul>
                  </div>

                  {/* AI Models */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      {t('features.list.aiProcessing.title')}
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
                      {t('features.list.smartSearch.title')}
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

                  {/* Collaboration */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('features.list.collaboration.title')}
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {tier.features.collaboration.map((collab, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{collab}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Analytics */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      {t('features.list.exports.title')}
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
                            return t('cta.button');
                          } else if (isDowngrade) {
                            return t('cta.contact', { plan: tier.name });
                          } else if (isUpgrade) {
                            return t('cta.button', { plan: tier.name });
                          } else {
                            return tier.id === 'free' ? t('plans.free.cta') : t('cta.button');
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
                          {tier.id === 'free' ? t('plans.free.cta') : t('cta.button')}
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
                {t('features.subtitle')}
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isComparisonOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-8">
              <Card className="p-6">
                <FeatureComparisonTable tiers={pricingTiers} t={t} />
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
          <h2 className="text-3xl font-bold mb-8">{t('faq.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="glass-card text-left">
              <CardHeader>
                <CardTitle className="text-lg">{t('faq.items.billing.question')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('faq.items.billing.answer')}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card text-left">
              <CardHeader>
                <CardTitle className="text-lg">{t('faq.items.limits.question')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('faq.items.limits.answer')}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card text-left">
              <CardHeader>
                <CardTitle className="text-lg">{t('faq.items.refund.question')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('faq.items.refund.answer')}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card text-left">
              <CardHeader>
                <CardTitle className="text-lg">{t('faq.items.support.question')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('faq.items.support.answer')}
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
            {t('cta.subtitle')}
          </p>
          <Button variant="outline" asChild>
            <Link to="/contact">{t('cta.contact')}</Link>
          </Button>
        </motion.div>
      </div>

      {/* Downgrade Confirmation Dialog */}
      <Dialog open={downgradeDialog.isOpen} onOpenChange={(open) => !open && !downgradeDialog.isProcessing && handleDowngradeCancel()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('cta.title')}</DialogTitle>
            <DialogDescription>
              {t('cta.subtitle', { plan: downgradeDialog.tierName })}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">{t('faq.items.limits.question')}</h4>
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
                  {t('faq.items.billing.answer')}
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
              {t('faq.items.billing.answer')}
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
                  {t('cta.button')}
                </>
              ) : (
                t('cta.contact')
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
                  {t('cta.button')}
                </>
              ) : (
                t('cta.button')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
