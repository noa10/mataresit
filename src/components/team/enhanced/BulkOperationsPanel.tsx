import React, { useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  UserMinus,
  UserCheck,
  Settings,
  Mail,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { TeamMember, TeamMemberRole, getTeamRoleDisplayName, TEAM_ROLE_COLORS } from '@/types/team';
import { cn } from '@/lib/utils';
import { TeamAPI } from '@/services/apiProxy';

interface BulkOperationsPanelProps {
  selectedMembers: TeamMember[];
  onSelectionChange: (members: TeamMember[]) => void;
  onOperationComplete: () => void;
}

interface BulkOperation {
  id: string;
  type: 'bulk_invite' | 'bulk_remove' | 'bulk_role_update' | 'bulk_permission_update';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  progress_percentage: number;
  started_at: string;
  completed_at?: string;
  error_summary?: string;
}

export function BulkOperationsPanel({ 
  selectedMembers, 
  onSelectionChange, 
  onOperationComplete 
}: BulkOperationsPanelProps) {
  const { currentTeam, hasPermission } = useTeam();
  const { t } = useTeamTranslation();
  const { toast } = useToast();

  const [bulkRoleDialogOpen, setBulkRoleDialogOpen] = useState(false);
  const [bulkRemoveDialogOpen, setBulkRemoveDialogOpen] = useState(false);
  const [bulkInviteDialogOpen, setBulkInviteDialogOpen] = useState(false);
  const [operationsDialogOpen, setOperationsDialogOpen] = useState(false);

  const [bulkRoleForm, setBulkRoleForm] = useState({
    newRole: 'member' as TeamMemberRole,
    reason: '',
  });

  const [bulkRemoveForm, setBulkRemoveForm] = useState({
    reason: '',
    transferData: false,
    transferToUserId: '',
  });

  const [bulkInviteForm, setBulkInviteForm] = useState({
    emails: '',
    role: 'member' as TeamMemberRole,
    customMessage: '',
    expiresInDays: 7,
  });

  const [activeOperations, setActiveOperations] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if user has permission for bulk operations
  if (!hasPermission('manage_members')) {
    return null;
  }

  const handleBulkRoleUpdate = async () => {
    if (selectedMembers.length === 0) return;

    try {
      setLoading(true);

      const roleUpdates = selectedMembers.map(member => ({
        user_id: member.user_id,
        new_role: bulkRoleForm.newRole,
        reason: bulkRoleForm.reason,
      }));

      if (!currentTeam?.id) {
        throw new Error('No team selected');
      }

      // Use enhanced team service instead of direct API call
      const response = await enhancedTeamService.bulkUpdateRoles(
        currentTeam.id,
        roleUpdates,
        bulkRoleForm.reason
      );

      const result = response;

      if (result.success) {
        toast({
          title: 'Bulk Role Update Started',
          description: `Updating roles for ${selectedMembers.length} members`,
        });

        // Add to active operations
        setActiveOperations(prev => [...prev, {
          id: result.bulk_operation_id,
          type: 'bulk_role_update',
          status: 'in_progress',
          total_items: result.total_updates,
          processed_items: 0,
          successful_items: 0,
          failed_items: 0,
          progress_percentage: 0,
          started_at: new Date().toISOString(),
        }]);

        setBulkRoleDialogOpen(false);
        onSelectionChange([]);
        onOperationComplete();
      } else {
        throw new Error(result.error || 'Failed to start bulk role update');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update member roles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedMembers.length === 0) return;

    try {
      setLoading(true);

      const userIds = selectedMembers.map(member => member.user_id);

      if (!currentTeam?.id) {
        throw new Error('No team selected');
      }

      // Use TeamAPI for bulk member removal
      const result = await TeamAPI.bulkRemove({
        team_id: currentTeam.id,
        user_ids: userIds,
        reason: bulkRemoveForm.reason,
        transfer_data: bulkRemoveForm.transferData,
        transfer_to_user_id: bulkRemoveForm.transferToUserId || null,
      });

      if (result.success) {
        const successCount = result.successful_removals || 0;
        const failedCount = result.failed_removals || 0;
        const totalCount = result.total_users || selectedMembers.length;

        toast({
          title: 'Bulk Member Removal Completed',
          description: `Successfully removed ${successCount} of ${totalCount} members${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
          variant: failedCount > 0 ? 'destructive' : 'default',
        });

        // Add to active operations as completed
        if (result.bulk_operation_id) {
          setActiveOperations(prev => [...prev, {
            id: result.bulk_operation_id,
            type: 'bulk_remove',
            status: 'completed',
            total_items: totalCount,
            processed_items: totalCount,
            successful_items: successCount,
            failed_items: failedCount,
            progress_percentage: 100,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }]);

          // Remove the completed operation after a delay
          setTimeout(() => {
            setActiveOperations(prev => prev.filter(op => op.id !== result.bulk_operation_id));
          }, 5000);
        }

        setBulkRemoveDialogOpen(false);
        onSelectionChange([]);
        onOperationComplete();
      } else {
        throw new Error(result.error || 'Failed to remove members');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkInvite = async () => {
    const emails = bulkInviteForm.emails
      .split('\n')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emails.length === 0) return;

    try {
      setLoading(true);

      const invitations = emails.map(email => ({
        email,
        role: bulkInviteForm.role,
        custom_message: bulkInviteForm.customMessage,
      }));

      if (!currentTeam?.id) {
        throw new Error('No team selected');
      }

      // Use enhanced team service instead of direct API call
      const response = await enhancedTeamService.bulkInviteMembers(
        currentTeam.id,
        invitations,
        {
          defaultRole: bulkInviteForm.role,
          expiresInDays: bulkInviteForm.expiresInDays,
          sendEmails: true,
        }
      );

      const result = response;

      if (result.success) {
        toast({
          title: 'Bulk Invitations Started',
          description: `Sending invitations to ${emails.length} recipients`,
        });

        // Add to active operations
        setActiveOperations(prev => [...prev, {
          id: result.bulk_operation_id,
          type: 'bulk_invite',
          status: 'in_progress',
          total_items: emails.length,
          processed_items: 0,
          successful_items: 0,
          failed_items: 0,
          progress_percentage: 0,
          started_at: new Date().toISOString(),
        }]);

        setBulkInviteDialogOpen(false);
        onOperationComplete();
      } else {
        throw new Error(result.error || 'Failed to start bulk invitations');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'bulk_invite': return <Mail className="h-4 w-4" />;
      case 'bulk_remove': return <UserMinus className="h-4 w-4" />;
      case 'bulk_role_update': return <UserCheck className="h-4 w-4" />;
      case 'bulk_permission_update': return <Settings className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <>
      {/* Bulk Operations Toolbar */}
      {selectedMembers.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                </CardTitle>
                <CardDescription>
                  Choose a bulk operation to perform on selected members
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectionChange([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkRoleDialogOpen(true)}
                disabled={!hasPermission('update_member_roles')}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Update Roles
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkRemoveDialogOpen(true)}
                disabled={!hasPermission('remove_members')}
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Remove Members
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Operations Panel */}
      {activeOperations.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Active Operations</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOperationsDialogOpen(true)}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeOperations.slice(0, 3).map((operation) => (
                <div key={operation.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {getOperationIcon(operation.type)}
                    {getStatusIcon(operation.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize">
                        {operation.type.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {operation.progress_percentage}%
                      </span>
                    </div>
                    <Progress value={operation.progress_percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{operation.processed_items}/{operation.total_items} processed</span>
                      <span>{operation.successful_items} successful, {operation.failed_items} failed</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Invite Button */}
      <div className="mb-6">
        <Button
          onClick={() => setBulkInviteDialogOpen(true)}
          disabled={!hasPermission('invite_members')}
        >
          <Mail className="h-4 w-4 mr-2" />
          Bulk Invite Members
        </Button>
      </div>

      {/* Bulk Role Update Dialog */}
      <Dialog open={bulkRoleDialogOpen} onOpenChange={setBulkRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Member Roles</DialogTitle>
            <DialogDescription>
              Update roles for {selectedMembers.length} selected member{selectedMembers.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select
                value={bulkRoleForm.newRole}
                onValueChange={(value: TeamMemberRole) => 
                  setBulkRoleForm(prev => ({ ...prev, newRole: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="Reason for role update..."
                value={bulkRoleForm.reason}
                onChange={(e) => setBulkRoleForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Selected Members:</h4>
              <div className="space-y-1">
                {selectedMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between text-sm">
                    <span>{member.first_name} {member.last_name} ({member.email})</span>
                    <Badge variant="outline" className={cn("text-xs", TEAM_ROLE_COLORS[member.role])}>
                      {getTeamRoleDisplayName(member.role)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkRoleUpdate} disabled={loading}>
              {loading ? 'Updating...' : 'Update Roles'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Remove Dialog */}
      <Dialog open={bulkRemoveDialogOpen} onOpenChange={setBulkRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Members</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} from the team?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="Reason for removing these members..."
                value={bulkRemoveForm.reason}
                onChange={(e) => setBulkRemoveForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="bulkTransferData"
                checked={bulkRemoveForm.transferData}
                onCheckedChange={(checked) =>
                  setBulkRemoveForm(prev => ({ ...prev, transferData: checked as boolean }))
                }
              />
              <Label htmlFor="bulkTransferData" className="text-sm">
                Transfer members' data to another team member
              </Label>
            </div>

            {bulkRemoveForm.transferData && (
              <div className="space-y-2">
                <Label>Transfer to</Label>
                <Select
                  value={bulkRemoveForm.transferToUserId}
                  onValueChange={(value) =>
                    setBulkRemoveForm(prev => ({ ...prev, transferToUserId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Show team members not in the selected list */}
                    {currentTeam && (
                      <>
                        {/* This would need to be populated with actual team members */}
                        <SelectItem value="placeholder">Select a member...</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Members to be removed:</h4>
              <div className="space-y-1">
                {selectedMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between text-sm">
                    <span>{member.first_name} {member.last_name} ({member.email})</span>
                    <Badge variant="outline" className={cn("text-xs", TEAM_ROLE_COLORS[member.role])}>
                      {getTeamRoleDisplayName(member.role)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkRemove}
              disabled={loading || (bulkRemoveForm.transferData && !bulkRemoveForm.transferToUserId)}
            >
              {loading ? 'Removing...' : `Remove ${selectedMembers.length} Member${selectedMembers.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
