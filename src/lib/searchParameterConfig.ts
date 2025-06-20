/**
 * Search Parameter Configuration Management
 * Manages dynamic search parameter configurations and A/B testing
 */

import { UnifiedSearchParams } from '@/types/unified-search';
import { supabase } from '@/integrations/supabase/client';

interface SearchParameterConfig {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  parameters: {
    similarityThreshold: number;
    limit: number;
    aggregationMode: 'relevance' | 'diversity' | 'recency';
    contentTypeWeights?: Record<string, number>;
    sourceWeights?: Record<string, number>;
  };
  targetScenarios: string[];
  performanceMetrics?: {
    averageResponseTime: number;
    averageRelevanceScore: number;
    cacheHitRate: number;
    userSatisfactionScore: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface ParameterTestResult {
  configId: string;
  testQuery: string;
  responseTime: number;
  resultCount: number;
  relevanceScore: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  controlConfig: string; // Config ID
  testConfig: string; // Config ID
  trafficSplit: number; // Percentage for test config (0-100)
  startDate: string;
  endDate?: string;
  metrics: {
    controlPerformance: number;
    testPerformance: number;
    statisticalSignificance: number;
  };
}

class SearchParameterConfigManager {
  private configs: Map<string, SearchParameterConfig> = new Map();
  private activeABTests: Map<string, ABTestConfig> = new Map();
  private testResults: ParameterTestResult[] = [];

  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default parameter configurations based on quality validation findings
   */
  private initializeDefaultConfigs(): void {
    const defaultConfigs: SearchParameterConfig[] = [
      {
        id: 'high_precision',
        name: 'High Precision Search',
        description: 'Optimized for exact matches and high-quality results',
        isActive: true,
        isDefault: false,
        parameters: {
          similarityThreshold: 0.7,
          limit: 15,
          aggregationMode: 'relevance',
          contentTypeWeights: {
            'title': 2.0,
            'merchant': 2.0,
            'keywords': 1.8,
            'description': 1.2,
            'full_text': 1.0
          },
          sourceWeights: {
            'custom_categories': 2.0, // Perfect exact matching
            'business_directory': 1.8,
            'receipts': 1.5,
            'claims': 1.2,
            'conversations': 1.0
          }
        },
        targetScenarios: ['exact_match', 'business_lookup', 'category_search'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'balanced_search',
        name: 'Balanced Search',
        description: 'Balanced configuration for general search scenarios',
        isActive: true,
        isDefault: true,
        parameters: {
          similarityThreshold: 0.2,
          limit: 20,
          aggregationMode: 'relevance',
          contentTypeWeights: {
            'full_text': 1.5,
            'title': 1.4,
            'description': 1.3,
            'merchant': 1.2,
            'keywords': 1.1
          },
          sourceWeights: {
            'business_directory': 1.8, // Excellent performance (0.7597 avg)
            'custom_categories': 1.6, // Good semantic relationships
            'receipts': 1.4,
            'claims': 1.2,
            'conversations': 1.0
          }
        },
        targetScenarios: ['general_search', 'semantic_search', 'multi_source'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'discovery_mode',
        name: 'Discovery Mode',
        description: 'Optimized for discovering related content and exploration',
        isActive: true,
        isDefault: false,
        parameters: {
          similarityThreshold: 0.15,
          limit: 30,
          aggregationMode: 'diversity',
          contentTypeWeights: {
            'description': 2.0,
            'full_text': 1.8,
            'keywords': 1.5,
            'title': 1.2,
            'merchant': 1.0
          },
          sourceWeights: {
            'business_directory': 2.0, // Best for discovery
            'custom_categories': 1.8,
            'conversations': 1.5, // Good for related discussions
            'receipts': 1.3,
            'claims': 1.2
          }
        },
        targetScenarios: ['exploration', 'related_content', 'broad_search'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'performance_optimized',
        name: 'Performance Optimized',
        description: 'Fast search with optimized parameters for speed',
        isActive: true,
        isDefault: false,
        parameters: {
          similarityThreshold: 0.4,
          limit: 12,
          aggregationMode: 'relevance',
          contentTypeWeights: {
            'title': 2.0,
            'keywords': 1.8,
            'merchant': 1.5,
            'description': 1.0,
            'full_text': 0.8
          },
          sourceWeights: {
            'custom_categories': 2.0, // Fastest with perfect results
            'business_directory': 1.6,
            'receipts': 1.0, // Slower due to content issues
            'claims': 0.8,
            'conversations': 0.6
          }
        },
        targetScenarios: ['quick_search', 'mobile_search', 'cached_search'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    defaultConfigs.forEach(config => {
      this.configs.set(config.id, config);
    });

    console.log(`🔧 Initialized ${defaultConfigs.length} search parameter configurations`);
  }

  /**
   * Get configuration by ID
   */
  getConfig(configId: string): SearchParameterConfig | null {
    return this.configs.get(configId) || null;
  }

  /**
   * Get default configuration
   */
  getDefaultConfig(): SearchParameterConfig {
    const defaultConfig = Array.from(this.configs.values()).find(config => config.isDefault);
    return defaultConfig || Array.from(this.configs.values())[0];
  }

  /**
   * Get configuration for specific scenario
   */
  getConfigForScenario(scenario: string): SearchParameterConfig {
    const matchingConfig = Array.from(this.configs.values()).find(config => 
      config.isActive && config.targetScenarios.includes(scenario)
    );
    
    return matchingConfig || this.getDefaultConfig();
  }

  /**
   * Apply configuration to search parameters
   */
  applyConfig(params: UnifiedSearchParams, configId?: string): UnifiedSearchParams {
    const config = configId ? this.getConfig(configId) : this.getDefaultConfig();
    
    if (!config) {
      console.warn('No configuration found, using original parameters');
      return params;
    }

    const appliedParams: UnifiedSearchParams = {
      ...params,
      similarityThreshold: config.parameters.similarityThreshold,
      limit: Math.min(params.limit || config.parameters.limit, config.parameters.limit),
      aggregationMode: config.parameters.aggregationMode
    };

    console.log(`🎯 Applied configuration "${config.name}" to search parameters`);
    return appliedParams;
  }

  /**
   * Record test result for performance analysis
   */
  recordTestResult(result: ParameterTestResult): void {
    this.testResults.push(result);
    
    // Keep only recent results (last 1000)
    if (this.testResults.length > 1000) {
      this.testResults = this.testResults.slice(-1000);
    }

    // Update configuration performance metrics
    this.updateConfigMetrics(result.configId);
  }

  /**
   * Update configuration performance metrics
   */
  private updateConfigMetrics(configId: string): void {
    const config = this.configs.get(configId);
    if (!config) return;

    const configResults = this.testResults.filter(r => r.configId === configId);
    if (configResults.length === 0) return;

    const metrics = {
      averageResponseTime: configResults.reduce((sum, r) => sum + r.responseTime, 0) / configResults.length,
      averageRelevanceScore: configResults.reduce((sum, r) => sum + r.relevanceScore, 0) / configResults.length,
      cacheHitRate: 0, // Would be calculated from cache metrics
      userSatisfactionScore: this.calculateSatisfactionScore(configResults)
    };

    config.performanceMetrics = metrics;
    config.updatedAt = new Date().toISOString();
    
    console.log(`📊 Updated metrics for config "${config.name}":`, metrics);
  }

  /**
   * Calculate user satisfaction score from feedback
   */
  private calculateSatisfactionScore(results: ParameterTestResult[]): number {
    const feedbackResults = results.filter(r => r.userFeedback);
    if (feedbackResults.length === 0) return 0;

    const positiveCount = feedbackResults.filter(r => r.userFeedback === 'positive').length;
    const neutralCount = feedbackResults.filter(r => r.userFeedback === 'neutral').length;
    
    // Weighted score: positive = 1, neutral = 0.5, negative = 0
    const score = (positiveCount + (neutralCount * 0.5)) / feedbackResults.length;
    return Math.round(score * 100) / 100;
  }

  /**
   * Get performance comparison between configurations
   */
  getPerformanceComparison(): Array<{
    configId: string;
    name: string;
    metrics: SearchParameterConfig['performanceMetrics'];
    testCount: number;
  }> {
    return Array.from(this.configs.values()).map(config => ({
      configId: config.id,
      name: config.name,
      metrics: config.performanceMetrics,
      testCount: this.testResults.filter(r => r.configId === config.id).length
    }));
  }

  /**
   * Create A/B test between two configurations
   */
  createABTest(testConfig: Omit<ABTestConfig, 'id' | 'metrics'>): string {
    const testId = `ab_test_${Date.now()}`;
    const abTest: ABTestConfig = {
      ...testConfig,
      id: testId,
      metrics: {
        controlPerformance: 0,
        testPerformance: 0,
        statisticalSignificance: 0
      }
    };

    this.activeABTests.set(testId, abTest);
    console.log(`🧪 Created A/B test "${testConfig.name}" with ID: ${testId}`);
    
    return testId;
  }

  /**
   * Get configuration for A/B test (returns test or control based on traffic split)
   */
  getABTestConfig(testId: string, userId: string): SearchParameterConfig | null {
    const abTest = this.activeABTests.get(testId);
    if (!abTest || !abTest.isActive) return null;

    // Simple hash-based assignment for consistent user experience
    const userHash = this.hashUserId(userId);
    const isTestGroup = userHash < abTest.trafficSplit;

    const configId = isTestGroup ? abTest.testConfig : abTest.controlConfig;
    return this.getConfig(configId);
  }

  /**
   * Simple hash function for user ID
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Update configuration
   */
  updateConfig(configId: string, updates: Partial<SearchParameterConfig>): boolean {
    const config = this.configs.get(configId);
    if (!config) return false;

    const updatedConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.configs.set(configId, updatedConfig);
    console.log(`🔧 Updated configuration "${config.name}"`);
    
    return true;
  }

  /**
   * Get all active configurations
   */
  getActiveConfigs(): SearchParameterConfig[] {
    return Array.from(this.configs.values()).filter(config => config.isActive);
  }

  /**
   * Export configurations for backup
   */
  exportConfigs(): SearchParameterConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Import configurations from backup
   */
  importConfigs(configs: SearchParameterConfig[]): void {
    configs.forEach(config => {
      this.configs.set(config.id, config);
    });
    console.log(`📥 Imported ${configs.length} configurations`);
  }
}

// Export singleton instance
export const searchParameterConfigManager = new SearchParameterConfigManager();
export type { SearchParameterConfig, ParameterTestResult, ABTestConfig };
