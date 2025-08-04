import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useFeaturesTranslation } from '@/contexts/LanguageContext';
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
  Globe,
  Bell,
  MapPin,
  Smartphone,
  Monitor,
  CreditCard,
  HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FeaturesPage() {
  const { getCurrentTier, isFeatureAvailable } = useSubscription();
  const { t } = useFeaturesTranslation();
  const tier = getCurrentTier();

  // Generate core features with translations
  const coreFeatures = [
    {
      icon: <Upload className="h-8 w-8 text-green-500" />,
      title: t('features.batchProcessing.title'),
      description: t('features.batchProcessing.description'),
      benefitsList: [
        t('features.batchProcessing.benefits.0'),
        t('features.batchProcessing.benefits.1'),
        t('features.batchProcessing.benefits.2'),
        t('features.batchProcessing.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <Bell className="h-8 w-8 text-blue-500" />,
      title: t('features.realTimeNotifications.title'),
      description: t('features.realTimeNotifications.description'),
      benefitsList: [
        t('features.realTimeNotifications.benefits.0'),
        t('features.realTimeNotifications.benefits.1'),
        t('features.realTimeNotifications.benefits.2'),
        t('features.realTimeNotifications.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <PieChart className="h-8 w-8 text-teal-500" />,
      title: t('features.customCategories.title'),
      description: t('features.customCategories.description'),
      benefitsList: [
        t('features.customCategories.benefits.0'),
        t('features.customCategories.benefits.1'),
        t('features.customCategories.benefits.2'),
        t('features.customCategories.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <Shield className="h-8 w-8 text-green-600" />,
      title: t('features.secureStorage.title'),
      description: t('features.secureStorage.description'),
      benefitsList: [
        t('features.secureStorage.benefits.0'),
        t('features.secureStorage.benefits.1'),
        t('features.secureStorage.benefits.2'),
        t('features.secureStorage.benefits.3')
      ],
      available: true,
      status: t('status.available')
    }
  ];

  // Generate AI features with translations
  const aiFeatures = [
    {
      icon: <Brain className="h-8 w-8 text-blue-500" />,
      title: t('features.aiProcessing.title'),
      description: t('features.aiProcessing.description'),
      benefitsList: [
        t('features.aiProcessing.benefits.0'),
        t('features.aiProcessing.benefits.1'),
        t('features.aiProcessing.benefits.2'),
        t('features.aiProcessing.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <Search className="h-8 w-8 text-purple-500" />,
      title: t('features.smartSearch.title'),
      description: t('features.smartSearch.description'),
      benefitsList: [
        t('features.smartSearch.benefits.0'),
        t('features.smartSearch.benefits.1'),
        t('features.smartSearch.benefits.2'),
        t('features.smartSearch.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <MapPin className="h-8 w-8 text-red-500" />,
      title: t('features.malaysianIntelligence.title'),
      description: t('features.malaysianIntelligence.description'),
      benefitsList: [
        t('features.malaysianIntelligence.benefits.0'),
        t('features.malaysianIntelligence.benefits.1'),
        t('features.malaysianIntelligence.benefits.2'),
        t('features.malaysianIntelligence.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-indigo-500" />,
      title: t('features.advancedAnalytics.title'),
      description: t('features.advancedAnalytics.description'),
      benefitsList: [
        t('features.advancedAnalytics.benefits.0'),
        t('features.advancedAnalytics.benefits.1'),
        t('features.advancedAnalytics.benefits.2'),
        t('features.advancedAnalytics.benefits.3')
      ],
      available: true,
      status: t('status.available')
    }
  ];

  // Generate collaboration features with translations
  const collaborationFeatures = [
    {
      icon: <Users className="h-8 w-8 text-blue-600" />,
      title: t('features.teamCollaboration.title'),
      description: t('features.teamCollaboration.description'),
      benefitsList: [
        t('features.teamCollaboration.benefits.0'),
        t('features.teamCollaboration.benefits.1'),
        t('features.teamCollaboration.benefits.2'),
        t('features.teamCollaboration.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-green-600" />,
      title: t('features.claimsManagement.title'),
      description: t('features.claimsManagement.description'),
      benefitsList: [
        t('features.claimsManagement.benefits.0'),
        t('features.claimsManagement.benefits.1'),
        t('features.claimsManagement.benefits.2'),
        t('features.claimsManagement.benefits.3')
      ],
      available: true,
      status: t('status.available')
    }
  ];

  // Generate reporting features with translations
  const reportingFeatures = [
    {
      icon: <FileText className="h-8 w-8 text-orange-500" />,
      title: t('features.exportOptions.title'),
      description: t('features.exportOptions.description'),
      benefitsList: [
        t('features.exportOptions.benefits.0'),
        t('features.exportOptions.benefits.1'),
        t('features.exportOptions.benefits.2'),
        t('features.exportOptions.benefits.3')
      ],
      available: true,
      status: t('status.available')
    }
  ];

  // Generate platform features with translations
  const platformFeatures = [
    {
      icon: <Smartphone className="h-8 w-8 text-purple-600" />,
      title: t('features.progressiveWebApp.title'),
      description: t('features.progressiveWebApp.description'),
      benefitsList: [
        t('features.progressiveWebApp.benefits.0'),
        t('features.progressiveWebApp.benefits.1'),
        t('features.progressiveWebApp.benefits.2'),
        t('features.progressiveWebApp.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <Monitor className="h-8 w-8 text-teal-600" />,
      title: t('features.mobileResponsive.title'),
      description: t('features.mobileResponsive.description'),
      benefitsList: [
        t('features.mobileResponsive.benefits.0'),
        t('features.mobileResponsive.benefits.1'),
        t('features.mobileResponsive.benefits.2'),
        t('features.mobileResponsive.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <CreditCard className="h-8 w-8 text-indigo-600" />,
      title: t('features.subscriptionManagement.title'),
      description: t('features.subscriptionManagement.description'),
      benefitsList: [
        t('features.subscriptionManagement.benefits.0'),
        t('features.subscriptionManagement.benefits.1'),
        t('features.subscriptionManagement.benefits.2'),
        t('features.subscriptionManagement.benefits.3')
      ],
      available: true,
      status: t('status.available')
    },
    {
      icon: <HelpCircle className="h-8 w-8 text-yellow-600" />,
      title: t('features.helpCenter.title'),
      description: t('features.helpCenter.description'),
      benefitsList: [
        t('features.helpCenter.benefits.0'),
        t('features.helpCenter.benefits.1'),
        t('features.helpCenter.benefits.2'),
        t('features.helpCenter.benefits.3')
      ],
      available: true,
      status: t('status.available')
    }
  ];

  // Generate integration features with translations
  const integrationFeatures = [
    {
      icon: <Globe className="h-8 w-8 text-gray-600" />,
      title: t('features.apiAccess.title'),
      description: t('features.apiAccess.description'),
      benefitsList: [
        t('features.apiAccess.benefits.0'),
        t('features.apiAccess.benefits.1'),
        t('features.apiAccess.benefits.2'),
        t('features.apiAccess.benefits.3')
      ],
      available: true,
      status: t('status.available')
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
                    {feature.status || t('status.available')}
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
            {feature.benefitsList.map((benefit: string, idx: number) => (
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
            <h1 className="text-4xl font-bold">{t('hero.title')}</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('hero.subtitle')}
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
                  {t('categories.ai.title')}
                </>
              ) : tier === 'max' ? (
                <>
                  <Crown className="h-4 w-4 mr-1" />
                  {t('categories.integration.title')}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  {t('categories.core.title')}
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
            <h2 className="text-3xl font-bold mb-4">{t('categories.core.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('categories.core.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coreFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* AI Features Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">{t('categories.ai.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('categories.ai.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {aiFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* Team Collaboration Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">{t('categories.collaboration.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('categories.collaboration.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {collaborationFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* Export & Reporting Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">{t('categories.reporting.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('categories.reporting.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {reportingFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* Platform Features Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">{t('categories.platform.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('categories.platform.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platformFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* Integration Features Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">{t('categories.integration.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('categories.integration.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {integrationFeatures.map((feature, index) => renderFeatureCard(feature, index))}
          </div>
        </motion.section>

        {/* Subscription Tiers Overview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.4 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">{t('cta.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('cta.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Tier */}
            <Card className={`${tier === 'free' ? 'ring-2 ring-green-500 bg-green-50/50' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="h-6 w-6 text-green-500" />
                  <CardTitle>{t('categories.core.title')}</CardTitle>
                  {tier === 'free' && <Badge className="bg-green-500 text-white">{t('status.available')}</Badge>}
                </div>
                <CardDescription>{t('categories.core.description')}</CardDescription>
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
                  <CardTitle>{t('categories.ai.title')}</CardTitle>
                  {tier === 'pro' && <Badge className="bg-blue-500 text-white">{t('status.available')}</Badge>}
                </div>
                <CardDescription>{t('categories.ai.description')}</CardDescription>
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
                  <CardTitle>{t('categories.integration.title')}</CardTitle>
                  {tier === 'max' && <Badge className="bg-purple-500 text-white">{t('status.available')}</Badge>}
                </div>
                <CardDescription>{t('categories.integration.description')}</CardDescription>
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
          transition={{ duration: 0.6, delay: 1.6 }}
          className="text-center"
        >
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                {t('cta.title')}
              </CardTitle>
              <CardDescription className="text-lg">
                {t('cta.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/dashboard">
                    <Upload className="h-5 w-5" />
                    {t('cta.button')}
                  </Link>
                </Button>
                {tier === 'free' && (
                  <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link to="/pricing">
                      <Crown className="h-5 w-5" />
                      {t('cta.contact')}
                    </Link>
                  </Button>
                )}
                <Button asChild variant="ghost" size="lg" className="gap-2">
                  <Link to="/help">
                    <MessageSquare className="h-5 w-5" />
                    {t('cta.contact')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Future Enhancements Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.8 }}
          className="mt-16 text-center"
        >
          <h2 className="text-2xl font-bold mb-4 text-muted-foreground">Future Enhancements</h2>
          <p className="text-muted-foreground mb-6">
            We're continuously improving Mataresit with new features and capabilities
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">Native Mobile Apps</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Dedicated iOS and Android apps with offline capabilities
                </p>
              </CardContent>
            </Card>
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">Advanced Integrations</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Direct connections with accounting software and ERP systems
                </p>
              </CardContent>
            </Card>
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">AI Insights</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Predictive analytics and spending pattern insights
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
