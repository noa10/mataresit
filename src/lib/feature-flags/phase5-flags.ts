// Phase 5 Feature Flag Configurations
// Specific configurations for Phase 5 production deployment features

import { FeatureFlag, EmbeddingMonitoringFlag, QueueProcessingFlag, BatchOptimizationFlag } from './types';

// Phase 5 Feature Flag Definitions
export const PHASE5_FEATURE_FLAGS = {
  EMBEDDING_MONITORING: 'embeddingMonitoring',
  QUEUE_BASED_PROCESSING: 'queueBasedProcessing',
  BATCH_OPTIMIZATION: 'batchOptimization'
} as const;

// Default Phase 5 Feature Flag Configurations
export const createEmbeddingMonitoringFlag = (): EmbeddingMonitoringFlag => ({
  id: 'embedding-monitoring-001',
  name: 'embeddingMonitoring',
  description: 'Enable comprehensive embedding performance monitoring and analytics',
  enabled: true,
  rolloutPercentage: 10, // Start with 10% rollout
  targetTeams: [],
  targetUsers: [],
  conditions: [
    {
      type: 'environment',
      operator: 'in',
      attribute: 'environment',
      value: ['production', 'staging']
    }
  ],
  metadata: {
    category: 'monitoring',
    priority: 'high',
    tags: ['phase5', 'monitoring', 'analytics', 'performance'],
    rolloutStrategy: 'percentage',
    dependencies: [],
    conflicts: [],
    rollbackPlan: 'Disable monitoring collection, keep existing data',
    monitoringMetrics: [
      'embedding_success_rate',
      'embedding_latency',
      'embedding_cost',
      'error_rate'
    ],
    estimatedImpact: 'low',
    testingStatus: 'tested'
  },
  config: {
    metricsCollection: true,
    performanceTracking: true,
    errorAnalysis: true,
    costTracking: true,
    realTimeAlerts: false, // Start disabled for gradual rollout
    dashboardEnabled: true,
    retentionDays: 30
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'system',
  lastModifiedBy: 'system'
});

export const createQueueProcessingFlag = (): QueueProcessingFlag => ({
  id: 'queue-processing-001',
  name: 'queueBasedProcessing',
  description: 'Enable queue-based embedding processing with worker coordination',
  enabled: false, // Start disabled
  rolloutPercentage: 0, // Start with 0% rollout
  targetTeams: [],
  targetUsers: [],
  conditions: [
    {
      type: 'environment',
      operator: 'equals',
      attribute: 'environment',
      value: 'production'
    },
    {
      type: 'custom',
      operator: 'equals',
      attribute: 'embeddingMonitoringEnabled',
      value: true
    }
  ],
  metadata: {
    category: 'processing',
    priority: 'critical',
    tags: ['phase5', 'queue', 'processing', 'workers', 'scalability'],
    rolloutStrategy: 'conditional',
    dependencies: ['embedding-monitoring-001'],
    conflicts: [],
    rollbackPlan: 'Fallback to direct processing, drain queue gracefully',
    monitoringMetrics: [
      'queue_depth',
      'processing_rate',
      'worker_utilization',
      'queue_latency'
    ],
    estimatedImpact: 'high',
    testingStatus: 'testing'
  },
  config: {
    fallbackToDirectProcessing: true,
    maxQueueDepth: 1000,
    workerScaling: true,
    priorityProcessing: true,
    rateLimiting: true,
    batchProcessing: false, // Enable after batch optimization
    deadLetterQueue: true
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'system',
  lastModifiedBy: 'system'
});

export const createBatchOptimizationFlag = (): BatchOptimizationFlag => ({
  id: 'batch-optimization-001',
  name: 'batchOptimization',
  description: 'Enable batch upload optimization with rate limiting and quota management',
  enabled: false, // Start disabled
  rolloutPercentage: 0, // Start with 0% rollout
  targetTeams: [],
  targetUsers: [],
  conditions: [
    {
      type: 'environment',
      operator: 'equals',
      attribute: 'environment',
      value: 'production'
    },
    {
      type: 'custom',
      operator: 'equals',
      attribute: 'queueProcessingEnabled',
      value: true
    }
  ],
  metadata: {
    category: 'optimization',
    priority: 'medium',
    tags: ['phase5', 'batch', 'optimization', 'rate-limiting', 'quota'],
    rolloutStrategy: 'conditional',
    dependencies: ['embedding-monitoring-001', 'queue-processing-001'],
    conflicts: [],
    rollbackPlan: 'Disable batch processing, process uploads individually',
    monitoringMetrics: [
      'batch_success_rate',
      'batch_processing_time',
      'api_quota_usage',
      'cost_optimization'
    ],
    estimatedImpact: 'medium',
    testingStatus: 'not_tested'
  },
  config: {
    rateLimitingEnabled: true,
    adaptiveProcessing: true,
    concurrentUploads: 3,
    quotaManagement: true,
    optimizationStrategies: ['rate_limiting', 'batch_grouping', 'priority_queuing'],
    performanceMonitoring: true,
    costOptimization: true
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'system',
  lastModifiedBy: 'system'
});

// Phase 5 Rollout Strategy
export const PHASE5_ROLLOUT_STRATEGY = {
  // Phase 1: Monitoring (Week 1)
  phase1: {
    embeddingMonitoring: {
      week1: { enabled: true, rolloutPercentage: 10 },
      week2: { enabled: true, rolloutPercentage: 25 },
      week3: { enabled: true, rolloutPercentage: 50 },
      week4: { enabled: true, rolloutPercentage: 100 }
    }
  },
  
  // Phase 2: Queue Processing (Week 3-4, after monitoring is stable)
  phase2: {
    queueBasedProcessing: {
      week3: { enabled: true, rolloutPercentage: 5 },
      week4: { enabled: true, rolloutPercentage: 15 },
      week5: { enabled: true, rolloutPercentage: 35 },
      week6: { enabled: true, rolloutPercentage: 75 },
      week7: { enabled: true, rolloutPercentage: 100 }
    }
  },
  
  // Phase 3: Batch Optimization (Week 5-6, after queue processing is stable)
  phase3: {
    batchOptimization: {
      week5: { enabled: true, rolloutPercentage: 5 },
      week6: { enabled: true, rolloutPercentage: 10 },
      week7: { enabled: true, rolloutPercentage: 25 },
      week8: { enabled: true, rolloutPercentage: 50 },
      week9: { enabled: true, rolloutPercentage: 100 }
    }
  }
};

// Feature Flag Evaluation Helpers
export class Phase5FeatureFlagEvaluator {
  constructor(private flagService: any) {}

  async evaluateEmbeddingMonitoring(userId?: string, teamId?: string): Promise<boolean> {
    const evaluation = await this.flagService.evaluateFlag(
      PHASE5_FEATURE_FLAGS.EMBEDDING_MONITORING,
      {
        userId,
        teamId,
        environment: process.env.NODE_ENV || 'development',
        customAttributes: {
          phase: 'phase5',
          feature: 'monitoring'
        }
      }
    );
    
    return evaluation.enabled;
  }

  async evaluateQueueProcessing(userId?: string, teamId?: string): Promise<boolean> {
    // Check if embedding monitoring is enabled first
    const monitoringEnabled = await this.evaluateEmbeddingMonitoring(userId, teamId);
    
    if (!monitoringEnabled) {
      return false; // Queue processing depends on monitoring
    }

    const evaluation = await this.flagService.evaluateFlag(
      PHASE5_FEATURE_FLAGS.QUEUE_BASED_PROCESSING,
      {
        userId,
        teamId,
        environment: process.env.NODE_ENV || 'development',
        customAttributes: {
          phase: 'phase5',
          feature: 'queue',
          embeddingMonitoringEnabled: true
        }
      }
    );
    
    return evaluation.enabled;
  }

  async evaluateBatchOptimization(userId?: string, teamId?: string): Promise<boolean> {
    // Check if queue processing is enabled first
    const queueEnabled = await this.evaluateQueueProcessing(userId, teamId);
    
    if (!queueEnabled) {
      return false; // Batch optimization depends on queue processing
    }

    const evaluation = await this.flagService.evaluateFlag(
      PHASE5_FEATURE_FLAGS.BATCH_OPTIMIZATION,
      {
        userId,
        teamId,
        environment: process.env.NODE_ENV || 'development',
        customAttributes: {
          phase: 'phase5',
          feature: 'batch',
          queueProcessingEnabled: true
        }
      }
    );
    
    return evaluation.enabled;
  }

  async evaluateAllPhase5Features(userId?: string, teamId?: string) {
    const [monitoring, queue, batch] = await Promise.all([
      this.evaluateEmbeddingMonitoring(userId, teamId),
      this.evaluateQueueProcessing(userId, teamId),
      this.evaluateBatchOptimization(userId, teamId)
    ]);

    return {
      embeddingMonitoring: monitoring,
      queueBasedProcessing: queue,
      batchOptimization: batch
    };
  }
}

// Rollout Management Helpers
export class Phase5RolloutManager {
  constructor(private flagService: any) {}

  async updateEmbeddingMonitoringRollout(percentage: number): Promise<void> {
    await this.flagService.updateRolloutPercentage(
      PHASE5_FEATURE_FLAGS.EMBEDDING_MONITORING,
      percentage
    );
  }

  async updateQueueProcessingRollout(percentage: number): Promise<void> {
    await this.flagService.updateRolloutPercentage(
      PHASE5_FEATURE_FLAGS.QUEUE_BASED_PROCESSING,
      percentage
    );
  }

  async updateBatchOptimizationRollout(percentage: number): Promise<void> {
    await this.flagService.updateRolloutPercentage(
      PHASE5_FEATURE_FLAGS.BATCH_OPTIMIZATION,
      percentage
    );
  }

  async executeWeeklyRollout(week: number): Promise<void> {
    const strategy = PHASE5_ROLLOUT_STRATEGY;
    
    // Update embedding monitoring
    if (strategy.phase1.embeddingMonitoring[`week${week}` as keyof typeof strategy.phase1.embeddingMonitoring]) {
      const config = strategy.phase1.embeddingMonitoring[`week${week}` as keyof typeof strategy.phase1.embeddingMonitoring];
      await this.updateEmbeddingMonitoringRollout(config.rolloutPercentage);
      
      if (config.enabled) {
        await this.flagService.updateFlag(PHASE5_FEATURE_FLAGS.EMBEDDING_MONITORING, { enabled: true });
      }
    }

    // Update queue processing (starts week 3)
    if (week >= 3 && strategy.phase2.queueBasedProcessing[`week${week}` as keyof typeof strategy.phase2.queueBasedProcessing]) {
      const config = strategy.phase2.queueBasedProcessing[`week${week}` as keyof typeof strategy.phase2.queueBasedProcessing];
      await this.updateQueueProcessingRollout(config.rolloutPercentage);
      
      if (config.enabled) {
        await this.flagService.updateFlag(PHASE5_FEATURE_FLAGS.QUEUE_BASED_PROCESSING, { enabled: true });
      }
    }

    // Update batch optimization (starts week 5)
    if (week >= 5 && strategy.phase3.batchOptimization[`week${week}` as keyof typeof strategy.phase3.batchOptimization]) {
      const config = strategy.phase3.batchOptimization[`week${week}` as keyof typeof strategy.phase3.batchOptimization];
      await this.updateBatchOptimizationRollout(config.rolloutPercentage);
      
      if (config.enabled) {
        await this.flagService.updateFlag(PHASE5_FEATURE_FLAGS.BATCH_OPTIMIZATION, { enabled: true });
      }
    }
  }

  async emergencyDisableAll(): Promise<void> {
    // Disable all Phase 5 features in reverse order (batch -> queue -> monitoring)
    await this.flagService.updateFlag(PHASE5_FEATURE_FLAGS.BATCH_OPTIMIZATION, { enabled: false });
    await this.flagService.updateFlag(PHASE5_FEATURE_FLAGS.QUEUE_BASED_PROCESSING, { enabled: false });
    await this.flagService.updateFlag(PHASE5_FEATURE_FLAGS.EMBEDDING_MONITORING, { enabled: false });
  }

  async getPhase5Status() {
    const flags = await Promise.all([
      this.flagService.getFlag(PHASE5_FEATURE_FLAGS.EMBEDDING_MONITORING),
      this.flagService.getFlag(PHASE5_FEATURE_FLAGS.QUEUE_BASED_PROCESSING),
      this.flagService.getFlag(PHASE5_FEATURE_FLAGS.BATCH_OPTIMIZATION)
    ]);

    return {
      embeddingMonitoring: {
        enabled: flags[0]?.enabled || false,
        rolloutPercentage: flags[0]?.rolloutPercentage || 0
      },
      queueBasedProcessing: {
        enabled: flags[1]?.enabled || false,
        rolloutPercentage: flags[1]?.rolloutPercentage || 0
      },
      batchOptimization: {
        enabled: flags[2]?.enabled || false,
        rolloutPercentage: flags[2]?.rolloutPercentage || 0
      }
    };
  }
}
