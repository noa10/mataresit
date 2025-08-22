/**
 * Logged-In User Flow Component
 * Handles invitation acceptance for users who are already authenticated
 * Provides direct acceptance or email mismatch handling
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  LogOut,
  Mail,
  Users,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import {
  TeamInvitation,
  UserType,
} from '@/types/team';
import { UserStateDetectionResult, invitationFlowService } from '@/services/invitationFlowService';
import { InvitationPreview, getInvitationCTA } from './InvitationPreview';

interface LoggedInUserFlowProps {
  invitation: TeamInvitation;
  userState: UserStateDetectionResult;
  token: string;
  currentUser: any; // User from auth context
  showEmailMismatch?: boolean;
  onSuccess: (teamId: string, teamName: string, redirectUrl?: string) => void;
  onError: (error: string, errorCode?: string) => void;
}

export function LoggedInUserFlow({
  invitation,
  userState,
  token,
  currentUser,
  showEmailMismatch = false,
  onSuccess,
  onError,
}: LoggedInUserFlowProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAccepting, setIsAccepting] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(true);

  const isEmailMismatch = currentUser?.email !== invitation.email;
  const isCrossTeamUser = userState.user_type === 'cross_team';

  useEffect(() => {
    validateInvitationAcceptance();
  }, []);

  // Validate if the current user can accept the invitation
  const validateInvitationAcceptance = async () => {
    if (!currentUser?.id) {
      onError('User not authenticated', 'NOT_AUTHENTICATED');
      return;
    }

    try {
      setIsValidating(true);
      
      const result = await invitationFlowService.validateDirectAcceptance(
        token,
        currentUser.id
      );

      if (!result.success) {
        onError(result.error || 'Failed to validate invitation', result.error_code);
        return;
      }

      setValidationResult(result.data);
    } catch (error: any) {
      console.error('Error validating invitation:', error);
      onError('Failed to validate invitation', 'VALIDATION_FAILED');
    } finally {
      setIsValidating(false);
    }
  };

  // Handle direct invitation acceptance
  const handleAcceptInvitation = async () => {
    if (!currentUser?.id || !validationResult?.can_accept) {
      return;
    }

    setIsAccepting(true);

    try {
      // Process the invitation acceptance
      const result = await invitationFlowService.processPostAuthInvitation(
        token,
        currentUser.id,
        'existing_session', // User is already logged in
        invitationFlowService.generateBrowserFingerprint()
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to accept invitation');
      }

      const { team_id, team_name, redirect_url } = result.data!;
      onSuccess(team_id, team_name, redirect_url);

    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      onError(error.message || 'Failed to accept invitation', 'ACCEPTANCE_FAILED');
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle declining invitation
  const handleDeclineInvitation = () => {
    toast({
      title: 'Invitation Declined',
      description: 'You have declined the team invitation.',
    });
    navigate('/dashboard');
  };

  // Handle signing out to sign in with correct email
  const handleSignOutAndRedirect = async () => {
    try {
      await supabase.auth.signOut();
      
      // Store invitation token for after sign-in
      localStorage.setItem('pending_invitation_token', token);
      
      toast({
        title: 'Signed Out',
        description: 'Please sign in with the correct email address to accept this invitation.',
      });
      
      navigate('/auth', { 
        state: { 
          email: invitation.email,
          invitationToken: token 
        }
      });
    } catch (error: any) {
      console.error('Error signing out:', error);
      onError('Failed to sign out', 'SIGNOUT_FAILED');
    }
  };

  // Handle contacting team admin
  const handleContactAdmin = () => {
    toast({
      title: 'Contact Team Admin',
      description: 'Please contact the team administrator to request a new invitation for your current email address.',
      duration: 8000,
    });
  };

  // Loading state during validation
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Spinner size="lg" className="mx-auto" />
              <h3 className="text-lg font-semibold">Validating Invitation</h3>
              <p className="text-muted-foreground">
                Please wait while we validate your invitation...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already a team member
  if (validationResult?.already_member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center space-y-4">
                <UserCheck className="h-12 w-12 mx-auto text-green-600" />
                <h3 className="text-lg font-semibold">Already a Team Member</h3>
                <p className="text-muted-foreground">
                  You're already a member of {validationResult.team_name}. This invitation has been marked as accepted.
                </p>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </Button>
                  <Button onClick={() => navigate('/teams')}>
                    View Teams
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Email mismatch scenario
  if (isEmailMismatch || isCrossTeamUser || !validationResult?.email_match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg space-y-6">
          <InvitationPreview
            invitation={invitation}
            userType="cross_team"
            currentUserEmail={currentUser?.email}
            showEmailMismatch={true}
          />
          
          <Card>
            <CardHeader className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
              <CardTitle>Email Address Mismatch</CardTitle>
              <CardDescription>
                This invitation was sent to a different email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
                <h4 className="font-medium text-sm">What you can do:</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Sign out and sign in with the invited email address ({invitation.email})</li>
                  <li>• Contact the team admin to send a new invitation to your current email ({currentUser?.email})</li>
                  <li>• Ask the team admin to verify the correct email address</li>
                </ul>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  onClick={handleSignOutAndRedirect}
                  className="w-full"
                  size="lg"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out & Sign In with {invitation.email}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleContactAdmin}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Team Admin
                </Button>
                
                <Button 
                  variant="ghost"
                  onClick={() => navigate('/dashboard')}
                  className="w-full"
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Direct acceptance flow (email matches)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <InvitationPreview
          invitation={invitation}
          userType="logged_in"
          currentUserEmail={currentUser?.email}
        />
        
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <CardTitle>Ready to Join</CardTitle>
            <CardDescription>
              You can accept this invitation immediately
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-green-800">All Set!</h4>
                  <p className="text-sm text-green-700 mt-1">
                    You're signed in as <strong>{currentUser?.email}</strong> and ready to join {invitation.team_name}.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDeclineInvitation}
                disabled={isAccepting}
              >
                Decline
              </Button>
              <Button
                className="flex-1"
                onClick={handleAcceptInvitation}
                disabled={isAccepting || !validationResult?.can_accept}
                size="lg"
              >
                {isAccepting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                By accepting, you'll join {invitation.team_name} as a {invitation.role}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
