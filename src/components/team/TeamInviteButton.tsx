import React, { useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import {
  TeamMemberRole,
  getTeamRoleDisplayName,
  getTeamRoleDescription,
} from '@/types/team';

interface TeamInviteButtonProps {
  teamId?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function TeamInviteButton({
  teamId,
  variant = 'default',
  size = 'default',
  className,
}: TeamInviteButtonProps) {
  const { currentTeam, hasPermission, inviteTeamMember } = useTeam();
  const { t } = useTeamTranslation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('member');
  const [inviting, setInviting] = useState(false);

  const targetTeamId = teamId || currentTeam?.id;

  const handleInvite = async () => {
    if (!targetTeamId || !email.trim()) return;

    try {
      setInviting(true);
      await inviteTeamMember(targetTeamId, email.trim(), role);
      
      // Reset form and close dialog
      setEmail('');
      setRole('member');
      setOpen(false);
    } catch (error) {
      // Error is handled by the context
    } finally {
      setInviting(false);
    }
  };

  // Don't show button if user doesn't have permission or no team is selected
  if (!targetTeamId || !hasPermission('invite_members')) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <UserPlus className="h-4 w-4 mr-2" />
          {t('members.actions.invite')}
        </Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('invitations.form.title')}</DialogTitle>
          <DialogDescription>
            {t('invitations.form.description', { teamName: currentTeam?.name || t('selector.personalWorkspace') })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t('invitations.form.fields.email')}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t('invitations.form.placeholders.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={inviting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="invite-role">{t('invitations.form.fields.role')}</Label>
            <Select
              value={role}
              onValueChange={(value: TeamMemberRole) => setRole(value)}
              disabled={inviting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{getTeamRoleDisplayName('viewer')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('members.permissions.viewer')}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{getTeamRoleDisplayName('member')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('members.permissions.member')}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{getTeamRoleDisplayName('admin')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('members.permissions.admin')}
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {getTeamRoleDescription(role)}
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={inviting}
          >
            {t('invitations.actions.cancel')}
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!email.trim() || inviting}
          >
            {inviting ? t('invitations.actions.sending') : t('invitations.actions.sendInvitation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
