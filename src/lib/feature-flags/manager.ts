// Feature Flag Manager Implementation
// Core feature flag management system with evaluation engine

import { createClient } from '@supabase/supabase-js';
import {
  FeatureFlag,
  FeatureFlagManager,
  FeatureFlagEvaluation,
  FeatureFlagCondition,
  FeatureFlagConditionResult,
  EvaluationContext,
  FeatureFlagUsageStats,
  FeatureFlagAuditLog,
  FeatureFlagFilters,
  TimeRange,
  Phase5FeatureFlags
} from './types';

export class FeatureFlagService implements FeatureFlagManager {
  private supabase;
  private cache: Map<string, FeatureFlag> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    private userId: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Flag CRUD Operations
  async createFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const now = new Date().toISOString();
    const newFlag: FeatureFlag = {
      ...flag,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      createdBy: this.userId,
      lastModifiedBy: this.userId
    };

    const { data, error } = await this.supabase
      .from('feature_flags')
      .insert(newFlag)
      .select()
      .single();

    if (error) throw new Error(`Failed to create feature flag: ${error.message}`);

    // Log audit event
    await this.logAuditEvent(newFlag.id, 'created', {}, 'Feature flag created');

    // Update cache
    this.cache.set(newFlag.id, newFlag);
    this.cacheExpiry.set(newFlag.id, Date.now() + this.CACHE_TTL);

    return data;
  }

  async updateFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const existingFlag = await this.getFlag(id);
    if (!existingFlag) throw new Error(`Feature flag ${id} not found`);

    const updatedFlag = {
      ...existingFlag,
      ...updates,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: this.userId
    };

    const { data, error } = await this.supabase
      .from('feature_flags')
      .update(updatedFlag)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update feature flag: ${error.message}`);

    // Log audit event with changes
    const changes = this.calculateChanges(existingFlag, updatedFlag);
    await this.logAuditEvent(id, 'updated', changes, 'Feature flag updated');

    // Update cache
    this.cache.set(id, data);
    this.cacheExpiry.set(id, Date.now() + this.CACHE_TTL);

    return data;
  }

  async deleteFlag(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('feature_flags')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete feature flag: ${error.message}`);

    // Log audit event
    await this.logAuditEvent(id, 'deleted', {}, 'Feature flag deleted');

    // Remove from cache
    this.cache.delete(id);
    this.cacheExpiry.delete(id);
  }

  async getFlag(id: string): Promise<FeatureFlag | null> {
    // Check cache first
    const cached = this.cache.get(id);
    const expiry = this.cacheExpiry.get(id);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    const { data, error } = await this.supabase
      .from('feature_flags')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get feature flag: ${error.message}`);
    }

    // Update cache
    this.cache.set(id, data);
    this.cacheExpiry.set(id, Date.now() + this.CACHE_TTL);

    return data;
  }

  async listFlags(filters?: FeatureFlagFilters): Promise<FeatureFlag[]> {
    let query = this.supabase.from('feature_flags').select('*');

    if (filters) {
      if (filters.enabled !== undefined) {
        query = query.eq('enabled', filters.enabled);
      }
      if (filters.category) {
        query = query.eq('metadata->>category', filters.category);
      }
      if (filters.priority) {
        query = query.eq('metadata->>priority', filters.priority);
      }
      if (filters.createdBy) {
        query = query.eq('createdBy', filters.createdBy);
      }
      if (filters.lastModifiedAfter) {
        query = query.gte('updatedAt', filters.lastModifiedAfter);
      }
      if (filters.lastModifiedBefore) {
        query = query.lte('updatedAt', filters.lastModifiedBefore);
      }
    }

    const { data, error } = await query.order('updatedAt', { ascending: false });

    if (error) throw new Error(`Failed to list feature flags: ${error.message}`);

    return data || [];
  }

  // Flag Evaluation Engine
  async evaluateFlag(flagId: string, context: EvaluationContext): Promise<FeatureFlagEvaluation> {
    const flag = await this.getFlag(flagId);
    
    if (!flag) {
      return {
        flagId,
        userId: context.userId,
        teamId: context.teamId,
        enabled: false,
        reason: 'Flag not found',
        evaluatedAt: new Date().toISOString(),
        conditions: []
      };
    }

    if (!flag.enabled) {
      await this.recordEvaluation(flagId, context, false, 'Flag disabled');
      return {
        flagId,
        userId: context.userId,
        teamId: context.teamId,
        enabled: false,
        reason: 'Flag disabled globally',
        evaluatedAt: new Date().toISOString(),
        conditions: []
      };
    }

    // Evaluate conditions
    const conditionResults = await this.evaluateConditions(flag.conditions || [], context);
    const conditionsPassed = conditionResults.every(result => result.result);

    if (!conditionsPassed) {
      const failedCondition = conditionResults.find(result => !result.result);
      await this.recordEvaluation(flagId, context, false, `Condition failed: ${failedCondition?.reason}`);
      return {
        flagId,
        userId: context.userId,
        teamId: context.teamId,
        enabled: false,
        reason: `Condition failed: ${failedCondition?.reason}`,
        evaluatedAt: new Date().toISOString(),
        conditions: conditionResults
      };
    }

    // Check targeted rollout
    if (flag.targetTeams && flag.targetTeams.length > 0 && context.teamId) {
      if (flag.targetTeams.includes(context.teamId)) {
        await this.recordEvaluation(flagId, context, true, 'Target team match');
        return {
          flagId,
          userId: context.userId,
          teamId: context.teamId,
          enabled: true,
          reason: 'Target team match',
          evaluatedAt: new Date().toISOString(),
          conditions: conditionResults
        };
      }
    }

    if (flag.targetUsers && flag.targetUsers.length > 0 && context.userId) {
      if (flag.targetUsers.includes(context.userId)) {
        await this.recordEvaluation(flagId, context, true, 'Target user match');
        return {
          flagId,
          userId: context.userId,
          teamId: context.teamId,
          enabled: true,
          reason: 'Target user match',
          evaluatedAt: new Date().toISOString(),
          conditions: conditionResults
        };
      }
    }

    // Percentage-based rollout
    const rolloutEnabled = this.evaluatePercentageRollout(
      flag.rolloutPercentage,
      context.userId || context.teamId || 'anonymous'
    );

    const reason = rolloutEnabled 
      ? `Percentage rollout (${flag.rolloutPercentage}%)`
      : `Outside rollout percentage (${flag.rolloutPercentage}%)`;

    await this.recordEvaluation(flagId, context, rolloutEnabled, reason);

    return {
      flagId,
      userId: context.userId,
      teamId: context.teamId,
      enabled: rolloutEnabled,
      reason,
      evaluatedAt: new Date().toISOString(),
      conditions: conditionResults
    };
  }

  async evaluateAllFlags(context: EvaluationContext): Promise<Record<string, FeatureFlagEvaluation>> {
    const flags = await this.listFlags({ enabled: true });
    const evaluations: Record<string, FeatureFlagEvaluation> = {};

    await Promise.all(
      flags.map(async (flag) => {
        evaluations[flag.id] = await this.evaluateFlag(flag.id, context);
      })
    );

    return evaluations;
  }

  // Phase 5 Specific Methods
  async getPhase5Flags(): Promise<Phase5FeatureFlags> {
    const flags = await this.listFlags({ 
      category: 'monitoring' 
    });

    const embeddingMonitoring = flags.find(f => f.name === 'embeddingMonitoring');
    const queueProcessing = flags.find(f => f.name === 'queueBasedProcessing');
    const batchOptimization = flags.find(f => f.name === 'batchOptimization');

    return {
      embeddingMonitoring: embeddingMonitoring as any,
      queueBasedProcessing: queueProcessing as any,
      batchOptimization: batchOptimization as any
    };
  }

  // Rollout Management
  async updateRolloutPercentage(flagId: string, percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    await this.updateFlag(flagId, { rolloutPercentage: percentage });
    await this.logAuditEvent(flagId, 'rollout_changed', 
      { rolloutPercentage: { from: 'unknown', to: percentage } },
      `Rollout percentage changed to ${percentage}%`
    );
  }

  async addTargetTeam(flagId: string, teamId: string): Promise<void> {
    const flag = await this.getFlag(flagId);
    if (!flag) throw new Error(`Feature flag ${flagId} not found`);

    const targetTeams = [...(flag.targetTeams || [])];
    if (!targetTeams.includes(teamId)) {
      targetTeams.push(teamId);
      await this.updateFlag(flagId, { targetTeams });
    }
  }

  async removeTargetTeam(flagId: string, teamId: string): Promise<void> {
    const flag = await this.getFlag(flagId);
    if (!flag) throw new Error(`Feature flag ${flagId} not found`);

    const targetTeams = (flag.targetTeams || []).filter(id => id !== teamId);
    await this.updateFlag(flagId, { targetTeams });
  }

  async addTargetUser(flagId: string, userId: string): Promise<void> {
    const flag = await this.getFlag(flagId);
    if (!flag) throw new Error(`Feature flag ${flagId} not found`);

    const targetUsers = [...(flag.targetUsers || [])];
    if (!targetUsers.includes(userId)) {
      targetUsers.push(userId);
      await this.updateFlag(flagId, { targetUsers });
    }
  }

  async removeTargetUser(flagId: string, userId: string): Promise<void> {
    const flag = await this.getFlag(flagId);
    if (!flag) throw new Error(`Feature flag ${flagId} not found`);

    const targetUsers = (flag.targetUsers || []).filter(id => id !== userId);
    await this.updateFlag(flagId, { targetUsers });
  }

  // Analytics and Monitoring
  async getUsageStats(flagId: string, timeRange?: TimeRange): Promise<FeatureFlagUsageStats> {
    const { data, error } = await this.supabase
      .rpc('get_feature_flag_usage_stats', {
        flag_id: flagId,
        start_time: timeRange?.start,
        end_time: timeRange?.end
      });

    if (error) throw new Error(`Failed to get usage stats: ${error.message}`);

    return data;
  }

  async getAuditLog(flagId?: string, timeRange?: TimeRange): Promise<FeatureFlagAuditLog[]> {
    let query = this.supabase.from('feature_flag_audit_log').select('*');

    if (flagId) {
      query = query.eq('flagId', flagId);
    }

    if (timeRange) {
      query = query.gte('timestamp', timeRange.start).lte('timestamp', timeRange.end);
    }

    const { data, error } = await query.order('timestamp', { ascending: false });

    if (error) throw new Error(`Failed to get audit log: ${error.message}`);

    return data || [];
  }

  // Private Helper Methods
  private async evaluateConditions(
    conditions: FeatureFlagCondition[],
    context: EvaluationContext
  ): Promise<FeatureFlagConditionResult[]> {
    return conditions.map(condition => {
      const result = this.evaluateCondition(condition, context);
      return {
        condition,
        result: result.passed,
        reason: result.reason
      };
    });
  }

  private evaluateCondition(
    condition: FeatureFlagCondition,
    context: EvaluationContext
  ): { passed: boolean; reason: string } {
    let attributeValue: any;

    switch (condition.type) {
      case 'user_attribute':
        attributeValue = context.userAttributes?.[condition.attribute];
        break;
      case 'team_attribute':
        attributeValue = context.teamAttributes?.[condition.attribute];
        break;
      case 'environment':
        attributeValue = context.environment;
        break;
      case 'custom':
        attributeValue = context.customAttributes?.[condition.attribute];
        break;
      default:
        return { passed: false, reason: `Unknown condition type: ${condition.type}` };
    }

    const passed = this.compareValues(attributeValue, condition.operator, condition.value);
    const reason = passed 
      ? `Condition passed: ${condition.attribute} ${condition.operator} ${condition.value}`
      : `Condition failed: ${condition.attribute} ${condition.operator} ${condition.value}`;

    return { passed, reason };
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'not_contains':
        return !String(actual).includes(String(expected));
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      default:
        return false;
    }
  }

  private evaluatePercentageRollout(percentage: number, identifier: string): boolean {
    if (percentage === 0) return false;
    if (percentage === 100) return true;

    // Use consistent hash-based rollout
    const hash = this.hashString(identifier);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async recordEvaluation(
    flagId: string,
    context: EvaluationContext,
    enabled: boolean,
    reason: string
  ): Promise<void> {
    try {
      await this.supabase.from('feature_flag_evaluations').insert({
        flag_id: flagId,
        user_id: context.userId,
        team_id: context.teamId,
        enabled,
        reason,
        evaluated_at: new Date().toISOString(),
        context: context
      });
    } catch (error) {
      // Don't throw on evaluation recording errors to avoid breaking the main flow
      console.error('Failed to record feature flag evaluation:', error);
    }
  }

  private async logAuditEvent(
    flagId: string,
    action: string,
    changes: Record<string, any>,
    reason?: string
  ): Promise<void> {
    try {
      await this.supabase.from('feature_flag_audit_log').insert({
        flag_id: flagId,
        action,
        user_id: this.userId,
        user_name: 'System', // TODO: Get actual user name
        timestamp: new Date().toISOString(),
        changes,
        reason,
        ip_address: null, // TODO: Get actual IP
        user_agent: null // TODO: Get actual user agent
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  private calculateChanges(oldFlag: FeatureFlag, newFlag: FeatureFlag): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    Object.keys(newFlag).forEach(key => {
      if (key === 'updatedAt' || key === 'lastModifiedBy') return;
      
      const oldValue = (oldFlag as any)[key];
      const newValue = (newFlag as any)[key];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { from: oldValue, to: newValue };
      }
    });

    return changes;
  }

  // Environment Management
  async syncEnvironment(environmentId: string): Promise<void> {
    // Implementation for syncing flags between environments
    throw new Error('Environment sync not implemented yet');
  }

  async promoteToEnvironment(flagId: string, fromEnv: string, toEnv: string): Promise<void> {
    // Implementation for promoting flags between environments
    throw new Error('Environment promotion not implemented yet');
  }
}
