import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { invitationFlowService, UserStateDetectionResult } from '@/services/invitationFlowService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  TeamInvitation,
  UserType,
} from '@/types/team';

// Import flow components (will be created next)
import { InvitationLandingPage } from '@/components/team/invitation/InvitationLandingPage';
import { UnregisteredUserFlow } from '@/components/team/invitation/UnregisteredUserFlow';
import { RegisteredUserFlow } from '@/components/team/invitation/RegisteredUserFlow';
import { LoggedInUserFlow } from '@/components/team/invitation/LoggedInUserFlow';

interface InvitationFlowState {
  invitation: TeamInvitation | null;
  userState: UserStateDetectionResult | null;
  userType: UserType | null;
  loading: boolean;
  error: string | null;
  sessionId?: string;
}

export default function TeamInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [flowState, setFlowState] = useState<InvitationFlowState>({
    invitation: null,
    userState: null,
    userType: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (token) {
      detectUserStateAndLoadInvitation();
    }
  }, [token, user]);

  const detectUserStateAndLoadInvitation = async () => {
    if (!token) return;

    try {
      setFlowState(prev => ({ ...prev, loading: true, error: null }));

      // Generate browser fingerprint and get client info
      const browserFingerprint = invitationFlowService.generateBrowserFingerprint();
      const ipAddress = await invitationFlowService.getClientIPAddress();
      const userAgent = navigator.userAgent;

      // Detect user state and validate invitation
      const result = await invitationFlowService.detectUserState(
        token,
        browserFingerprint,
        ipAddress,
        userAgent
      );

      if (!result.success) {
        setFlowState(prev => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to validate invitation'
        }));
        return;
      }

      const { invitation, user_state, session_data } = result.data!;

      setFlowState(prev => ({
        ...prev,
        invitation,
        userState: user_state,
        userType: user_state.user_type,
        loading: false,
        sessionId: session_data?.session_id
      }));

    } catch (error: any) {
      console.error('Error detecting user state:', error);
      setFlowState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load invitation'
      }));
    }
  };

  // Handle successful invitation acceptance from any flow
  const handleInvitationAccepted = (teamId: string, teamName: string, redirectUrl?: string) => {
    toast({
      title: 'Welcome to the Team!',
      description: `You've successfully joined ${teamName}.`,
      duration: 5000,
    });

    // Navigate to the specified redirect URL or default to teams page
    setTimeout(() => {
      navigate(redirectUrl || '/teams');
    }, 1000);
  };

  // Handle invitation flow errors
  const handleFlowError = (error: string, errorCode?: string) => {
    toast({
      title: 'Error',
      description: error,
      variant: 'destructive',
    });

    // For certain errors, redirect to appropriate pages
    if (errorCode === 'INVITATION_EXPIRED' || errorCode === 'INVITATION_NOT_FOUND') {
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    }
  };

  // Loading state
  if (flowState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Spinner size="lg" className="mx-auto mb-4" />
              <p className="text-muted-foreground">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (flowState.error || !flowState.invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold">Invitation Error</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {flowState.error || 'This invitation is invalid or has expired.'}
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
                <Button onClick={() => navigate('/auth')}>
                  Sign In
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Route to appropriate flow component based on user type
  const { invitation, userState, userType } = flowState;

  if (!invitation || !userState || !userType) {
    return null; // This shouldn't happen if we reach here
  }

  const commonProps = {
    invitation,
    userState,
    token: token!,
    onSuccess: handleInvitationAccepted,
    onError: handleFlowError,
  };

  switch (userType) {
    case 'unregistered':
      return (
        <UnregisteredUserFlow
          {...commonProps}
          sessionId={flowState.sessionId}
        />
      );

    case 'logged_out':
      return (
        <RegisteredUserFlow
          {...commonProps}
          sessionId={flowState.sessionId}
        />
      );

    case 'logged_in':
      return (
        <LoggedInUserFlow
          {...commonProps}
          currentUser={user}
        />
      );

    case 'cross_team':
      return (
        <LoggedInUserFlow
          {...commonProps}
          currentUser={user}
          showEmailMismatch={true}
        />
      );

    default:
      return (
        <InvitationLandingPage
          {...commonProps}
          onUserTypeDetected={(detectedType) => {
            setFlowState(prev => ({ ...prev, userType: detectedType }));
          }}
        />
      );
  }
}
