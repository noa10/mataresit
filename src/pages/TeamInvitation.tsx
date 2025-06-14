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
      
      setInvitation(invitationData);
    } catch (error: any) {
      setError(error.message || 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!token || !invitation) return;

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invalid Invitation</h3>
              <p className="text-muted-foreground mb-4">
                {error || 'This invitation is invalid or has expired.'}
              </p>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
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
              disabled={accepting}
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
