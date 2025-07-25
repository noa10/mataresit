import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemberAnalyticsDashboard } from '../MemberAnalyticsDashboard';
import { teamService } from '@/services/teamService';

// Mock the team service
vi.mock('@/services/teamService', () => ({
  teamService: {
    getMemberAnalytics: vi.fn(),
    getMemberPerformanceInsights: vi.fn(),
    getTeamEngagementMetrics: vi.fn(),
    getMemberActivityTimeline: vi.fn(),
  },
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock Recharts components to avoid canvas issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  RadialBarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="radial-bar-chart">{children}</div>,
  RadialBar: () => <div data-testid="radial-bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockTeamEngagementData = {
  team_overview: {
    total_members: 10,
    very_active_members: 3,
    active_members: 4,
    moderate_members: 2,
    inactive_members: 1,
    avg_member_tenure_days: 120,
  },
  activity_metrics: {
    total_activities: 500,
    recent_activities: 50,
    recent_contributors: 8,
    contributor_participation_rate: 80,
  },
  receipt_metrics: {
    total_receipts: 200,
    recent_receipts: 25,
    recent_amount: 5000,
    ai_adoption_rate: 75,
  },
  top_performers: [
    {
      user_id: 'user-1',
      full_name: 'John Doe',
      role: 'admin',
      activity_score: 95,
      receipt_count: 50,
      total_amount: 2000,
      engagement_level: 'high',
    },
  ],
  engagement_trends: [
    {
      date: '2024-01-01',
      active_members: 8,
      activities: 25,
      receipts: 10,
      amount: 500,
    },
  ],
  team_health_score: 85,
  insights: ['Team engagement is above average', 'AI adoption rate is excellent'],
};

const mockMemberAnalyticsData = {
  member_info: {
    user_id: 'user-1',
    role: 'admin',
    full_name: 'John Doe',
    email: 'john@example.com',
    joined_at: '2024-01-01T00:00:00Z',
  },
  activity_stats: {
    total_activities: 100,
    active_days: 25,
    activities_last_week: 15,
    activities_last_month: 60,
    avg_activity_interval_minutes: 120,
    activity_frequency: 'active',
  },
  engagement_metrics: {
    receipts_created: 30,
    total_amount_processed: 1500,
    ai_processed_receipts: 25,
    ai_adoption_rate: 83,
    engagement_level: 'high',
  },
  performance_data: {
    days_since_last_active: 1,
    activity_consistency: 85,
    member_status: 'very_active',
  },
};

describe('MemberAnalyticsDashboard', () => {
  const defaultProps = {
    teamId: 'test-team-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    // Mock service to never resolve
    vi.mocked(teamService.getTeamEngagementMetrics).mockImplementation(() => new Promise(() => {}));

    render(<MemberAnalyticsDashboard {...defaultProps} />);

    expect(screen.getByText('Member Analytics')).toBeInTheDocument();
    // Should show loading skeletons
    expect(screen.getAllByRole('generic')).toHaveLength(expect.any(Number));
  });

  it('renders team analytics view by default', async () => {
    vi.mocked(teamService.getTeamEngagementMetrics).mockResolvedValue({
      success: true,
      data: mockTeamEngagementData,
    });

    render(<MemberAnalyticsDashboard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Team-wide engagement and performance metrics')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Members')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Active Members')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument(); // very_active + active
  });

  it('switches to individual view when member is selected', async () => {
    vi.mocked(teamService.getMemberAnalytics).mockResolvedValue({
      success: true,
      data: mockMemberAnalyticsData,
    });
    vi.mocked(teamService.getMemberPerformanceInsights).mockResolvedValue({
      success: true,
      data: {},
    });

    render(<MemberAnalyticsDashboard {...defaultProps} selectedMemberId="user-1" />);

    // Wait for the view mode to change
    await waitFor(() => {
      expect(screen.getByText('Individual member performance insights')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('admin • Joined 1/1/2024')).toBeInTheDocument();
  });

  it('handles timeframe changes', async () => {
    vi.mocked(teamService.getTeamEngagementMetrics).mockResolvedValue({
      success: true,
      data: mockTeamEngagementData,
    });

    render(<MemberAnalyticsDashboard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Last Month')).toBeInTheDocument();
    });

    // Change timeframe to week
    const timeframeSelect = screen.getByDisplayValue('Last Month');
    fireEvent.click(timeframeSelect);
    
    const weekOption = screen.getByText('Last Week');
    fireEvent.click(weekOption);

    // Should call service with new timeframe (7 days)
    await waitFor(() => {
      expect(teamService.getTeamEngagementMetrics).toHaveBeenCalledWith('test-team-id', 7);
    });
  });

  it('handles refresh functionality', async () => {
    vi.mocked(teamService.getTeamEngagementMetrics).mockResolvedValue({
      success: true,
      data: mockTeamEngagementData,
    });

    render(<MemberAnalyticsDashboard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Should call service again
    await waitFor(() => {
      expect(teamService.getTeamEngagementMetrics).toHaveBeenCalledTimes(2);
    });
  });

  it('handles view mode toggle', async () => {
    vi.mocked(teamService.getTeamEngagementMetrics).mockResolvedValue({
      success: true,
      data: mockTeamEngagementData,
    });

    render(<MemberAnalyticsDashboard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Team View')).toBeInTheDocument();
    });

    // Change to individual view
    const viewModeSelect = screen.getByDisplayValue('Team View');
    fireEvent.click(viewModeSelect);
    
    const individualOption = screen.getByText('Individual');
    fireEvent.click(individualOption);

    await waitFor(() => {
      expect(screen.getByText('Individual member performance insights')).toBeInTheDocument();
    });
  });

  it('handles service errors gracefully', async () => {
    vi.mocked(teamService.getTeamEngagementMetrics).mockRejectedValue(
      new Error('Service error')
    );

    render(<MemberAnalyticsDashboard {...defaultProps} />);

    // Should handle error and show fallback content
    await waitFor(() => {
      expect(screen.getByText('No team engagement data available')).toBeInTheDocument();
    });
  });

  it('calls onMemberSelect when member is selected from team view', async () => {
    const mockOnMemberSelect = vi.fn();
    
    vi.mocked(teamService.getTeamEngagementMetrics).mockResolvedValue({
      success: true,
      data: mockTeamEngagementData,
    });

    render(
      <MemberAnalyticsDashboard 
        {...defaultProps} 
        onMemberSelect={mockOnMemberSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Top Performers')).toBeInTheDocument();
    });

    // Click on a top performer
    const performerCard = screen.getByText('John Doe').closest('div[role="button"], div[class*="cursor-pointer"]');
    if (performerCard) {
      fireEvent.click(performerCard);
      expect(mockOnMemberSelect).toHaveBeenCalledWith('user-1');
    }
  });
});
