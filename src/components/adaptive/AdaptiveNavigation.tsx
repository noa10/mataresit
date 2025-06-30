// Adaptive Navigation Component
// Phase 5: Personalization & Memory System - Task 4

import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAdaptiveUI } from '@/hooks/useAdaptiveUI';
import { AdaptiveContainer } from './AdaptiveContainer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Home,
  Search,
  Upload,
  MessageSquare,
  BarChart3,
  Settings,
  Users,
  FileText,
  Zap,
  Star
} from 'lucide-react';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  featureId?: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  badge?: string;
  description?: string;
}

interface AdaptiveNavigationProps {
  items?: NavigationItem[];
  orientation?: 'vertical' | 'horizontal';
  showLabels?: boolean;
  className?: string;
}

const defaultNavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    href: '/dashboard',
    featureId: 'dashboard',
    description: 'View your receipt overview and statistics'
  },
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    href: '/search',
    featureId: 'search_query',
    description: 'Search and analyze your receipts'
  },
  {
    id: 'upload',
    label: 'Upload',
    icon: Upload,
    href: '/upload',
    featureId: 'upload',
    description: 'Upload new receipts'
  },
  {
    id: 'chat',
    label: 'AI Chat',
    icon: MessageSquare,
    href: '/chat',
    featureId: 'chat_message',
    description: 'Chat with AI about your receipts'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    href: '/analytics',
    featureId: 'analysis',
    description: 'View detailed spending analytics'
  },
  {
    id: 'claims',
    label: 'Claims',
    icon: FileText,
    href: '/claims',
    featureId: 'claims',
    description: 'Manage expense claims'
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    href: '/team',
    featureId: 'team',
    description: 'Manage team members and collaboration'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    featureId: 'settings',
    description: 'Configure your preferences'
  }
];

export function AdaptiveNavigation({
  items = defaultNavigationItems,
  orientation = 'vertical',
  showLabels,
  className
}: AdaptiveNavigationProps) {
  const location = useLocation();
  const {
    getNavigationStyle,
    getSortedComponents,
    isFeaturePrimary,
    getFeatureUsageFrequency,
    trackComponentInteraction
  } = useAdaptiveUI();

  const navigationStyle = getNavigationStyle();
  const shouldShowLabels = showLabels ?? (navigationStyle === 'full');

  // Sort navigation items by usage frequency and priority
  const sortedItems = useMemo(() => {
    const itemsWithMetrics = items.map(item => ({
      ...item,
      usageFrequency: item.featureId ? getFeatureUsageFrequency(item.featureId) : 0,
      isPrimary: item.featureId ? isFeaturePrimary(item.featureId) : false
    }));

    // Sort by: primary features first, then by usage frequency, then by original order
    return itemsWithMetrics.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      if (a.usageFrequency !== b.usageFrequency) {
        return b.usageFrequency - a.usageFrequency;
      }
      return 0;
    });
  }, [items, getFeatureUsageFrequency, isFeaturePrimary]);

  // Filter items based on navigation style
  const visibleItems = useMemo(() => {
    switch (navigationStyle) {
      case 'minimal':
        return sortedItems.slice(0, 4); // Show only top 4 items
      case 'icons':
        return sortedItems.slice(0, 6); // Show top 6 items
      case 'contextual':
        // Show items based on current context
        const currentPath = location.pathname;
        const contextualItems = sortedItems.filter(item => 
          item.isPrimary || 
          item.href === currentPath ||
          item.usageFrequency > 0.3
        );
        return contextualItems.slice(0, 8);
      case 'full':
      default:
        return sortedItems; // Show all items
    }
  }, [sortedItems, navigationStyle, location.pathname]);

  const handleItemClick = (item: NavigationItem) => {
    if (item.featureId) {
      trackComponentInteraction(`nav-${item.id}`, 'click');
    }
  };

  const renderNavigationItem = (item: NavigationItem) => {
    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    const usageFrequency = item.featureId ? getFeatureUsageFrequency(item.featureId) : 0;
    const isPrimary = item.featureId ? isFeaturePrimary(item.featureId) : false;

    const itemContent = (
      <Button
        variant={isActive ? 'default' : 'ghost'}
        size={shouldShowLabels ? 'default' : 'icon'}
        className={cn(
          'w-full justify-start',
          orientation === 'horizontal' && 'flex-col h-auto py-2',
          !shouldShowLabels && 'aspect-square',
          isPrimary && 'ring-2 ring-primary/20',
          usageFrequency > 0.5 && 'font-medium'
        )}
        onClick={() => handleItemClick(item)}
        asChild
      >
        <Link to={item.href}>
          <Icon className={cn(
            'h-4 w-4',
            shouldShowLabels && orientation === 'vertical' && 'mr-2',
            orientation === 'horizontal' && 'mb-1'
          )} />
          {shouldShowLabels && (
            <span className={cn(
              orientation === 'horizontal' && 'text-xs'
            )}>
              {item.label}
            </span>
          )}
          {isPrimary && (
            <Star className="h-3 w-3 ml-auto text-yellow-500" />
          )}
          {item.badge && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {item.badge}
            </Badge>
          )}
        </Link>
      </Button>
    );

    if (!shouldShowLabels && item.description) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {itemContent}
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="max-w-xs">
                <div className="font-medium">{item.label}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
                {usageFrequency > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Usage: {(usageFrequency * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <div key={item.id}>{itemContent}</div>;
  };

  return (
    <AdaptiveContainer
      componentId="adaptive-navigation"
      className={cn(
        'adaptive-navigation',
        orientation === 'vertical' ? 'flex flex-col space-y-1' : 'flex flex-row space-x-1',
        className
      )}
      trackInteractions={true}
    >
      {/* High-priority items */}
      <div className={cn(
        'primary-navigation',
        orientation === 'vertical' ? 'space-y-1' : 'flex space-x-1'
      )}>
        {visibleItems
          .filter(item => item.isPrimary)
          .map(renderNavigationItem)
        }
      </div>

      {/* Separator if we have both primary and secondary items */}
      {visibleItems.some(item => item.isPrimary) && 
       visibleItems.some(item => !item.isPrimary) && (
        <div className={cn(
          'separator',
          orientation === 'vertical' ? 'border-t my-2' : 'border-l mx-2'
        )} />
      )}

      {/* Secondary items */}
      <div className={cn(
        'secondary-navigation',
        orientation === 'vertical' ? 'space-y-1' : 'flex space-x-1'
      )}>
        {visibleItems
          .filter(item => !item.isPrimary)
          .map(renderNavigationItem)
        }
      </div>

      {/* Adaptation indicator */}
      {navigationStyle !== 'full' && (
        <div className="mt-4 p-2 text-xs text-muted-foreground text-center">
          <Zap className="h-3 w-3 inline mr-1" />
          Adaptive Navigation
        </div>
      )}
    </AdaptiveContainer>
  );
}

export default AdaptiveNavigation;
