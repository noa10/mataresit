// Adaptive Feature Panel Component
// Phase 5: Personalization & Memory System - Task 4

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAdaptiveUI } from '@/hooks/useAdaptiveUI';
import { AdaptiveContainer } from './AdaptiveContainer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Upload,
  Search,
  BarChart3,
  MessageSquare,
  FileText,
  Users,
  Settings,
  Star,
  TrendingUp,
  Clock,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';

interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'primary' | 'secondary' | 'advanced';
  href?: string;
  action?: () => void;
  badge?: string;
  requiresPro?: boolean;
}

interface AdaptiveFeaturePanelProps {
  features?: FeatureItem[];
  className?: string;
  showCategories?: boolean;
  maxPrimaryFeatures?: number;
  maxSecondaryFeatures?: number;
  enablePersonalization?: boolean;
}

const defaultFeatures: FeatureItem[] = [
  {
    id: 'upload',
    title: 'Upload Receipts',
    description: 'Upload and process new receipts with AI',
    icon: Upload,
    category: 'primary',
    href: '/upload'
  },
  {
    id: 'search',
    title: 'Smart Search',
    description: 'Search receipts with natural language',
    icon: Search,
    category: 'primary',
    href: '/search'
  },
  {
    id: 'chat',
    title: 'AI Assistant',
    description: 'Chat with AI about your receipts',
    icon: MessageSquare,
    category: 'primary',
    href: '/chat'
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'View spending insights and trends',
    icon: BarChart3,
    category: 'secondary',
    href: '/analytics'
  },
  {
    id: 'claims',
    title: 'Expense Claims',
    description: 'Create and manage expense claims',
    icon: FileText,
    category: 'secondary',
    href: '/claims'
  },
  {
    id: 'team',
    title: 'Team Management',
    description: 'Collaborate with team members',
    icon: Users,
    category: 'advanced',
    href: '/team',
    requiresPro: true
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configure your preferences',
    icon: Settings,
    category: 'advanced',
    href: '/settings'
  }
];

export function AdaptiveFeaturePanel({
  features = defaultFeatures,
  className,
  showCategories = true,
  maxPrimaryFeatures = 6,
  maxSecondaryFeatures = 4,
  enablePersonalization = true
}: AdaptiveFeaturePanelProps) {
  const {
    isFeaturePrimary,
    getFeatureUsageFrequency,
    getSortedComponents,
    trackComponentInteraction,
    adaptationConfidence
  } = useAdaptiveUI();

  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Sort and filter features based on usage patterns
  const adaptedFeatures = useMemo(() => {
    if (!enablePersonalization) return features;

    return features.map(feature => {
      const usageFrequency = getFeatureUsageFrequency(feature.id);
      const isPrimary = isFeaturePrimary(feature.id);
      
      return {
        ...feature,
        usageFrequency,
        isPrimary,
        adaptedCategory: isPrimary ? 'primary' : 
                        usageFrequency > 0.3 ? 'secondary' : 
                        feature.category
      };
    }).sort((a, b) => {
      // Sort by: primary features first, then usage frequency, then original category
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      if (a.usageFrequency !== b.usageFrequency) {
        return (b.usageFrequency || 0) - (a.usageFrequency || 0);
      }
      return 0;
    });
  }, [features, enablePersonalization, getFeatureUsageFrequency, isFeaturePrimary]);

  // Group features by category
  const categorizedFeatures = useMemo(() => {
    const groups = {
      primary: adaptedFeatures.filter(f => f.adaptedCategory === 'primary').slice(0, maxPrimaryFeatures),
      secondary: adaptedFeatures.filter(f => f.adaptedCategory === 'secondary').slice(0, maxSecondaryFeatures),
      advanced: adaptedFeatures.filter(f => f.adaptedCategory === 'advanced')
    };

    return groups;
  }, [adaptedFeatures, maxPrimaryFeatures, maxSecondaryFeatures]);

  // Get visible features based on current selection
  const visibleFeatures = useMemo(() => {
    if (selectedCategory === 'all') {
      return showAllFeatures ? adaptedFeatures : [
        ...categorizedFeatures.primary,
        ...categorizedFeatures.secondary.slice(0, 2)
      ];
    }
    return categorizedFeatures[selectedCategory as keyof typeof categorizedFeatures] || [];
  }, [selectedCategory, showAllFeatures, adaptedFeatures, categorizedFeatures]);

  const handleFeatureClick = (feature: FeatureItem) => {
    trackComponentInteraction(`feature-${feature.id}`, 'click');
    
    if (feature.action) {
      feature.action();
    } else if (feature.href) {
      window.location.href = feature.href;
    }
  };

  const renderFeatureCard = (feature: FeatureItem & { usageFrequency?: number; isPrimary?: boolean }) => {
    const Icon = feature.icon;
    const usageFrequency = feature.usageFrequency || 0;
    const isPrimary = feature.isPrimary || false;

    return (
      <Card 
        key={feature.id}
        className={cn(
          'cursor-pointer transition-all hover:shadow-md',
          isPrimary && 'ring-2 ring-primary/20 bg-primary/5',
          usageFrequency > 0.5 && 'border-primary/30'
        )}
        onClick={() => handleFeatureClick(feature)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                isPrimary ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {feature.title}
                  {isPrimary && <Star className="h-4 w-4 text-yellow-500" />}
                  {feature.requiresPro && (
                    <Badge variant="secondary" className="text-xs">Pro</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </div>
            </div>
            
            {feature.badge && (
              <Badge variant="outline" className="text-xs">
                {feature.badge}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        {enablePersonalization && usageFrequency > 0 && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Used {(usageFrequency * 100).toFixed(0)}% of the time</span>
              {isPrimary && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Zap className="h-3 w-3 text-primary" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">Frequently used feature</div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  const renderCategoryTab = (category: string, label: string, count: number) => (
    <TabsTrigger 
      key={category}
      value={category} 
      className="flex items-center gap-2"
    >
      {label}
      <Badge variant="secondary" className="text-xs">
        {count}
      </Badge>
    </TabsTrigger>
  );

  return (
    <AdaptiveContainer
      componentId="adaptive-feature-panel"
      className={cn('adaptive-feature-panel', className)}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Features</h2>
            <p className="text-muted-foreground">
              {enablePersonalization && adaptationConfidence > 0.5 
                ? 'Personalized based on your usage patterns'
                : 'Available features and tools'
              }
            </p>
          </div>
          
          {enablePersonalization && (
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="gap-1">
                      <Zap className="h-3 w-3" />
                      {(adaptationConfidence * 100).toFixed(0)}% adapted
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      Features are personalized based on your usage patterns
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllFeatures(!showAllFeatures)}
              >
                {showAllFeatures ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show All
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Category Tabs */}
        {showCategories && (
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-4">
              {renderCategoryTab('all', 'All', adaptedFeatures.length)}
              {renderCategoryTab('primary', 'Primary', categorizedFeatures.primary.length)}
              {renderCategoryTab('secondary', 'Secondary', categorizedFeatures.secondary.length)}
              {renderCategoryTab('advanced', 'Advanced', categorizedFeatures.advanced.length)}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleFeatures.map(renderFeatureCard)}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Grid without tabs */}
        {!showCategories && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleFeatures.map(renderFeatureCard)}
          </div>
        )}

        {/* Show more button */}
        {!showAllFeatures && selectedCategory === 'all' && adaptedFeatures.length > visibleFeatures.length && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => setShowAllFeatures(true)}
            >
              Show {adaptedFeatures.length - visibleFeatures.length} more features
            </Button>
          </div>
        )}

        {/* Personalization info */}
        {enablePersonalization && adaptationConfidence > 0.3 && (
          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Adaptive Features</h4>
                <p className="text-sm text-muted-foreground">
                  This panel adapts to show your most-used features first. 
                  Features marked with <Star className="h-3 w-3 inline text-yellow-500" /> are frequently used.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdaptiveContainer>
  );
}

export default AdaptiveFeaturePanel;
