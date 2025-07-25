import { supabase } from '@/lib/supabase';
import {
  MemberAnalytics,
  TeamEngagementMetrics,
  ServiceResponse,
  GetMemberAnalyticsRequest,
  GetTeamEngagementMetricsRequest
} from '@/types/team';

/**
 * Optimized Team Analytics Service
 * 
 * This service provides optimized analytics functions that leverage
 * materialized views and performance monitoring for faster queries.
 */
export class OptimizedTeamAnalyticsService {
  
  /**
   * Get member analytics using optimized queries with caching
   */
  async getMemberAnalyticsOptimized(
    request: GetMemberAnalyticsRequest & { useCache?: boolean }
  ): Promise<ServiceResponse<MemberAnalytics>> {
    try {
      const { data, error } = await supabase.rpc('get_member_analytics_optimized', {
        _team_id: request.team_id,
        _user_id: request.user_id || null,
        _use_cache: request.useCache !== false // Default to true
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_member_analytics_optimized');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_member_analytics_optimized',
          team_id: request.team_id,
          user_id: request.user_id,
          cache_used: response.metadata?.cache_used,
          data_freshness: response.metadata?.data_freshness,
          performance_optimized: true
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getMemberAnalyticsOptimized');
    }
  }

  /**
   * Get team engagement metrics using optimized queries with caching
   */
  async getTeamEngagementMetricsOptimized(
    request: GetTeamEngagementMetricsRequest & { useCache?: boolean }
  ): Promise<ServiceResponse<TeamEngagementMetrics>> {
    try {
      const { data, error } = await supabase.rpc('get_team_engagement_metrics_optimized', {
        _team_id: request.team_id,
        _use_cache: request.useCache !== false // Default to true
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_team_engagement_metrics_optimized');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_team_engagement_metrics_optimized',
          team_id: request.team_id,
          cache_used: response.metadata?.cache_used,
          data_freshness: response.metadata?.data_freshness,
          team_health_score: response.data?.team_health_score,
          performance_optimized: true
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getTeamEngagementMetricsOptimized');
    }
  }

  /**
   * Refresh materialized views for analytics data
   */
  async refreshAnalyticsViews(): Promise<ServiceResponse<{ refreshed: boolean }>> {
    try {
      const { data, error } = await supabase.rpc('refresh_member_analytics_views');

      if (error) throw error;

      return {
        success: true,
        data: { refreshed: true },
        metadata: {
          operation: 'refresh_member_analytics_views',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'refreshAnalyticsViews');
    }
  }

  /**
   * Get performance analysis for analytics queries
   */
  async getPerformanceAnalysis(hoursBack: number = 24): Promise<ServiceResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('analyze_member_analytics_performance', {
        _hours_back: hoursBack
      });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: {
          operation: 'analyze_member_analytics_performance',
          hours_analyzed: hoursBack,
          analysis_timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getPerformanceAnalysis');
    }
  }

  /**
   * Get performance recommendations for analytics system
   */
  async getPerformanceRecommendations(): Promise<ServiceResponse<any[]>> {
    try {
      const { data, error } = await supabase.rpc('get_member_analytics_performance_recommendations');

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: {
          operation: 'get_member_analytics_performance_recommendations',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getPerformanceRecommendations');
    }
  }

  /**
   * Get analytics performance metrics
   */
  async getAnalyticsMetrics(
    teamId?: string,
    functionName?: string,
    hoursBack: number = 24
  ): Promise<ServiceResponse<any[]>> {
    try {
      let query = supabase
        .from('member_analytics_performance_metrics')
        .select('*')
        .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      if (functionName) {
        query = query.eq('function_name', functionName);
      }

      const { data, error } = await query.limit(1000);

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: {
          operation: 'get_analytics_metrics',
          team_id: teamId,
          function_name: functionName,
          hours_back: hoursBack,
          total_metrics: data?.length || 0
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getAnalyticsMetrics');
    }
  }

  /**
   * Check if materialized views need refresh
   */
  async checkViewFreshness(): Promise<ServiceResponse<{
    memberActivityView: { lastUpdated: string; ageMinutes: number; needsRefresh: boolean };
    teamEngagementView: { lastUpdated: string; ageMinutes: number; needsRefresh: boolean };
  }>> {
    try {
      // Check member activity view freshness
      const { data: memberActivityData, error: memberActivityError } = await supabase
        .from('mv_team_member_activity_summary')
        .select('last_updated')
        .limit(1)
        .single();

      if (memberActivityError && memberActivityError.code !== 'PGRST116') {
        throw memberActivityError;
      }

      // Check team engagement view freshness
      const { data: teamEngagementData, error: teamEngagementError } = await supabase
        .from('mv_team_engagement_metrics')
        .select('last_updated')
        .limit(1)
        .single();

      if (teamEngagementError && teamEngagementError.code !== 'PGRST116') {
        throw teamEngagementError;
      }

      const now = new Date();
      const memberActivityAge = memberActivityData?.last_updated 
        ? Math.floor((now.getTime() - new Date(memberActivityData.last_updated).getTime()) / (1000 * 60))
        : Infinity;
      
      const teamEngagementAge = teamEngagementData?.last_updated
        ? Math.floor((now.getTime() - new Date(teamEngagementData.last_updated).getTime()) / (1000 * 60))
        : Infinity;

      return {
        success: true,
        data: {
          memberActivityView: {
            lastUpdated: memberActivityData?.last_updated || 'never',
            ageMinutes: memberActivityAge,
            needsRefresh: memberActivityAge > 120 // Refresh if older than 2 hours
          },
          teamEngagementView: {
            lastUpdated: teamEngagementData?.last_updated || 'never',
            ageMinutes: teamEngagementAge,
            needsRefresh: teamEngagementAge > 120 // Refresh if older than 2 hours
          }
        },
        metadata: {
          operation: 'check_view_freshness',
          timestamp: now.toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'checkViewFreshness');
    }
  }

  /**
   * Validate response from database function
   */
  private validateResponse(data: any, operation: string): any {
    if (!data) {
      throw new Error(`No data returned from ${operation}`);
    }

    if (data.success === false) {
      throw new Error(data.error || `Operation ${operation} failed`);
    }

    return data;
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: any, operation: string): ServiceResponse<any> {
    console.error(`OptimizedTeamAnalyticsService.${operation} error:`, error);
    
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
      error_code: error.code || 'UNKNOWN_ERROR',
      metadata: {
        operation,
        timestamp: new Date().toISOString(),
        error_type: error.constructor.name
      }
    };
  }
}

// Export singleton instance
export const optimizedTeamAnalyticsService = new OptimizedTeamAnalyticsService();
