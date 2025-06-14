import React, { useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
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
          Invite Member
        </Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join {currentTeam?.name || 'your team'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={inviting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
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
                      Can view receipts and team members
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{getTeamRoleDisplayName('member')}</span>
                    <span className="text-xs text-muted-foreground">
                      Can upload, edit, and view receipts
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{getTeamRoleDisplayName('admin')}</span>
                    <span className="text-xs text-muted-foreground">
                      Can manage team members and settings
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
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!email.trim() || inviting}
          >
            {inviting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
