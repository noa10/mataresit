import { supabase } from '@/lib/supabase';
import { advancedAnalyticsService } from './advancedAnalyticsService';
import { ServiceResponse } from '@/types/team';

// ============================================================================
// AUTOMATED REPORTING TYPES
// ============================================================================

export interface ReportSchedule {
  id: string;
  team_id: string;
  report_type: 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  format: 'pdf' | 'email' | 'dashboard';
  enabled: boolean;
  next_run: string;
  last_run?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
  format_options: ReportFormatOptions;
}

export interface ReportSection {
  type: 'overview' | 'performance' | 'collaboration' | 'predictive' | 'roi' | 'insights';
  title: string;
  include_charts: boolean;
  include_recommendations: boolean;
  custom_filters?: Record<string, any>;
}

export interface ReportFormatOptions {
  include_executive_summary: boolean;
  include_detailed_metrics: boolean;
  include_member_breakdown: boolean;
  include_action_items: boolean;
  branding?: {
    logo_url?: string;
    company_name?: string;
    color_scheme?: string;
  };
}

export interface GeneratedReport {
  id: string;
  team_id: string;
  report_type: string;
  generated_at: string;
  file_url?: string;
  email_sent: boolean;
  recipients: string[];
  summary: ReportSummary;
}

export interface ReportSummary {
  team_health: string;
  key_insights: string[];
  action_items: string[];
  performance_highlights: string[];
  areas_for_improvement: string[];
}

// ============================================================================
// AUTOMATED REPORTING SERVICE
// ============================================================================

export class AutomatedReportingService {
  
  /**
   * Create a new report schedule
   */
  async createReportSchedule(
    teamId: string,
    schedule: Omit<ReportSchedule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ServiceResponse<ReportSchedule>> {
    try {
      const { data, error } = await supabase
        .from('report_schedules')
        .insert({
          ...schedule,
          team_id: teamId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        metadata: {
          operation: 'create_report_schedule',
          team_id: teamId,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'createReportSchedule');
    }
  }

  /**
   * Generate an automated report
   */
  async generateAutomatedReport(
    teamId: string,
    reportType: 'weekly' | 'monthly' | 'quarterly',
    template?: ReportTemplate
  ): Promise<ServiceResponse<GeneratedReport>> {
    try {
      // Get analytics data
      const [teamAnalytics, memberAnalytics, predictiveAnalytics] = await Promise.all([
        advancedAnalyticsService.getTeamAdvancedAnalytics(teamId),
        advancedAnalyticsService.getAnalyticsSummary(teamId),
        advancedAnalyticsService.getPredictiveAnalytics(teamId)
      ]);

      if (!teamAnalytics.success) {
        throw new Error('Failed to get team analytics');
      }

      // Generate report content
      const reportContent = await this.generateReportContent(
        teamAnalytics.data,
        memberAnalytics.data || [],
        predictiveAnalytics.data,
        template
      );

      // Create report summary
      const summary = this.generateReportSummary(
        teamAnalytics.data,
        memberAnalytics.data || [],
        predictiveAnalytics.data
      );

      // Save generated report
      const { data, error } = await supabase
        .from('generated_reports')
        .insert({
          team_id: teamId,
          report_type: reportType,
          generated_at: new Date().toISOString(),
          email_sent: false,
          recipients: [],
          summary,
          content: reportContent
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        metadata: {
          operation: 'generate_automated_report',
          team_id: teamId,
          report_type: reportType,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'generateAutomatedReport');
    }
  }

  /**
   * Send report via email
   */
  async sendReportEmail(
    reportId: string,
    recipients: string[],
    customMessage?: string
  ): Promise<ServiceResponse<void>> {
    try {
      // Get report data
      const { data: report, error } = await supabase
        .from('generated_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;

      // Prepare email content
      const emailContent = this.generateEmailContent(report, customMessage);

      // Send email (integrate with your email service)
      // This is a placeholder - integrate with your actual email service
      const emailResult = await this.sendEmail(recipients, emailContent);

      // Update report as sent
      await supabase
        .from('generated_reports')
        .update({
          email_sent: true,
          recipients,
          sent_at: new Date().toISOString()
        })
        .eq('id', reportId);

      return {
        success: true,
        metadata: {
          operation: 'send_report_email',
          report_id: reportId,
          recipients_count: recipients.length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'sendReportEmail');
    }
  }

  /**
   * Get report schedules for a team
   */
  async getReportSchedules(teamId: string): Promise<ServiceResponse<ReportSchedule[]>> {
    try {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: {
          operation: 'get_report_schedules',
          team_id: teamId,
          count: data?.length || 0,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getReportSchedules');
    }
  }

  /**
   * Get generated reports for a team
   */
  async getGeneratedReports(
    teamId: string,
    limit: number = 10
  ): Promise<ServiceResponse<GeneratedReport[]>> {
    try {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('*')
        .eq('team_id', teamId)
        .order('generated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: {
          operation: 'get_generated_reports',
          team_id: teamId,
          count: data?.length || 0,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'getGeneratedReports');
    }
  }

  /**
   * Process scheduled reports (to be called by cron job)
   */
  async processScheduledReports(): Promise<ServiceResponse<{ processed: number }>> {
    try {
      // Get due reports
      const { data: dueReports, error } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('enabled', true)
        .lte('next_run', new Date().toISOString());

      if (error) throw error;

      let processed = 0;

      for (const schedule of dueReports || []) {
        try {
          // Generate report
          const reportResult = await this.generateAutomatedReport(
            schedule.team_id,
            schedule.report_type
          );

          if (reportResult.success && schedule.recipients.length > 0) {
            // Send email if recipients are configured
            await this.sendReportEmail(
              reportResult.data.id,
              schedule.recipients
            );
          }

          // Update next run time
          const nextRun = this.calculateNextRun(schedule.report_type);
          await supabase
            .from('report_schedules')
            .update({
              last_run: new Date().toISOString(),
              next_run: nextRun
            })
            .eq('id', schedule.id);

          processed++;
        } catch (error) {
          console.error(`Failed to process report schedule ${schedule.id}:`, error);
        }
      }

      return {
        success: true,
        data: { processed },
        metadata: {
          operation: 'process_scheduled_reports',
          processed_count: processed,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return this.handleError(error, 'processScheduledReports');
    }
  }

  /**
   * Generate report content
   */
  private async generateReportContent(
    teamAnalytics: any,
    memberAnalytics: any[],
    predictiveAnalytics: any,
    template?: ReportTemplate
  ): Promise<any> {
    return {
      executive_summary: {
        team_health: teamAnalytics.team_info.team_health_status,
        total_members: teamAnalytics.team_info.total_members,
        avg_engagement: Math.round(teamAnalytics.activity_summary.avg_engagement_score),
        high_performers: teamAnalytics.performance_distribution.high_performers,
        at_risk_members: teamAnalytics.performance_distribution.at_risk_members
      },
      performance_metrics: {
        engagement_distribution: teamAnalytics.performance_distribution,
        collaboration_summary: teamAnalytics.collaboration_summary,
        activity_summary: teamAnalytics.activity_summary
      },
      member_insights: memberAnalytics.slice(0, 10).map(member => ({
        user_id: member.user_id,
        role: member.role,
        engagement_score: member.engagement_score,
        collaboration_score: member.collaboration_score,
        performance_category: member.performance_category
      })),
      recommendations: teamAnalytics.team_insights.recommended_actions,
      predictive_insights: predictiveAnalytics ? {
        team_trajectory: predictiveAnalytics.predictive_analytics.team_trajectory,
        risk_assessment: predictiveAnalytics.risk_assessment,
        immediate_actions: predictiveAnalytics.recommendations.immediate_actions
      } : null
    };
  }

  /**
   * Generate report summary
   */
  private generateReportSummary(
    teamAnalytics: any,
    memberAnalytics: any[],
    predictiveAnalytics: any
  ): ReportSummary {
    return {
      team_health: teamAnalytics.team_info.team_health_status,
      key_insights: [
        `Team has ${teamAnalytics.performance_distribution.high_performers} high performers`,
        `Average engagement score: ${Math.round(teamAnalytics.activity_summary.avg_engagement_score)}`,
        `Collaboration effectiveness: ${teamAnalytics.collaboration_summary.collaboration_effectiveness}`
      ],
      action_items: teamAnalytics.team_insights.recommended_actions.slice(0, 3),
      performance_highlights: teamAnalytics.team_insights.strengths,
      areas_for_improvement: teamAnalytics.team_insights.areas_for_improvement
    };
  }

  /**
   * Generate email content
   */
  private generateEmailContent(report: any, customMessage?: string): any {
    return {
      subject: `Team Analytics Report - ${new Date(report.generated_at).toLocaleDateString()}`,
      html: `
        <h2>Team Analytics Report</h2>
        ${customMessage ? `<p>${customMessage}</p>` : ''}
        <h3>Executive Summary</h3>
        <p>Team Health: <strong>${report.summary.team_health}</strong></p>
        <h4>Key Insights:</h4>
        <ul>
          ${report.summary.key_insights.map((insight: string) => `<li>${insight}</li>`).join('')}
        </ul>
        <h4>Recommended Actions:</h4>
        <ul>
          ${report.summary.action_items.map((action: string) => `<li>${action}</li>`).join('')}
        </ul>
        <p><em>Generated on ${new Date(report.generated_at).toLocaleString()}</em></p>
      `
    };
  }

  /**
   * Calculate next run time for scheduled reports
   */
  private calculateNextRun(reportType: string): string {
    const now = new Date();
    switch (reportType) {
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        now.setMonth(now.getMonth() + 3);
        break;
    }
    return now.toISOString();
  }

  /**
   * Send email (placeholder - integrate with actual email service)
   */
  private async sendEmail(recipients: string[], content: any): Promise<boolean> {
    // Integrate with your email service (SendGrid, AWS SES, etc.)
    console.log('Sending email to:', recipients, 'Content:', content);
    return true;
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: any, operation: string): ServiceResponse<any> {
    console.error(`AutomatedReportingService.${operation} error:`, error);
    
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
export const automatedReportingService = new AutomatedReportingService();
