/**
 * React Hook for Search Parameter Optimization
 * Provides search parameter optimization and configuration management
 */

import { useState, useEffect, useCallback } from 'react';
import { UnifiedSearchParams } from '@/types/unified-search';
import { searchParameterOptimizer } from '@/lib/searchParameterOptimizer';
import { searchParameterConfigManager } from '@/lib/searchParameterConfig';
import type { 
  ParameterOptimizationResult, 
  SearchContext 
} from '@/lib/searchParameterOptimizer';
import type { 
  SearchParameterConfig, 
  ParameterTestResult 
} from '@/lib/searchParameterConfig';

interface OptimizationState {
  // Current optimization
  currentOptimization: ParameterOptimizationResult | null;
  
  // Available configurations
  availableConfigs: SearchParameterConfig[];
  defaultConfig: SearchParameterConfig | null;
  
  // Performance data
  performanceComparison: Array<{
    configId: string;
    name: string;
    metrics: SearchParameterConfig['performanceMetrics'];
    testCount: number;
  }>;
  
  // A/B testing
  activeABTests: string[];
  
  // Loading states
  loading: boolean;
  error: string | null;
}

interface UseSearchParameterOptimizationReturn extends OptimizationState {
  // Optimization functions
  optimizeParameters: (params: UnifiedSearchParams) => ParameterOptimizationResult;
  applyConfiguration: (params: UnifiedSearchParams, configId?: string) => UnifiedSearchParams;
  
  // Configuration management
  getConfigForScenario: (scenario: string) => SearchParameterConfig;
  updateConfiguration: (configId: string, updates: Partial<SearchParameterConfig>) => boolean;
  
  // Performance tracking
  recordTestResult: (result: ParameterTestResult) => void;
  refreshPerformanceData: () => void;
  
  // A/B testing
  createABTest: (testConfig: any) => string;
  getABTestConfig: (testId: string, userId: string) => SearchParameterConfig | null;
  
  // Analytics
  getOptimizationInsights: () => {
    bestPerformingConfig: string;
    averageImprovement: number;
    recommendedActions: string[];
  };
}

export function useSearchParameterOptimization(): UseSearchParameterOptimizationReturn {
  const [state, setState] = useState<OptimizationState>({
    currentOptimization: null,
    availableConfigs: [],
    defaultConfig: null,
    performanceComparison: [],
    activeABTests: [],
    loading: false,
    error: null
  });

  /**
   * Initialize configurations and load performance data
   */
  useEffect(() => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Load available configurations
      const configs = searchParameterConfigManager.getActiveConfigs();
      const defaultConfig = searchParameterConfigManager.getDefaultConfig();
      const performanceComparison = searchParameterConfigManager.getPerformanceComparison();

      setState(prev => ({
        ...prev,
        availableConfigs: configs,
        defaultConfig,
        performanceComparison,
        loading: false
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize optimization'
      }));
    }
  }, []);

  /**
   * Optimize search parameters
   */
  const optimizeParameters = useCallback((params: UnifiedSearchParams): ParameterOptimizationResult => {
    try {
      const result = searchParameterOptimizer.optimizeParameters(params);
      
      setState(prev => ({
        ...prev,
        currentOptimization: result,
        error: null
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Optimization failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      
      // Return safe defaults
      return {
        optimizedParams: params,
        optimizationReason: 'Using original parameters due to optimization error',
        expectedImprovements: [],
        confidenceScore: 0.5
      };
    }
  }, []);

  /**
   * Apply specific configuration to parameters
   */
  const applyConfiguration = useCallback((
    params: UnifiedSearchParams, 
    configId?: string
  ): UnifiedSearchParams => {
    try {
      return searchParameterConfigManager.applyConfig(params, configId);
    } catch (error) {
      console.error('Failed to apply configuration:', error);
      return params;
    }
  }, []);

  /**
   * Get configuration for specific scenario
   */
  const getConfigForScenario = useCallback((scenario: string): SearchParameterConfig => {
    return searchParameterConfigManager.getConfigForScenario(scenario);
  }, []);

  /**
   * Update configuration
   */
  const updateConfiguration = useCallback((
    configId: string, 
    updates: Partial<SearchParameterConfig>
  ): boolean => {
    try {
      const success = searchParameterConfigManager.updateConfig(configId, updates);
      
      if (success) {
        // Refresh configurations
        const configs = searchParameterConfigManager.getActiveConfigs();
        setState(prev => ({ ...prev, availableConfigs: configs }));
      }
      
      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update configuration'
      }));
      return false;
    }
  }, []);

  /**
   * Record test result for performance analysis
   */
  const recordTestResult = useCallback((result: ParameterTestResult): void => {
    try {
      searchParameterConfigManager.recordTestResult(result);
      
      // Refresh performance data
      const performanceComparison = searchParameterConfigManager.getPerformanceComparison();
      setState(prev => ({ ...prev, performanceComparison }));
      
    } catch (error) {
      console.error('Failed to record test result:', error);
    }
  }, []);

  /**
   * Refresh performance data
   */
  const refreshPerformanceData = useCallback(() => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const performanceComparison = searchParameterConfigManager.getPerformanceComparison();
      
      setState(prev => ({
        ...prev,
        performanceComparison,
        loading: false,
        error: null
      }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh performance data'
      }));
    }
  }, []);

  /**
   * Create A/B test
   */
  const createABTest = useCallback((testConfig: any): string => {
    try {
      const testId = searchParameterConfigManager.createABTest(testConfig);
      
      setState(prev => ({
        ...prev,
        activeABTests: [...prev.activeABTests, testId]
      }));
      
      return testId;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create A/B test'
      }));
      return '';
    }
  }, []);

  /**
   * Get A/B test configuration
   */
  const getABTestConfig = useCallback((
    testId: string, 
    userId: string
  ): SearchParameterConfig | null => {
    try {
      return searchParameterConfigManager.getABTestConfig(testId, userId);
    } catch (error) {
      console.error('Failed to get A/B test config:', error);
      return null;
    }
  }, []);

  /**
   * Get optimization insights and recommendations
   */
  const getOptimizationInsights = useCallback(() => {
    try {
      const { performanceComparison } = state;
      
      if (performanceComparison.length === 0) {
        return {
          bestPerformingConfig: 'balanced_search',
          averageImprovement: 0,
          recommendedActions: ['Collect more performance data to generate insights']
        };
      }

      // Find best performing configuration
      const bestConfig = performanceComparison.reduce((best, current) => {
        const currentScore = (current.metrics?.averageRelevanceScore || 0) * 0.6 + 
                           (1 / (current.metrics?.averageResponseTime || 1000)) * 0.4;
        const bestScore = (best.metrics?.averageRelevanceScore || 0) * 0.6 + 
                         (1 / (best.metrics?.averageResponseTime || 1000)) * 0.4;
        
        return currentScore > bestScore ? current : best;
      });

      // Calculate average improvement
      const avgResponseTime = performanceComparison.reduce((sum, config) => 
        sum + (config.metrics?.averageResponseTime || 0), 0) / performanceComparison.length;
      
      const avgRelevanceScore = performanceComparison.reduce((sum, config) => 
        sum + (config.metrics?.averageRelevanceScore || 0), 0) / performanceComparison.length;

      const bestResponseTime = bestConfig.metrics?.averageResponseTime || avgResponseTime;
      const bestRelevanceScore = bestConfig.metrics?.averageRelevanceScore || avgRelevanceScore;

      const responseTimeImprovement = ((avgResponseTime - bestResponseTime) / avgResponseTime) * 100;
      const relevanceImprovement = ((bestRelevanceScore - avgRelevanceScore) / avgRelevanceScore) * 100;
      const averageImprovement = (responseTimeImprovement + relevanceImprovement) / 2;

      // Generate recommendations
      const recommendedActions: string[] = [];
      
      if (averageImprovement > 10) {
        recommendedActions.push(`Switch to "${bestConfig.name}" configuration for better performance`);
      }
      
      if (avgResponseTime > 500) {
        recommendedActions.push('Consider using performance-optimized configuration for faster searches');
      }
      
      if (avgRelevanceScore < 0.7) {
        recommendedActions.push('Review similarity thresholds to improve search relevance');
      }
      
      const lowTestCountConfigs = performanceComparison.filter(c => c.testCount < 10);
      if (lowTestCountConfigs.length > 0) {
        recommendedActions.push('Collect more test data for configurations with limited samples');
      }

      if (recommendedActions.length === 0) {
        recommendedActions.push('Current configurations are performing well. Continue monitoring.');
      }

      return {
        bestPerformingConfig: bestConfig.configId,
        averageImprovement: Math.round(averageImprovement * 100) / 100,
        recommendedActions
      };

    } catch (error) {
      console.error('Failed to generate optimization insights:', error);
      return {
        bestPerformingConfig: 'balanced_search',
        averageImprovement: 0,
        recommendedActions: ['Error generating insights. Please check configuration data.']
      };
    }
  }, [state]);

  return {
    ...state,
    optimizeParameters,
    applyConfiguration,
    getConfigForScenario,
    updateConfiguration,
    recordTestResult,
    refreshPerformanceData,
    createABTest,
    getABTestConfig,
    getOptimizationInsights
  };
}

export default useSearchParameterOptimization;
