import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { teamService } from '@/services/teamService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
} from 'lucide-react';
import {
  TeamInvitation,
  getTeamRoleDisplayName,
  getTeamRoleDescription,
  TEAM_ROLE_COLORS,
} from '@/types/team';
import { cn } from '@/lib/utils';

export default function TeamInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const { refreshCurrentTeam } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const invitationData = await teamService.getInvitationByToken(token);

      if (!invitationData) {
        setError('Invitation not found or has expired');
        return;
      }

      // Check if the invitation is for the current user's email
      if (user && invitationData.email !== user.email) {
        setError(`This invitation was sent to ${invitationData.email}, but you're signed in as ${user.email}. Please sign in with the correct email address or contact the team admin.`);
        return;
      }

      setInvitation(invitationData);
    } catch (error: any) {
      setError(error.message || 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!token || !invitation || !user) return;

    // Double-check email match before attempting to accept
    if (invitation.email !== user.email) {
      toast({
        title: 'Email Mismatch',
        description: `This invitation is for ${invitation.email}, but you're signed in as ${user.email}. Please sign in with the correct email address.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setAccepting(true);

      await teamService.acceptInvitation(token);

      toast({
        title: 'Success',
        description: `You've joined ${invitation.team_name}!`,
      });

      // Refresh team data and navigate to team management
      await refreshCurrentTeam();
      navigate('/teams');
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineInvitation = () => {
    toast({
      title: 'Invitation Declined',
      description: 'You have declined the team invitation.',
    });
    navigate('/dashboard');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
              <p className="text-muted-foreground mb-4">
                Please sign in to accept this team invitation.
              </p>
              <Button asChild>
                <a href="/auth">Sign In</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Spinner size="lg" className="mx-auto mb-4" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    const isEmailMismatch = error?.includes('signed in as');

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold">
                {isEmailMismatch ? 'Email Mismatch' : 'Invalid Invitation'}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {error || 'This invitation is invalid or has expired.'}
              </p>

              {isEmailMismatch && (
                <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
                  <h4 className="font-medium text-sm">What you can do:</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Sign out and sign in with the invited email address</li>
                    <li>• Contact the team admin to send a new invitation to your current email</li>
                    <li>• Ask the team admin to verify the correct email address</li>
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
                {isEmailMismatch && (
                  <Button onClick={() => navigate('/auth')}>
                    Sign In with Different Email
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Team Invitation</CardTitle>
          <CardDescription>
            You've been invited to join a team
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Email Mismatch Warning */}
          {user && invitation.email !== user.email && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-800">Email Mismatch</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    This invitation was sent to <strong>{invitation.email}</strong>, but you're signed in as <strong>{user.email}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Team Information */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">{invitation.team_name}</h3>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge
                variant="outline"
                className={cn("text-sm", TEAM_ROLE_COLORS[invitation.role])}
              >
                {getTeamRoleDisplayName(invitation.role)}
              </Badge>
            </div>
          </div>

          {/* Role Description */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Role Permissions</h4>
            <p className="text-sm text-muted-foreground">
              {getTeamRoleDescription(invitation.role)}
            </p>
          </div>

          {/* Invitation Details */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invited email:</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invited by:</span>
              <span className="font-medium">{invitation.invited_by_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expires:</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="font-medium">
                  {new Date(invitation.expires_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDeclineInvitation}
              disabled={accepting}
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={handleAcceptInvitation}
              disabled={accepting || (user && invitation.email !== user.email)}
            >
              {accepting ? (
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

          {/* Email mismatch help text */}
          {user && invitation.email !== user.email && (
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Sign in with {invitation.email} to accept this invitation
              </p>
            </div>
          )}

          {/* Additional Info */}
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              By accepting this invitation, you'll be able to collaborate with your team members
              on receipt management and data sharing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
