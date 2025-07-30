import React, { useState, useMemo, useCallback } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { TeamAPI } from '@/services/apiProxy';
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
  Loader2,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import {
  TeamMember,
  TeamMemberRole,
  getTeamRoleDisplayName,
  getTeamRoleDescription,
  TEAM_ROLE_COLORS,
  EnhancedMemberSearchResult,
  MemberSearchResults
} from '@/types/team';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { AdvancedMemberSearchInput } from './AdvancedMemberSearchInput';
import { MemberFilterBuilder, MemberFilters } from './MemberFilterBuilder';
import { SavedSearchManager, SavedSearch } from './SavedSearchManager';
import { enhancedTeamService } from '@/services/enhancedTeamService';

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

  // Enhanced search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MemberFilters>({
    roles: [],
    statuses: [],
    activityLevels: [],
    joinDateRange: {},
    lastActiveRange: {},
    engagementScoreRange: {},
    receiptCountRange: {},
  });
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'joined_at' | 'last_active' | 'activity_score'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EnhancedMemberSearchResult[]>([]);
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);

  const [roleUpdateDialogOpen, setRoleUpdateDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [scheduleRemovalDialogOpen, setScheduleRemovalDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(false);

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

  // Enhanced search function
  const performAdvancedSearch = useCallback(async (query: string, suggestions?: any[]) => {
    if (!currentTeam?.id) return;

    setIsSearching(true);
    try {
      const response = await enhancedTeamService.searchMembersAdvanced({
        team_id: currentTeam.id,
        search_query: query || undefined,
        role_filter: filters.roles.length > 0 ? filters.roles : undefined,
        status_filter: filters.statuses.length > 0 ? filters.statuses : undefined,
        activity_filter: filters.activityLevels.length > 0 ? filters.activityLevels[0] : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: 100,
        offset: 0,
      });

      if (response.success && response.data?.members) {
        setSearchResults(response.data.members);
        setUseAdvancedSearch(true);
      } else {
        toast.error('Search failed. Please try again.');
      }
    } catch (error) {
      console.error('Advanced search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [currentTeam?.id, filters, sortBy, sortOrder, toast]);

  // Load saved search
  const loadSavedSearch = useCallback((savedSearch: SavedSearch) => {
    setSearchQuery(savedSearch.query);
    setFilters(savedSearch.filters);
    performAdvancedSearch(savedSearch.query);
  }, [performAdvancedSearch]);

  // Enhanced members with status information
  const enhancedMembers: MemberWithStatus[] = useMemo(() => {
    const membersToProcess = useAdvancedSearch ?
      searchResults.map(result => ({
        id: result.id,
        team_id: result.user_id, // Note: this mapping might need adjustment
        user_id: result.user_id,
        role: result.role,
        permissions: result.permissions,
        joined_at: result.joined_at,
        updated_at: result.updated_at,
        email: result.email,
        first_name: result.first_name,
        last_name: result.last_name,
        last_active_at: result.last_active_at,
        removal_scheduled_at: result.removal_scheduled_at,
      } as TeamMember)) :
      members;

    return membersToProcess.map(member => ({
      ...member,
      status: member.removal_scheduled_at ? 'scheduled_removal' :
              (member.last_active_at && new Date(member.last_active_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) ? 'active' : 'inactive',
    }));
  }, [members, searchResults, useAdvancedSearch]);

  // Basic filtered members (fallback when not using advanced search)
  const basicFilteredMembers = useMemo(() => {
    if (useAdvancedSearch) return enhancedMembers;

    let filtered = enhancedMembers.filter(member => {
      // Search filter
      const searchMatch = searchQuery === '' ||
        `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase());

      return searchMatch;
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
  }, [enhancedMembers, searchQuery, sortBy, sortOrder, useAdvancedSearch]);

  const filteredMembers = basicFilteredMembers;

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
    if (!selectedMember || !currentTeam?.id) return;

    try {
      setLoading(true);

      // Call enhanced role update function using TeamAPI
      const result = await TeamAPI.updateMemberRole(
        currentTeam.id,
        selectedMember.user_id,
        roleUpdateForm.newRole
      );

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
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember || !currentTeam?.id) return;

    try {
      setLoading(true);

      // Call enhanced remove member function using TeamAPI
      const result = await TeamAPI.removeMember({
        team_id: currentTeam.id,
        user_id: selectedMember.user_id,
        reason: removeForm.reason,
        transfer_data: removeForm.transferData,
        transfer_to_user_id: removeForm.transferToUserId || null,
      });

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
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleRemoval = async () => {
    if (!selectedMember || !currentTeam?.id) return;

    try {
      setLoading(true);

      // Call schedule removal function using TeamAPI
      const result = await TeamAPI.scheduleRemoval({
        team_id: currentTeam.id,
        user_id: selectedMember.user_id,
        removal_date: scheduleRemovalForm.removalDate,
        reason: scheduleRemovalForm.reason,
      });

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
    } finally {
      setLoading(false);
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
      {/* Enhanced Search Interface */}
      <div className="space-y-4">
        {/* Search Input and Controls */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <AdvancedMemberSearchInput
              onSearch={performAdvancedSearch}
              placeholder="Search team members by name, email, or role..."
              isLoading={isSearching}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <MemberFilterBuilder
              filters={filters}
              onFiltersChange={setFilters}
              onReset={() => {
                setFilters({
                  roles: [],
                  statuses: [],
                  activityLevels: [],
                  joinDateRange: {},
                  lastActiveRange: {},
                  engagementScoreRange: {},
                  receiptCountRange: {},
                });
                setUseAdvancedSearch(false);
                setSearchResults([]);
              }}
            />

            <SavedSearchManager
              currentQuery={searchQuery}
              currentFilters={filters}
              onSearchLoad={loadSavedSearch}
            />
          </div>
        </div>

        {/* Search Status */}
        {isSearching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching members...
          </div>
        )}

        {useAdvancedSearch && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUseAdvancedSearch(false);
                setSearchResults([]);
                setSearchQuery('');
              }}
            >
              Clear Search
            </Button>
          </div>
        )}
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
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (sortBy === 'name') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('name');
                      setSortOrder('asc');
                    }
                  }}
                  className="h-auto p-0 font-medium"
                >
                  Member
                  {sortBy === 'name' && (
                    sortOrder === 'asc' ? <SortAsc className="ml-1 h-3 w-3" /> : <SortDesc className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (sortBy === 'role') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('role');
                      setSortOrder('asc');
                    }
                  }}
                  className="h-auto p-0 font-medium"
                >
                  Role
                  {sortBy === 'role' && (
                    sortOrder === 'asc' ? <SortAsc className="ml-1 h-3 w-3" /> : <SortDesc className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (sortBy === 'joined_at') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('joined_at');
                      setSortOrder('desc');
                    }
                  }}
                  className="h-auto p-0 font-medium"
                >
                  Joined
                  {sortBy === 'joined_at' && (
                    sortOrder === 'asc' ? <SortAsc className="ml-1 h-3 w-3" /> : <SortDesc className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (sortBy === 'last_active') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('last_active');
                      setSortOrder('desc');
                    }
                  }}
                  className="h-auto p-0 font-medium"
                >
                  Last Active
                  {sortBy === 'last_active' && (
                    sortOrder === 'asc' ? <SortAsc className="ml-1 h-3 w-3" /> : <SortDesc className="ml-1 h-3 w-3" />
                  )}
                </Button>
              </TableHead>
              {useAdvancedSearch && (
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'activity_score') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('activity_score');
                        setSortOrder('desc');
                      }
                    }}
                    className="h-auto p-0 font-medium"
                  >
                    Activity
                    {sortBy === 'activity_score' && (
                      sortOrder === 'asc' ? <SortAsc className="ml-1 h-3 w-3" /> : <SortDesc className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
              )}
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => {
              // Get enhanced data if available
              const enhancedMember = useAdvancedSearch ?
                searchResults.find(r => r.user_id === member.user_id) : null;

              return (
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
                        {enhancedMember?.receipt_metrics && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {enhancedMember.receipt_metrics.total_receipts} receipts •
                            {enhancedMember.receipt_metrics.categories_used} categories
                          </div>
                        )}
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
                      {enhancedMember?.member_status && enhancedMember.member_status !== member.status && (
                        <Badge variant="outline" className="text-xs ml-1">
                          {enhancedMember.member_status.replace('_', ' ')}
                        </Badge>
                      )}
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
                    {enhancedMember?.activity_metrics && (
                      <div className="text-xs text-muted-foreground">
                        {enhancedMember.activity_metrics.active_days} active days
                      </div>
                    )}
                  </TableCell>
                  {useAdvancedSearch && enhancedMember && (
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {enhancedMember.activity_metrics.activity_score || 0}
                          </div>
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(100, (enhancedMember.activity_metrics.activity_score || 0))}%`
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {enhancedMember.activity_metrics.total_activities} activities
                        </div>
                      </div>
                    </TableCell>
                  )}
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
              );
            })}
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
            <Button onClick={handleRoleUpdate} disabled={loading}>
              {loading ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMember?.first_name} {selectedMember?.last_name} from the team?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="Reason for removing this member..."
                value={removeForm.reason}
                onChange={(e) => setRemoveForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="transferData"
                checked={removeForm.transferData}
                onCheckedChange={(checked) =>
                  setRemoveForm(prev => ({ ...prev, transferData: checked as boolean }))
                }
              />
              <Label htmlFor="transferData" className="text-sm">
                Transfer member's data to another team member
              </Label>
            </div>

            {removeForm.transferData && (
              <div className="space-y-2">
                <Label>Transfer to</Label>
                <Select
                  value={removeForm.transferToUserId}
                  onValueChange={(value) =>
                    setRemoveForm(prev => ({ ...prev, transferToUserId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members
                      .filter(member => member.user_id !== selectedMember?.user_id)
                      .map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.first_name} {member.last_name} ({member.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={loading || (removeForm.transferData && !removeForm.transferToUserId)}
            >
              {loading ? 'Removing...' : 'Remove Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Removal Dialog */}
      <Dialog open={scheduleRemovalDialogOpen} onOpenChange={setScheduleRemovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Member Removal</DialogTitle>
            <DialogDescription>
              Schedule {selectedMember?.first_name} {selectedMember?.last_name} for removal at a future date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Removal Date</Label>
              <Input
                type="date"
                value={scheduleRemovalForm.removalDate}
                onChange={(e) => setScheduleRemovalForm(prev => ({ ...prev, removalDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="Reason for scheduling removal..."
                value={scheduleRemovalForm.reason}
                onChange={(e) => setScheduleRemovalForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleRemovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleRemoval} disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Removal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
