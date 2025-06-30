/**
 * Summary Card UI Component for Chat Interface
 * 
 * Renders a summary card with key metrics, trends, and optional actions.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  DollarSign,
  Users,
  ShoppingCart,
  BarChart3,
  Target,
  Calendar,
  CreditCard,
  Receipt,
  PieChart
} from 'lucide-react';
import { SummaryCardData, UIComponentProps } from '@/types/ui-components';
import { formatCurrencySafe } from '@/utils/currency';

interface SummaryCardComponentProps extends Omit<UIComponentProps, 'component'> {
  data: SummaryCardData;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

export function SummaryCardComponent({ 
  data, 
  onAction, 
  className = '', 
  compact = false 
}: SummaryCardComponentProps) {
  // Icon mapping
  const iconMap = {
    'dollar-sign': DollarSign,
    'users': Users,
    'shopping-cart': ShoppingCart,
    'bar-chart': BarChart3,
    'target': Target,
    'calendar': Calendar,
    'credit-card': CreditCard,
    'receipt': Receipt,
    'pie-chart': PieChart,
    'trending-up': TrendingUp,
    'trending-down': TrendingDown,
  };

  const IconComponent = data.icon ? iconMap[data.icon as keyof typeof iconMap] : null;

  // Format the main value
  const formatValue = (value: string | number) => {
    if (typeof value === 'number' && data.currency) {
      return formatCurrencySafe(value, data.currency, 'en-US', 'MYR');
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  };

  // Get trend icon and color
  const getTrendIcon = () => {
    if (!data.trend) return null;
    
    switch (data.trend.direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    if (!data.trend) return 'text-muted-foreground';
    
    switch (data.trend.direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  // Get card color classes
  const getCardColorClasses = () => {
    switch (data.color) {
      case 'primary':
        return 'border-l-4 border-l-primary bg-primary/5';
      case 'success':
        return 'border-l-4 border-l-green-500 bg-green-50';
      case 'warning':
        return 'border-l-4 border-l-yellow-500 bg-yellow-50';
      case 'danger':
        return 'border-l-4 border-l-red-500 bg-red-50';
      default:
        return 'border-l-4 border-l-muted-foreground/20';
    }
  };

  if (compact) {
    return (
      <Card className={`${getCardColorClasses()} ${className}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {IconComponent && (
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">{data.title}</p>
                <p className="font-semibold text-sm">{formatValue(data.value)}</p>
              </div>
            </div>
            {data.trend && (
              <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>{Math.abs(data.trend.percentage)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${getCardColorClasses()} hover:shadow-lg transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {IconComponent && (
              <div className="p-2 rounded-lg bg-primary/10">
                <IconComponent className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {data.title}
              </CardTitle>
              {data.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{data.subtitle}</p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Main Value */}
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">{formatValue(data.value)}</span>
            {data.trend && (
              <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="font-medium">
                  {Math.abs(data.trend.percentage)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {data.trend.period}
                </span>
              </div>
            )}
          </div>

          {/* Trend Description */}
          {data.trend && (
            <p className="text-xs text-muted-foreground">
              {data.trend.direction === 'up' ? 'Increase' : 
               data.trend.direction === 'down' ? 'Decrease' : 'No change'} 
              {' '}from {data.trend.period}
            </p>
          )}

          {/* Actions */}
          {data.actions && data.actions.length > 0 && (
            <div className="flex gap-2 pt-2 border-t border-border/50">
              {data.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant === 'primary' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onAction?.(action.action, action.params)}
                  className="flex-1"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {/* Metadata */}
          {data.metadata && Object.keys(data.metadata).length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
              {Object.entries(data.metadata).slice(0, 4).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-muted-foreground capitalize">
                    {key.replace('_', ' ')}:
                  </span>
                  <span className="ml-1 font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
