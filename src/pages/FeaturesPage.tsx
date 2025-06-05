import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { VersionControl } from '@/components/features/VersionControl';
import { Integrations } from '@/components/features/Integrations';
import { CustomBranding } from '@/components/features/CustomBranding';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  Headphones, 
  Users, 
  BarChart3, 
  Lock,
  Crown,
  Zap,
  Upload
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FeaturesPage() {
  const { getCurrentTier, isFeatureAvailable } = useSubscription();
  const tier = getCurrentTier();

  const getTierIcon = () => {
    switch (tier) {
      case 'pro':
        return <Zap className="h-5 w-5 text-blue-500" />;
      case 'max':
        return <Crown className="h-5 w-5 text-purple-500" />;
      default:
        return <Upload className="h-5 w-5 text-green-500" />;
    }
  };

  const getTierColor = () => {
    switch (tier) {
      case 'pro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'max':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Features & Integrations</h1>
              <p className="text-muted-foreground">
                Manage your plan features and integrations
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getTierIcon()}
              <Badge className={getTierColor()}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)} Plan
              </Badge>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Subscription Status */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <SubscriptionStatus />
          </motion.div>

          {/* Right Column - Features */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Version Control */}
            <VersionControl />

            {/* Integrations */}
            <Integrations />

            {/* Custom Branding */}
            <CustomBranding />

            {/* Support & Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Support */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isFeatureAvailable('priority_support') ? (
                        <Headphones className="h-5 w-5 text-green-500" />
                      ) : (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <CardTitle className="text-lg">Support</CardTitle>
                    </div>
                    <Badge variant="outline" className={
                      isFeatureAvailable('priority_support') 
                        ? "text-green-600 border-green-200" 
                        : ""
                    }>
                      {tier === 'free' ? 'Basic' : tier === 'pro' ? 'Standard' : 'Priority'}
                    </Badge>
                  </div>
                  <CardDescription>
                    Get help when you need it
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="font-medium mb-2">Available support:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Email support</li>
                        {tier !== 'free' && <li>• Priority response</li>}
                        {tier === 'max' && <li>• Dedicated support agent</li>}
                        {tier === 'max' && <li>• Phone support</li>}
                      </ul>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      Contact Support
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Advanced Analytics */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isFeatureAvailable('advanced_analytics') ? (
                        <BarChart3 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      )}
                      <CardTitle className="text-lg">Analytics</CardTitle>
                    </div>
                    <Badge variant="outline" className={
                      isFeatureAvailable('advanced_analytics') 
                        ? "text-green-600 border-green-200" 
                        : ""
                    }>
                      {isFeatureAvailable('advanced_analytics') ? 'Advanced' : 'Basic'}
                    </Badge>
                  </div>
                  <CardDescription>
                    Insights into your receipt data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="font-medium mb-2">Available features:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Basic reporting</li>
                        {tier !== 'free' && <li>• Advanced filters</li>}
                        {tier !== 'free' && <li>• Export capabilities</li>}
                        {tier === 'max' && <li>• Custom dashboards</li>}
                        {tier === 'max' && <li>• API access</li>}
                      </ul>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      View Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upgrade CTA for Free Users */}
            {tier === 'free' && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Unlock More Features
                  </CardTitle>
                  <CardDescription>
                    Upgrade to Pro or Max to access advanced features
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium mb-2">Pro Features:</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Version control</li>
                          <li>• Basic integrations</li>
                          <li>• Custom branding</li>
                          <li>• Up to 5 users</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Max Features:</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Advanced integrations</li>
                          <li>• Unlimited users</li>
                          <li>• Priority support</li>
                          <li>• API access</li>
                        </ul>
                      </div>
                    </div>
                    <Button asChild className="w-full">
                      <Link to="/pricing">View Pricing Plans</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
