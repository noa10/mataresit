import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
import { ReceiptPreview } from '@/components/claims/ReceiptPreview';
import { ClaimApprovalDialog } from '@/components/claims/ClaimApprovalDialog';
import { ClaimRejectionDialog } from '@/components/claims/ClaimRejectionDialog';
import { EditClaimDialog } from '@/components/claims/EditClaimDialog';
import { ClaimSubmissionDialog } from '@/components/claims/ClaimSubmissionDialog';
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
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

export default function ClaimDetailsPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { currentTeam, hasPermission } = useTeam();
  const { toast } = useToast();

  const [claim, setClaim] = useState<Claim | null>(null);
  const [auditTrail, setAuditTrail] = useState<ClaimAuditTrail[]>([]);
  const [attachedReceipts, setAttachedReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);

  // Load claim data
  useEffect(() => {
    if (claimId) {
      loadClaim();
    }
  }, [claimId]);

  const loadClaim = async () => {
    if (!claimId) return;

    try {
      setLoading(true);
      setError(null);

      const claimData = await claimService.getClaim(claimId);
      
      if (!claimData) {
        setError('Claim not found');
        return;
      }

      // Check if user has permission to view this claim
      const canView = await claimService.canUserPerformAction(claimId, 'view');
      if (!canView) {
        setError('You do not have permission to view this claim');
        return;
      }

      // Check if claim belongs to current team (if team is selected)
      if (currentTeam && claimData.team_id !== currentTeam.id) {
        setError('This claim belongs to a different team');
        return;
      }

      setClaim(claimData);
      await loadAuditTrail();
      await loadAttachedReceipts();
    } catch (error: any) {
      console.error('Error loading claim:', error);
      setError(error.message || 'Failed to load claim');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditTrail = async () => {
    if (!claimId) return;

    try {
      const trail = await claimService.getClaimAuditTrail(claimId);
      setAuditTrail(trail);
    } catch (error) {
      console.error('Error loading audit trail:', error);
    }
  };

  const loadAttachedReceipts = async () => {
    if (!claim?.attachments || claim.attachments.length === 0) {
      setAttachedReceipts([]);
      return;
    }

    try {
      setReceiptsLoading(true);
      const receiptIds: string[] = [];
      
      claim.attachments.forEach(attachment => {
        try {
          const parsed = typeof attachment === 'string' ? JSON.parse(attachment) : attachment;
          if (parsed.type === 'receipt' && parsed.receiptId) {
            receiptIds.push(parsed.receiptId);
          }
        } catch (e) {
          console.warn('Failed to parse attachment:', attachment);
        }
      });

      if (receiptIds.length > 0) {
        const receipts = await fetchReceipts();
        const filteredReceipts = receipts.filter(receipt => 
          receiptIds.includes(receipt.id)
        );
        setAttachedReceipts(filteredReceipts);
      }
    } catch (error) {
      console.error('Error loading attached receipts:', error);
    } finally {
      setReceiptsLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDialogSuccess = () => {
    loadClaim(); // Reload claim data after any changes
  };

  const handleBack = () => {
    navigate('/claims');
  };

  // Permission checks
  const canEdit = claim && hasPermission('edit_claims') && claim.status === 'draft';
  const canSubmit = claim && claim.status === 'draft';
  const canApprove = claim && hasPermission('approve_claims') && 
    ['submitted', 'under_review'].includes(claim.status);
  const canReject = claim && hasPermission('approve_claims') && 
    ['submitted', 'under_review'].includes(claim.status);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading claim details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error Loading Claim</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Claims
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Claim Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The requested claim could not be found or you don't have permission to view it.
              </p>
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Claims
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Claims
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{claim.title}</h1>
            <p className="text-muted-foreground">Claim Details</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs", CLAIM_STATUS_COLORS[claim.status])}>
            {getClaimStatusDisplayName(claim.status)}
          </Badge>
          <Badge className={cn("text-xs", CLAIM_PRIORITY_COLORS[claim.priority])}>
            {getClaimPriorityDisplayName(claim.priority)}
          </Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mb-6">
        {canEdit && (
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
        
        {canSubmit && (
          <Button onClick={() => setSubmissionDialogOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Submit for Review
          </Button>
        )}
        
        {canReject && (
          <Button variant="destructive" onClick={() => setRejectionDialogOpen(true)}>
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
        )}
        
        {canApprove && (
          <Button onClick={() => setApprovalDialogOpen(true)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Claim Details */}
        <div className="lg:col-span-2 space-y-6">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Created:</span>
                  <span>{formatDate(claim.created_at)}</span>
                </div>

                {claim.category && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Category:</span>
                    <span>{claim.category}</span>
                  </div>
                )}
              </div>

              {claim.description && (
                <div>
                  <span className="font-medium">Description:</span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {claim.description}
                  </p>
                </div>
              )}

              {/* Workflow Information */}
              {(claim.submitted_at || claim.reviewed_at || claim.approved_at) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium">Workflow Timeline</h4>

                    {claim.submitted_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>Submitted: {formatDate(claim.submitted_at)}</span>
                      </div>
                    )}

                    {claim.reviewed_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        <span>
                          Reviewed: {formatDate(claim.reviewed_at)}
                          {claim.reviewer_name && ` by ${claim.reviewer_name}`}
                        </span>
                      </div>
                    )}

                    {claim.approved_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span>
                          Approved: {formatDate(claim.approved_at)}
                          {claim.approver_name && ` by ${claim.approver_name}`}
                        </span>
                      </div>
                    )}

                    {claim.rejection_reason && (
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-3 w-3 text-red-600 mt-0.5" />
                        <div>
                          <span>Rejected: {claim.rejection_reason}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attached Receipts */}
          {attachedReceipts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptIcon className="h-5 w-5" />
                  Attached Receipts ({attachedReceipts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {receiptsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading receipts...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attachedReceipts.map((receipt) => (
                      <ReceiptPreview key={receipt.id} receipt={receipt} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Audit Trail */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              {auditTrail.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity recorded yet
                </p>
              ) : (
                <div className="space-y-4">
                  {auditTrail.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-muted pl-4 pb-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm capitalize">
                          {entry.action}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>

                      {entry.user_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          by {entry.user_name}
                        </p>
                      )}

                      {entry.old_status && entry.new_status && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Status changed from {getClaimStatusDisplayName(entry.old_status)} to{' '}
                          {getClaimStatusDisplayName(entry.new_status)}
                        </p>
                      )}

                      {entry.comment && (
                        <p className="text-sm mt-2 p-2 bg-muted rounded text-muted-foreground">
                          {entry.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <EditClaimDialog
        claim={claim}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimSubmissionDialog
        claim={claim}
        open={submissionDialogOpen}
        onOpenChange={setSubmissionDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimApprovalDialog
        claim={claim}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimRejectionDialog
        claim={claim}
        open={rejectionDialogOpen}
        onOpenChange={setRejectionDialogOpen}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
