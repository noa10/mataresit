import React, { useState, useEffect } from 'react';
import { Plus, Eye, Check, X, Clock, DollarSign, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTeam } from '@/contexts/TeamContext';
import { claimService } from '@/services/claimService';
import {
  Claim,
  ClaimStatus,
  ClaimPriority,
  CLAIM_STATUS_COLORS,
  CLAIM_PRIORITY_COLORS,
  getClaimStatusDisplayName,
  getClaimPriorityDisplayName,
} from '@/types/claims';
import { cn } from '@/lib/utils';

interface ClaimsListProps {
  onCreateClaim?: () => void;
  onViewClaim?: (claim: Claim) => void;
  onApproveClaim?: (claim: Claim) => void;
  onRejectClaim?: (claim: Claim) => void;
}

export function ClaimsList({ onCreateClaim, onViewClaim, onApproveClaim, onRejectClaim }: ClaimsListProps) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ClaimPriority | 'all'>('all');
  const { currentTeam, hasPermission } = useTeam();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load claims
  const loadClaims = async () => {
    if (!currentTeam) return;

    try {
      setLoading(true);
      const filters = {
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
      };
      
      const data = await claimService.getTeamClaims(currentTeam.id, filters);
      setClaims(data);
    } catch (error) {
      console.error('Error loading claims:', error);
      toast({
        title: 'Error',
        description: 'Failed to load claims',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle approve claim - delegate to parent
  const handleApproveClaim = (claim: Claim) => {
    onApproveClaim?.(claim);
  };

  // Handle reject claim - delegate to parent
  const handleRejectClaim = (claim: Claim) => {
    onRejectClaim?.(claim);
  };

  // Navigate to claim details page
  const handleViewClaimDetails = (claim: Claim) => {
    navigate(`/claims/${claim.id}`);
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Load claims when team or filters change
  useEffect(() => {
    loadClaims();
  }, [currentTeam, statusFilter, priorityFilter]);

  if (!currentTeam) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Please select a team to view claims
          </p>
        </CardContent>
      </Card>
    );
  }

  const canCreateClaims = hasPermission('create_claims');
  const canApproveClaims = hasPermission('approve_claims');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Claims</h2>
          <p className="text-muted-foreground">
            Manage expense claims for {currentTeam.name}
          </p>
        </div>
        
        {canCreateClaims && (
          <Button onClick={onCreateClaim}>
            <Plus className="h-4 w-4 mr-2" />
            New Claim
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ClaimStatus | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as ClaimPriority | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle>Claims List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading claims...</p>
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No claims found</p>
              {canCreateClaims && (
                <Button variant="outline" onClick={onCreateClaim} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first claim
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Claimant</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{claim.title}</p>
                        {claim.category && (
                          <p className="text-sm text-muted-foreground">{claim.category}</p>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        {formatCurrency(claim.amount, claim.currency)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <p className="text-sm">{claim.claimant_name}</p>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline" className={cn(CLAIM_PRIORITY_COLORS[claim.priority])}>
                        {getClaimPriorityDisplayName(claim.priority)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline" className={cn(CLAIM_STATUS_COLORS[claim.status])}>
                        {getClaimStatusDisplayName(claim.status)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      {claim.submitted_at ? formatDate(claim.submitted_at) : '-'}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewClaim?.(claim)}
                          title="View in modal"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewClaimDetails(claim)}
                          title="View details page"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>

                        {canApproveClaims && ['submitted', 'under_review'].includes(claim.status) && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApproveClaim(claim)}
                              className="text-green-600 hover:text-green-700"
                              title="Approve claim"
                            >
                              <Check className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejectClaim(claim)}
                              className="text-red-600 hover:text-red-700"
                              title="Reject claim"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
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
    </div>
  );
}
