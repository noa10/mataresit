import React, { useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  Plus, 
  Users, 
  Settings,
  Check,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTeamRoleDisplayName, TEAM_ROLE_COLORS } from '@/types/team';

interface TeamSelectorProps {
  className?: string;
  showCreateButton?: boolean;
}

export function TeamSelector({ className, showCreateButton = true }: TeamSelectorProps) {
  const {
    currentTeam,
    currentTeamRole,
    userTeams,
    loading,
    switchTeam,
    createTeam,
  } = useTeam();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);

  const handleCreateTeam = async () => {
    if (!createForm.name.trim()) return;

    try {
      setCreating(true);
      const teamId = await createTeam(createForm.name.trim(), createForm.description.trim() || undefined);
      
      // Switch to the new team
      await switchTeam(teamId);
      
      // Reset form and close dialog
      setCreateForm({ name: '', description: '' });
      setCreateDialogOpen(false);
    } catch (error) {
      // Error is handled by the context
    } finally {
      setCreating(false);
    }
  };

  const handleTeamSwitch = async (teamId: string | null) => {
    await switchTeam(teamId);
  };

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="justify-between min-w-[200px]"
              disabled={loading.teams || loading.currentTeam}
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="truncate">
                  {currentTeam ? currentTeam.name : 'Personal Workspace'}
                </span>
                {currentTeamRole && (
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", TEAM_ROLE_COLORS[currentTeamRole])}
                  >
                    {getTeamRoleDisplayName(currentTeamRole)}
                  </Badge>
                )}
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[250px]">
            <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Personal workspace */}
            <DropdownMenuItem
              onClick={() => handleTeamSwitch(null)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Personal Workspace</span>
              </div>
              {!currentTeam && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            
            {userTeams.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Teams</DropdownMenuLabel>
                {userTeams.map((team) => (
                  <DropdownMenuItem
                    key={team.id}
                    onClick={() => handleTeamSwitch(team.id)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">{team.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", TEAM_ROLE_COLORS[team.user_role])}
                      >
                        {getTeamRoleDisplayName(team.user_role)}
                      </Badge>
                      {currentTeam?.id === team.id && <Check className="h-4 w-4" />}
                    </div>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            
            {showCreateButton && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setCreateDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Team</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {currentTeam && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // TODO: Navigate to team settings
              console.log('Navigate to team settings');
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Create a new team to collaborate with others on receipt management.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="Enter team name"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={creating}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="team-description">Description (Optional)</Label>
              <Textarea
                id="team-description"
                placeholder="Describe your team's purpose"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                disabled={creating}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={!createForm.name.trim() || creating}
            >
              {creating ? 'Creating...' : 'Create Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
