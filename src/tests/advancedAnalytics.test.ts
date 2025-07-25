import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { advancedAnalyticsService } from '@/services/advancedAnalyticsService';
import { automatedReportingService } from '@/services/automatedReportingService';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            single: vi.fn(),
            limit: vi.fn()
          })),
          single: vi.fn(),
          limit: vi.fn()
        })),
        order: vi.fn(() => ({
          single: vi.fn(),
          limit: vi.fn()
        })),
        single: vi.fn(),
        limit: vi.fn()
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn()
      }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn()
      }))
    })),
    removeChannel: vi.fn()
  }
}));

describe('Advanced Analytics Service', () => {
  const mockTeamId = 'test-team-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAdvancedMemberAnalytics', () => {
    it('should successfully get member analytics', async () => {
      const mockAnalyticsData = {
        member_info: {
          user_id: mockUserId,
          role: 'member',
          performance_category: 'high_performer',
          activity_trend: 'increasing'
        },
        activity_metrics: {
          engagement_score: 85,
          receipts_created: 25,
          receipts_ai_processed: 20
        },
        collaboration_metrics: {
          collaboration_score: 75,
          conversations_created: 5,
          active_conversations_30_days: 3
        }
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockAnalyticsData,
        error: null
      });

      const result = await advancedAnalyticsService.getAdvancedMemberAnalytics(
        mockTeamId,
        mockUserId,
        30
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalyticsData);
      expect(result.metadata?.operation).toBe('get_advanced_member_analytics');
      expect(supabase.rpc).toHaveBeenCalledWith('get_advanced_member_analytics', {
        _team_id: mockTeamId,
        _user_id: mockUserId,
        _period_days: 30
      });
    });

    it('should handle database errors gracefully', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'DB_ERROR' }
      });

      const result = await advancedAnalyticsService.getAdvancedMemberAnalytics(
        mockTeamId,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.error_code).toBe('DB_ERROR');
    });

    it('should use default period when not specified', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {},
        error: null
      });

      await advancedAnalyticsService.getAdvancedMemberAnalytics(mockTeamId);

      expect(supabase.rpc).toHaveBeenCalledWith('get_advanced_member_analytics', {
        _team_id: mockTeamId,
        _user_id: null,
        _period_days: 30
      });
    });
  });

  describe('getTeamAdvancedAnalytics', () => {
    it('should successfully get team analytics', async () => {
      const mockTeamAnalytics = {
        team_info: {
          team_id: mockTeamId,
          team_name: 'Test Team',
          total_members: 10,
          team_health_status: 'excellent'
        },
        performance_distribution: {
          high_performers: 3,
          solid_contributors: 5,
          at_risk_members: 1
        },
        activity_summary: {
          avg_engagement_score: 78.5,
          team_receipts_30_days: 150
        }
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockTeamAnalytics,
        error: null
      });

      const result = await advancedAnalyticsService.getTeamAdvancedAnalytics(mockTeamId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTeamAnalytics);
      expect(result.metadata?.team_id).toBe(mockTeamId);
    });
  });

  describe('getPredictiveAnalytics', () => {
    it('should successfully get predictive analytics', async () => {
      const mockPredictiveData = {
        forecast_period: {
          start_date: '2025-01-24',
          end_date: '2025-02-23',
          forecast_days: 30
        },
        performance_forecast: {
          predicted_activity_level: 85.2,
          predicted_collaboration_score: 72.8,
          team_health_forecast: 'improving'
        },
        risk_assessment: {
          member_attrition_risk: 'low',
          productivity_decline_risk: 'medium',
          team_cohesion_risk: 'low'
        }
      };

      (supabase.rpc as any).mockResolvedValue({
        data: mockPredictiveData,
        error: null
      });

      const result = await advancedAnalyticsService.getPredictiveAnalytics(mockTeamId, 30);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPredictiveData);
      expect(supabase.rpc).toHaveBeenCalledWith('get_predictive_team_analytics', {
        _team_id: mockTeamId,
        _forecast_days: 30
      });
    });
  });

  describe('getAnalyticsSummary', () => {
    it('should successfully get analytics summary from materialized view', async () => {
      const mockSummaryData = [
        {
          user_id: 'user1',
          engagement_score: 85,
          collaboration_score: 75,
          performance_category: 'high_performer'
        },
        {
          user_id: 'user2',
          engagement_score: 65,
          collaboration_score: 55,
          performance_category: 'solid_contributor'
        }
      ];

      const mockSupabaseChain = {
        select: vi.fn(() => mockSupabaseChain),
        eq: vi.fn(() => mockSupabaseChain),
        order: vi.fn(() => Promise.resolve({
          data: mockSummaryData,
          error: null
        }))
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await advancedAnalyticsService.getAnalyticsSummary(mockTeamId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSummaryData);
      expect(result.metadata?.count).toBe(2);
      expect(supabase.from).toHaveBeenCalledWith('mv_advanced_analytics_summary');
    });
  });

  describe('exportAnalyticsData', () => {
    it('should successfully export analytics data', async () => {
      // Mock successful analytics responses
      const mockTeamAnalytics = { team_info: { team_id: mockTeamId } };
      const mockMemberAnalytics = [{ user_id: 'user1' }];

      vi.spyOn(advancedAnalyticsService, 'getTeamAdvancedAnalytics')
        .mockResolvedValue({ success: true, data: mockTeamAnalytics });
      vi.spyOn(advancedAnalyticsService, 'getAnalyticsSummary')
        .mockResolvedValue({ success: true, data: mockMemberAnalytics });

      const result = await advancedAnalyticsService.exportAnalyticsData(mockTeamId, {
        format: 'json',
        include_charts: true,
        include_recommendations: true
      });

      expect(result.success).toBe(true);
      expect(result.data?.export_id).toContain('export_');
      expect(result.data?.format).toBe('json');
      expect(result.data?.download_url).toContain('data:application/json');
    });

    it('should handle export errors when analytics data is unavailable', async () => {
      vi.spyOn(advancedAnalyticsService, 'getTeamAdvancedAnalytics')
        .mockResolvedValue({ success: false, error: 'Analytics unavailable' });

      const result = await advancedAnalyticsService.exportAnalyticsData(mockTeamId, {
        format: 'json'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Analytics unavailable');
    });
  });

  describe('subscribeToAnalyticsUpdates', () => {
    it('should set up real-time subscription correctly', () => {
      const mockCallback = vi.fn();
      const mockChannel = {
        on: vi.fn(() => mockChannel),
        subscribe: vi.fn()
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      const unsubscribe = advancedAnalyticsService.subscribeToAnalyticsUpdates(
        mockTeamId,
        mockCallback
      );

      expect(supabase.channel).toHaveBeenCalledWith(`analytics_${mockTeamId}`);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mv_advanced_analytics_summary',
          filter: `team_id=eq.${mockTeamId}`
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      const mockSupabaseChain = {
        select: vi.fn(() => mockSupabaseChain),
        limit: vi.fn(() => Promise.resolve({
          data: [{ team_id: 'test' }],
          error: null
        }))
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await advancedAnalyticsService.healthCheck();

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('healthy');
      expect(result.metadata?.materialized_views_accessible).toBe(true);
    });

    it('should return unhealthy status when database is not accessible', async () => {
      const mockSupabaseChain = {
        select: vi.fn(() => mockSupabaseChain),
        limit: vi.fn(() => Promise.resolve({
          data: null,
          error: { message: 'Connection failed' }
        }))
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await advancedAnalyticsService.healthCheck();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Analytics service unhealthy');
      expect(result.error_code).toBe('SERVICE_UNHEALTHY');
    });
  });
});

describe('Automated Reporting Service', () => {
  const mockTeamId = 'test-team-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReportSchedule', () => {
    it('should successfully create a report schedule', async () => {
      const mockSchedule = {
        team_id: mockTeamId,
        report_type: 'weekly' as const,
        recipients: ['test@example.com'],
        format: 'email' as const,
        enabled: true,
        next_run: '2025-01-31T00:00:00Z'
      };

      const mockSupabaseChain = {
        insert: vi.fn(() => mockSupabaseChain),
        select: vi.fn(() => mockSupabaseChain),
        single: vi.fn(() => Promise.resolve({
          data: { id: 'schedule-id', ...mockSchedule },
          error: null
        }))
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await automatedReportingService.createReportSchedule(
        mockTeamId,
        mockSchedule
      );

      expect(result.success).toBe(true);
      expect(result.data?.team_id).toBe(mockTeamId);
      expect(supabase.from).toHaveBeenCalledWith('report_schedules');
    });
  });

  describe('generateAutomatedReport', () => {
    it('should successfully generate an automated report', async () => {
      // Mock analytics service responses
      vi.spyOn(advancedAnalyticsService, 'getTeamAdvancedAnalytics')
        .mockResolvedValue({
          success: true,
          data: {
            team_info: { team_health_status: 'excellent', total_members: 10 },
            performance_distribution: { high_performers: 3, at_risk_members: 1 },
            activity_summary: { avg_engagement_score: 85 },
            collaboration_summary: { collaboration_effectiveness: 'good' },
            team_insights: { recommended_actions: ['Action 1', 'Action 2'], strengths: ['Strength 1'] }
          }
        });

      vi.spyOn(advancedAnalyticsService, 'getAnalyticsSummary')
        .mockResolvedValue({ success: true, data: [] });

      vi.spyOn(advancedAnalyticsService, 'getPredictiveAnalytics')
        .mockResolvedValue({ success: true, data: null });

      const mockSupabaseChain = {
        insert: vi.fn(() => mockSupabaseChain),
        select: vi.fn(() => mockSupabaseChain),
        single: vi.fn(() => Promise.resolve({
          data: { id: 'report-id', team_id: mockTeamId },
          error: null
        }))
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await automatedReportingService.generateAutomatedReport(
        mockTeamId,
        'weekly'
      );

      expect(result.success).toBe(true);
      expect(result.data?.team_id).toBe(mockTeamId);
      expect(supabase.from).toHaveBeenCalledWith('generated_reports');
    });

    it('should handle analytics service failures', async () => {
      vi.spyOn(advancedAnalyticsService, 'getTeamAdvancedAnalytics')
        .mockResolvedValue({ success: false, error: 'Analytics failed' });

      const result = await automatedReportingService.generateAutomatedReport(
        mockTeamId,
        'weekly'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Analytics failed');
    });
  });
});

describe('Performance Tests', () => {
  describe('Analytics Calculation Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = performance.now();
      
      // Mock large dataset
      const largeMemberAnalytics = Array.from({ length: 1000 }, (_, i) => ({
        user_id: `user-${i}`,
        engagement_score: Math.random() * 100,
        collaboration_score: Math.random() * 100,
        performance_category: 'solid_contributor'
      }));

      const mockSupabaseChain = {
        select: vi.fn(() => mockSupabaseChain),
        eq: vi.fn(() => mockSupabaseChain),
        order: vi.fn(() => Promise.resolve({
          data: largeMemberAnalytics,
          error: null
        }))
      };

      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      const result = await advancedAnalyticsService.getAnalyticsSummary(mockTeamId);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1000);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory Usage', () => {
    it('should not cause memory leaks with real-time subscriptions', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy multiple subscriptions
      for (let i = 0; i < 100; i++) {
        const unsubscribe = advancedAnalyticsService.subscribeToAnalyticsUpdates(
          `team-${i}`,
          () => {}
        );
        unsubscribe();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
