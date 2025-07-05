import { notificationService } from './notificationService';
import { supabase } from '@/integrations/supabase/client';
import { NotificationType } from '@/types/notifications';

export interface TeamCollaborationNotificationData {
  teamId: string;
  actorUserId: string;
  actorName: string;
  receiptId?: string;
  merchant?: string;
  total?: number;
  currency?: string;
  comment?: string;
  reason?: string;
  changes?: Record<string, { old: any; new: any }>;
}

export interface TeamMemberNotificationData {
  teamId: string;
  actorUserId: string;
  actorName: string;
  targetUserId?: string;
  targetUserName?: string;
  role?: string;
  invitationEmail?: string;
}

export class TeamCollaborationNotificationService {
  
  // =============================================
  // RECEIPT COLLABORATION NOTIFICATIONS
  // =============================================

  static async notifyReceiptShared(data: TeamCollaborationNotificationData): Promise<void> {
    try {
      // Get all team members except the actor
      const teamMembers = await this.getTeamMembersExceptActor(data.teamId, data.actorUserId);
      
      for (const member of teamMembers) {
        await notificationService.createTeamReceiptNotification(
          member.user_id,
          data.receiptId!,
          'receipt_shared',
          {
            teamId: data.teamId,
            actorName: data.actorName,
            merchant: data.merchant,
          }
        );
      }

      console.log(`✅ Receipt shared notifications sent to ${teamMembers.length} team members`);
    } catch (error) {
      console.error('Failed to send receipt shared notifications:', error);
    }
  }

  static async notifyReceiptCommentAdded(data: TeamCollaborationNotificationData): Promise<void> {
    try {
      // Get all team members except the actor
      const teamMembers = await this.getTeamMembersExceptActor(data.teamId, data.actorUserId);
      
      for (const member of teamMembers) {
        await notificationService.createTeamReceiptNotification(
          member.user_id,
          data.receiptId!,
          'receipt_comment_added',
          {
            teamId: data.teamId,
            actorName: data.actorName,
            merchant: data.merchant,
            comment: data.comment,
          }
        );
      }

      console.log(`✅ Receipt comment notifications sent to ${teamMembers.length} team members`);
    } catch (error) {
      console.error('Failed to send receipt comment notifications:', error);
    }
  }

  static async notifyReceiptEditedByTeamMember(data: TeamCollaborationNotificationData): Promise<void> {
    try {
      // Get receipt owner and other team members (excluding the editor)
      const receiptOwner = await this.getReceiptOwner(data.receiptId!);
      const teamMembers = await this.getTeamMembersExceptActor(data.teamId, data.actorUserId);
      
      // Notify receipt owner if they're not the editor
      if (receiptOwner && receiptOwner.user_id !== data.actorUserId) {
        await notificationService.createTeamReceiptNotification(
          receiptOwner.user_id,
          data.receiptId!,
          'receipt_edited_by_team_member',
          {
            teamId: data.teamId,
            actorName: data.actorName,
            merchant: data.merchant,
          }
        );
      }

      // Notify other team members who might be interested
      const interestedMembers = teamMembers.filter(member => 
        member.user_id !== receiptOwner?.user_id && 
        member.user_id !== data.actorUserId
      );

      for (const member of interestedMembers) {
        await notificationService.createTeamReceiptNotification(
          member.user_id,
          data.receiptId!,
          'receipt_edited_by_team_member',
          {
            teamId: data.teamId,
            actorName: data.actorName,
            merchant: data.merchant,
          }
        );
      }

      console.log(`✅ Receipt edited notifications sent to ${interestedMembers.length + (receiptOwner ? 1 : 0)} team members`);
    } catch (error) {
      console.error('Failed to send receipt edited notifications:', error);
    }
  }

  static async notifyReceiptApprovedByTeam(data: TeamCollaborationNotificationData): Promise<void> {
    try {
      // Get receipt owner
      const receiptOwner = await this.getReceiptOwner(data.receiptId!);
      
      if (receiptOwner && receiptOwner.user_id !== data.actorUserId) {
        await notificationService.createTeamReceiptNotification(
          receiptOwner.user_id,
          data.receiptId!,
          'receipt_approved_by_team',
          {
            teamId: data.teamId,
            actorName: data.actorName,
            merchant: data.merchant,
          }
        );
      }

      console.log(`✅ Receipt approved notification sent to receipt owner`);
    } catch (error) {
      console.error('Failed to send receipt approved notification:', error);
    }
  }

  static async notifyReceiptFlaggedForReview(data: TeamCollaborationNotificationData): Promise<void> {
    try {
      // Get team admins and receipt owner
      const teamAdmins = await this.getTeamAdmins(data.teamId);
      const receiptOwner = await this.getReceiptOwner(data.receiptId!);
      
      // Notify team admins
      for (const admin of teamAdmins) {
        if (admin.user_id !== data.actorUserId) {
          await notificationService.createTeamReceiptNotification(
            admin.user_id,
            data.receiptId!,
            'receipt_flagged_for_review',
            {
              teamId: data.teamId,
              actorName: data.actorName,
              merchant: data.merchant,
              reason: data.reason,
            }
          );
        }
      }

      // Notify receipt owner if they're not the one who flagged it
      if (receiptOwner && receiptOwner.user_id !== data.actorUserId) {
        await notificationService.createTeamReceiptNotification(
          receiptOwner.user_id,
          data.receiptId!,
          'receipt_flagged_for_review',
          {
            teamId: data.teamId,
            actorName: data.actorName,
            merchant: data.merchant,
            reason: data.reason,
          }
        );
      }

      console.log(`✅ Receipt flagged notifications sent to admins and owner`);
    } catch (error) {
      console.error('Failed to send receipt flagged notifications:', error);
    }
  }

  // =============================================
  // TEAM MEMBER NOTIFICATIONS
  // =============================================

  static async notifyTeamMemberJoined(data: TeamMemberNotificationData): Promise<void> {
    try {
      // Get all team members except the new member
      const teamMembers = await this.getTeamMembersExceptActor(data.teamId, data.actorUserId);
      
      for (const member of teamMembers) {
        await notificationService.createNotification(
          member.user_id,
          'team_member_joined',
          'New Team Member Joined',
          `${data.actorName} has joined the team`,
          {
            teamId: data.teamId,
            priority: 'medium',
            actionUrl: `/teams/${data.teamId}/members`,
            relatedEntityType: 'team_member',
            relatedEntityId: data.actorUserId,
            metadata: {
              actorName: data.actorName,
              actorUserId: data.actorUserId,
            }
          }
        );
      }

      console.log(`✅ Team member joined notifications sent to ${teamMembers.length} members`);
    } catch (error) {
      console.error('Failed to send team member joined notifications:', error);
    }
  }

  static async notifyTeamMemberLeft(data: TeamMemberNotificationData): Promise<void> {
    try {
      // Get all remaining team members
      const teamMembers = await this.getTeamMembers(data.teamId);
      
      for (const member of teamMembers) {
        await notificationService.createNotification(
          member.user_id,
          'team_member_left',
          'Team Member Left',
          `${data.actorName} has left the team`,
          {
            teamId: data.teamId,
            priority: 'medium',
            actionUrl: `/teams/${data.teamId}/members`,
            relatedEntityType: 'team_member',
            relatedEntityId: data.actorUserId,
            metadata: {
              actorName: data.actorName,
              actorUserId: data.actorUserId,
            }
          }
        );
      }

      console.log(`✅ Team member left notifications sent to ${teamMembers.length} members`);
    } catch (error) {
      console.error('Failed to send team member left notifications:', error);
    }
  }

  static async notifyTeamMemberRoleChanged(data: TeamMemberNotificationData): Promise<void> {
    try {
      // Notify the target user about their role change
      if (data.targetUserId) {
        await notificationService.createNotification(
          data.targetUserId,
          'team_member_role_changed',
          'Your Role Has Changed',
          `Your role has been changed to ${data.role} by ${data.actorName}`,
          {
            teamId: data.teamId,
            priority: 'high',
            actionUrl: `/teams/${data.teamId}`,
            relatedEntityType: 'team_member',
            relatedEntityId: data.targetUserId,
            metadata: {
              actorName: data.actorName,
              targetUserName: data.targetUserName,
              newRole: data.role,
            }
          }
        );
      }

      // Notify team admins about the role change
      const teamAdmins = await this.getTeamAdmins(data.teamId);
      for (const admin of teamAdmins) {
        if (admin.user_id !== data.actorUserId && admin.user_id !== data.targetUserId) {
          await notificationService.createNotification(
            admin.user_id,
            'team_member_role_changed',
            'Team Member Role Changed',
            `${data.actorName} changed ${data.targetUserName || 'a team member'}'s role to ${data.role}`,
            {
              teamId: data.teamId,
              priority: 'medium',
              actionUrl: `/teams/${data.teamId}/members`,
              relatedEntityType: 'team_member',
              relatedEntityId: data.targetUserId,
              metadata: {
                actorName: data.actorName,
                targetUserName: data.targetUserName,
                newRole: data.role,
              }
            }
          );
        }
      }

      console.log(`✅ Team member role change notifications sent`);
    } catch (error) {
      console.error('Failed to send team member role change notifications:', error);
    }
  }

  static async notifyTeamInvitationSent(data: TeamMemberNotificationData): Promise<void> {
    try {
      // Notify team admins about the new invitation
      const teamAdmins = await this.getTeamAdmins(data.teamId);
      
      for (const admin of teamAdmins) {
        if (admin.user_id !== data.actorUserId) {
          await notificationService.createNotification(
            admin.user_id,
            'team_invitation_sent',
            'Team Invitation Sent',
            `${data.actorName} invited ${data.invitationEmail} to join the team`,
            {
              teamId: data.teamId,
              priority: 'medium',
              actionUrl: `/teams/${data.teamId}/members`,
              relatedEntityType: 'team_invitation',
              metadata: {
                actorName: data.actorName,
                invitationEmail: data.invitationEmail,
              }
            }
          );
        }
      }

      console.log(`✅ Team invitation sent notifications sent to ${teamAdmins.length} admins`);
    } catch (error) {
      console.error('Failed to send team invitation sent notifications:', error);
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private static async getTeamMembers(teamId: string): Promise<Array<{ user_id: string; role: string }>> {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', teamId)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching team members:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching team members:', error);
      return [];
    }
  }

  private static async getTeamMembersExceptActor(teamId: string, actorUserId: string): Promise<Array<{ user_id: string; role: string }>> {
    const members = await this.getTeamMembers(teamId);
    return members.filter(member => member.user_id !== actorUserId);
  }

  private static async getTeamAdmins(teamId: string): Promise<Array<{ user_id: string; role: string }>> {
    const members = await this.getTeamMembers(teamId);
    return members.filter(member => member.role === 'admin' || member.role === 'owner');
  }

  private static async getReceiptOwner(receiptId: string): Promise<{ user_id: string } | null> {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('user_id')
        .eq('id', receiptId)
        .single();

      if (error) {
        console.error('Error fetching receipt owner:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching receipt owner:', error);
      return null;
    }
  }

  // =============================================
  // INTEGRATION HELPERS
  // =============================================

  static async handleReceiptShared(receiptId: string, teamId: string, actorUserId: string, actorName: string): Promise<void> {
    const receiptData = await this.getReceiptDataForNotification(receiptId);
    
    await this.notifyReceiptShared({
      teamId,
      actorUserId,
      actorName,
      receiptId,
      merchant: receiptData?.merchant,
      total: receiptData?.total,
      currency: receiptData?.currency,
    });
  }

  static async handleReceiptCommentAdded(receiptId: string, teamId: string, actorUserId: string, actorName: string, comment: string): Promise<void> {
    const receiptData = await this.getReceiptDataForNotification(receiptId);
    
    await this.notifyReceiptCommentAdded({
      teamId,
      actorUserId,
      actorName,
      receiptId,
      merchant: receiptData?.merchant,
      comment,
    });
  }

  static async handleReceiptEdited(receiptId: string, teamId: string, actorUserId: string, actorName: string, changes?: Record<string, any>): Promise<void> {
    const receiptData = await this.getReceiptDataForNotification(receiptId);
    
    await this.notifyReceiptEditedByTeamMember({
      teamId,
      actorUserId,
      actorName,
      receiptId,
      merchant: receiptData?.merchant,
      changes,
    });
  }

  private static async getReceiptDataForNotification(receiptId: string): Promise<{ merchant?: string; total?: number; currency?: string } | null> {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('merchant, total, currency')
        .eq('id', receiptId)
        .single();

      if (error) {
        console.error('Error fetching receipt data:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching receipt data:', error);
      return null;
    }
  }
}

// Export singleton instance
export const teamCollaborationNotificationService = new TeamCollaborationNotificationService();
