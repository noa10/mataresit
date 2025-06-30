/**
 * Bar Chart UI Component for Chat Interface
 * 
 * Renders an interactive bar chart with customizable orientation and styling.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChartData, UIComponentProps } from '@/types/ui-components';
import { formatCurrencySafe } from '@/utils/currency';

interface BarChartComponentProps extends Omit<UIComponentProps, 'component'> {
  data: BarChartData;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

export function BarChartComponent({ 
  data, 
  onAction, 
  className = '', 
  compact = false 
}: BarChartComponentProps) {
  const maxValue = Math.max(...data.data.map(item => item.value));
  const isHorizontal = data.orientation === 'horizontal';

  // Default color scheme
  const defaultColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];

  const colors = data.color_scheme || defaultColors;

  // Format value for display
  const formatValue = (value: number) => {
    if (data.currency) {
      return formatCurrencySafe(value, data.currency, 'en-US', 'MYR');
    }
    return value.toLocaleString();
  };

  // Get color for bar
  const getBarColor = (index: number, item: any) => {
    return item.color || colors[index % colors.length];
  };

  // Calculate bar size percentage
  const getBarSize = (value: number) => {
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  };

  if (compact) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-3">
          {data.title && (
            <h4 className="font-medium text-sm mb-3">{data.title}</h4>
          )}
          <div className="space-y-2">
            {data.data.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-16 text-xs text-muted-foreground truncate">
                  {item.label}
                </div>
                <div className="flex-1 relative">
                  <div className="h-4 bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-300"
                      style={{
                        width: `${getBarSize(item.value)}%`,
                        backgroundColor: getBarColor(index, item)
                      }}
                    />
                  </div>
                </div>
                <div className="text-xs font-medium w-16 text-right">
                  {formatValue(item.value)}
                </div>
              </div>
            ))}
            {data.data.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{data.data.length - 5} more items
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      {(data.title || data.subtitle) && (
        <CardHeader className="pb-4">
          {data.title && (
            <CardTitle className="text-lg">{data.title}</CardTitle>
          )}
          {data.subtitle && (
            <p className="text-sm text-muted-foreground">{data.subtitle}</p>
          )}
        </CardHeader>
      )}

      <CardContent className="p-4">
        {isHorizontal ? (
          // Horizontal Bar Chart
          <div className="space-y-4">
            {data.y_axis_label && (
              <p className="text-sm font-medium text-muted-foreground">
                {data.y_axis_label}
              </p>
            )}
            <div className="space-y-3">
              {data.data.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.label}</span>
                    {data.show_values && (
                      <span className="text-sm text-muted-foreground">
                        {formatValue(item.value)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="h-6 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-500 ease-out"
                        style={{
                          width: `${getBarSize(item.value)}%`,
                          backgroundColor: getBarColor(index, item)
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {data.x_axis_label && (
              <p className="text-sm font-medium text-muted-foreground text-center pt-2">
                {data.x_axis_label}
              </p>
            )}
          </div>
        ) : (
          // Vertical Bar Chart
          <div className="space-y-4">
            <div className="flex items-end justify-center gap-2 h-48">
              {data.data.map((item, index) => (
                <div key={index} className="flex flex-col items-center gap-2 flex-1 max-w-16">
                  {data.show_values && (
                    <span className="text-xs text-muted-foreground">
                      {formatValue(item.value)}
                    </span>
                  )}
                  <div className="relative w-full flex flex-col justify-end h-40">
                    <div
                      className="w-full rounded-t-md transition-all duration-500 ease-out"
                      style={{
                        height: `${getBarSize(item.value)}%`,
                        backgroundColor: getBarColor(index, item),
                        minHeight: item.value > 0 ? '4px' : '0px'
                      }}
                    />
                  </div>
                  <span className="text-xs text-center font-medium leading-tight">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            {data.x_axis_label && (
              <p className="text-sm font-medium text-muted-foreground text-center">
                {data.x_axis_label}
              </p>
            )}
          </div>
        )}

        {/* Legend */}
        {data.show_legend && data.data.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
            {data.data.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: getBarColor(index, item) }}
                />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
