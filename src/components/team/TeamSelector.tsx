import React, { useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
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
    hasPermission,
  } = useTeam();

  const { t } = useTeamTranslation();

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
                  {currentTeam ? currentTeam.name : t('selector.personalWorkspace')}
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
            <DropdownMenuLabel>{t('selector.switchWorkspace')}</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Personal workspace */}
            <DropdownMenuItem
              onClick={() => handleTeamSwitch(null)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{t('selector.personalWorkspace')}</span>
              </div>
              {!currentTeam && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            
            {userTeams.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('selector.teams')}</DropdownMenuLabel>
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
                          {t('selector.memberCount', { count: team.member_count })}
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
                  <span>{t('actions.createTeam')}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>


      </div>

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create.title')}</DialogTitle>
            <DialogDescription>
              {t('create.description')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">{t('create.fields.name')}</Label>
              <Input
                id="team-name"
                placeholder={t('create.placeholders.name')}
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-description">{t('create.fields.description')}</Label>
              <Textarea
                id="team-description"
                placeholder={t('create.placeholders.description')}
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
              {t('create.actions.cancel')}
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={!createForm.name.trim() || creating}
            >
              {creating ? t('create.actions.creating') : t('create.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
