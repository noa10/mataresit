import { useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { CreateTeamDialog } from '@/components/team/CreateTeamDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  } = useTeam();

  const { t } = useTeamTranslation();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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
      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
