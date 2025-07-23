import React, { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { teamService } from '@/services/teamService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  UserPlus,
  Settings,
  Sparkles,
} from 'lucide-react';
import {
  TeamMember,
  getTeamRoleDisplayName,
  TEAM_ROLE_COLORS,
} from '@/types/team';
import { cn } from '@/lib/utils';

// Import enhanced components
import { EnhancedTeamManagement } from '@/components/team/enhanced/EnhancedTeamManagement';

export default function TeamManagement() {
  const { currentTeam, hasPermission } = useTeam();
  const { t } = useTeamTranslation();
  const { toast } = useToast();

  const [showEnhanced, setShowEnhanced] = useState(true);

  // Check if user has access to team management
  if (!currentTeam) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Team Selected</h3>
            <p className="text-muted-foreground">
              Please select a team to manage its members and settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasPermission('view_members')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              You don't have permission to view team management.
            </p>
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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {currentTeam.name}
            {showEnhanced && (
              <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border-blue-200">
                <Sparkles className="h-3 w-3 mr-1" />
                Enhanced
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            {showEnhanced
              ? 'Advanced team management with bulk operations, audit trails, and enhanced controls'
              : t('members.subtitle')
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showEnhanced ? "default" : "outline"}
            onClick={() => setShowEnhanced(!showEnhanced)}
            className="flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {showEnhanced ? 'Enhanced Mode' : 'Enable Enhanced'}
          </Button>
        </div>
      </div>

      {/* Enhanced Team Management */}
      {showEnhanced ? (
        <EnhancedTeamManagement />
      ) : (
        <LegacyTeamManagement />
      )}
    </div>
  );
}

// Legacy team management component (simplified version of original)
function LegacyTeamManagement() {
  const { currentTeam, teamMembers, loading, hasPermission } = useTeam();
  const { t } = useTeamTranslation();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading team members...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="members" className="space-y-6">
      <TabsList>
        <TabsTrigger value="members">{t('navigation.members')}</TabsTrigger>
        <TabsTrigger value="invitations">{t('navigation.invitations')}</TabsTrigger>
        {hasPermission('manage_team') && (
          <TabsTrigger value="settings">{t('navigation.settings')}</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="members">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({teamMembers.length})
            </CardTitle>
            <CardDescription>
              Manage your team members and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Team Members</h3>
                <p className="text-muted-foreground mb-4">
                  Start building your team by inviting members.
                </p>
                {hasPermission('invite_members') && (
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Members
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("gap-1", TEAM_ROLE_COLORS[member.role])}>
                      {getTeamRoleDisplayName(member.role)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="invitations">
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              Manage pending team invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Enhanced Features Available</h3>
              <p className="text-muted-foreground">
                Switch to Enhanced Mode to access advanced invitation management.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {hasPermission('manage_team') && (
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Team Settings</CardTitle>
              <CardDescription>
                Configure team settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Enhanced Features Available</h3>
                <p className="text-muted-foreground">
                  Switch to Enhanced Mode to access advanced team settings.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}

