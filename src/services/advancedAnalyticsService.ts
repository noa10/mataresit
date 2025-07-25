import { supabase } from '@/lib/supabase';
import { ServiceResponse } from '@/types/team';

// ============================================================================
// ADVANCED ANALYTICS TYPES
// ============================================================================

export interface AdvancedMemberAnalytics {
  member_info: {
    user_id: string;
    role: string;
    joined_at: string;
    updated_at: string;
    performance_category: string;
    activity_trend: string;
  };
  activity_metrics: {
    receipts_created: number;
    receipts_ai_processed: number;
    receipts_last_30_days: number;
    receipts_last_7_days: number;
    receipts_last_1_day: number;
    active_days_last_30_days: number;
    total_receipt_amount: number;
    engagement_score: number;
  };
  collaboration_metrics: {
    conversations_created: number;
    active_conversations_30_days: number;
    messages_sent_30_days: number;
    messages_sent_7_days: number;
    projects_involved: number;
    projects_completed: number;
    tasks_completed: number;
    files_shared: number;
    collaboration_score: number;
  };
  performance_indicators: {
    avg_completion_time: number | null;
    project_success_rate: number;
    productivity_trend: string;
    collaboration_effectiveness: string;
  };
  predictive_insights: {
    performance_forecast: string;
    recommended_actions: string[];
    growth_potential: string;
  };
  metadata: {
    generated_at: string;
    generated_by: string;
    team_id: string;
    data_freshness: number;
  };
}

export interface TeamAdvancedAnalytics {
  team_info: {
    team_id: string;
    team_name: string;
    total_members: number;
    team_health_status: string;
    last_updated: string;
  };
  member_composition: {
    owners_count: number;
    admins_count: number;
    members_count: number;
    composition_ratio: {
      leadership_ratio: number;
      member_ratio: number;
    };
  };
  activity_summary: {
    team_receipts_30_days: number;
    team_receipts_7_days: number;
    avg_engagement_score: number;
    activity_per_member: number;
  };
  collaboration_summary: {
    avg_collaboration_score: number;
    team_conversations: number;
    collaboration_effectiveness: string;
  };
  performance_distribution: {
    high_performers: number;
    solid_contributors: number;
    developing_members: number;
    needs_attention: number;
    at_risk_members: number;
    performance_percentages: {
      high_performers_pct: number;
      solid_contributors_pct: number;
      at_risk_pct: number;
    };
  };
  team_insights: {
    strengths: string[];
    areas_for_improvement: string[];
    recommended_actions: string[];
  };
  predictive_analytics: {
    team_trajectory: string;
    success_probability: string;
    growth_forecast: string;
  };
  metadata: {
    generated_at: string;
    generated_by: string;
    team_id: string;
    data_freshness: number;
  };
}

export interface PredictiveAnalytics {
  forecast_period: {
    start_date: string;
    end_date: string;
    forecast_days: number;
  };
  performance_forecast: {
    predicted_activity_level: number;
    predicted_collaboration_score: number;
    team_health_forecast: string;
  };
  risk_assessment: {
    member_attrition_risk: string;
    productivity_decline_risk: string;
    team_cohesion_risk: string;
  };
  recommendations: {
    immediate_actions: string[];
    strategic_initiatives: string[];
  };
  success_indicators: {
    key_metrics_to_watch: string[];
    target_improvements: {
      activity_increase_target: number;
      collaboration_score_target: number;
      at_risk_reduction_target: number;
    };
  };
  metadata: {
    generated_at: string;
    generated_by: string;
    team_id: string;
    forecast_confidence: string;
    data_points_analyzed: number;
  };
}

export interface AnalyticsExportOptions {
  format: 'csv' | 'pdf' | 'json';
  include_charts?: boolean;
  include_recommendations?: boolean;
  date_range?: {
    start_date: string;
    end_date: string;
  };
}

export interface AnalyticsExportResult {
  export_id: string;
  download_url: string;
  file_size: number;
  expires_at: string;
  format: string;
}

// ============================================================================
// ADVANCED ANALYTICS SERVICE
// ============================================================================

export class AdvancedAnalyticsService {
  
  /**
   * Get comprehensive advanced analytics for a team member
   */
  async getAdvancedMemberAnalytics(
    teamId: string,
    userId?: string,
    periodDays: number = 30
  ): Promise<ServiceResponse<AdvancedMemberAnalytics>> {
    try {
      const { data, error } = await supabase.rpc('get_advanced_member_analytics', {
        _team_id: teamId,
        _user_id: userId || null,
        _period_days: periodDays
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_advanced_member_analytics');

      return {
        success: true,
        data: response,
        metadata: {
          operation: 'get_advanced_member_analytics',
          team_id: teamId,
          user_id: userId,
          period_days: periodDays,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getAdvancedMemberAnalytics');
    }
  }

  /**
   * Get team-wide advanced analytics
   */
  async getTeamAdvancedAnalytics(
    teamId: string,
    periodDays: number = 30
  ): Promise<ServiceResponse<TeamAdvancedAnalytics>> {
    try {
      const { data, error } = await supabase.rpc('get_team_advanced_analytics', {
        _team_id: teamId,
        _period_days: periodDays
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_team_advanced_analytics');

      return {
        success: true,
        data: response,
        metadata: {
          operation: 'get_team_advanced_analytics',
          team_id: teamId,
          period_days: periodDays,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getTeamAdvancedAnalytics');
    }
  }

  /**
   * Get predictive analytics for team performance
   */
  async getPredictiveAnalytics(
    teamId: string,
    forecastDays: number = 30
  ): Promise<ServiceResponse<PredictiveAnalytics>> {
    try {
      const { data, error } = await supabase.rpc('get_predictive_team_analytics', {
        _team_id: teamId,
        _forecast_days: forecastDays
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_predictive_team_analytics');

      return {
        success: true,
        data: response,
        metadata: {
          operation: 'get_predictive_team_analytics',
          team_id: teamId,
          forecast_days: forecastDays,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getPredictiveAnalytics');
    }
  }

  /**
   * Get analytics data from materialized views directly
   */
  async getAnalyticsSummary(teamId: string): Promise<ServiceResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('mv_advanced_analytics_summary')
        .select('*')
        .eq('team_id', teamId)
        .order('engagement_score', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: {
          operation: 'get_analytics_summary',
          team_id: teamId,
          timestamp: new Date().toISOString(),
          count: data?.length || 0
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getAnalyticsSummary');
    }
  }

  /**
   * Get team analytics summary from materialized view
   */
  async getTeamAnalyticsSummary(teamId: string): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('mv_team_advanced_analytics')
        .select('*')
        .eq('team_id', teamId)
        .single();

      if (error) throw error;

      return {
        success: true,
        data: data,
        metadata: {
          operation: 'get_team_analytics_summary',
          team_id: teamId,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getTeamAnalyticsSummary');
    }
  }

  /**
   * Refresh analytics materialized views
   */
  async refreshAnalyticsViews(): Promise<ServiceResponse<void>> {
    try {
      const { error } = await supabase.rpc('refresh_advanced_analytics_views');

      if (error) throw error;

      return {
        success: true,
        metadata: {
          operation: 'refresh_analytics_views',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'refreshAnalyticsViews');
    }
  }

  /**
   * Export analytics data in various formats
   */
  async exportAnalyticsData(
    teamId: string,
    options: AnalyticsExportOptions
  ): Promise<ServiceResponse<AnalyticsExportResult>> {
    try {
      // Get analytics data
      const analyticsResponse = await this.getTeamAdvancedAnalytics(teamId);
      if (!analyticsResponse.success) {
        throw new Error(analyticsResponse.error || 'Failed to get analytics data');
      }

      const memberAnalyticsResponse = await this.getAnalyticsSummary(teamId);
      if (!memberAnalyticsResponse.success) {
        throw new Error(memberAnalyticsResponse.error || 'Failed to get member analytics data');
      }

      // Generate export based on format
      const exportData = {
        team_analytics: analyticsResponse.data,
        member_analytics: memberAnalyticsResponse.data,
        export_options: options,
        generated_at: new Date().toISOString(),
        team_id: teamId
      };

      // For now, return JSON format (can be extended for CSV/PDF)
      const exportResult: AnalyticsExportResult = {
        export_id: `export_${teamId}_${Date.now()}`,
        download_url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`,
        file_size: JSON.stringify(exportData).length,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        format: options.format
      };

      return {
        success: true,
        data: exportResult,
        metadata: {
          operation: 'export_analytics_data',
          team_id: teamId,
          format: options.format,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'exportAnalyticsData');
    }
  }

  /**
   * Get comparative analytics between teams or time periods
   */
  async getComparativeAnalytics(
    teamIds: string[],
    periodDays: number = 30
  ): Promise<ServiceResponse<any[]>> {
    try {
      const comparativeData = [];

      for (const teamId of teamIds) {
        const teamAnalytics = await this.getTeamAdvancedAnalytics(teamId, periodDays);
        if (teamAnalytics.success) {
          comparativeData.push({
            team_id: teamId,
            ...teamAnalytics.data
          });
        }
      }

      return {
        success: true,
        data: comparativeData,
        metadata: {
          operation: 'get_comparative_analytics',
          teams_analyzed: teamIds.length,
          period_days: periodDays,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getComparativeAnalytics');
    }
  }

  /**
   * Get real-time analytics updates using Supabase Realtime
   */
  subscribeToAnalyticsUpdates(
    teamId: string,
    callback: (payload: any) => void
  ): () => void {
    const channel = supabase
      .channel(`analytics_${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mv_advanced_analytics_summary',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          callback({
            type: 'analytics_update',
            team_id: teamId,
            timestamp: new Date().toISOString(),
            data: payload
          });
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Get analytics performance metrics
   */
  async getAnalyticsPerformanceMetrics(
    teamId?: string,
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

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: {
          operation: 'get_analytics_performance_metrics',
          team_id: teamId,
          hours_back: hoursBack,
          timestamp: new Date().toISOString(),
          count: data?.length || 0
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getAnalyticsPerformanceMetrics');
    }
  }

  /**
   * Health check for analytics service
   */
  async healthCheck(): Promise<ServiceResponse<{ status: string; timestamp: string }>> {
    try {
      // Test basic connectivity
      const { data, error } = await supabase
        .from('mv_advanced_analytics_summary')
        .select('team_id')
        .limit(1);

      if (error) throw error;

      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          operation: 'health_check',
          materialized_views_accessible: true
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Analytics service unhealthy',
        error_code: 'SERVICE_UNHEALTHY',
        metadata: {
          operation: 'health_check',
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
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
    console.error(`AdvancedAnalyticsService.${operation} error:`, error);
    
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
export const advancedAnalyticsService = new AdvancedAnalyticsService();
