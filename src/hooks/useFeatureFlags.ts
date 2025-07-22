// React Hook for Feature Flag Management
// Provides easy access to feature flags in React components

import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { FeatureFlagService } from '@/lib/feature-flags/manager';
import { FeatureFlagEvaluation, EvaluationContext } from '@/lib/feature-flags/types';
import { Phase5FeatureFlagEvaluator, PHASE5_FEATURE_FLAGS } from '@/lib/feature-flags/phase5-flags';

// Feature Flag Context
interface FeatureFlagContextType {
  flagService: FeatureFlagService | null;
  evaluator: Phase5FeatureFlagEvaluator | null;
  isInitialized: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flagService: null,
  evaluator: null,
  isInitialized: false
});

// Feature Flag Provider Component
interface FeatureFlagProviderProps {
  children: React.ReactNode;
  supabaseUrl: string;
  supabaseKey: string;
  userId: string;
}

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({
  children,
  supabaseUrl,
  supabaseKey,
  userId
}) => {
  const [flagService, setFlagService] = useState<FeatureFlagService | null>(null);
  const [evaluator, setEvaluator] = useState<Phase5FeatureFlagEvaluator | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const service = new FeatureFlagService(supabaseUrl, supabaseKey, userId);
    const eval = new Phase5FeatureFlagEvaluator(service);
    
    setFlagService(service);
    setEvaluator(eval);
    setIsInitialized(true);
  }, [supabaseUrl, supabaseKey, userId]);

  return (
    <FeatureFlagContext.Provider value={{ flagService, evaluator, isInitialized }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

// Hook for accessing feature flag context
export const useFeatureFlagContext = () => {
  const context = useContext(FeatureFlagContext);
  if (!context.isInitialized) {
    throw new Error('useFeatureFlagContext must be used within a FeatureFlagProvider');
  }
  return context;
};

// Main Feature Flag Hook
interface UseFeatureFlagOptions {
  userId?: string;
  teamId?: string;
  userAttributes?: Record<string, any>;
  teamAttributes?: Record<string, any>;
  customAttributes?: Record<string, any>;
  refreshInterval?: number; // Auto-refresh interval in milliseconds
}

interface UseFeatureFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  evaluation: FeatureFlagEvaluation | null;
  refresh: () => Promise<void>;
}

export const useFeatureFlag = (
  flagName: string,
  options: UseFeatureFlagOptions = {}
): UseFeatureFlagResult => {
  const { flagService } = useFeatureFlagContext();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<FeatureFlagEvaluation | null>(null);

  const evaluateFlag = useCallback(async () => {
    if (!flagService) return;

    try {
      setIsLoading(true);
      setError(null);

      const context: EvaluationContext = {
        userId: options.userId,
        teamId: options.teamId,
        userAttributes: options.userAttributes,
        teamAttributes: options.teamAttributes,
        customAttributes: options.customAttributes,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      };

      const result = await flagService.evaluateFlag(flagName, context);
      
      setEvaluation(result);
      setIsEnabled(result.enabled);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to evaluate feature flag';
      setError(errorMessage);
      setIsEnabled(false); // Default to disabled on error
    } finally {
      setIsLoading(false);
    }
  }, [flagService, flagName, options]);

  useEffect(() => {
    evaluateFlag();
  }, [evaluateFlag]);

  // Auto-refresh if interval is specified
  useEffect(() => {
    if (!options.refreshInterval) return;

    const interval = setInterval(evaluateFlag, options.refreshInterval);
    return () => clearInterval(interval);
  }, [evaluateFlag, options.refreshInterval]);

  return {
    isEnabled,
    isLoading,
    error,
    evaluation,
    refresh: evaluateFlag
  };
};

// Hook for Phase 5 specific feature flags
interface UsePhase5FlagsResult {
  embeddingMonitoring: UseFeatureFlagResult;
  queueBasedProcessing: UseFeatureFlagResult;
  batchOptimization: UseFeatureFlagResult;
  isLoading: boolean;
  hasAnyEnabled: boolean;
  refresh: () => Promise<void>;
}

export const usePhase5Flags = (
  options: UseFeatureFlagOptions = {}
): UsePhase5FlagsResult => {
  const embeddingMonitoring = useFeatureFlag(PHASE5_FEATURE_FLAGS.EMBEDDING_MONITORING, options);
  const queueBasedProcessing = useFeatureFlag(PHASE5_FEATURE_FLAGS.QUEUE_BASED_PROCESSING, options);
  const batchOptimization = useFeatureFlag(PHASE5_FEATURE_FLAGS.BATCH_OPTIMIZATION, options);

  const isLoading = embeddingMonitoring.isLoading || queueBasedProcessing.isLoading || batchOptimization.isLoading;
  const hasAnyEnabled = embeddingMonitoring.isEnabled || queueBasedProcessing.isEnabled || batchOptimization.isEnabled;

  const refresh = useCallback(async () => {
    await Promise.all([
      embeddingMonitoring.refresh(),
      queueBasedProcessing.refresh(),
      batchOptimization.refresh()
    ]);
  }, [embeddingMonitoring.refresh, queueBasedProcessing.refresh, batchOptimization.refresh]);

  return {
    embeddingMonitoring,
    queueBasedProcessing,
    batchOptimization,
    isLoading,
    hasAnyEnabled,
    refresh
  };
};

// Hook for multiple feature flags
export const useFeatureFlags = (
  flagNames: string[],
  options: UseFeatureFlagOptions = {}
): Record<string, UseFeatureFlagResult> => {
  const results: Record<string, UseFeatureFlagResult> = {};

  flagNames.forEach(flagName => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[flagName] = useFeatureFlag(flagName, options);
  });

  return results;
};

// Hook for feature flag management (admin operations)
interface UseFeatureFlagManagementResult {
  flags: any[];
  loading: boolean;
  error: string | null;
  createFlag: (flag: any) => Promise<void>;
  updateFlag: (id: string, updates: any) => Promise<void>;
  deleteFlag: (id: string) => Promise<void>;
  updateRollout: (id: string, percentage: number) => Promise<void>;
  toggleFlag: (id: string, enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useFeatureFlagManagement = (): UseFeatureFlagManagementResult => {
  const { flagService } = useFeatureFlagContext();
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    if (!flagService) return;

    try {
      setLoading(true);
      setError(null);
      const flagList = await flagService.listFlags();
      setFlags(flagList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, [flagService]);

  const createFlag = useCallback(async (flag: any) => {
    if (!flagService) return;

    try {
      await flagService.createFlag(flag);
      await loadFlags();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create feature flag');
    }
  }, [flagService, loadFlags]);

  const updateFlag = useCallback(async (id: string, updates: any) => {
    if (!flagService) return;

    try {
      await flagService.updateFlag(id, updates);
      await loadFlags();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update feature flag');
    }
  }, [flagService, loadFlags]);

  const deleteFlag = useCallback(async (id: string) => {
    if (!flagService) return;

    try {
      await flagService.deleteFlag(id);
      await loadFlags();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete feature flag');
    }
  }, [flagService, loadFlags]);

  const updateRollout = useCallback(async (id: string, percentage: number) => {
    if (!flagService) return;

    try {
      await flagService.updateRolloutPercentage(id, percentage);
      await loadFlags();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update rollout percentage');
    }
  }, [flagService, loadFlags]);

  const toggleFlag = useCallback(async (id: string, enabled: boolean) => {
    if (!flagService) return;

    try {
      await flagService.updateFlag(id, { enabled });
      await loadFlags();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to toggle feature flag');
    }
  }, [flagService, loadFlags]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  return {
    flags,
    loading,
    error,
    createFlag,
    updateFlag,
    deleteFlag,
    updateRollout,
    toggleFlag,
    refresh: loadFlags
  };
};

// Utility hook for conditional rendering based on feature flags
export const useFeatureFlagGuard = (
  flagName: string,
  options: UseFeatureFlagOptions = {}
) => {
  const { isEnabled, isLoading } = useFeatureFlag(flagName, options);

  const FeatureGuard: React.FC<{ 
    children: React.ReactNode; 
    fallback?: React.ReactNode;
    showLoading?: boolean;
  }> = ({ children, fallback = null, showLoading = false }) => {
    if (isLoading && showLoading) {
      return <div>Loading...</div>;
    }

    if (isEnabled) {
      return <>{children}</>;
    }

    return <>{fallback}</>;
  };

  return { FeatureGuard, isEnabled, isLoading };
};

// Hook for feature flag analytics
interface UseFeatureFlagAnalyticsResult {
  usageStats: any | null;
  auditLog: any[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useFeatureFlagAnalytics = (
  flagId: string,
  timeRange?: { start: string; end: string }
): UseFeatureFlagAnalyticsResult => {
  const { flagService } = useFeatureFlagContext();
  const [usageStats, setUsageStats] = useState<any | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!flagService) return;

    try {
      setLoading(true);
      setError(null);

      const [stats, audit] = await Promise.all([
        flagService.getUsageStats(flagId, timeRange),
        flagService.getAuditLog(flagId, timeRange)
      ]);

      setUsageStats(stats);
      setAuditLog(audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [flagService, flagId, timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    usageStats,
    auditLog,
    loading,
    error,
    refresh: loadAnalytics
  };
};
