import React, { useState, useMemo } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  MoreHorizontal,
  Search,
  Filter,
  UserMinus,
  UserCheck,
  Crown,
  Shield,
  Eye,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { 
  TeamMember, 
  TeamMemberRole, 
  getTeamRoleDisplayName, 
  getTeamRoleDescription,
  TEAM_ROLE_COLORS 
} from '@/types/team';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface EnhancedMemberTableProps {
  members: TeamMember[];
  selectedMembers: TeamMember[];
  onSelectionChange: (members: TeamMember[]) => void;
  onMemberUpdate: () => void;
}

interface MemberWithStatus extends TeamMember {
  status: 'active' | 'inactive' | 'scheduled_removal';
  last_active?: string;
  removal_scheduled_at?: string;
}

export function EnhancedMemberTable({ 
  members, 
  selectedMembers, 
  onSelectionChange, 
  onMemberUpdate 
}: EnhancedMemberTableProps) {
  const { currentTeam, currentTeamRole, hasPermission } = useTeam();
  const { t } = useTeamTranslation();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<TeamMemberRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'scheduled_removal'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'joined_at' | 'last_active'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [roleUpdateDialogOpen, setRoleUpdateDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [scheduleRemovalDialogOpen, setScheduleRemovalDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const [roleUpdateForm, setRoleUpdateForm] = useState({
    newRole: 'member' as TeamMemberRole,
    reason: '',
  });

  const [removeForm, setRemoveForm] = useState({
    reason: '',
    transferData: false,
    transferToUserId: '',
  });

  const [scheduleRemovalForm, setScheduleRemovalForm] = useState({
    removalDate: '',
    reason: '',
  });

  // Enhanced members with status information
  const enhancedMembers: MemberWithStatus[] = useMemo(() => {
    return members.map(member => ({
      ...member,
      status: member.removal_scheduled_at ? 'scheduled_removal' : 
              (member.last_active_at && new Date(member.last_active_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) ? 'active' : 'inactive',
    }));
  }, [members]);

  // Filtered and sorted members
  const filteredMembers = useMemo(() => {
    let filtered = enhancedMembers.filter(member => {
      // Search filter
      const searchMatch = searchQuery === '' || 
        `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase());

      // Role filter
      const roleMatch = roleFilter === 'all' || member.role === roleFilter;

      // Status filter
      const statusMatch = statusFilter === 'all' || member.status === statusFilter;

      return searchMatch && roleMatch && statusMatch;
    });

    // Sort members
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = `${a.first_name} ${a.last_name}`.toLowerCase();
          bValue = `${b.first_name} ${b.last_name}`.toLowerCase();
          break;
        case 'role':
          const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 };
          aValue = roleOrder[a.role];
          bValue = roleOrder[b.role];
          break;
        case 'joined_at':
          aValue = new Date(a.joined_at);
          bValue = new Date(b.joined_at);
          break;
        case 'last_active':
          aValue = a.last_active_at ? new Date(a.last_active_at) : new Date(0);
          bValue = b.last_active_at ? new Date(b.last_active_at) : new Date(0);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [enhancedMembers, searchQuery, roleFilter, statusFilter, sortBy, sortOrder]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(filteredMembers);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectMember = (member: TeamMember, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedMembers, member]);
    } else {
      onSelectionChange(selectedMembers.filter(m => m.id !== member.id));
    }
  };

  const handleRoleUpdate = async () => {
    if (!selectedMember) return;

    try {
      // Call enhanced role update function
      const response = await fetch('/api/team/update-member-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: currentTeam?.id,
          user_id: selectedMember.user_id,
          new_role: roleUpdateForm.newRole,
          reason: roleUpdateForm.reason,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Role Updated',
          description: `${selectedMember.first_name} ${selectedMember.last_name} is now a ${roleUpdateForm.newRole}`,
        });
        setRoleUpdateDialogOpen(false);
        onMemberUpdate();
      } else {
        throw new Error(result.error || 'Failed to update role');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update member role',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    try {
      // Call enhanced remove member function
      const response = await fetch('/api/team/remove-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: currentTeam?.id,
          user_id: selectedMember.user_id,
          reason: removeForm.reason,
          transfer_data: removeForm.transferData,
          transfer_to_user_id: removeForm.transferToUserId || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Member Removed',
          description: `${selectedMember.first_name} ${selectedMember.last_name} has been removed from the team`,
        });
        setRemoveDialogOpen(false);
        onMemberUpdate();
      } else {
        throw new Error(result.error || 'Failed to remove member');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const handleScheduleRemoval = async () => {
    if (!selectedMember) return;

    try {
      // Call schedule removal function
      const response = await fetch('/api/team/schedule-removal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: currentTeam?.id,
          user_id: selectedMember.user_id,
          removal_date: scheduleRemovalForm.removalDate,
          reason: scheduleRemovalForm.reason,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Removal Scheduled',
          description: `${selectedMember.first_name} ${selectedMember.last_name} is scheduled for removal`,
        });
        setScheduleRemovalDialogOpen(false);
        onMemberUpdate();
      } else {
        throw new Error(result.error || 'Failed to schedule removal');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to schedule removal',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: TeamMemberRole) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'member': return <User className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'inactive': return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'scheduled_removal': return <AlertTriangle className="h-3 w-3 text-red-500" />;
      default: return <XCircle className="h-3 w-3 text-gray-500" />;
    }
  };

  const canManageMember = (member: TeamMember) => {
    if (!hasPermission('manage_members')) return false;
    if (member.role === 'owner') return false;
    if (member.role === 'admin' && currentTeamRole !== 'owner') return false;
    return true;
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="scheduled_removal">Scheduled Removal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedMembers.some(m => m.id === member.id)}
                    onCheckedChange={(checked) => handleSelectMember(member, checked as boolean)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium">
                        {member.first_name} {member.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getRoleIcon(member.role)}
                    <Badge variant="outline" className={cn("gap-1", TEAM_ROLE_COLORS[member.role])}>
                      {getTeamRoleDisplayName(member.role)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(member.status)}
                    <span className="text-sm capitalize">{member.status.replace('_', ' ')}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {member.last_active_at 
                      ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })
                      : 'Never'
                    }
                  </div>
                </TableCell>
                <TableCell>
                  {canManageMember(member) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedMember(member);
                            setRoleUpdateForm({ newRole: member.role, reason: '' });
                            setRoleUpdateDialogOpen(true);
                          }}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Update Role
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedMember(member);
                            setScheduleRemovalForm({ removalDate: '', reason: '' });
                            setScheduleRemovalDialogOpen(true);
                          }}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Removal
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedMember(member);
                            setRemoveForm({ reason: '', transferData: false, transferToUserId: '' });
                            setRemoveDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Role Update Dialog */}
      <Dialog open={roleUpdateDialogOpen} onOpenChange={setRoleUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Member Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedMember?.first_name} {selectedMember?.last_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select
                value={roleUpdateForm.newRole}
                onValueChange={(value: TeamMemberRole) => 
                  setRoleUpdateForm(prev => ({ ...prev, newRole: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentTeamRole === 'owner' && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="Reason for role change..."
                value={roleUpdateForm.reason}
                onChange={(e) => setRoleUpdateForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRoleUpdate}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Additional dialogs would be implemented similarly... */}
    </div>
  );
}
