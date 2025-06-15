// Claim Management Types

export type ClaimStatus = 
  | 'draft'
  | 'submitted' 
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type ClaimPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Claim {
  id: string;
  team_id: string;
  claimant_id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category?: string;
  priority: ClaimPriority;
  status: ClaimStatus;
  
  // Approval workflow fields
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  
  // Metadata
  metadata: Record<string, any>;
  attachments: string[]; // Array of file URLs/references
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined data
  claimant_name?: string;
  claimant_email?: string;
  reviewer_name?: string;
  approver_name?: string;
}

export interface ClaimAuditTrail {
  id: string;
  claim_id: string;
  user_id: string;
  action: string;
  old_status?: ClaimStatus;
  new_status?: ClaimStatus;
  comment?: string;
  metadata: Record<string, any>;
  created_at: string;
  
  // Joined data
  user_name?: string;
  user_email?: string;
}

export interface CreateClaimRequest {
  team_id: string;
  title: string;
  description?: string;
  amount: number;
  currency?: string;
  category?: string;
  priority?: ClaimPriority;
  attachments?: string[];
}

export interface UpdateClaimRequest {
  title?: string;
  description?: string;
  amount?: number;
  currency?: string;
  category?: string;
  priority?: ClaimPriority;
  attachments?: string[];
}

export interface ClaimApprovalRequest {
  claim_id: string;
  comment?: string;
}

export interface ClaimRejectionRequest {
  claim_id: string;
  rejection_reason: string;
}

export interface ClaimFilters {
  status?: ClaimStatus;
  priority?: ClaimPriority;
  claimant_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  category?: string;
}

export interface ClaimStats {
  total_claims: number;
  pending_claims: number;
  approved_claims: number;
  rejected_claims: number;
  total_amount: number;
  approved_amount: number;
  average_processing_time?: number; // in hours
}

// Permission helpers
export const CLAIM_PERMISSIONS = {
  CREATE: 'create_claims',
  VIEW: 'view_claims',
  REVIEW: 'review_claims',
  APPROVE: 'approve_claims',
  DELETE: 'delete_claims',
} as const;

export const CLAIM_STATUS_COLORS: Record<ClaimStatus, string> = {
  draft: 'text-gray-600 bg-gray-100',
  submitted: 'text-blue-600 bg-blue-100',
  under_review: 'text-yellow-600 bg-yellow-100',
  approved: 'text-green-600 bg-green-100',
  rejected: 'text-red-600 bg-red-100',
  cancelled: 'text-gray-600 bg-gray-100',
};

export const CLAIM_PRIORITY_COLORS: Record<ClaimPriority, string> = {
  low: 'text-gray-600 bg-gray-100',
  medium: 'text-blue-600 bg-blue-100',
  high: 'text-orange-600 bg-orange-100',
  urgent: 'text-red-600 bg-red-100',
};

export function getClaimStatusDisplayName(status: ClaimStatus): string {
  const statusNames: Record<ClaimStatus, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };
  return statusNames[status];
}

export function getClaimPriorityDisplayName(priority: ClaimPriority): string {
  const priorityNames: Record<ClaimPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  };
  return priorityNames[priority];
}

export function canTransitionClaimStatus(
  currentStatus: ClaimStatus,
  newStatus: ClaimStatus,
  userRole: string
): boolean {
  // Define valid status transitions
  const validTransitions: Record<ClaimStatus, ClaimStatus[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['under_review', 'approved', 'rejected', 'cancelled'],
    under_review: ['approved', 'rejected', 'submitted'],
    approved: [], // Final state
    rejected: ['submitted'], // Can be resubmitted
    cancelled: [], // Final state
  };

  // Check if transition is valid
  if (!validTransitions[currentStatus].includes(newStatus)) {
    return false;
  }

  // Check role permissions for specific transitions
  if (newStatus === 'approved' || newStatus === 'rejected') {
    return ['owner', 'admin'].includes(userRole);
  }

  if (newStatus === 'under_review') {
    return ['owner', 'admin'].includes(userRole);
  }

  return true;
}
