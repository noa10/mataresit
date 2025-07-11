/**
 * Section Header UI Component for Chat Interface
 * 
 * Renders markdown headers (H1, H2, H3) with proper styling and hierarchy
 * in chat responses. Supports collapsible sections and visual organization.
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronRight,
  Hash,
  Bookmark,
  Star,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { UIComponentProps } from '@/types/ui-components';
import { cn } from '@/lib/utils';

// Section Header Data Interface
export interface SectionHeaderData {
  title: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  subtitle?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  icon?: string;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  divider?: boolean;
  anchor?: string;
  standalone?: boolean; // Indicates if this is a standalone header that might be duplicated
}

interface SectionHeaderComponentProps extends Omit<UIComponentProps, 'component'> {
  data: SectionHeaderData;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

export function SectionHeaderComponent({ 
  data, 
  onAction, 
  className = '', 
  compact = false 
}: SectionHeaderComponentProps) {
  const [isCollapsed, setIsCollapsed] = useState(data.collapsed || false);

  // Get icon component based on string name
  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'hash': return Hash;
      case 'bookmark': return Bookmark;
      case 'star': return Star;
      case 'info': return Info;
      case 'alert': return AlertCircle;
      case 'check': return CheckCircle;
      case 'error': return XCircle;
      default: return null;
    }
  };

  // Get variant-specific styling
  const getVariantStyles = () => {
    switch (data.variant) {
      case 'primary':
        return {
          container: 'border-primary/20 bg-primary/5',
          title: 'text-primary',
          subtitle: 'text-primary/70',
          icon: 'text-primary'
        };
      case 'success':
        return {
          container: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
          title: 'text-green-800 dark:text-green-200',
          subtitle: 'text-green-600 dark:text-green-400',
          icon: 'text-green-600 dark:text-green-400'
        };
      case 'warning':
        return {
          container: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
          title: 'text-yellow-800 dark:text-yellow-200',
          subtitle: 'text-yellow-600 dark:text-yellow-400',
          icon: 'text-yellow-600 dark:text-yellow-400'
        };
      case 'error':
        return {
          container: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
          title: 'text-red-800 dark:text-red-200',
          subtitle: 'text-red-600 dark:text-red-400',
          icon: 'text-red-600 dark:text-red-400'
        };
      case 'info':
        return {
          container: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
          title: 'text-blue-800 dark:text-blue-200',
          subtitle: 'text-blue-600 dark:text-blue-400',
          icon: 'text-blue-600 dark:text-blue-400'
        };
      default:
        return {
          container: 'border-border bg-background',
          title: 'text-foreground',
          subtitle: 'text-muted-foreground',
          icon: 'text-muted-foreground'
        };
    }
  };

  // Get typography styles based on header level
  const getTypographyStyles = () => {
    const baseStyles = compact ? 'font-semibold' : 'font-bold';
    
    switch (data.level) {
      case 1:
        return compact 
          ? `text-lg ${baseStyles}` 
          : `text-2xl ${baseStyles}`;
      case 2:
        return compact 
          ? `text-base ${baseStyles}` 
          : `text-xl ${baseStyles}`;
      case 3:
        return compact 
          ? `text-sm ${baseStyles}` 
          : `text-lg ${baseStyles}`;
      case 4:
        return compact 
          ? `text-sm font-medium` 
          : `text-base font-semibold`;
      case 5:
        return compact 
          ? `text-xs font-medium` 
          : `text-sm font-semibold`;
      case 6:
        return compact 
          ? `text-xs font-normal` 
          : `text-sm font-medium`;
      default:
        return `text-base ${baseStyles}`;
    }
  };

  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onAction?.('toggle_collapse', { 
      anchor: data.anchor, 
      collapsed: newCollapsed 
    });
  };

  const handleAnchorClick = () => {
    if (data.anchor) {
      onAction?.('navigate_to_anchor', { anchor: data.anchor });
    }
  };

  const IconComponent = getIcon(data.icon);
  const variantStyles = getVariantStyles();
  const typographyStyles = getTypographyStyles();

  // For level 1 headers, use a more prominent card layout (unless it's a standalone header)
  if (data.level === 1 && !compact && !data.standalone) {
    return (
      <Card className={cn(
        'mb-6 overflow-hidden',
        variantStyles.container,
        className
      )}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {IconComponent && (
                <IconComponent className={cn('h-6 w-6 mt-1', variantStyles.icon)} />
              )}
              <div className="flex-1">
                <h1 className={cn(typographyStyles, variantStyles.title)}>
                  {data.title}
                </h1>
                {data.subtitle && (
                  <p className={cn('mt-2 text-sm', variantStyles.subtitle)}>
                    {data.subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {data.badge && (
                <Badge variant={data.badge.variant || 'default'}>
                  {data.badge.text}
                </Badge>
              )}
              {data.collapsible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleCollapse}
                  className="h-8 w-8 p-0"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
        {data.divider && (
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        )}
      </Card>
    );
  }

  // For other header levels, use a simpler layout
  // Apply more subtle styling for standalone headers to reduce visual confusion
  const isStandalone = data.standalone;

  return (
    <div className={cn(
      'flex items-start justify-between',
      // Reduce padding and margins for standalone headers
      isStandalone ? 'py-1' : 'py-3',
      // Only show border for non-standalone headers at level 2 and below
      !isStandalone && data.level <= 2 ? 'border-b border-border/50' : '',
      // Adjust margins based on standalone status
      isStandalone
        ? 'mb-1'
        : data.level === 1 ? 'mb-4' : data.level === 2 ? 'mb-3' : 'mb-2',
      className
    )}>
      <div className="flex items-start gap-2 flex-1">
        {data.collapsible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleCollapse}
            className="h-6 w-6 p-0 mt-0.5"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        )}

        {IconComponent && (
          <IconComponent className={cn(
            data.level <= 2 ? 'h-5 w-5' : 'h-4 w-4',
            'mt-0.5',
            variantStyles.icon,
            // Reduce icon opacity for standalone headers
            isStandalone ? 'opacity-60' : ''
          )} />
        )}

        <div className="flex-1">
          <div
            className={cn(
              typographyStyles,
              variantStyles.title,
              data.anchor ? 'cursor-pointer hover:underline' : '',
              // Apply more subtle styling for standalone headers
              isStandalone ? 'opacity-75 text-sm font-medium' : ''
            )}
            onClick={data.anchor ? handleAnchorClick : undefined}
          >
            {data.title}
          </div>
          {data.subtitle && (
            <p className={cn(
              'mt-1',
              compact ? 'text-xs' : 'text-sm',
              variantStyles.subtitle,
              isStandalone ? 'opacity-60' : ''
            )}>
              {data.subtitle}
            </p>
          )}
        </div>
      </div>

      {data.badge && (
        <Badge
          variant={data.badge.variant || 'default'}
          className={cn(
            compact ? 'text-xs' : '',
            isStandalone ? 'opacity-75' : ''
          )}
        >
          {data.badge.text}
        </Badge>
      )}
    </div>
  );
}
