import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AdvancedAnalyticsDashboard } from '@/components/team/enhanced/AdvancedAnalyticsDashboard';
import { advancedAnalyticsService } from '@/services/advancedAnalyticsService';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/services/advancedAnalyticsService');
vi.mock('@/hooks/use-toast');

// Mock chart components to avoid canvas rendering issues in tests
vi.mock('@/components/team/enhanced/PredictiveAnalyticsChart', () => ({
  PredictiveAnalyticsChart: ({ predictiveData }: any) => (
    <div data-testid="predictive-chart">
      Predictive Chart: {predictiveData?.forecast_period?.forecast_days} days
    </div>
  )
}));

vi.mock('@/components/team/enhanced/ROIAnalysisChart', () => ({
  ROIAnalysisChart: ({ teamAnalytics }: any) => (
    <div data-testid="roi-chart">
      ROI Chart: {teamAnalytics?.team_info?.team_name}
    </div>
  )
}));

vi.mock('@/components/team/enhanced/CollaborationMetricsChart', () => ({
  CollaborationMetricsChart: ({ teamAnalytics }: any) => (
    <div data-testid="collaboration-chart">
      Collaboration Chart: {teamAnalytics?.collaboration_summary?.avg_collaboration_score}
    </div>
  )
}));

vi.mock('@/components/team/enhanced/ComparativeAnalyticsChart', () => ({
  ComparativeAnalyticsChart: ({ memberAnalytics }: any) => (
    <div data-testid="comparative-chart">
      Comparative Chart: {memberAnalytics?.length} members
    </div>
  )
}));

const mockToast = vi.fn();
(useToast as Mock).mockReturnValue({ toast: mockToast });

describe('AdvancedAnalyticsDashboard Integration Tests', () => {
  const mockTeamId = 'test-team-id';
  const mockTeamAnalytics = {
    team_info: {
      team_id: mockTeamId,
      team_name: 'Test Team',
      total_members: 10,
      team_health_status: 'excellent'
    },
    activity_summary: {
      avg_engagement_score: 85.5,
      team_receipts_30_days: 150,
      team_receipts_7_days: 35
    },
    collaboration_summary: {
      avg_collaboration_score: 72.3,
      team_conversations: 25,
      collaboration_effectiveness: 'good'
    },
    performance_distribution: {
      high_performers: 3,
      solid_contributors: 5,
      developing_members: 1,
      needs_attention: 1,
      at_risk_members: 0,
      performance_percentages: {
        high_performers_pct: 30,
        solid_contributors_pct: 50,
        at_risk_pct: 0
      }
    },
    team_insights: {
      strengths: ['Strong collaboration', 'High engagement'],
      areas_for_improvement: ['Cross-team communication'],
      recommended_actions: ['Improve documentation', 'Regular check-ins']
    }
  };

  const mockMemberAnalytics = [
    {
      user_id: 'user1',
      role: 'admin',
      engagement_score: 90,
      collaboration_score: 85,
      performance_category: 'high_performer',
      receipts_created: 25,
      conversations_created: 5,
      active_conversations_30_days: 3
    },
    {
      user_id: 'user2',
      role: 'member',
      engagement_score: 75,
      collaboration_score: 65,
      performance_category: 'solid_contributor',
      receipts_created: 18,
      conversations_created: 2,
      active_conversations_30_days: 1
    }
  ];

  const mockPredictiveAnalytics = {
    forecast_period: {
      start_date: '2025-01-24',
      end_date: '2025-02-23',
      forecast_days: 30
    },
    performance_forecast: {
      predicted_activity_level: 88.2,
      predicted_collaboration_score: 75.8,
      team_health_forecast: 'improving'
    },
    risk_assessment: {
      member_attrition_risk: 'low',
      productivity_decline_risk: 'medium',
      team_cohesion_risk: 'low'
    },
    recommendations: {
      immediate_actions: ['Monitor productivity trends', 'Enhance team communication'],
      strategic_initiatives: ['Implement mentorship program', 'Expand collaboration tools']
    },
    metadata: {
      generated_at: '2025-01-24T10:00:00Z',
      generated_by: 'system',
      team_id: mockTeamId,
      forecast_confidence: 'high',
      data_points_analyzed: 100
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful analytics service responses
    (advancedAnalyticsService.getTeamAdvancedAnalytics as Mock).mockResolvedValue({
      success: true,
      data: mockTeamAnalytics
    });
    
    (advancedAnalyticsService.getAnalyticsSummary as Mock).mockResolvedValue({
      success: true,
      data: mockMemberAnalytics
    });
    
    (advancedAnalyticsService.getPredictiveAnalytics as Mock).mockResolvedValue({
      success: true,
      data: mockPredictiveAnalytics
    });

    (advancedAnalyticsService.subscribeToAnalyticsUpdates as Mock).mockReturnValue(() => {});
  });

  describe('Dashboard Loading and Initialization', () => {
    it('should display loading state initially', () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      expect(screen.getByText('Loading Advanced Analytics')).toBeInTheDocument();
      expect(screen.getByText('Gathering comprehensive analytics data...')).toBeInTheDocument();
    });

    it('should load and display analytics data successfully', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} userRole="admin" />);
      
      await waitFor(() => {
        expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      });

      // Check key metrics are displayed
      expect(screen.getByText('excellent')).toBeInTheDocument(); // Team health
      expect(screen.getByText('86')).toBeInTheDocument(); // Rounded engagement score
      expect(screen.getByText('3')).toBeInTheDocument(); // High performers
      expect(screen.getByText('0')).toBeInTheDocument(); // At risk members
    });

    it('should handle analytics loading errors gracefully', async () => {
      (advancedAnalyticsService.getTeamAdvancedAnalytics as Mock).mockResolvedValue({
        success: false,
        error: 'Failed to load analytics'
      });

      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error Loading Analytics",
          description: "Failed to load advanced analytics data. Please try again.",
          variant: "destructive",
        });
      });
    });
  });

  describe('Tab Navigation and Content', () => {
    it('should display performance tab content by default', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Performance Distribution')).toBeInTheDocument();
      });

      // Check performance distribution numbers
      expect(screen.getByText('3')).toBeInTheDocument(); // High performers
      expect(screen.getByText('5')).toBeInTheDocument(); // Solid contributors
    });

    it('should switch to collaboration tab and display collaboration chart', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Collaboration' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: 'Collaboration' }));
      
      await waitFor(() => {
        expect(screen.getByTestId('collaboration-chart')).toBeInTheDocument();
        expect(screen.getByText('Collaboration Chart: 72.3')).toBeInTheDocument();
      });
    });

    it('should show predictive tab for admin users', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} userRole="admin" />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Predictive' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: 'Predictive' }));
      
      await waitFor(() => {
        expect(screen.getByTestId('predictive-chart')).toBeInTheDocument();
        expect(screen.getByText('Predictive Chart: 30 days')).toBeInTheDocument();
      });
    });

    it('should hide predictive tab for regular members', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} userRole="member" />);
      
      await waitFor(() => {
        expect(screen.queryByRole('tab', { name: 'Predictive' })).not.toBeInTheDocument();
      });
    });

    it('should show ROI analysis tab for admin users', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} userRole="owner" />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'ROI Analysis' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: 'ROI Analysis' }));
      
      await waitFor(() => {
        expect(screen.getByTestId('roi-chart')).toBeInTheDocument();
        expect(screen.getByText('ROI Chart: Test Team')).toBeInTheDocument();
      });
    });

    it('should display comparative analytics tab', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Comparative' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: 'Comparative' }));
      
      await waitFor(() => {
        expect(screen.getByTestId('comparative-chart')).toBeInTheDocument();
        expect(screen.getByText('Comparative Chart: 2 members')).toBeInTheDocument();
      });
    });
  });

  describe('Controls and Interactions', () => {
    it('should change timeframe and reload data', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Last Month')).toBeInTheDocument();
      });

      // Change timeframe
      fireEvent.click(screen.getByDisplayValue('Last Month'));
      fireEvent.click(screen.getByText('Last Week'));
      
      await waitFor(() => {
        expect(advancedAnalyticsService.getTeamAdvancedAnalytics).toHaveBeenCalledWith(
          mockTeamId,
          7 // 7 days for week
        );
      });
    });

    it('should toggle real-time mode', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Real-time')).toBeInTheDocument();
      });

      const realTimeButton = screen.getByText('Real-time');
      fireEvent.click(realTimeButton);
      
      // Should set up subscription when enabled
      expect(advancedAnalyticsService.subscribeToAnalyticsUpdates).toHaveBeenCalledWith(
        mockTeamId,
        expect.any(Function)
      );
    });

    it('should refresh data manually', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      // Clear previous calls
      vi.clearAllMocks();

      fireEvent.click(screen.getByText('Refresh'));
      
      await waitFor(() => {
        expect(advancedAnalyticsService.getTeamAdvancedAnalytics).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith({
          title: "Analytics Updated",
          description: "Advanced analytics data has been refreshed.",
        });
      });
    });

    it('should export analytics data', async () => {
      (advancedAnalyticsService.exportAnalyticsData as Mock).mockResolvedValue({
        success: true,
        data: {
          export_id: 'export-123',
          download_url: 'data:application/json;charset=utf-8,{"test":"data"}',
          file_size: 1024,
          expires_at: '2025-01-25T10:00:00Z',
          format: 'json'
        }
      });

      // Mock document.createElement and related DOM methods
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Export'));
      
      await waitFor(() => {
        expect(advancedAnalyticsService.exportAnalyticsData).toHaveBeenCalledWith(
          mockTeamId,
          {
            format: 'json',
            include_charts: true,
            include_recommendations: true
          }
        );
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Successful",
          description: "Analytics data has been exported successfully.",
        });
      });

      // Verify download link was created and clicked
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
      
      // Cleanup
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('Individual Member View', () => {
    it('should switch to individual view mode', async () => {
      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} selectedMemberId="user1" />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Team Overview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByDisplayValue('Team Overview'));
      fireEvent.click(screen.getByText('Individual'));
      
      await waitFor(() => {
        expect(advancedAnalyticsService.getAdvancedMemberAnalytics).toHaveBeenCalledWith(
          mockTeamId,
          'user1',
          30
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle export errors gracefully', async () => {
      (advancedAnalyticsService.exportAnalyticsData as Mock).mockResolvedValue({
        success: false,
        error: 'Export failed'
      });

      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Export'));
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Failed",
          description: "Failed to export analytics data. Please try again.",
          variant: "destructive",
        });
      });
    });

    it('should handle real-time subscription errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      (advancedAnalyticsService.subscribeToAnalyticsUpdates as Mock).mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      });

      // Should not crash the component
      expect(screen.getByText('Real-time')).toBeInTheDocument();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Performance Considerations', () => {
    it('should not make unnecessary API calls on re-renders', async () => {
      const { rerender } = render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      });

      const initialCallCount = (advancedAnalyticsService.getTeamAdvancedAnalytics as Mock).mock.calls.length;
      
      // Re-render with same props
      rerender(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      // Should not make additional calls
      expect((advancedAnalyticsService.getTeamAdvancedAnalytics as Mock).mock.calls.length)
        .toBe(initialCallCount);
    });

    it('should cleanup subscriptions on unmount', async () => {
      const unsubscribeMock = vi.fn();
      (advancedAnalyticsService.subscribeToAnalyticsUpdates as Mock).mockReturnValue(unsubscribeMock);

      const { unmount } = render(<AdvancedAnalyticsDashboard teamId={mockTeamId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      });

      unmount();
      
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
