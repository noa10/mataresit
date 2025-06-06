import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Crown,
  Zap,
  Upload,
  Database,
  Layers,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface SubscriptionLimitErrorProps {
  limitType: 'monthly_receipts' | 'storage' | 'batch_upload' | 'feature';
  currentUsage?: number;
  limit?: number;
  feature?: string;
  className?: string;
  showUpgradeOptions?: boolean;
}

export default function SubscriptionLimitError({
  limitType,
  currentUsage,
  limit,
  feature,
  className = "",
  showUpgradeOptions = true
}: SubscriptionLimitErrorProps) {
  const { getCurrentTier } = useSubscription();
  const currentTier = getCurrentTier();

  const getErrorContent = () => {
    switch (limitType) {
      case 'monthly_receipts':
        return {
          icon: <Upload className="h-5 w-5" />,
          title: 'Monthly Receipt Limit Reached',
          description: `You've used ${currentUsage} of your ${limit} monthly receipts.`,
          suggestion: 'Upgrade to a higher plan for more monthly receipts.',
          upgradeFeatures: ['More monthly receipts', 'Advanced processing', 'Better analytics']
        };
      
      case 'storage':
        return {
          icon: <Database className="h-5 w-5" />,
          title: 'Storage Limit Reached',
          description: `You've reached your storage limit of ${limit ? `${(limit / 1024).toFixed(1)} GB` : 'your plan'}.`,
          suggestion: 'Upgrade for more storage space.',
          upgradeFeatures: ['More storage space', 'Longer data retention', 'Advanced features']
        };
      
      case 'batch_upload':
        return {
          icon: <Layers className="h-5 w-5" />,
          title: 'Batch Upload Limit Exceeded',
          description: `Your plan allows batches of up to ${limit} files. You're trying to upload more than this limit.`,
          suggestion: 'Upgrade for larger batch uploads.',
          upgradeFeatures: ['Larger batch uploads', 'Faster processing', 'Priority support']
        };
      
      case 'feature':
        return {
          icon: <Crown className="h-5 w-5" />,
          title: `${feature} Not Available`,
          description: `The ${feature} feature is not available on your current plan.`,
          suggestion: 'Upgrade to access this premium feature.',
          upgradeFeatures: ['Premium features', 'Advanced capabilities', 'Priority support']
        };
      
      default:
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          title: 'Subscription Limit Reached',
          description: 'You\'ve reached a limit on your current plan.',
          suggestion: 'Consider upgrading for more features.',
          upgradeFeatures: ['More features', 'Higher limits', 'Better support']
        };
    }
  };

  const getRecommendedPlan = () => {
    if (currentTier === 'free') {
      return {
        name: 'Pro',
        price: '$10/month',
        tier: 'pro',
        icon: <Zap className="h-4 w-4" />,
        color: 'bg-blue-100 text-blue-800 border-blue-200'
      };
    } else if (currentTier === 'pro') {
      return {
        name: 'Max',
        price: '$20/month',
        tier: 'max',
        icon: <Crown className="h-4 w-4" />,
        color: 'bg-purple-100 text-purple-800 border-purple-200'
      };
    }
    return null;
  };

  const errorContent = getErrorContent();
  const recommendedPlan = getRecommendedPlan();
  const usagePercentage = currentUsage && limit ? Math.min((currentUsage / limit) * 100, 100) : 100;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Error Alert */}
      <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex items-start space-x-3">
          <div className="text-red-600 dark:text-red-400 mt-0.5">
            {errorContent.icon}
          </div>
          <div className="flex-1">
            <AlertTitle className="text-red-800 dark:text-red-200">
              {errorContent.title}
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300 mt-1">
              {errorContent.description}
            </AlertDescription>
            
            {/* Usage Progress Bar */}
            {currentUsage && limit && (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Usage</span>
                  <span>{currentUsage} / {limit}</span>
                </div>
                <Progress 
                  value={usagePercentage} 
                  className="h-2"
                  style={{ 
                    background: `linear-gradient(to right, #ef4444 ${usagePercentage}%, #e5e7eb ${usagePercentage}%)` 
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </Alert>

      {/* Upgrade Recommendation */}
      {showUpgradeOptions && recommendedPlan && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="text-blue-600 dark:text-blue-400">
                  {recommendedPlan.icon}
                </div>
                <CardTitle className="text-lg text-blue-800 dark:text-blue-200">
                  Recommended: {recommendedPlan.name} Plan
                </CardTitle>
              </div>
              <Badge className={recommendedPlan.color}>
                {recommendedPlan.price}
              </Badge>
            </div>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              {errorContent.suggestion}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upgrade Features */}
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                What you'll get:
              </h4>
              <ul className="space-y-1">
                {errorContent.upgradeFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-300">
                    <ArrowRight className="h-3 w-3" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button asChild className="flex-1">
                <Link to="/pricing">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to {recommendedPlan.name}
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link to="/pricing">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All Plans
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alternative Actions */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Need help choosing the right plan?
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/contact">
            Contact Support
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Compact version for inline error display
 */
export function CompactSubscriptionLimitError({
  limitType,
  currentUsage,
  limit,
  feature,
  className = ""
}: Omit<SubscriptionLimitErrorProps, 'showUpgradeOptions'>) {
  const errorContent = (() => {
    switch (limitType) {
      case 'monthly_receipts':
        return {
          message: `Monthly limit reached (${currentUsage}/${limit})`,
          action: 'Upgrade for more receipts'
        };
      case 'storage':
        return {
          message: 'Storage limit reached',
          action: 'Upgrade for more storage'
        };
      case 'batch_upload':
        return {
          message: `Batch limit exceeded (max ${limit} files)`,
          action: 'Upgrade for larger batches'
        };
      case 'feature':
        return {
          message: `${feature} not available`,
          action: 'Upgrade to unlock'
        };
      default:
        return {
          message: 'Plan limit reached',
          action: 'Upgrade plan'
        };
    }
  })();

  return (
    <div className={`flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className}`}>
      <div className="flex items-center space-x-2">
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <span className="text-sm text-red-800 dark:text-red-200">
          {errorContent.message}
        </span>
      </div>
      <Button size="sm" asChild>
        <Link to="/pricing">
          {errorContent.action}
        </Link>
      </Button>
    </div>
  );
}
