/**
 * Status Indicator Component
 * 
 * Provides real-time status updates during chat operations
 * with progress tracking and smooth animations.
 */

import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Brain, 
  Database, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  MessageSquare,
  BarChart3,
  Sparkles
} from 'lucide-react';

export type StatusStage = 
  | 'idle'
  | 'preprocessing'
  | 'searching'
  | 'ranking'
  | 'generating'
  | 'complete'
  | 'error';

export interface StatusUpdate {
  stage: StatusStage;
  message: string;
  progress?: number;
  details?: string;
  timestamp?: number;
}

interface StatusIndicatorProps {
  status: StatusUpdate;
  showProgress?: boolean;
  showDetails?: boolean;
  className?: string;
  compact?: boolean;
}

// Status configuration with icons, colors, and messages
const STATUS_CONFIG = {
  idle: {
    icon: MessageSquare,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    message: 'Ready to help',
    description: 'Type your question to get started'
  },
  preprocessing: {
    icon: Brain,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    message: 'Understanding your question',
    description: 'Analyzing intent and extracting key information'
  },
  searching: {
    icon: Search,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    message: 'Searching through your data',
    description: 'Finding relevant receipts and information'
  },
  ranking: {
    icon: BarChart3,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    message: 'Ranking results',
    description: 'Organizing the most relevant information'
  },
  generating: {
    icon: Sparkles,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    message: 'Generating response',
    description: 'Creating a personalized answer for you'
  },
  complete: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    message: 'Complete',
    description: 'Response generated successfully'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    message: 'Something went wrong',
    description: 'Please try again or rephrase your question'
  }
};

// Progress mapping for different stages
const STAGE_PROGRESS = {
  idle: 0,
  preprocessing: 20,
  searching: 40,
  ranking: 70,
  generating: 90,
  complete: 100,
  error: 0
};

export function StatusIndicator({
  status,
  showProgress = true,
  showDetails = true,
  className = '',
  compact = false
}: StatusIndicatorProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const config = STATUS_CONFIG[status.stage];
  const targetProgress = status.progress ?? STAGE_PROGRESS[status.stage];

  // Animate progress changes
  useEffect(() => {
    if (targetProgress !== displayProgress) {
      setIsAnimating(true);
      
      const duration = 500; // Animation duration in ms
      const steps = 20;
      const stepSize = (targetProgress - displayProgress) / steps;
      const stepDuration = duration / steps;

      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        
        if (currentStep >= steps) {
          setDisplayProgress(targetProgress);
          setIsAnimating(false);
          clearInterval(interval);
        } else {
          setDisplayProgress(prev => prev + stepSize);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    }
  }, [targetProgress, displayProgress]);

  const IconComponent = config.icon;
  const isLoading = ['preprocessing', 'searching', 'ranking', 'generating'].includes(status.stage);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="relative">
          {isLoading ? (
            <Loader2 className={`h-4 w-4 animate-spin ${config.color}`} />
          ) : (
            <IconComponent className={`h-4 w-4 ${config.color}`} />
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {status.message || config.message}
        </span>
        {showProgress && isLoading && (
          <div className="w-16">
            <Progress value={displayProgress} className="h-1" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Status Header */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${config.bgColor} transition-all duration-300`}>
          {isLoading ? (
            <Loader2 className={`h-5 w-5 animate-spin ${config.color}`} />
          ) : (
            <IconComponent className={`h-5 w-5 ${config.color}`} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">
              {status.message || config.message}
            </h4>
            <Badge 
              variant={status.stage === 'error' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {status.stage.charAt(0).toUpperCase() + status.stage.slice(1)}
            </Badge>
          </div>
          
          {showDetails && (
            <p className="text-xs text-muted-foreground mt-1">
              {status.details || config.description}
            </p>
          )}
        </div>

        {/* Timestamp */}
        {status.timestamp && (
          <div className="text-xs text-muted-foreground">
            {new Date(status.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && status.stage !== 'idle' && status.stage !== 'error' && (
        <div className="space-y-1">
          <Progress 
            value={displayProgress} 
            className={`h-2 transition-all duration-300 ${isAnimating ? 'animate-pulse' : ''}`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(displayProgress)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Status Indicator Hook for managing status updates
 */
export function useStatusIndicator(initialStatus: StatusStage = 'idle') {
  const [status, setStatus] = useState<StatusUpdate>({
    stage: initialStatus,
    message: STATUS_CONFIG[initialStatus].message,
    timestamp: Date.now()
  });

  const updateStatus = (
    stage: StatusStage, 
    message?: string, 
    details?: string, 
    progress?: number
  ) => {
    setStatus({
      stage,
      message: message || STATUS_CONFIG[stage].message,
      details: details || STATUS_CONFIG[stage].description,
      progress,
      timestamp: Date.now()
    });
  };

  const resetStatus = () => {
    updateStatus('idle');
  };

  const setError = (message?: string, details?: string) => {
    updateStatus('error', message, details);
  };

  const setComplete = (message?: string, details?: string) => {
    updateStatus('complete', message, details);
  };

  return {
    status,
    updateStatus,
    resetStatus,
    setError,
    setComplete
  };
}

/**
 * Multi-Step Status Indicator for complex operations
 */
interface MultiStepStatusProps {
  steps: Array<{
    stage: StatusStage;
    label: string;
    description?: string;
  }>;
  currentStep: number;
  className?: string;
}

export function MultiStepStatus({ steps, currentStep, className = '' }: MultiStepStatusProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const config = STATUS_CONFIG[step.stage];
        const IconComponent = config.icon;

        return (
          <div 
            key={index}
            className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
              isActive ? config.bgColor : isCompleted ? 'bg-green-50' : 'bg-muted/30'
            }`}
          >
            <div className={`p-1 rounded-full ${
              isCompleted ? 'bg-green-100' : isActive ? config.bgColor : 'bg-muted'
            }`}>
              {isActive ? (
                <Loader2 className={`h-4 w-4 animate-spin ${config.color}`} />
              ) : isCompleted ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1">
              <div className={`text-sm font-medium ${
                isActive ? config.color : isCompleted ? 'text-green-600' : 'text-muted-foreground'
              }`}>
                {step.label}
              </div>
              {step.description && (
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              )}
            </div>

            {isCompleted && (
              <Badge variant="secondary" className="text-xs">
                Done
              </Badge>
            )}
            {isActive && (
              <Badge className="text-xs">
                Active
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
