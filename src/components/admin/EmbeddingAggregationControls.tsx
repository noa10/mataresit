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
  const [isRunning, setIsRunning] = useState<string | null>(null);

  const aggregationTypes = [
    {
      key: 'hourly' as const,
      label: 'Hourly Stats',
      description: 'Aggregate metrics for the previous hour',
      icon: Clock,
      color: 'text-blue-500'
    },
    {
      key: 'daily' as const,
      label: 'Daily Stats',
      description: 'Aggregate metrics for the previous day',
      icon: Calendar,
      color: 'text-green-500'
    },
    {
      key: 'cleanup' as const,
      label: 'Cleanup',
      description: 'Remove old metrics data',
      icon: Trash2,
      color: 'text-orange-500'
    },
    {
      key: 'all' as const,
      label: 'All Operations',
      description: 'Run all aggregation operations',
      icon: Zap,
      color: 'text-purple-500'
    }
  ];

  const handleTrigger = async (type: 'hourly' | 'daily' | 'cleanup' | 'all') => {
    if (isRunning || disabled) return;

    setIsRunning(type);
    
    try {
      const result = await onTrigger(type);
      
      if (result.success) {
        toast.success(
          `${type} aggregation completed successfully`,
          {
            description: `${result.summary.successful}/${result.summary.totalOperations} operations completed in ${result.summary.totalExecutionTime}ms`
          }
        );
      } else {
        toast.error(`${type} aggregation failed`);
      }
    } catch (error) {
      toast.error(`Failed to trigger ${type} aggregation`);
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
        {isRunning === 'all' ? 'Running...' : 'Run All'}
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
                        Running
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
            <p>Aggregations process raw metrics into hourly and daily summaries for better performance.</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status Indicator */}
      {isRunning && (
        <Badge variant="secondary" className="animate-pulse">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          {isRunning}
        </Badge>
      )}
    </div>
  );
}
