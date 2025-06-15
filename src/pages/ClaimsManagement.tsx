import React, { useState } from 'react';
import { ClaimsList } from '@/components/claims/ClaimsList';
import { CreateClaimDialog } from '@/components/claims/CreateClaimDialog';
import { ClaimDetailsDialog } from '@/components/claims/ClaimDetailsDialog';
import { ClaimApprovalDialog } from '@/components/claims/ClaimApprovalDialog';
import { ClaimRejectionDialog } from '@/components/claims/ClaimRejectionDialog';
import { EditClaimDialog } from '@/components/claims/EditClaimDialog';
import { ClaimSubmissionDialog } from '@/components/claims/ClaimSubmissionDialog';
import { useTeam } from '@/contexts/TeamContext';
import { Card, CardContent } from '@/components/ui/card';
import { Claim } from '@/types/claims';

export default function ClaimsManagement() {
  const { currentTeam } = useTeam();
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateClaim = () => {
    setCreateDialogOpen(true);
  };

  const handleCreateSuccess = () => {
    setRefreshKey(prev => prev + 1); // Trigger refresh of claims list
  };

  const handleViewClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(true);
  };

  const handleEditClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleSubmitClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(false);
    setSubmissionDialogOpen(true);
  };

  const handleApproveClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(false);
    setApprovalDialogOpen(true);
  };

  const handleRejectClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(false);
    setRejectionDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    setRefreshKey(prev => prev + 1); // Trigger refresh of claims list
    setSelectedClaim(null);
  };

  if (!currentTeam) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">No Team Selected</h2>
              <p className="text-muted-foreground">
                Please select a team to manage claims. You can select a team from the sidebar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <ClaimsList
        key={refreshKey}
        onCreateClaim={handleCreateClaim}
        onViewClaim={handleViewClaim}
        onApproveClaim={handleApproveClaim}
        onRejectClaim={handleRejectClaim}
      />

      <CreateClaimDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      <ClaimDetailsDialog
        claim={selectedClaim}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onEdit={handleEditClaim}
        onSubmit={handleSubmitClaim}
        onApprove={handleApproveClaim}
        onReject={handleRejectClaim}
        onRefresh={handleDialogSuccess}
      />

      <EditClaimDialog
        claim={selectedClaim}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimSubmissionDialog
        claim={selectedClaim}
        open={submissionDialogOpen}
        onOpenChange={setSubmissionDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimApprovalDialog
        claim={selectedClaim}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimRejectionDialog
        claim={selectedClaim}
        open={rejectionDialogOpen}
        onOpenChange={setRejectionDialogOpen}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
