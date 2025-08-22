/**
 * Reusable Invitation Preview Component
 * Displays invitation details, team information, and role descriptions
 * Used across all invitation flow components
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Building2,
  Clock,
  User,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import {
  TeamInvitation,
  getTeamRoleDisplayName,
  getTeamRoleDescription,
  TEAM_ROLE_COLORS,
  UserType,
} from '@/types/team';
import { cn } from '@/lib/utils';

interface InvitationPreviewProps {
  invitation: TeamInvitation;
  userType?: UserType;
  currentUserEmail?: string;
  showEmailMismatch?: boolean;
  compact?: boolean;
  className?: string;
}

export function InvitationPreview({
  invitation,
  userType,
  currentUserEmail,
  showEmailMismatch = false,
  compact = false,
  className,
}: InvitationPreviewProps) {
  const isEmailMismatch = currentUserEmail && invitation.email !== currentUserEmail;
  const shouldShowMismatchWarning = showEmailMismatch && isEmailMismatch;

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className={cn("space-y-4", compact ? "p-4" : "p-6")}>
        {/* Email Mismatch Warning */}
        {shouldShowMismatchWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-800">Email Mismatch</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  This invitation was sent to <strong>{invitation.email}</strong>, but you're signed in as <strong>{currentUserEmail}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Team Information */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          
          <div>
            <h3 className={cn(
              "font-semibold text-foreground",
              compact ? "text-lg" : "text-xl"
            )}>
              {invitation.team_name}
            </h3>
            {invitation.custom_message && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                "{invitation.custom_message}"
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Role:</span>
            <Badge
              variant="outline"
              className={cn("text-sm", TEAM_ROLE_COLORS[invitation.role])}
            >
              <Shield className="h-3 w-3 mr-1" />
              {getTeamRoleDisplayName(invitation.role)}
            </Badge>
          </div>
        </div>

        {/* Role Description */}
        {!compact && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2 text-sm">Role Permissions</h4>
            <p className="text-sm text-muted-foreground">
              {getTeamRoleDescription(invitation.role)}
            </p>
          </div>
        )}

        {/* Invitation Details */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Invited email:
            </span>
            <span className="font-medium">{invitation.email}</span>
          </div>
          
          {invitation.invited_by_name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invited by:</span>
              <span className="font-medium">{invitation.invited_by_name}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Expires:
            </span>
            <span className="font-medium">
              {new Date(invitation.expires_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* User Type Indicator (for debugging/admin) */}
        {userType && process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            User Type: {userType}
          </div>
        )}

        {/* Additional Info */}
        {!compact && (
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              By accepting this invitation, you'll be able to collaborate with your team members
              on receipt management and data sharing.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version of the invitation preview for use in smaller spaces
 */
export function CompactInvitationPreview(props: Omit<InvitationPreviewProps, 'compact'>) {
  return <InvitationPreview {...props} compact={true} />;
}

/**
 * Invitation preview with email mismatch warning
 */
export function InvitationPreviewWithMismatch(props: InvitationPreviewProps) {
  return <InvitationPreview {...props} showEmailMismatch={true} />;
}

/**
 * Get user type display information for UI
 */
export function getUserTypeDisplayInfo(userType: UserType) {
  switch (userType) {
    case 'unregistered':
      return {
        title: 'Create Account',
        description: 'You\'ll need to create an account to join this team',
        icon: User,
        color: 'text-blue-600',
      };
    case 'logged_out':
      return {
        title: 'Sign In Required',
        description: 'Please sign in to accept this invitation',
        icon: Shield,
        color: 'text-green-600',
      };
    case 'logged_in':
      return {
        title: 'Ready to Join',
        description: 'You can accept this invitation immediately',
        icon: Building2,
        color: 'text-purple-600',
      };
    case 'cross_team':
      return {
        title: 'Email Mismatch',
        description: 'This invitation is for a different email address',
        icon: AlertTriangle,
        color: 'text-yellow-600',
      };
    default:
      return {
        title: 'Team Invitation',
        description: 'You\'ve been invited to join a team',
        icon: Building2,
        color: 'text-gray-600',
      };
  }
}

/**
 * Get appropriate call-to-action text based on user type
 */
export function getInvitationCTA(userType: UserType): string {
  switch (userType) {
    case 'unregistered':
      return 'Create Account & Join Team';
    case 'logged_out':
      return 'Sign In & Accept Invitation';
    case 'logged_in':
      return 'Accept Invitation';
    case 'cross_team':
      return 'Sign In with Correct Email';
    default:
      return 'Join Team';
  }
}

/**
 * Get secondary action text based on user type
 */
export function getInvitationSecondaryAction(userType: UserType): string {
  switch (userType) {
    case 'unregistered':
      return 'Already have an account? Sign in';
    case 'logged_out':
      return 'Don\'t have an account? Create one';
    case 'logged_in':
      return 'Decline Invitation';
    case 'cross_team':
      return 'Contact Team Admin';
    default:
      return 'Go to Dashboard';
  }
}
