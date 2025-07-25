import React, { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  Shield,
  UserPlus,
  UserMinus,
  UserCheck,
  Settings,
  Crown,
  Mail,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { enhancedTeamService } from '@/services/enhancedTeamService';

interface AuditLog {
  id: string;
  team_id: string;
  action: string;
  action_description: string;
  performed_by: string;
  performed_by_email: string;
  performed_by_name: string;
  target_user_id?: string;
  target_user_email?: string;
  target_user_name?: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  created_at: string;
}

interface AuditTrailViewerProps {
  className?: string;
}

export function AuditTrailViewer({ className }: AuditTrailViewerProps) {
  const { currentTeam, hasPermission } = useTeam();
  const { t } = useTeamTranslation();
  const { toast } = useToast();

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const [pagination, setPagination] = useState({
    page: 0,
    limit: 50,
    total: 0,
    hasMore: false,
  });

  useEffect(() => {
    if (currentTeam?.id && hasPermission('view_audit_logs')) {
      loadAuditLogs();
    }
  }, [currentTeam?.id, actionFilter, userFilter, dateRange, pagination.page]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: (pagination.page * pagination.limit).toString(),
      });

      if (actionFilter !== 'all') {
        params.append('actions', actionFilter);
      }

      if (userFilter !== 'all') {
        params.append('user_id', userFilter);
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (dateRange) {
        case '1d':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      params.append('start_date', startDate.toISOString());
      params.append('end_date', endDate.toISOString());

      if (!currentTeam?.id) {
        throw new Error('No team selected');
      }

      // Use enhanced team service instead of direct API call
      const response = await enhancedTeamService.getAuditLogs({
        team_id: currentTeam.id,
        actions: actionFilter !== 'all' ? [actionFilter] : undefined,
        userId: userFilter !== 'all' ? userFilter : undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: pagination.limit,
        offset: pagination.page * pagination.limit,
      });

      if (response.success) {
        // response.data is a PaginatedResponse<TeamAuditLog>, so we need response.data.data for the array
        const auditLogsData = response.data?.data;
        setAuditLogs(Array.isArray(auditLogsData) ? auditLogsData : []);
        setPagination(prev => ({
          ...prev,
          total: response.data?.total || 0,
          hasMore: response.data?.has_more || false
        }));
      } else {
        throw new Error(response.error || 'Failed to load audit logs');
      }
    } catch (error: any) {
      // Ensure auditLogs is always an array even on error
      setAuditLogs([]);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load audit logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadAuditLogs();
      return;
    }

    try {
      setLoading(true);

      if (!currentTeam?.id) {
        throw new Error('No team selected');
      }

      // Use enhanced team service for search instead of direct API call
      const response = await enhancedTeamService.searchAuditLogs({
        team_id: currentTeam.id,
        search_params: {
          text_search: searchQuery,
          actions: actionFilter !== 'all' ? [actionFilter] : undefined,
          user_id: userFilter !== 'all' ? userFilter : undefined,
          limit: pagination.limit,
        },
      });

      if (response.success) {
        const searchResults = response.data;
        setAuditLogs(Array.isArray(searchResults) ? searchResults : []);
      } else {
        throw new Error(response.error || 'Failed to search audit logs');
      }
    } catch (error: any) {
      // Ensure auditLogs is always an array even on error
      setAuditLogs([]);
      toast({
        title: 'Error',
        description: error.message || 'Failed to search audit logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const response = await fetch(`/api/team/${currentTeam?.id}/audit-logs/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString(),
          format: 'json',
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Create and download file
        const blob = new Blob([JSON.stringify(result.export_data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${currentTeam?.name}-${format(new Date(), 'yyyy-MM-dd')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Export Complete',
          description: 'Audit logs have been exported successfully',
        });
      } else {
        throw new Error(result.error || 'Failed to export audit logs');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to export audit logs',
        variant: 'destructive',
      });
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'member_added': return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'member_removed': return <UserMinus className="h-4 w-4 text-red-500" />;
      case 'member_role_changed': return <UserCheck className="h-4 w-4 text-blue-500" />;
      case 'owner_transferred': return <Crown className="h-4 w-4 text-purple-500" />;
      case 'invitation_sent': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'invitation_accepted': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'invitation_cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'team_created': return <Shield className="h-4 w-4 text-green-500" />;
      case 'team_updated': return <Settings className="h-4 w-4 text-blue-500" />;
      case 'team_deleted': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'member_added':
      case 'invitation_accepted':
      case 'team_created':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'member_removed':
      case 'invitation_cancelled':
      case 'team_deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'member_role_changed':
      case 'invitation_sent':
      case 'team_updated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'owner_transferred':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (!hasPermission('view_audit_logs')) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don't have permission to view audit logs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Audit Trail</h3>
          <p className="text-sm text-muted-foreground">
            Track all team management activities and changes
          </p>
        </div>
        <Button onClick={handleExportLogs} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="member_added">Member Added</SelectItem>
                <SelectItem value="member_removed">Member Removed</SelectItem>
                <SelectItem value="member_role_changed">Role Changed</SelectItem>
                <SelectItem value="invitation_sent">Invitation Sent</SelectItem>
                <SelectItem value="team_updated">Team Updated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last Day</SelectItem>
                <SelectItem value="7d">Last Week</SelectItem>
                <SelectItem value="30d">Last Month</SelectItem>
                <SelectItem value="90d">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleSearch} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading audit logs...</p>
            </div>
          ) : !Array.isArray(auditLogs) ? (
            <div className="p-8 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-destructive">Data Error</h3>
              <p className="text-muted-foreground">
                Invalid audit logs data format. Please refresh the page.
              </p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Audit Logs</h3>
              <p className="text-muted-foreground">
                No audit logs found for the selected criteria.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => {
                  // Additional safety check for each log item
                  if (!log || typeof log !== 'object' || !log.id) {
                    console.warn('Invalid audit log item:', log);
                    return null;
                  }

                  return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {formatActionName(log.action)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <div className="font-medium text-sm">{log.action_description}</div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Additional context available
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{log.performed_by_name}</div>
                        <div className="text-xs text-muted-foreground">{log.performed_by_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.target_user_name ? (
                        <div>
                          <div className="font-medium text-sm">{log.target_user_name}</div>
                          <div className="text-xs text-muted-foreground">{log.target_user_email}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailsDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                }).filter(Boolean)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {auditLogs.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {pagination.page * pagination.limit + 1} to{' '}
            {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of{' '}
            {pagination.total} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(0, prev.page - 1) }))}
              disabled={pagination.page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={!pagination.hasMore}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Audit Log Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this audit log entry
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Action</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getActionIcon(selectedLog.action)}
                    <Badge variant="outline" className={getActionColor(selectedLog.action)}>
                      {formatActionName(selectedLog.action)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date & Time</Label>
                  <div className="mt-1 text-sm">
                    {format(new Date(selectedLog.created_at), 'PPpp')}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Description</Label>
                <div className="mt-1 text-sm">{selectedLog.action_description}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Performed By</Label>
                  <div className="mt-1">
                    <div className="text-sm font-medium">{selectedLog.performed_by_name}</div>
                    <div className="text-xs text-muted-foreground">{selectedLog.performed_by_email}</div>
                  </div>
                </div>
                {selectedLog.target_user_name && (
                  <div>
                    <Label className="text-sm font-medium">Target User</Label>
                    <div className="mt-1">
                      <div className="text-sm font-medium">{selectedLog.target_user_name}</div>
                      <div className="text-xs text-muted-foreground">{selectedLog.target_user_email}</div>
                    </div>
                  </div>
                )}
              </div>

              {(Object.keys(selectedLog.old_values).length > 0 || Object.keys(selectedLog.new_values).length > 0) && (
                <div>
                  <Label className="text-sm font-medium">Changes</Label>
                  <div className="mt-1 space-y-2">
                    {Object.keys(selectedLog.old_values).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-red-600">Before:</div>
                        <pre className="text-xs bg-red-50 p-2 rounded border">
                          {JSON.stringify(selectedLog.old_values, null, 2)}
                        </pre>
                      </div>
                    )}
                    {Object.keys(selectedLog.new_values).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-green-600">After:</div>
                        <pre className="text-xs bg-green-50 p-2 rounded border">
                          {JSON.stringify(selectedLog.new_values, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Additional Context</Label>
                  <pre className="mt-1 text-xs bg-muted p-2 rounded border overflow-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {(selectedLog.ip_address || selectedLog.user_agent) && (
                <div>
                  <Label className="text-sm font-medium">Technical Details</Label>
                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {selectedLog.ip_address && (
                      <div>IP Address: {selectedLog.ip_address}</div>
                    )}
                    {selectedLog.user_agent && (
                      <div>User Agent: {selectedLog.user_agent}</div>
                    )}
                    {selectedLog.session_id && (
                      <div>Session ID: {selectedLog.session_id}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
