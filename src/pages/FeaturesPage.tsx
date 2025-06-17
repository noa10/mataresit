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
  Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FeaturesPage() {
  const { getCurrentTier, isFeatureAvailable } = useSubscription();
  const { t } = useFeaturesTranslation();
  const tier = getCurrentTier();

  // Generate core features with translations
  const coreFeatures = [
    {
      icon: <Brain className="h-8 w-8 text-blue-500" />,
      title: t('features.aiProcessing.title'),
      description: t('features.aiProcessing.description'),
      benefits: t('features.aiProcessing.benefits'),
      available: true,
      status: t('status.available')
    },
    {
      icon: <Upload className="h-8 w-8 text-green-500" />,
      title: t('features.batchProcessing.title'),
      description: t('features.batchProcessing.description'),
      benefits: t('features.batchProcessing.benefits'),
      available: true,
      status: t('status.available')
    },
    {
      icon: <Eye className="h-8 w-8 text-purple-500" />,
      title: t('features.smartSearch.title'),
      description: t('features.smartSearch.description'),
      benefits: t('features.smartSearch.benefits'),
      available: true,
      status: t('status.available')
    },
    {
      icon: <Search className="h-8 w-8 text-orange-500" />,
      title: t('features.smartSearch.title'),
      description: t('features.smartSearch.description'),
      benefits: t('features.smartSearch.benefits'),
      available: true,
      status: t('status.available')
    }
  ];

  // Generate analytics features with translations
  const analyticsFeatures = [
    {
      icon: <BarChart3 className="h-8 w-8 text-indigo-500" />,
      title: t('features.exportOptions.title'),
      description: t('features.exportOptions.description'),
      benefits: t('features.exportOptions.benefits'),
      available: true,
      status: t('status.available')
    },
    {
      icon: <FileText className="h-8 w-8 text-red-500" />,
      title: t('features.exportOptions.title'),
      description: t('features.exportOptions.description'),
      benefits: t('features.exportOptions.benefits'),
      available: true,
      status: t('status.available')
    },
    {
      icon: <PieChart className="h-8 w-8 text-teal-500" />,
      title: t('features.customCategories.title'),
      description: t('features.customCategories.description'),
      benefits: t('features.customCategories.benefits'),
      available: true,
      status: t('status.available')
    }
  ];

  // Generate platform features with translations
  const platformFeatures = [
    {
      icon: <Shield className="h-8 w-8 text-green-600" />,
      title: t('features.secureStorage.title'),
      description: t('features.secureStorage.description'),
      benefits: t('features.secureStorage.benefits'),
      available: true,
      status: t('status.available')
    },
    {
      icon: <Settings className="h-8 w-8 text-gray-600" />,
      title: t('features.teamCollaboration.title'),
      description: t('features.teamCollaboration.description'),
      benefits: t('features.teamCollaboration.benefits'),
      available: true,
      status: t('status.available')
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-blue-600" />,
      title: t('features.claimsManagement.title'),
      description: t('features.claimsManagement.description'),
      benefits: t('features.claimsManagement.benefits'),
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
            {(Array.isArray(feature.benefits) ? feature.benefits : [feature.benefits]).map((benefit: string, idx: number) => (
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

        {/* Analytics & Reporting Section */}
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
            <h2 className="text-3xl font-bold mb-4">{t('categories.collaboration.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('categories.collaboration.description')}
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
          transition={{ duration: 0.6, delay: 1.0 }}
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

        {/* Coming Soon Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mt-16 text-center"
        >
          <h2 className="text-2xl font-bold mb-4 text-muted-foreground">{t('status.coming_soon')}</h2>
          <p className="text-muted-foreground mb-6">
            {t('cta.subtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">{t('features.apiAccess.title')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {t('features.apiAccess.description')}
                </p>
              </CardContent>
            </Card>
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">{t('features.teamCollaboration.title')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {t('features.teamCollaboration.description')}
                </p>
              </CardContent>
            </Card>
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">{t('features.exportOptions.title')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {t('features.exportOptions.description')}
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
