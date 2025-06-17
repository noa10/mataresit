import React, { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { teamService } from '@/services/teamService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  UserPlus,
  Mail,
  MoreHorizontal,
  Trash2,
  Settings,
  Crown,
  Shield,
  Eye,
} from 'lucide-react';
import {
  TeamMember,
  TeamInvitation,
  TeamMemberRole,
  getTeamRoleDisplayName,
  getTeamRoleDescription,
  TEAM_ROLE_COLORS,
} from '@/types/team';
import { cn } from '@/lib/utils';

export default function TeamManagement() {
  const {
    currentTeam,
    currentTeamRole,
    teamMembers,
    loading,
    hasPermission,
    loadTeamMembers,
    inviteTeamMember,
    removeTeamMember,
    updateTeamMemberRole,
  } = useTeam();

  const { t } = useTeamTranslation();

  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member' as TeamMemberRole,
  });
  const [inviting, setInviting] = useState(false);
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (currentTeam) {
      // Add a small delay to ensure team context is fully established
      const timer = setTimeout(() => {
        loadInvitations();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [currentTeam]);

  const loadInvitations = async () => {
    if (!currentTeam) return;

    try {
      setLoadingInvitations(true);
      const invitationData = await teamService.getTeamInvitations(currentTeam.id);
      setInvitations(invitationData);
    } catch (error: any) {
      console.error('Failed to load invitations:', error);
      // Only show error toast if it's not a simple "no data" case
      if (error.message && !error.message.includes('No rows found')) {
        toast({
          title: 'Error',
          description: 'Failed to load invitations',
          variant: 'destructive',
        });
      }
      // Set empty array as fallback
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleInviteMember = async () => {
    if (!currentTeam || !inviteForm.email.trim()) return;

    try {
      setInviting(true);
      await inviteTeamMember(currentTeam.id, inviteForm.email.trim(), inviteForm.role);
      
      // Reset form and close dialog
      setInviteForm({ email: '', role: 'member' });
      setInviteDialogOpen(false);
      
      // Reload invitations
      await loadInvitations();
    } catch (error) {
      // Error is handled by the context
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!currentTeam) return;

    try {
      await removeTeamMember(currentTeam.id, member.user_id);
    } catch (error) {
      // Error is handled by the context
    }
  };

  const handleUpdateMemberRole = async (member: TeamMember, newRole: TeamMemberRole) => {
    if (!currentTeam) return;

    try {
      await updateTeamMemberRole(currentTeam.id, member.user_id, newRole);
    } catch (error) {
      // Error is handled by the context
    }
  };

  const handleCancelInvitation = async (invitation: TeamInvitation) => {
    try {
      await teamService.cancelInvitation(invitation.id);
      await loadInvitations();
      
      toast({
        title: 'Success',
        description: 'Invitation cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel invitation',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: TeamMemberRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'member':
        return <Users className="h-4 w-4" />;
      case 'viewer':
        return <Eye className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  if (!currentTeam) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('errors.noTeamSelected')}</h3>
              <p className="text-muted-foreground">
                {t('errors.selectTeamMessage')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{currentTeam.name}</h1>
          <p className="text-muted-foreground">
            {t('members.subtitle')}
          </p>
        </div>

        {hasPermission('invite_members') && (
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t('members.actions.invite')}
          </Button>
        )}
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">{t('navigation.members')}</TabsTrigger>
          <TabsTrigger value="invitations">{t('navigation.invitations')}</TabsTrigger>
          {hasPermission('manage_team') && (
            <TabsTrigger value="settings">{t('navigation.settings')}</TabsTrigger>
          )}
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>{t('members.title')}</CardTitle>
              <CardDescription>
                {t('members.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading.members ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="lg" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('members.table.name')}</TableHead>
                      <TableHead>{t('members.table.role')}</TableHead>
                      <TableHead>{t('members.table.joinedDate')}</TableHead>
                      <TableHead>{t('members.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                              <span className="text-sm font-medium">
                                {member.first_name?.[0] || member.email?.[0]?.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">
                                {member.first_name && member.last_name
                                  ? `${member.first_name} ${member.last_name}`
                                  : member.email}
                              </div>
                              {member.first_name && (
                                <div className="text-sm text-muted-foreground">
                                  {member.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(member.role)}
                            <Badge 
                              variant="outline" 
                              className={cn(TEAM_ROLE_COLORS[member.role])}
                            >
                              {getTeamRoleDisplayName(member.role)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(member.joined_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {hasPermission('invite_members') && member.role !== 'owner' && (
                            <div className="flex items-center gap-2">
                              <Select
                                value={member.role}
                                onValueChange={(value: TeamMemberRole) => 
                                  handleUpdateMemberRole(member, value)
                                }
                                disabled={member.role === 'owner'}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="viewer">{t('members.roles.viewer')}</SelectItem>
                                  <SelectItem value="member">{t('members.roles.member')}</SelectItem>
                                  <SelectItem value="admin">{t('members.roles.admin')}</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMember(member)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>{t('invitations.title')}</CardTitle>
              <CardDescription>
                {t('invitations.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingInvitations ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="lg" />
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('invitations.noPending')}</h3>
                  <p className="text-muted-foreground">
                    {t('invitations.allProcessed')}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('invitations.table.email')}</TableHead>
                      <TableHead>{t('invitations.table.role')}</TableHead>
                      <TableHead>{t('invitations.table.invitedBy')}</TableHead>
                      <TableHead>{t('invitations.table.expiresDate')}</TableHead>
                      <TableHead>{t('invitations.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn(TEAM_ROLE_COLORS[invitation.role])}
                          >
                            {getTeamRoleDisplayName(invitation.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>{invitation.invited_by_name}</TableCell>
                        <TableCell>
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {hasPermission('invite_members') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelInvitation(invitation)}
                              className="text-destructive hover:text-destructive"
                            >
                              {t('invitations.actions.cancel')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        {hasPermission('manage_team') && (
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.title')}</CardTitle>
                <CardDescription>
                  {t('settings.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('settings.comingSoon')}</h3>
                  <p className="text-muted-foreground">
                    {t('settings.futureUpdate')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invitations.form.title')}</DialogTitle>
            <DialogDescription>
              {t('invitations.form.description', { teamName: currentTeam?.name || t('selector.personalWorkspace') })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="invite-email" className="text-sm font-medium">
                {t('invitations.form.fields.email')}
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder={t('invitations.form.placeholders.email')}
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                disabled={inviting}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="invite-role" className="text-sm font-medium">
                {t('invitations.form.fields.role')}
              </label>
              <Select
                value={inviteForm.role}
                onValueChange={(value: TeamMemberRole) => 
                  setInviteForm(prev => ({ ...prev, role: value }))
                }
                disabled={inviting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">
                    <div className="flex flex-col items-start">
                      <span>{t('members.roles.viewer')}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('members.permissions.viewer')}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex flex-col items-start">
                      <span>{t('members.roles.member')}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('members.permissions.member')}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex flex-col items-start">
                      <span>{t('members.roles.admin')}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('members.permissions.admin')}
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={inviting}
            >
              {t('invitations.actions.cancel')}
            </Button>
            <Button
              onClick={handleInviteMember}
              disabled={!inviteForm.email.trim() || inviting}
            >
              {inviting ? t('invitations.actions.sending') : t('invitations.actions.sendInvitation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
