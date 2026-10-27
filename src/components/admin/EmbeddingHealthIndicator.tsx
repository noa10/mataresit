/**
 * Embedding Health Indicator
 * Visual indicator for embedding system health status
 */

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminTranslation } from '@/contexts/LanguageContext';

interface EmbeddingHealthIndicatorProps {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function EmbeddingHealthIndicator({ 
  status, 
  size = 'md', 
  showLabel = false,
  className 
}: EmbeddingHealthIndicatorProps) {
  const { t } = useAdminTranslation();
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          icon: CheckCircle,
          color: 'text-green-500 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-950/30',
          label: t('embeddingMetrics.common.healthy'),
          pulse: false
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-950/30',
          label: t('embeddingMetrics.common.warning'),
          pulse: true
        };
      case 'error':
        return {
          icon: XCircle,
          color: 'text-red-500 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-950/30',
          label: t('embeddingMetrics.common.error'),
          pulse: true
        };
      default:
        return {
          icon: Activity,
          color: 'text-gray-500 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-950/30',
          label: t('embeddingMetrics.common.unknown'),
          pulse: false
        };
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          container: 'w-6 h-6',
          icon: 'h-3 w-3',
          text: 'text-xs'
        };
      case 'lg':
        return {
          container: 'w-12 h-12',
          icon: 'h-6 w-6',
          text: 'text-base'
        };
      default:
        return {
          container: 'w-8 h-8',
          icon: 'h-4 w-4',
          text: 'text-sm'
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses = getSizeClasses(size);
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div 
        className={cn(
          'rounded-full flex items-center justify-center',
          config.bgColor,
          sizeClasses.container,
          config.pulse && 'animate-pulse'
        )}
      >
        <Icon className={cn(config.color, sizeClasses.icon)} />
      </div>
      {showLabel && (
        <span className={cn('font-medium', config.color, sizeClasses.text)}>
          {config.label}
        </span>
      )}
    </div>
  );
}
