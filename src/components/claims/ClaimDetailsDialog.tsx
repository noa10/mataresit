import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useTeam } from '@/contexts/TeamContext';
import { claimService } from '@/services/claimService';
import {
  Claim,
  ClaimAuditTrail,
  CLAIM_STATUS_COLORS,
  CLAIM_PRIORITY_COLORS,
  getClaimStatusDisplayName,
  getClaimPriorityDisplayName,
} from '@/types/claims';
import { cn } from '@/lib/utils';
import { Receipt } from '@/types/receipt';
import { fetchReceipts } from '@/services/receiptService';
import { ReceiptPreview } from './ReceiptPreview';
import {
  Calendar,
  DollarSign,
  User,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Send,
  Eye,
  Receipt as ReceiptIcon,
} from 'lucide-react';

interface ClaimDetailsDialogProps {
  claim: Claim | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (claim: Claim) => void;
  onSubmit?: (claim: Claim) => void;
  onApprove?: (claim: Claim) => void;
  onReject?: (claim: Claim) => void;
  onRefresh?: () => void;
}

export function ClaimDetailsDialog({
  claim,
  open,
  onOpenChange,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onRefresh,
}: ClaimDetailsDialogProps) {
  const [auditTrail, setAuditTrail] = useState<ClaimAuditTrail[]>([]);
  const [attachedReceipts, setAttachedReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const { hasPermission } = useTeam();
  const { toast } = useToast();

  // Load audit trail and receipts when claim changes
  useEffect(() => {
    if (claim && open) {
      loadAuditTrail();
      loadAttachedReceipts();
    }
  }, [claim, open]);

  const loadAuditTrail = async () => {
    if (!claim) return;

    try {
      setLoading(true);
      const trail = await claimService.getClaimAuditTrail(claim.id);
      setAuditTrail(trail);
    } catch (error) {
      console.error('Error loading audit trail:', error);
      setAuditTrail([]); // Set empty array to prevent showing loading state
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load claim history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAttachedReceipts = async () => {
    if (!claim || !claim.attachments || claim.attachments.length === 0) {
      setAttachedReceipts([]);
      return;
    }

    try {
      setReceiptsLoading(true);

      // Parse attachments to find receipt IDs
      const receiptIds: string[] = [];

      for (const attachment of claim.attachments) {
        try {
          const parsed = JSON.parse(attachment);
          if (parsed.type === 'receipt' && parsed.receiptId) {
            receiptIds.push(parsed.receiptId);
          }
        } catch (e) {
          // Handle legacy string attachments or other formats
          console.log('Could not parse attachment:', attachment);
        }
      }

      if (receiptIds.length > 0) {
        // Fetch all receipts and filter by IDs
        const allReceipts = await fetchReceipts();
        const filteredReceipts = allReceipts.filter(receipt =>
          receiptIds.includes(receipt.id)
        );
        setAttachedReceipts(filteredReceipts);
      } else {
        setAttachedReceipts([]);
      }
    } catch (error) {
      console.error('Error loading attached receipts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load attached receipts',
        variant: 'destructive',
      });
      setAttachedReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!claim) return null;

  const canEdit = hasPermission('edit_claims') && claim.status === 'draft';
  const canSubmit = hasPermission('submit_claims') && claim.status === 'draft';
  const canApprove = hasPermission('approve_claims') && ['submitted', 'under_review'].includes(claim.status);
  const canReject = hasPermission('approve_claims') && ['submitted', 'under_review'].includes(claim.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {claim.title}
          </DialogTitle>
          <DialogDescription>
            Claim details and workflow information
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
          {/* Status and Priority */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className={cn(CLAIM_STATUS_COLORS[claim.status])}>
              {getClaimStatusDisplayName(claim.status)}
            </Badge>
            <Badge variant="outline" className={cn(CLAIM_PRIORITY_COLORS[claim.priority])}>
              {getClaimPriorityDisplayName(claim.priority)}
            </Badge>
          </div>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Claim Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Amount:</span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(claim.amount, claim.currency)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Claimant:</span>
                  <span>{claim.claimant_name || 'Unknown'}</span>
                </div>
              </div>

              {claim.category && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Category:</span>
                  <span>{claim.category}</span>
                </div>
              )}

              {claim.description && (
                <div>
                  <span className="font-medium">Description:</span>
                  <p className="mt-1 text-sm text-muted-foreground">{claim.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Created: {formatDate(claim.created_at)}</span>
                </div>
                
                {claim.submitted_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Submitted: {formatDate(claim.submitted_at)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Workflow Information */}
          {(claim.reviewed_by || claim.approved_by || claim.rejection_reason) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Workflow Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {claim.reviewed_by && (
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <span>Reviewed by: {claim.reviewer_name || 'Unknown'}</span>
                    {claim.reviewed_at && (
                      <span className="text-sm text-muted-foreground">
                        on {formatDate(claim.reviewed_at)}
                      </span>
                    )}
                  </div>
                )}

                {claim.approved_by && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Approved by: {claim.approver_name || 'Unknown'}</span>
                    {claim.approved_at && (
                      <span className="text-sm text-muted-foreground">
                        on {formatDate(claim.approved_at)}
                      </span>
                    )}
                  </div>
                )}

                {claim.rejection_reason && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">Rejection Reason:</span>
                    </div>
                    <p className="text-sm bg-red-50 p-3 rounded-md border border-red-200">
                      {claim.rejection_reason}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {(claim.attachments && claim.attachments.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ReceiptIcon className="h-5 w-5" />
                  Attachments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {receiptsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm text-muted-foreground">Loading receipts...</span>
                  </div>
                ) : attachedReceipts.length > 0 ? (
                  <ReceiptPreview
                    receipts={attachedReceipts}
                    showRemoveButton={false}
                    className="mt-2"
                  />
                ) : (
                  <div className="space-y-2">
                    {claim.attachments.map((attachment, index) => {
                      try {
                        const parsed = JSON.parse(attachment);
                        if (parsed.type === 'receipt') {
                          return (
                            <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
                              <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium text-sm">
                                  Receipt from {parsed.metadata?.merchant || 'Unknown Merchant'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {parsed.metadata?.date && new Date(parsed.metadata.date).toLocaleDateString()} •
                                  {parsed.metadata?.total && parsed.metadata?.currency &&
                                    ` ${formatCurrency(parsed.metadata.total, parsed.metadata.currency)}`
                                  }
                                </div>
                              </div>
                            </div>
                          );
                        }
                      } catch (e) {
                        // Handle legacy string attachments
                        return (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">{attachment}</span>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading activity history...</span>
                </div>
              ) : auditTrail.length > 0 ? (
                <div className="space-y-3">
                  {auditTrail.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.user_name || 'Unknown'}</span>
                          <span className="text-sm text-muted-foreground">{entry.action}</span>
                          {entry.old_status && entry.new_status && (
                            <span className="text-sm">
                              from <Badge variant="outline" className="text-xs">{entry.old_status}</Badge>
                              {' '}to <Badge variant="outline" className="text-xs">{entry.new_status}</Badge>
                            </span>
                          )}
                        </div>
                        {entry.comment && (
                          <p className="text-sm text-muted-foreground mt-1">{entry.comment}</p>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No activity history available</p>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex items-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          
          {canEdit && (
            <Button variant="outline" onClick={() => onEdit?.(claim)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          
          {canSubmit && (
            <Button onClick={() => onSubmit?.(claim)}>
              <Send className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          )}
          
          {canReject && (
            <Button variant="destructive" onClick={() => onReject?.(claim)}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          )}
          
          {canApprove && (
            <Button onClick={() => onApprove?.(claim)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
