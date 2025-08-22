/**
 * Invitation Landing Page Component
 * Main entry point for invitation flows with user state detection
 * Routes users to appropriate flow based on their current state
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Users,
  UserPlus,
  LogIn,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  TeamInvitation,
  UserType,
} from '@/types/team';
import { UserStateDetectionResult } from '@/services/invitationFlowService';
import { InvitationPreview, getUserTypeDisplayInfo, getInvitationCTA } from './InvitationPreview';

interface InvitationLandingPageProps {
  invitation: TeamInvitation;
  userState: UserStateDetectionResult;
  token: string;
  onSuccess: (teamId: string, teamName: string, redirectUrl?: string) => void;
  onError: (error: string, errorCode?: string) => void;
  onUserTypeDetected: (userType: UserType) => void;
}

export function InvitationLandingPage({
  invitation,
  userState,
  token,
  onSuccess,
  onError,
  onUserTypeDetected,
}: InvitationLandingPageProps) {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const userTypeInfo = getUserTypeDisplayInfo(userState.user_type);
  const IconComponent = userTypeInfo.icon;

  // Handle user action based on their type
  const handlePrimaryAction = () => {
    setIsProcessing(true);
    
    // Route to appropriate flow
    setTimeout(() => {
      onUserTypeDetected(userState.user_type);
    }, 100);
  };

  // Handle secondary actions
  const handleSecondaryAction = () => {
    switch (userState.user_type) {
      case 'unregistered':
        navigate('/auth', { state: { invitationToken: token } });
        break;
      case 'logged_out':
        navigate('/auth/signup', { state: { invitationToken: token } });
        break;
      case 'logged_in':
        navigate('/dashboard');
        break;
      case 'cross_team':
        navigate('/contact');
        break;
      default:
        navigate('/dashboard');
    }
  };

  // Get appropriate messaging based on user state
  const getActionMessage = () => {
    switch (userState.user_type) {
      case 'unregistered':
        return {
          title: 'Create Your Account',
          description: 'You\'ll need to create an account to join this team. We\'ll guide you through the process.',
          primaryAction: 'Get Started',
          secondaryAction: 'Already have an account?',
        };
      case 'logged_out':
        return {
          title: 'Sign In to Continue',
          description: 'Sign in to your existing account to accept this invitation.',
          primaryAction: 'Sign In',
          secondaryAction: 'Need to create an account?',
        };
      case 'logged_in':
        return {
          title: 'Ready to Join',
          description: 'You\'re all set! You can accept this invitation immediately.',
          primaryAction: 'Accept Invitation',
          secondaryAction: 'Go to Dashboard',
        };
      case 'cross_team':
        return {
          title: 'Email Mismatch',
          description: 'This invitation is for a different email address than the one you\'re currently signed in with.',
          primaryAction: 'Resolve Email Issue',
          secondaryAction: 'Contact Support',
        };
      default:
        return {
          title: 'Team Invitation',
          description: 'You\'ve been invited to join a team.',
          primaryAction: 'Continue',
          secondaryAction: 'Learn More',
        };
    }
  };

  const actionMessage = getActionMessage();

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Spinner size="lg" className="mx-auto" />
              <h3 className="text-lg font-semibold">Preparing Your Experience</h3>
              <p className="text-muted-foreground">
                Please wait while we set up the best flow for you...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Invitation Preview */}
        <InvitationPreview
          invitation={invitation}
          userType={userState.user_type}
          currentUserEmail={userState.current_user_email}
          showEmailMismatch={userState.user_type === 'cross_team'}
        />
        
        {/* Action Card */}
        <Card>
          <CardHeader className="text-center">
            <div className={`h-8 w-8 mx-auto mb-2 ${userTypeInfo.color}`}>
              <IconComponent className="h-full w-full" />
            </div>
            <CardTitle>{actionMessage.title}</CardTitle>
            <CardDescription>
              {actionMessage.description}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* User State Information */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 ${userTypeInfo.color}`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{userTypeInfo.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {userTypeInfo.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Cross-team membership info */}
            {userState.cross_team_memberships > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-800">Multiple Teams</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      You're already a member of {userState.cross_team_memberships} other team{userState.cross_team_memberships > 1 ? 's' : ''}.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Action */}
            <Button 
              onClick={handlePrimaryAction}
              className="w-full"
              size="lg"
              disabled={isProcessing}
            >
              {actionMessage.primaryAction}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            
            {/* Secondary Action */}
            <div className="text-center">
              <Button 
                variant="link" 
                onClick={handleSecondaryAction}
                className="text-sm"
                disabled={isProcessing}
              >
                {actionMessage.secondaryAction}
              </Button>
            </div>

            {/* Additional Information */}
            <div className="text-center pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                This invitation will expire on {new Date(invitation.expires_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <h4 className="text-sm font-medium">Need Help?</h4>
              <p className="text-xs text-muted-foreground">
                If you're having trouble with this invitation, you can contact the team administrator 
                {invitation.invited_by_name && ` (${invitation.invited_by_name})`} or reach out to support.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/contact')}
                >
                  Contact Support
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/help/invitations')}
                >
                  Learn More
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
