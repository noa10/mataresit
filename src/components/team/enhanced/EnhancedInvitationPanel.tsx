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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  UserPlus,
  RotateCcw,
  XCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Send,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { TeamInvitation, TeamMemberRole, getTeamRoleDisplayName, TEAM_ROLE_COLORS } from '@/types/team';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { enhancedTeamService } from '@/services/enhancedTeamService';

interface EnhancedInvitationPanelProps {
  onInvitationUpdate: () => void;
}

interface EnhancedInvitation extends TeamInvitation {
  invitation_attempts?: number;
  last_sent_at?: string;
  custom_message?: string;
  permissions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export function EnhancedInvitationPanel({ onInvitationUpdate }: EnhancedInvitationPanelProps) {
  const { currentTeam, hasPermission } = useTeam();
  const { t } = useTeamTranslation();
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<EnhancedInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<EnhancedInvitation | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member' as TeamMemberRole,
    customMessage: '',
    permissions: {},
    expiresInDays: 7,
    sendEmail: true,
  });

  const [resendForm, setResendForm] = useState({
    customMessage: '',
    extendExpiration: true,
    newExpirationDays: 7,
  });

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'accepted' | 'expired' | 'cancelled'>('all');

  useEffect(() => {
    if (currentTeam?.id) {
      loadInvitations();
    }
  }, [currentTeam?.id]);

  const loadInvitations = async () => {
    try {
      setLoading(true);

      if (!currentTeam?.id) {
        throw new Error('No team selected');
      }

      // Use enhanced team service instead of direct API call
      const response = await enhancedTeamService.getTeamInvitations({
        team_id: currentTeam.id,
        include_expired: true,
      });

      if (response.success) {
        setInvitations(response.data || []);
      } else {
        throw new Error(response.error || 'Failed to load invitations');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load invitations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async () => {
    try {
      if (!currentTeam?.id) {
        throw new Error('No team selected');
      }

      // Use the enhanced team service instead of direct API call
      const result = await enhancedTeamService.sendInvitationEnhanced({
        team_id: currentTeam.id,
        email: inviteForm.email,
        role: inviteForm.role,
        custom_message: inviteForm.customMessage,
        permissions: inviteForm.permissions,
        expires_in_days: inviteForm.expiresInDays,
        send_email: inviteForm.sendEmail,
      });

      if (result.success) {
        toast({
          title: 'Invitation Sent',
          description: `Invitation sent to ${inviteForm.email}`,
        });

        setInviteDialogOpen(false);
        setInviteForm({
          email: '',
          role: 'member',
          customMessage: '',
          permissions: {},
          expiresInDays: 7,
          sendEmail: true,
        });

        loadInvitations();
        onInvitationUpdate();
      } else {
        throw new Error(result.error || 'Failed to send invitation');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    }
  };

  const handleResendInvitation = async () => {
    if (!selectedInvitation) return;

    try {
      // Use the enhanced team service instead of direct API call
      const result = await enhancedTeamService.resendInvitation({
        invitation_id: selectedInvitation.id,
        custom_message: resendForm.customMessage,
        extend_expiration: resendForm.extendExpiration,
        new_expiration_days: resendForm.newExpirationDays,
      });

      if (result.success) {
        toast({
          title: 'Invitation Resent',
          description: `Invitation resent to ${selectedInvitation.email}`,
        });

        setResendDialogOpen(false);
        loadInvitations();
      } else {
        throw new Error(result.error || 'Failed to resend invitation');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive',
      });
    }
  };

  const handleCancelInvitation = async (invitation: EnhancedInvitation) => {
    try {
      // Use the enhanced team service instead of direct API call
      const result = await enhancedTeamService.cancelInvitation(
        invitation.id,
        'Cancelled by admin'
      );

      if (result.success) {
        toast({
          title: 'Invitation Cancelled',
          description: `Invitation to ${invitation.email} has been cancelled`,
        });

        loadInvitations();
      } else {
        throw new Error(result.error || 'Failed to cancel invitation');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel invitation',
        variant: 'destructive',
      });
    }
  };

  const copyInvitationLink = (invitation: EnhancedInvitation) => {
    const inviteUrl = `${window.location.origin}/invite/${invitation.token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: 'Link Copied',
      description: 'Invitation link copied to clipboard',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'accepted': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'expired': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
      case 'expired': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredInvitations = invitations.filter(invitation => 
    filterStatus === 'all' || invitation.status === filterStatus
  );

  if (!hasPermission('invite_members')) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team Invitations</h3>
          <p className="text-sm text-muted-foreground">
            Manage pending and sent invitations
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Send Invitation
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invitations Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading invitations...</p>
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Invitations</h3>
              <p className="text-muted-foreground mb-4">
                {filterStatus === 'all' 
                  ? 'No invitations have been sent yet.'
                  : `No ${filterStatus} invitations found.`
                }
              </p>
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Send First Invitation
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invitation.email}</div>
                        {invitation.custom_message && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Custom message included
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1", TEAM_ROLE_COLORS[invitation.role])}>
                        {getTeamRoleDisplayName(invitation.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(invitation.status)}
                        <Badge variant="outline" className={getStatusColor(invitation.status)}>
                          {invitation.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                      </div>
                      {invitation.last_sent_at && invitation.last_sent_at !== invitation.created_at && (
                        <div className="text-xs text-muted-foreground">
                          Resent {formatDistanceToNow(new Date(invitation.last_sent_at), { addSuffix: true })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(invitation.expires_at) > new Date() ? (
                          <span className="text-green-600">
                            {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-red-600">Expired</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {invitation.invitation_attempts || 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {invitation.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedInvitation(invitation);
                                setResendForm({
                                  customMessage: invitation.custom_message || '',
                                  extendExpiration: true,
                                  newExpirationDays: 7,
                                });
                                setResendDialogOpen(true);
                              }}
                              title="Resend invitation"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyInvitationLink(invitation)}
                              title="Copy invitation link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelInvitation(invitation)}
                              title="Cancel invitation"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {invitation.status === 'expired' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedInvitation(invitation);
                              setResendForm({
                                customMessage: invitation.custom_message || '',
                                extendExpiration: true,
                                newExpirationDays: 7,
                              });
                              setResendDialogOpen(true);
                            }}
                            title="Resend invitation"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Send Invitation Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Team Invitation</DialogTitle>
            <DialogDescription>
              Invite a new member to join {currentTeam?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(value: TeamMemberRole) => 
                  setInviteForm(prev => ({ ...prev, role: value }))
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
              <Label htmlFor="message">Custom Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to the invitation..."
                value={inviteForm.customMessage}
                onChange={(e) => setInviteForm(prev => ({ ...prev, customMessage: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Expires In (Days)</Label>
              <Select
                value={inviteForm.expiresInDays.toString()}
                onValueChange={(value) => 
                  setInviteForm(prev => ({ ...prev, expiresInDays: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="3">3 Days</SelectItem>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="14">14 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="send-email"
                checked={inviteForm.sendEmail}
                onCheckedChange={(checked) => 
                  setInviteForm(prev => ({ ...prev, sendEmail: checked }))
                }
              />
              <Label htmlFor="send-email">Send email notification</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInvitation} disabled={!inviteForm.email}>
              <Send className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Invitation Dialog */}
      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resend Invitation</DialogTitle>
            <DialogDescription>
              Resend invitation to {selectedInvitation?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resend-message">Custom Message (Optional)</Label>
              <Textarea
                id="resend-message"
                placeholder="Update the invitation message..."
                value={resendForm.customMessage}
                onChange={(e) => setResendForm(prev => ({ ...prev, customMessage: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="extend-expiration"
                checked={resendForm.extendExpiration}
                onCheckedChange={(checked) => 
                  setResendForm(prev => ({ ...prev, extendExpiration: checked }))
                }
              />
              <Label htmlFor="extend-expiration">Extend expiration</Label>
            </div>

            {resendForm.extendExpiration && (
              <div className="space-y-2">
                <Label htmlFor="new-expires">New Expiration (Days)</Label>
                <Select
                  value={resendForm.newExpirationDays.toString()}
                  onValueChange={(value) => 
                    setResendForm(prev => ({ ...prev, newExpirationDays: parseInt(value) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Day</SelectItem>
                    <SelectItem value="3">3 Days</SelectItem>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResendInvitation}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resend Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
