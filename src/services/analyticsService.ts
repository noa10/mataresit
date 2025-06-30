import { supabase } from '@/integrations/supabase/client';
import { InteractionType } from '@/types/personalization';

export interface UserAnalytics {
  totalInteractions: number;
  interactionsByType: Record<InteractionType, number>;
  dailyActivity: Array<{
    date: string;
    interactions: number;
    chatMessages: number;
    searchQueries: number;
    uiActions: number;
  }>;
  patterns: {
    mostActiveHour: number;
    mostActiveDay: string;
    averageSessionDuration: number;
    preferredFeatures: string[];
  };
  insights: {
    receiptManagementStyle: 'batch_processor' | 'regular_uploader' | 'occasional_user';
    searchBehavior: 'power_searcher' | 'casual_searcher' | 'browser';
    chatEngagement: 'conversational' | 'task_focused' | 'minimal';
    efficiency: 'high' | 'medium' | 'low';
  };
}

export interface UsageStatistics {
  period: 'day' | 'week' | 'month';
  totalSessions: number;
  averageSessionDuration: number;
  totalInteractions: number;
  featureUsage: Record<string, number>;
  trends: {
    interactionTrend: 'increasing' | 'stable' | 'decreasing';
    engagementScore: number;
    productivityScore: number;
  };
}

export interface PersonalizedInsights {
  receiptPatterns: {
    uploadFrequency: string;
    preferredUploadTime: string;
    averageReceiptValue: number;
    topCategories: string[];
    processingEfficiency: number;
  };
  searchPatterns: {
    queryComplexity: 'simple' | 'moderate' | 'complex';
    searchSuccess: number;
    preferredSearchType: 'semantic' | 'keyword' | 'filter';
  };
  chatPatterns: {
    messageLength: 'short' | 'medium' | 'long';
    questionFrequency: number;
    responsePreference: 'detailed' | 'concise' | 'visual';
  };
  recommendations: Array<{
    type: 'feature' | 'workflow' | 'setting';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

class AnalyticsService {
  /**
   * Get comprehensive user analytics
   */
  async getUserAnalytics(timeframe: 'week' | 'month' | 'quarter' = 'month'): Promise<UserAnalytics> {
    try {
      const { data, error } = await supabase.rpc('get_user_analytics', {
        p_timeframe: timeframe
      });

      if (error) {
        console.error('Error fetching user analytics:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to get user analytics:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for a specific period
   */
  async getUsageStatistics(period: 'day' | 'week' | 'month' = 'week'): Promise<UsageStatistics> {
    try {
      const { data, error } = await supabase.rpc('get_usage_statistics', {
        p_period: period
      });

      if (error) {
        console.error('Error fetching usage statistics:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to get usage statistics:', error);
      throw error;
    }
  }

  /**
   * Get personalized insights about user behavior
   */
  async getPersonalizedInsights(): Promise<PersonalizedInsights> {
    try {
      const { data, error } = await supabase.rpc('get_personalized_insights');

      if (error) {
        console.error('Error fetching personalized insights:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to get personalized insights:', error);
      throw error;
    }
  }

  /**
   * Get interaction trends over time
   */
  async getInteractionTrends(days: number = 30): Promise<Array<{
    date: string;
    interactions: number;
    chatMessages: number;
    searchQueries: number;
    uiActions: number;
    featureUsage: number;
  }>> {
    try {
      const { data, error } = await supabase.rpc('get_interaction_trends', {
        p_days: days
      });

      if (error) {
        console.error('Error fetching interaction trends:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get interaction trends:', error);
      throw error;
    }
  }

  /**
   * Analyze user patterns and generate insights
   */
  async analyzeUserPatterns(): Promise<{
    patterns: Record<string, any>;
    insights: string[];
    recommendations: Array<{
      type: string;
      message: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  }> {
    try {
      const { data, error } = await supabase.rpc('analyze_user_patterns');

      if (error) {
        console.error('Error analyzing user patterns:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to analyze user patterns:', error);
      throw error;
    }
  }

  /**
   * Get feature usage analytics
   */
  async getFeatureUsageAnalytics(): Promise<Array<{
    feature: string;
    usageCount: number;
    averageDuration: number;
    successRate: number;
    lastUsed: string;
    trend: 'increasing' | 'stable' | 'decreasing';
  }>> {
    try {
      const { data, error } = await supabase.rpc('get_feature_usage_analytics');

      if (error) {
        console.error('Error fetching feature usage analytics:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get feature usage analytics:', error);
      throw error;
    }
  }

  /**
   * Get chat analytics
   */
  async getChatAnalytics(): Promise<{
    totalMessages: number;
    averageMessageLength: number;
    questionRatio: number;
    responseTime: number;
    topTopics: string[];
    satisfactionScore: number;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_chat_analytics');

      if (error) {
        console.error('Error fetching chat analytics:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to get chat analytics:', error);
      throw error;
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(): Promise<{
    totalQueries: number;
    averageResultsCount: number;
    queryTypes: Record<string, number>;
    successRate: number;
    topQueries: string[];
    searchEfficiency: number;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_search_analytics');

      if (error) {
        console.error('Error fetching search analytics:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to get search analytics:', error);
      throw error;
    }
  }

  /**
   * Generate productivity insights
   */
  async getProductivityInsights(): Promise<{
    productivityScore: number;
    efficiencyTrends: Array<{
      date: string;
      score: number;
    }>;
    timeOptimization: Array<{
      suggestion: string;
      potentialSavings: string;
      difficulty: 'easy' | 'medium' | 'hard';
    }>;
    workflowRecommendations: Array<{
      workflow: string;
      description: string;
      benefits: string[];
    }>;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_productivity_insights');

      if (error) {
        console.error('Error fetching productivity insights:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to get productivity insights:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const analytics = await this.getUserAnalytics();
      const insights = await this.getPersonalizedInsights();
      const trends = await this.getInteractionTrends();

      const exportData = {
        analytics,
        insights,
        trends,
        exportedAt: new Date().toISOString()
      };

      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      } else {
        // Convert to CSV format
        return this.convertToCSV(exportData);
      }
    } catch (error) {
      console.error('Failed to export analytics data:', error);
      throw error;
    }
  }

  /**
   * Convert analytics data to CSV format
   */
  private convertToCSV(data: any): string {
    // Implementation for CSV conversion
    const csvRows: string[] = [];
    
    // Add headers
    csvRows.push('Date,Interactions,Chat Messages,Search Queries,UI Actions');
    
    // Add data rows
    if (data.trends) {
      data.trends.forEach((trend: any) => {
        csvRows.push(`${trend.date},${trend.interactions},${trend.chatMessages},${trend.searchQueries},${trend.uiActions}`);
      });
    }
    
    return csvRows.join('\n');
  }
}

export const analyticsService = new AnalyticsService();
