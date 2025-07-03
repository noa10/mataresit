/**
 * Progressive Usage Display Component
 * Shows usage statistics with progressive loading and skeleton states
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Database, 
  RefreshCw, 
  Upload, 
  HardDrive, 
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { formatDistanceToNow } from 'date-fns';

interface ProgressiveUsageDisplayProps {
  className?: string;
  showDetailedStats?: boolean;
}

interface LoadingStage {
  id: string;
  label: string;
  completed: boolean;
  duration: number;
}

export function ProgressiveUsageDisplay({ 
  className, 
  showDetailedStats = true 
}: ProgressiveUsageDisplayProps) {
  const { 
    limits, 
    usage, 
    usageStats,
    isLoading, 
    error, 
    dataUpdatedAt,
    refreshUsage 
  } = useSubscription();

  const [loadingStages, setLoadingStages] = useState<LoadingStage[]>([
    { id: 'basic', label: 'Loading basic stats', completed: false, duration: 500 },
    { id: 'usage', label: 'Calculating usage', completed: false, duration: 800 },
    { id: 'analytics', label: 'Preparing analytics', completed: false, duration: 1200 },
  ]);

  const [currentStage, setCurrentStage] = useState(0);
  const [showProgressBar, setShowProgressBar] = useState(false);

  // Simulate progressive loading stages when loading
  useEffect(() => {
    if (isLoading) {
      setShowProgressBar(true);
      setCurrentStage(0);
      setLoadingStages(stages => stages.map(s => ({ ...s, completed: false })));

      // Simulate progressive completion
      const timer = setTimeout(() => {
        setCurrentStage(1);
        setLoadingStages(stages => 
          stages.map((s, i) => ({ ...s, completed: i === 0 }))
        );
      }, 300);

      const timer2 = setTimeout(() => {
        setCurrentStage(2);
        setLoadingStages(stages => 
          stages.map((s, i) => ({ ...s, completed: i <= 1 }))
        );
      }, 800);

      return () => {
        clearTimeout(timer);
        clearTimeout(timer2);
      };
    } else {
      // Complete all stages when loading is done
      setLoadingStages(stages => stages.map(s => ({ ...s, completed: true })));
      setTimeout(() => setShowProgressBar(false), 500);
    }
  }, [isLoading]);

  const formatLastUpdated = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Progressive loading skeleton
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Usage & Limits
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
          </CardTitle>
          <CardDescription>
            {loadingStages[currentStage]?.label || 'Loading your usage statistics...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progressive Loading Indicator */}
          {showProgressBar && (
            <div className="space-y-2">
              <Progress value={(currentStage + 1) / loadingStages.length * 100} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                {loadingStages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center gap-1">
                    {stage.completed ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : index === currentStage ? (
                      <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                    ) : (
                      <Clock className="h-3 w-3 text-gray-400" />
                    )}
                    <span className={stage.completed ? 'text-green-600' : index === currentStage ? 'text-blue-600' : ''}>
                      {stage.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skeleton for basic stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>

            {showDetailedStats && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>

                <div className="pt-2 border-t">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Usage & Limits
          </CardTitle>
          <CardDescription className="text-red-600">
            Failed to load usage statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            {error}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refreshUsage()}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Success state with data
  const receiptsUsed = usage?.receiptsUsedThisMonth || 0;
  const receiptsLimit = limits?.monthlyReceipts || 0;
  const storageUsed = usage?.storageUsedMB || 0;
  const storageLimit = limits?.storageLimitMB || 0;
  const batchLimit = limits?.batchUploadLimit || 0;

  const receiptsPercentage = getUsagePercentage(receiptsUsed, receiptsLimit);
  const storagePercentage = getUsagePercentage(storageUsed, storageLimit);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Usage & Limits
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardTitle>
            <CardDescription>
              Current usage for your subscription plan
              {dataUpdatedAt && (
                <span className="ml-2 text-xs">
                  • Updated {formatLastUpdated(dataUpdatedAt)}
                </span>
              )}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refreshUsage()}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Usage Stats */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Receipts this month</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-mono ${getUsageColor(receiptsPercentage)}`}>
                {receiptsUsed} / {receiptsLimit === -1 ? 'Unlimited' : receiptsLimit}
              </span>
              {receiptsLimit !== -1 && (
                <Badge variant={receiptsPercentage >= 90 ? 'destructive' : receiptsPercentage >= 75 ? 'secondary' : 'default'}>
                  {Math.round(receiptsPercentage)}%
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Storage used</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-mono ${getUsageColor(storagePercentage)}`}>
                {storageUsed.toFixed(1)} MB / {storageLimit === -1 ? 'Unlimited' : `${storageLimit} MB`}
              </span>
              {storageLimit !== -1 && (
                <Badge variant={storagePercentage >= 90 ? 'destructive' : storagePercentage >= 75 ? 'secondary' : 'default'}>
                  {Math.round(storagePercentage)}%
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Batch upload limit</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {batchLimit} files
            </span>
          </div>
        </div>

        {/* Detailed Analytics (Progressive) */}
        {showDetailedStats && usage && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Additional Statistics
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total receipts:</span>
                <span className="ml-2 font-mono">{usage.totalReceipts || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">With images:</span>
                <span className="ml-2 font-mono">{usage.receiptsWithImages || 0}</span>
              </div>
            </div>

            {usage.usagePercentages && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Usage Distribution</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Receipts</span>
                    <span>{usage.usagePercentages.receipts}%</span>
                  </div>
                  <Progress value={usage.usagePercentages.receipts} className="h-1" />
                  
                  <div className="flex justify-between text-xs">
                    <span>Storage</span>
                    <span>{usage.usagePercentages.storage}%</span>
                  </div>
                  <Progress value={usage.usagePercentages.storage} className="h-1" />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
