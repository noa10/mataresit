import React, { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Settings,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { TeamMember, getTeamRoleDisplayName, TEAM_ROLE_COLORS, EnhancedTeamStats } from '@/types/team';
import { cn } from '@/lib/utils';
import { enhancedTeamService } from '@/services/enhancedTeamService';

// Import enhanced components
import { BulkOperationsPanel } from './BulkOperationsPanel';
import { EnhancedMemberTable } from './EnhancedMemberTable';
import { EnhancedInvitationPanel } from './EnhancedInvitationPanel';
import { AuditTrailViewer } from './AuditTrailViewer';

// Use the EnhancedTeamStats type from the types file instead of local interface

interface EnhancedTeamManagementProps {
  className?: string;
}

export function EnhancedTeamManagement({ className }: EnhancedTeamManagementProps) {
  const { currentTeam, hasPermission } = useTeam();
  const { t } = useTeamTranslation();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
  const [teamStats, setTeamStats] = useState<EnhancedTeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('members');

  useEffect(() => {
    if (currentTeam?.id) {
      loadTeamData();
    }
  }, [currentTeam?.id]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMembers(),
        loadTeamStats(),
      ]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load team data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!currentTeam?.id) {
      throw new Error('No team selected');
    }

    const response = await enhancedTeamService.getTeamMembers({
      team_id: currentTeam.id,
      include_inactive: true,
      include_scheduled_removal: true,
    });

    if (response.success) {
      setMembers(response.data || []);
    } else {
      throw new Error(response.error || 'Failed to load team members');
    }
  };

  const loadTeamStats = async () => {
    if (!currentTeam?.id) {
      throw new Error('No team selected');
    }

    const response = await enhancedTeamService.getEnhancedTeamStats(currentTeam.id);

    if (response.success) {
      setTeamStats(response.data);
    } else {
      throw new Error(response.error || 'Failed to load team statistics');
    }
  };

  const handleMemberUpdate = () => {
    loadTeamData();
    setSelectedMembers([]);
  };

  const handleInvitationUpdate = () => {
    loadTeamData();
  };

  if (!hasPermission('view_members')) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don't have permission to view team management.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading team data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Team Overview Stats */}
      {teamStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamStats.total_members}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                {teamStats.recent_joins} joined recently
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Members</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamStats.active_members}</div>
              <div className="text-xs text-muted-foreground">
                {teamStats.inactive_members} inactive
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
              <Mail className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamStats.pending_invitations}</div>
              <div className="text-xs text-muted-foreground">
                Awaiting response
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Activity className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamStats.recent_activity_count}</div>
              <div className="text-xs text-muted-foreground">
                Last 7 days
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Role Distribution */}
      {teamStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Role Distribution</CardTitle>
            <CardDescription>
              Current team member roles and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {teamStats.owners > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("gap-1", TEAM_ROLE_COLORS.owner)}>
                    {getTeamRoleDisplayName('owner')}
                  </Badge>
                  <span className="text-sm font-medium">{teamStats.owners}</span>
                </div>
              )}
              {teamStats.admins > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("gap-1", TEAM_ROLE_COLORS.admin)}>
                    {getTeamRoleDisplayName('admin')}
                  </Badge>
                  <span className="text-sm font-medium">{teamStats.admins}</span>
                </div>
              )}
              {teamStats.members > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("gap-1", TEAM_ROLE_COLORS.member)}>
                    {getTeamRoleDisplayName('member')}
                  </Badge>
                  <span className="text-sm font-medium">{teamStats.members}</span>
                </div>
              )}
              {teamStats.viewers > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("gap-1", TEAM_ROLE_COLORS.viewer)}>
                    {getTeamRoleDisplayName('viewer')}
                  </Badge>
                  <span className="text-sm font-medium">{teamStats.viewers}</span>
                </div>
              )}
            </div>

            {teamStats.scheduled_removals > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    {teamStats.scheduled_removals} member{teamStats.scheduled_removals !== 1 ? 's' : ''} scheduled for removal
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Invitations
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          {/* Bulk Operations Panel */}
          <BulkOperationsPanel
            selectedMembers={selectedMembers}
            onSelectionChange={setSelectedMembers}
            onOperationComplete={handleMemberUpdate}
          />

          {/* Enhanced Member Table */}
          <EnhancedMemberTable
            members={members}
            selectedMembers={selectedMembers}
            onSelectionChange={setSelectedMembers}
            onMemberUpdate={handleMemberUpdate}
          />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6">
          <EnhancedInvitationPanel
            onInvitationUpdate={handleInvitationUpdate}
          />
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <AuditTrailViewer />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Analytics</CardTitle>
              <CardDescription>
                Detailed insights and metrics about your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Analytics Coming Soon</h3>
                <p className="text-muted-foreground">
                  Advanced team analytics and insights will be available here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
