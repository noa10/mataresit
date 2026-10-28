/**
 * Embedding Aggregation Controls
 * Manual controls for triggering embedding metrics aggregations
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Clock, 
  Calendar, 
  Trash2, 
  RefreshCw,
  ChevronDown,
  Zap
} from 'lucide-react';
import { EmbeddingAggregationResult } from '@/types/embedding-metrics';
import { toast } from 'sonner';
import { useAdminTranslation } from '@/contexts/LanguageContext';

interface EmbeddingAggregationControlsProps {
  onTrigger: (type: 'hourly' | 'daily' | 'cleanup' | 'all') => Promise<EmbeddingAggregationResult>;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function EmbeddingAggregationControls({ 
  onTrigger, 
  disabled = false,
  size = 'md'
}: EmbeddingAggregationControlsProps) {
  const { t } = useAdminTranslation();
  const [isRunning, setIsRunning] = useState<string | null>(null);

  const aggregationTypes = [
    {
      key: 'hourly' as const,
      label: t('embeddingMetrics.aggregation.hourlyStats'),
      description: t('embeddingMetrics.aggregation.hourlyStatsDescription'),
      icon: Clock,
      color: 'text-blue-500'
    },
    {
      key: 'daily' as const,
      label: t('embeddingMetrics.aggregation.dailyStats'),
      description: t('embeddingMetrics.aggregation.dailyStatsDescription'),
      icon: Calendar,
      color: 'text-green-500'
    },
    {
      key: 'cleanup' as const,
      label: t('embeddingMetrics.aggregation.cleanup'),
      description: t('embeddingMetrics.aggregation.cleanupDescription'),
      icon: Trash2,
      color: 'text-orange-500'
    },
    {
      key: 'all' as const,
      label: t('embeddingMetrics.aggregation.allOperations'),
      description: t('embeddingMetrics.aggregation.allOperationsDescription'),
      icon: Zap,
      color: 'text-purple-500'
    }
  ];

  const handleTrigger = async (type: 'hourly' | 'daily' | 'cleanup' | 'all') => {
    if (isRunning || disabled) return;

    setIsRunning(type);
    
    try {
      const result = await onTrigger(type);
      
      const typeName = t(`embeddingMetrics.aggregation.typeNames.${type}`, {
        defaultValue: type,
      });

      if (result.success) {
        toast.success(
          t('embeddingMetrics.aggregation.completedSuccess', { type: typeName }),
          {
            description: t('embeddingMetrics.aggregation.completedDescription', {
              successful: result.summary.successful,
              total: result.summary.totalOperations,
              duration: result.summary.totalExecutionTime,
            }),
          }
        );
      } else {
        toast.error(
          t('embeddingMetrics.aggregation.failed', { type: typeName })
        );
      }
    } catch (error) {
      toast.error(
        t('embeddingMetrics.aggregation.triggerFailed', {
          type: t(`embeddingMetrics.aggregation.typeNames.${type}`, {
            defaultValue: type,
          }),
        })
      );
    } finally {
      setIsRunning(null);
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case 'sm': return 'sm';
      case 'lg': return 'lg';
      default: return 'default';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Quick All Operations Button */}
      <Button
        onClick={() => handleTrigger('all')}
        disabled={disabled || isRunning !== null}
        size={getButtonSize()}
        className="relative"
      >
        {isRunning === 'all' ? (
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        {isRunning === 'all'
          ? t('embeddingMetrics.aggregation.runningAction')
          : t('embeddingMetrics.aggregation.runAll')}
      </Button>

      {/* Dropdown for Individual Operations */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled || isRunning !== null}
            size={getButtonSize()}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {aggregationTypes.map((type) => {
            const Icon = type.icon;
            const isCurrentlyRunning = isRunning === type.key;
            
            return (
              <DropdownMenuItem
                key={type.key}
                onClick={() => handleTrigger(type.key)}
                disabled={disabled || isRunning !== null}
                className="flex items-start gap-3 p-3"
              >
                <div className={`mt-0.5 ${type.color}`}>
                  {isCurrentlyRunning ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.label}</span>
                    {isCurrentlyRunning && (
                      <Badge variant="secondary" className="text-xs">
                        {t('embeddingMetrics.aggregation.runningBadge')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type.description}
                  </p>
                </div>
              </DropdownMenuItem>
            );
          })}
          
          <DropdownMenuSeparator />
          
          <div className="p-3 text-xs text-muted-foreground">
            <p>{t('embeddingMetrics.aggregation.info')}</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status Indicator */}
      {isRunning && (
        <Badge variant="secondary" className="animate-pulse">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          {t(`embeddingMetrics.aggregation.typeNames.${isRunning}`, {
            defaultValue: isRunning ?? '',
          })}
        </Badge>
      )}
    </div>
  );
}
