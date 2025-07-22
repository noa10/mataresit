// Feature Flag Management System Types
// Comprehensive type definitions for the feature flag system

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  targetTeams?: string[];
  targetUsers?: string[];
  conditions?: FeatureFlagCondition[];
  metadata: FeatureFlagMetadata;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

export interface FeatureFlagCondition {
  type: 'user_attribute' | 'team_attribute' | 'environment' | 'time_window' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  attribute: string;
  value: string | number | boolean | string[];
}

export interface FeatureFlagMetadata {
  category: 'monitoring' | 'processing' | 'optimization' | 'ui' | 'api' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  rolloutStrategy: 'percentage' | 'targeted' | 'conditional' | 'kill_switch';
  dependencies?: string[]; // Other feature flag IDs this depends on
  conflicts?: string[]; // Feature flag IDs that conflict with this one
  rollbackPlan?: string;
  monitoringMetrics?: string[];
  estimatedImpact: 'low' | 'medium' | 'high';
  testingStatus: 'not_tested' | 'testing' | 'tested' | 'approved';
}

export interface FeatureFlagEvaluation {
  flagId: string;
  userId?: string;
  teamId?: string;
  enabled: boolean;
  reason: string;
  evaluatedAt: string;
  conditions: FeatureFlagConditionResult[];
}

export interface FeatureFlagConditionResult {
  condition: FeatureFlagCondition;
  result: boolean;
  reason: string;
}

export interface FeatureFlagUsageStats {
  flagId: string;
  totalEvaluations: number;
  enabledEvaluations: number;
  disabledEvaluations: number;
  uniqueUsers: number;
  uniqueTeams: number;
  evaluationsByHour: { hour: string; count: number }[];
  topUsers: { userId: string; count: number }[];
  topTeams: { teamId: string; count: number }[];
  errorRate: number;
  averageEvaluationTime: number;
}

export interface FeatureFlagAuditLog {
  id: string;
  flagId: string;
  action: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled' | 'rollout_changed';
  userId: string;
  userName: string;
  timestamp: string;
  changes: Record<string, { from: any; to: any }>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FeatureFlagEnvironment {
  id: string;
  name: string;
  description: string;
  isProduction: boolean;
  flags: Record<string, FeatureFlag>;
  lastSyncAt: string;
}

// Phase 5 Specific Feature Flags
export interface Phase5FeatureFlags {
  embeddingMonitoring: EmbeddingMonitoringFlag;
  queueBasedProcessing: QueueProcessingFlag;
  batchOptimization: BatchOptimizationFlag;
}

export interface EmbeddingMonitoringFlag extends FeatureFlag {
  config: {
    metricsCollection: boolean;
    performanceTracking: boolean;
    errorAnalysis: boolean;
    costTracking: boolean;
    realTimeAlerts: boolean;
    dashboardEnabled: boolean;
    retentionDays: number;
  };
}

export interface QueueProcessingFlag extends FeatureFlag {
  config: {
    fallbackToDirectProcessing: boolean;
    maxQueueDepth: number;
    workerScaling: boolean;
    priorityProcessing: boolean;
    rateLimiting: boolean;
    batchProcessing: boolean;
    deadLetterQueue: boolean;
  };
}

export interface BatchOptimizationFlag extends FeatureFlag {
  config: {
    rateLimitingEnabled: boolean;
    adaptiveProcessing: boolean;
    concurrentUploads: number;
    quotaManagement: boolean;
    optimizationStrategies: string[];
    performanceMonitoring: boolean;
    costOptimization: boolean;
  };
}

// Feature Flag Management Interface
export interface FeatureFlagManager {
  // Flag CRUD operations
  createFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureFlag>;
  updateFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag>;
  deleteFlag(id: string): Promise<void>;
  getFlag(id: string): Promise<FeatureFlag | null>;
  listFlags(filters?: FeatureFlagFilters): Promise<FeatureFlag[]>;

  // Flag evaluation
  evaluateFlag(flagId: string, context: EvaluationContext): Promise<FeatureFlagEvaluation>;
  evaluateAllFlags(context: EvaluationContext): Promise<Record<string, FeatureFlagEvaluation>>;

  // Rollout management
  updateRolloutPercentage(flagId: string, percentage: number): Promise<void>;
  addTargetTeam(flagId: string, teamId: string): Promise<void>;
  removeTargetTeam(flagId: string, teamId: string): Promise<void>;
  addTargetUser(flagId: string, userId: string): Promise<void>;
  removeTargetUser(flagId: string, userId: string): Promise<void>;

  // Analytics and monitoring
  getUsageStats(flagId: string, timeRange?: TimeRange): Promise<FeatureFlagUsageStats>;
  getAuditLog(flagId?: string, timeRange?: TimeRange): Promise<FeatureFlagAuditLog[]>;
  
  // Environment management
  syncEnvironment(environmentId: string): Promise<void>;
  promoteToEnvironment(flagId: string, fromEnv: string, toEnv: string): Promise<void>;
}

export interface FeatureFlagFilters {
  enabled?: boolean;
  category?: string;
  priority?: string;
  tags?: string[];
  createdBy?: string;
  lastModifiedAfter?: string;
  lastModifiedBefore?: string;
}

export interface EvaluationContext {
  userId?: string;
  teamId?: string;
  userAttributes?: Record<string, any>;
  teamAttributes?: Record<string, any>;
  environment?: string;
  timestamp?: string;
  customAttributes?: Record<string, any>;
}

export interface TimeRange {
  start: string;
  end: string;
}

// Rollout Strategy Types
export type RolloutStrategy = 
  | { type: 'percentage'; percentage: number }
  | { type: 'targeted'; targets: { teams?: string[]; users?: string[] } }
  | { type: 'conditional'; conditions: FeatureFlagCondition[] }
  | { type: 'kill_switch'; enabled: boolean };

// Feature Flag Events
export interface FeatureFlagEvent {
  type: 'flag_evaluated' | 'flag_updated' | 'rollout_changed' | 'flag_error';
  flagId: string;
  userId?: string;
  teamId?: string;
  data: Record<string, any>;
  timestamp: string;
}

// Admin Interface Types
export interface FeatureFlagAdminConfig {
  permissions: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canViewAuditLog: boolean;
    canManageRollout: boolean;
    canPromoteEnvironments: boolean;
  };
  environments: string[];
  defaultRolloutPercentage: number;
  maxRolloutPercentage: number;
  requireApprovalForProduction: boolean;
  auditLogRetentionDays: number;
}
