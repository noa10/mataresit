// Feature Flag Configuration
// Environment-specific configuration and initialization

import { FeatureFlagService } from './manager';
import { 
  createEmbeddingMonitoringFlag, 
  createQueueProcessingFlag, 
  createBatchOptimizationFlag,
  Phase5FeatureFlagEvaluator,
  Phase5RolloutManager
} from './phase5-flags';

// Environment Configuration
export interface FeatureFlagConfig {
  supabaseUrl: string;
  supabaseKey: string;
  environment: 'development' | 'staging' | 'production';
  userId: string;
  cacheEnabled: boolean;
  cacheTTL: number;
  autoRefreshInterval?: number;
  enableAnalytics: boolean;
  enableAuditLog: boolean;
  maxRolloutPercentage: number;
  requireApprovalForProduction: boolean;
}

// Default configurations by environment
export const getDefaultConfig = (environment: string): Partial<FeatureFlagConfig> => {
  const baseConfig = {
    cacheEnabled: true,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    enableAnalytics: true,
    enableAuditLog: true,
  };

  switch (environment) {
    case 'development':
      return {
        ...baseConfig,
        maxRolloutPercentage: 100,
        requireApprovalForProduction: false,
        autoRefreshInterval: 30 * 1000, // 30 seconds
      };
    
    case 'staging':
      return {
        ...baseConfig,
        maxRolloutPercentage: 100,
        requireApprovalForProduction: true,
        autoRefreshInterval: 60 * 1000, // 1 minute
      };
    
    case 'production':
      return {
        ...baseConfig,
        maxRolloutPercentage: 100,
        requireApprovalForProduction: true,
        autoRefreshInterval: 5 * 60 * 1000, // 5 minutes
      };
    
    default:
      return baseConfig;
  }
};

// Feature Flag Manager Factory
export class FeatureFlagManagerFactory {
  private static instance: FeatureFlagService | null = null;
  private static evaluator: Phase5FeatureFlagEvaluator | null = null;
  private static rolloutManager: Phase5RolloutManager | null = null;

  static initialize(config: FeatureFlagConfig): FeatureFlagService {
    if (!this.instance) {
      this.instance = new FeatureFlagService(
        config.supabaseUrl,
        config.supabaseKey,
        config.userId
      );
      
      this.evaluator = new Phase5FeatureFlagEvaluator(this.instance);
      this.rolloutManager = new Phase5RolloutManager(this.instance);
    }
    
    return this.instance;
  }

  static getInstance(): FeatureFlagService {
    if (!this.instance) {
      throw new Error('FeatureFlagManager not initialized. Call initialize() first.');
    }
    return this.instance;
  }

  static getEvaluator(): Phase5FeatureFlagEvaluator {
    if (!this.evaluator) {
      throw new Error('FeatureFlagEvaluator not initialized. Call initialize() first.');
    }
    return this.evaluator;
  }

  static getRolloutManager(): Phase5RolloutManager {
    if (!this.rolloutManager) {
      throw new Error('RolloutManager not initialized. Call initialize() first.');
    }
    return this.rolloutManager;
  }

  static reset(): void {
    this.instance = null;
    this.evaluator = null;
    this.rolloutManager = null;
  }
}

// Environment Variable Integration
export const getFeatureFlagConfigFromEnv = (): Partial<FeatureFlagConfig> => {
  return {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_ANON_KEY || '',
    environment: (process.env.NODE_ENV as any) || 'development',
    cacheEnabled: process.env.FEATURE_FLAG_CACHE_ENABLED !== 'false',
    cacheTTL: parseInt(process.env.FEATURE_FLAG_CACHE_TTL || '300000'), // 5 minutes
    enableAnalytics: process.env.FEATURE_FLAG_ANALYTICS_ENABLED !== 'false',
    enableAuditLog: process.env.FEATURE_FLAG_AUDIT_LOG_ENABLED !== 'false',
    maxRolloutPercentage: parseInt(process.env.FEATURE_FLAG_MAX_ROLLOUT || '100'),
    requireApprovalForProduction: process.env.FEATURE_FLAG_REQUIRE_APPROVAL === 'true',
    autoRefreshInterval: process.env.FEATURE_FLAG_AUTO_REFRESH_INTERVAL 
      ? parseInt(process.env.FEATURE_FLAG_AUTO_REFRESH_INTERVAL) 
      : undefined,
  };
};

// Legacy Environment Variable Support (for backward compatibility)
export const getLegacyFeatureFlagConfig = () => {
  return {
    embeddingMonitoring: {
      enabled: process.env.ENABLE_EMBEDDING_MONITORING === 'true',
      rolloutPercentage: parseInt(process.env.EMBEDDING_MONITORING_ROLLOUT_PERCENTAGE || '0'),
    },
    queueBasedProcessing: {
      enabled: process.env.ENABLE_QUEUE_PROCESSING === 'true',
      rolloutPercentage: parseInt(process.env.QUEUE_PROCESSING_ROLLOUT_PERCENTAGE || '0'),
    },
    batchOptimization: {
      enabled: process.env.ENABLE_BATCH_OPTIMIZATION === 'true',
      rolloutPercentage: parseInt(process.env.BATCH_OPTIMIZATION_ROLLOUT_PERCENTAGE || '0'),
    },
  };
};

// Migration Helper for Legacy Environment Variables
export const migrateFromLegacyConfig = async (flagService: FeatureFlagService) => {
  const legacyConfig = getLegacyFeatureFlagConfig();
  
  try {
    // Update embedding monitoring flag
    const embeddingFlag = await flagService.getFlag('embedding-monitoring-001');
    if (embeddingFlag) {
      await flagService.updateFlag('embedding-monitoring-001', {
        enabled: legacyConfig.embeddingMonitoring.enabled,
        rolloutPercentage: legacyConfig.embeddingMonitoring.rolloutPercentage,
      });
    }

    // Update queue processing flag
    const queueFlag = await flagService.getFlag('queue-processing-001');
    if (queueFlag) {
      await flagService.updateFlag('queue-processing-001', {
        enabled: legacyConfig.queueBasedProcessing.enabled,
        rolloutPercentage: legacyConfig.queueBasedProcessing.rolloutPercentage,
      });
    }

    // Update batch optimization flag
    const batchFlag = await flagService.getFlag('batch-optimization-001');
    if (batchFlag) {
      await flagService.updateFlag('batch-optimization-001', {
        enabled: legacyConfig.batchOptimization.enabled,
        rolloutPercentage: legacyConfig.batchOptimization.rolloutPercentage,
      });
    }

    console.log('Successfully migrated from legacy feature flag configuration');
  } catch (error) {
    console.error('Failed to migrate from legacy configuration:', error);
  }
};

// Initialization Helper
export const initializeFeatureFlags = async (config?: Partial<FeatureFlagConfig>) => {
  const envConfig = getFeatureFlagConfigFromEnv();
  const defaultConfig = getDefaultConfig(envConfig.environment || 'development');
  
  const finalConfig: FeatureFlagConfig = {
    ...defaultConfig,
    ...envConfig,
    ...config,
  } as FeatureFlagConfig;

  // Validate required configuration
  if (!finalConfig.supabaseUrl || !finalConfig.supabaseKey) {
    throw new Error('Supabase URL and key are required for feature flag initialization');
  }

  if (!finalConfig.userId) {
    finalConfig.userId = 'system'; // Default to system user
  }

  // Initialize the manager
  const flagService = FeatureFlagManagerFactory.initialize(finalConfig);

  // Ensure Phase 5 flags exist
  await ensurePhase5FlagsExist(flagService);

  // Migrate from legacy config if needed
  if (process.env.ENABLE_EMBEDDING_MONITORING || 
      process.env.ENABLE_QUEUE_PROCESSING || 
      process.env.ENABLE_BATCH_OPTIMIZATION) {
    await migrateFromLegacyConfig(flagService);
  }

  return {
    flagService,
    evaluator: FeatureFlagManagerFactory.getEvaluator(),
    rolloutManager: FeatureFlagManagerFactory.getRolloutManager(),
  };
};

// Ensure Phase 5 flags exist in the database
const ensurePhase5FlagsExist = async (flagService: FeatureFlagService) => {
  try {
    const existingFlags = await flagService.listFlags();
    const existingFlagNames = existingFlags.map(f => f.name);

    // Create embedding monitoring flag if it doesn't exist
    if (!existingFlagNames.includes('embeddingMonitoring')) {
      const embeddingFlag = createEmbeddingMonitoringFlag();
      await flagService.createFlag(embeddingFlag);
    }

    // Create queue processing flag if it doesn't exist
    if (!existingFlagNames.includes('queueBasedProcessing')) {
      const queueFlag = createQueueProcessingFlag();
      await flagService.createFlag(queueFlag);
    }

    // Create batch optimization flag if it doesn't exist
    if (!existingFlagNames.includes('batchOptimization')) {
      const batchFlag = createBatchOptimizationFlag();
      await flagService.createFlag(batchFlag);
    }

    console.log('Phase 5 feature flags initialized successfully');
  } catch (error) {
    console.error('Failed to ensure Phase 5 flags exist:', error);
  }
};

// Feature Flag Evaluation Helper
export const evaluateFeatureFlag = async (
  flagName: string,
  userId?: string,
  teamId?: string,
  customAttributes?: Record<string, any>
): Promise<boolean> => {
  try {
    const evaluator = FeatureFlagManagerFactory.getEvaluator();
    
    switch (flagName) {
      case 'embeddingMonitoring':
        return await evaluator.evaluateEmbeddingMonitoring(userId, teamId);
      case 'queueBasedProcessing':
        return await evaluator.evaluateQueueProcessing(userId, teamId);
      case 'batchOptimization':
        return await evaluator.evaluateBatchOptimization(userId, teamId);
      default:
        const flagService = FeatureFlagManagerFactory.getInstance();
        const evaluation = await flagService.evaluateFlag(flagName, {
          userId,
          teamId,
          customAttributes,
          environment: process.env.NODE_ENV || 'development',
        });
        return evaluation.enabled;
    }
  } catch (error) {
    console.error(`Failed to evaluate feature flag ${flagName}:`, error);
    return false; // Default to disabled on error
  }
};

// Batch Feature Flag Evaluation
export const evaluateAllPhase5Flags = async (
  userId?: string,
  teamId?: string
) => {
  try {
    const evaluator = FeatureFlagManagerFactory.getEvaluator();
    return await evaluator.evaluateAllPhase5Features(userId, teamId);
  } catch (error) {
    console.error('Failed to evaluate Phase 5 flags:', error);
    return {
      embeddingMonitoring: false,
      queueBasedProcessing: false,
      batchOptimization: false,
    };
  }
};

// Export configuration types and utilities
export type { FeatureFlagConfig };
export { 
  FeatureFlagManagerFactory,
  getDefaultConfig,
  getFeatureFlagConfigFromEnv,
  getLegacyFeatureFlagConfig,
  migrateFromLegacyConfig,
  initializeFeatureFlags,
  evaluateFeatureFlag,
  evaluateAllPhase5Flags
};
