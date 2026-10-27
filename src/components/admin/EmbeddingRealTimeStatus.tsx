/**
 * Embedding Real-time Status Indicator
 * Shows the status of real-time data connections and last update time
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 2
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  RefreshCw,
  Clock,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminTranslation } from '@/contexts/LanguageContext';

interface EmbeddingRealTimeStatusProps {
  isConnected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastUpdateTime: Date | null;
  enableRealTime: boolean;
  onToggleRealTime: (enabled: boolean) => void;
  className?: string;
}

export function EmbeddingRealTimeStatus({
  isConnected,
  status,
  lastUpdateTime,
  enableRealTime,
  onToggleRealTime,
  className
}: EmbeddingRealTimeStatusProps) {
  const { t, language } = useAdminTranslation();
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          badgeVariant: 'default' as const,
          label: t('embeddingMetrics.common.connected'),
          description: t('embeddingMetrics.realTime.connectedDescription')
        };
      case 'connecting':
        return {
          icon: RefreshCw,
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          badgeVariant: 'secondary' as const,
          label: t('embeddingMetrics.common.connecting'),
          description: t('embeddingMetrics.realTime.connectingDescription')
        };
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          badgeVariant: 'destructive' as const,
          label: t('embeddingMetrics.common.error'),
          description: t('embeddingMetrics.realTime.errorDescription')
        };
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          badgeVariant: 'outline' as const,
          label: t('embeddingMetrics.common.disconnected'),
          description: t('embeddingMetrics.realTime.disconnectedDescription')
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return t('embeddingMetrics.common.never');
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return t('embeddingMetrics.common.justNow');
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return t('embeddingMetrics.common.minutesAgo', { count: minutes });
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return t('embeddingMetrics.common.hoursAgo', { count: hours });
    } else {
      return date.toLocaleDateString(language === 'ms' ? 'ms-MY' : 'en-MY');
    }
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Real-time Toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={enableRealTime ? 'default' : 'outline'}
              size="sm"
              onClick={() => onToggleRealTime(!enableRealTime)}
              className={cn(
                'relative',
                enableRealTime && 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              <Zap className={cn(
                'h-4 w-4 mr-2',
                enableRealTime && status === 'connected' && 'animate-pulse'
              )} />
              {t('embeddingMetrics.realTime.realTime')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {enableRealTime
                ? t('embeddingMetrics.realTime.disableTooltip')
                : t('embeddingMetrics.realTime.enableTooltip')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Connection Status */}
      {enableRealTime && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  config.bgColor
                )}>
                  <Icon className={cn(
                    'h-4 w-4',
                    config.color,
                    status === 'connecting' && 'animate-spin'
                  )} />
                </div>
                <Badge variant={config.badgeVariant} className="text-xs">
                  {config.label}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{config.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Last Update Time */}
      {enableRealTime && isConnected && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono text-xs">
                  {formatLastUpdate(lastUpdateTime)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-medium">{t('embeddingMetrics.realTime.lastUpdate')}</p>
                {lastUpdateTime && (
                  <p className="text-xs text-muted-foreground">
                    {lastUpdateTime.toLocaleString(
                      language === 'ms' ? 'ms-MY' : 'en-MY'
                    )}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Connection Quality Indicator */}
      {enableRealTime && isConnected && (
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((bar) => (
            <div
              key={bar}
              className={cn(
                'w-1 rounded-full transition-all duration-300',
                bar === 1 ? 'h-2' : bar === 2 ? 'h-3' : 'h-4',
                status === 'connected' 
                  ? 'bg-green-500' 
                  : status === 'connecting'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-gray-300'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
