import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Share2, 
  Users, 
  User, 
  Globe, 
  Eye, 
  Edit3, 
  MessageCircle,
  Calendar,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { TeamCollaborationNotificationService } from '@/services/teamCollaborationNotificationService';

interface ReceiptShareDialogProps {
  receiptId: string;
  receiptMerchant?: string;
  receiptTotal?: number;
  receiptCurrency?: string;
  children: React.ReactNode;
}

interface SharePermissions {
  view: boolean;
  edit: boolean;
  comment: boolean;
}

interface ExistingShare {
  id: string;
  share_type: 'team' | 'user' | 'public';
  shared_with_team_id?: string;
  shared_with_user_id?: string;
  permissions: SharePermissions;
  message?: string;
  expires_at?: string;
  created_at: string;
  team_name?: string;
  user_email?: string;
}

export function ReceiptShareDialog({ 
  receiptId, 
  receiptMerchant, 
  receiptTotal, 
  receiptCurrency, 
  children 
}: ReceiptShareDialogProps) {
  const { user } = useAuth();
  const { currentTeam, teams } = useTeam();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingShares, setExistingShares] = useState<ExistingShare[]>([]);
  
  // Form state
  const [shareType, setShareType] = useState<'team' | 'user' | 'public'>('team');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [userEmail, setUserEmail] = useState('');
  const [message, setMessage] = useState('');
  const [permissions, setPermissions] = useState<SharePermissions>({
    view: true,
    edit: false,
    comment: true,
  });
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadExistingShares();
      if (currentTeam) {
        setSelectedTeamId(currentTeam.id);
      }
    }
  }, [isOpen, currentTeam]);

  const loadExistingShares = async () => {
    try {
      const { data, error } = await supabase
        .from('receipt_shares')
        .select(`
          *,
          team:teams(name),
          user:auth.users(email)
        `)
        .eq('receipt_id', receiptId);

      if (error) {
        console.error('Error loading existing shares:', error);
        return;
      }

      const shares: ExistingShare[] = (data || []).map(share => ({
        id: share.id,
        share_type: share.share_type,
        shared_with_team_id: share.shared_with_team_id,
        shared_with_user_id: share.shared_with_user_id,
        permissions: share.permissions,
        message: share.message,
        expires_at: share.expires_at,
        created_at: share.created_at,
        team_name: share.team?.name,
        user_email: share.user?.email,
      }));

      setExistingShares(shares);
    } catch (error) {
      console.error('Error loading existing shares:', error);
    }
  };

  const handleShare = async () => {
    if (!user) return;

    // Validation
    if (shareType === 'team' && !selectedTeamId) {
      toast.error('Please select a team to share with');
      return;
    }
    if (shareType === 'user' && !userEmail.trim()) {
      toast.error('Please enter a user email');
      return;
    }

    setIsLoading(true);
    try {
      const shareData = {
        receipt_id: receiptId,
        shared_by_user_id: user.id,
        share_type: shareType,
        permissions,
        message: message.trim() || null,
        expires_at: expiresAt || null,
        ...(shareType === 'team' && { shared_with_team_id: selectedTeamId }),
        ...(shareType === 'user' && { shared_with_user_id: null }), // We'll need to resolve email to user_id
      };

      const { error } = await supabase
        .from('receipt_shares')
        .insert(shareData);

      if (error) {
        console.error('Error sharing receipt:', error);
        toast.error('Failed to share receipt');
        return;
      }

      // Send notification
      if (shareType === 'team' && selectedTeamId) {
        const teamName = teams.find(t => t.id === selectedTeamId)?.name || 'Unknown Team';
        const userName = user.user_metadata?.full_name || user.email || 'Unknown User';
        
        await TeamCollaborationNotificationService.handleReceiptShared(
          receiptId,
          selectedTeamId,
          user.id,
          userName
        );
      }

      toast.success('Receipt shared successfully');
      setIsOpen(false);
      resetForm();
      loadExistingShares();
    } catch (error) {
      console.error('Error sharing receipt:', error);
      toast.error('Failed to share receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('receipt_shares')
        .delete()
        .eq('id', shareId);

      if (error) {
        console.error('Error removing share:', error);
        toast.error('Failed to remove share');
        return;
      }

      toast.success('Share removed successfully');
      loadExistingShares();
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error('Failed to remove share');
    }
  };

  const resetForm = () => {
    setShareType('team');
    setSelectedTeamId(currentTeam?.id || '');
    setUserEmail('');
    setMessage('');
    setPermissions({ view: true, edit: false, comment: true });
    setExpiresAt('');
  };

  const getShareDisplayName = (share: ExistingShare): string => {
    switch (share.share_type) {
      case 'team':
        return share.team_name || 'Unknown Team';
      case 'user':
        return share.user_email || 'Unknown User';
      case 'public':
        return 'Public Link';
      default:
        return 'Unknown';
    }
  };

  const getShareIcon = (shareType: string) => {
    switch (shareType) {
      case 'team':
        return <Users className="h-4 w-4" />;
      case 'user':
        return <User className="h-4 w-4" />;
      case 'public':
        return <Globe className="h-4 w-4" />;
      default:
        return <Share2 className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Receipt
          </DialogTitle>
          <DialogDescription>
            Share this receipt with team members or other users
            {receiptMerchant && ` from ${receiptMerchant}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Shares */}
          {existingShares.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Currently Shared With</h4>
              <div className="space-y-2">
                {existingShares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getShareIcon(share.share_type)}
                      <div>
                        <p className="text-sm font-medium">{getShareDisplayName(share)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {share.permissions.view && <Badge variant="outline" className="text-xs"><Eye className="h-3 w-3 mr-1" />View</Badge>}
                          {share.permissions.edit && <Badge variant="outline" className="text-xs"><Edit3 className="h-3 w-3 mr-1" />Edit</Badge>}
                          {share.permissions.comment && <Badge variant="outline" className="text-xs"><MessageCircle className="h-3 w-3 mr-1" />Comment</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveShare(share.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          )}

          {/* Share Form */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Share with New Recipients</h4>
            
            {/* Share Type */}
            <div className="space-y-2">
              <Label>Share Type</Label>
              <Select value={shareType} onValueChange={(value: 'team' | 'user' | 'public') => setShareType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Specific User
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Public Link
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Team Selection */}
            {shareType === 'team' && (
              <div className="space-y-2">
                <Label>Select Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* User Email */}
            {shareType === 'user' && (
              <div className="space-y-2">
                <Label>User Email</Label>
                <Input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter user email address"
                />
              </div>
            )}

            {/* Permissions */}
            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span className="text-sm font-medium">View</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Can view the receipt</p>
                  </div>
                  <Switch
                    checked={permissions.view}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, view: checked }))}
                    disabled // View permission is always required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4" />
                      <span className="text-sm font-medium">Edit</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Can modify receipt details</p>
                  </div>
                  <Switch
                    checked={permissions.edit}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, edit: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Comment</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Can add comments to the receipt</p>
                  </div>
                  <Switch
                    checked={permissions.comment}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, comment: checked }))}
                  />
                </div>
              </div>
            </div>

            {/* Optional Message */}
            <div className="space-y-2">
              <Label>Message (Optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message to include with the share..."
                className="min-h-[80px]"
              />
            </div>

            {/* Expiration Date */}
            <div className="space-y-2">
              <Label>Expiration Date (Optional)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for permanent access
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={isLoading}>
              {isLoading ? 'Sharing...' : 'Share Receipt'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
