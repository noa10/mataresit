/**
 * Pie Chart UI Component for Chat Interface
 * 
 * Renders an interactive pie chart with legend and customizable styling.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChartData, UIComponentProps } from '@/types/ui-components';
import { formatCurrencySafe } from '@/utils/currency';

interface PieChartComponentProps extends Omit<UIComponentProps, 'component'> {
  data: PieChartData;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

export function PieChartComponent({ 
  data, 
  onAction, 
  className = '', 
  compact = false 
}: PieChartComponentProps) {
  // Default color scheme
  const defaultColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];

  const colors = data.color_scheme || defaultColors;
  const totalValue = data.data.reduce((sum, item) => sum + item.value, 0);

  // Calculate percentages if not provided
  const dataWithPercentages = data.data.map((item, index) => ({
    ...item,
    percentage: item.percentage || (totalValue > 0 ? (item.value / totalValue) * 100 : 0),
    color: item.color || colors[index % colors.length]
  }));

  // Format value for display
  const formatValue = (value: number) => {
    if (data.currency) {
      return formatCurrencySafe(value, data.currency, 'en-US', 'MYR');
    }
    return value.toLocaleString();
  };

  // Generate SVG path for pie slice
  const createPieSlice = (startAngle: number, endAngle: number, radius: number, innerRadius: number = 0) => {
    const start = polarToCartesian(50, 50, radius, endAngle);
    const end = polarToCartesian(50, 50, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    if (innerRadius > 0) {
      // Donut chart
      const innerStart = polarToCartesian(50, 50, innerRadius, endAngle);
      const innerEnd = polarToCartesian(50, 50, innerRadius, startAngle);
      
      return [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        "L", innerEnd.x, innerEnd.y,
        "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
        "Z"
      ].join(" ");
    } else {
      // Regular pie chart
      return [
        "M", 50, 50,
        "L", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        "Z"
      ].join(" ");
    }
  };

  // Convert polar coordinates to cartesian
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  // Generate pie slices
  let currentAngle = 0;
  const slices = dataWithPercentages.map((item, index) => {
    const sliceAngle = (item.percentage / 100) * 360;
    const slice = {
      ...item,
      startAngle: currentAngle,
      endAngle: currentAngle + sliceAngle,
      path: createPieSlice(currentAngle, currentAngle + sliceAngle, compact ? 35 : 40)
    };
    currentAngle += sliceAngle;
    return slice;
  });

  if (compact) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-3">
          {data.title && (
            <h4 className="font-medium text-sm mb-3">{data.title}</h4>
          )}
          <div className="flex items-center gap-3">
            {/* Mini Pie Chart */}
            <div className="flex-shrink-0">
              <svg width="80" height="80" viewBox="0 0 100 100" className="transform -rotate-90">
                {slices.map((slice, index) => (
                  <path
                    key={index}
                    d={slice.path}
                    fill={slice.color}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
                {data.center_total && (
                  <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-xs font-medium fill-current transform rotate-90"
                  >
                    {formatValue(totalValue)}
                  </text>
                )}
              </svg>
            </div>
            
            {/* Compact Legend */}
            <div className="flex-1 space-y-1">
              {dataWithPercentages.slice(0, 4).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="font-medium">
                    {data.show_percentages ? `${item.percentage.toFixed(1)}%` : formatValue(item.value)}
                  </span>
                </div>
              ))}
              {dataWithPercentages.length > 4 && (
                <p className="text-xs text-muted-foreground">
                  +{dataWithPercentages.length - 4} more
                </p>
              )}
            </div>
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
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Pie Chart */}
          <div className="flex-shrink-0">
            <div className="relative">
              <svg width="200" height="200" viewBox="0 0 100 100" className="transform -rotate-90">
                {slices.map((slice, index) => (
                  <path
                    key={index}
                    d={slice.path}
                    fill={slice.color}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    onClick={() => onAction?.('slice_click', { item: slice, index })}
                  />
                ))}
              </svg>
              
              {/* Center Total */}
              {data.center_total && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-lg font-bold">{formatValue(totalValue)}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          {data.show_legend && (
            <div className="flex-1 space-y-2">
              {dataWithPercentages.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <div className="text-right">
                    {data.show_values && (
                      <div className="font-medium">{formatValue(item.value)}</div>
                    )}
                    {data.show_percentages && (
                      <div className="text-sm text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
