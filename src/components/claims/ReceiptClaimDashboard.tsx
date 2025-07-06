import React from 'react';
import { motion } from 'framer-motion';
import { 
  Receipt, 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { fetchReceipts } from '@/services/receiptService';
import { claimService } from '@/services/claimService';
import { useReceiptClaimIntegration } from '@/hooks/useReceiptClaimIntegration';
import { formatCurrencySafe } from '@/utils/currency';
import { useTeam } from '@/contexts/TeamContext';

interface ReceiptClaimDashboardProps {
  onCreateClaim?: () => void;
  onViewReceipts?: () => void;
  onViewClaims?: () => void;
}

export function ReceiptClaimDashboard({
  onCreateClaim,
  onViewReceipts,
  onViewClaims,
}: ReceiptClaimDashboardProps) {
  const { currentTeam } = useTeam();
  const { useReceiptUsage, getReceiptUsageSummary } = useReceiptClaimIntegration();

  // Fetch receipts
  const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['receipts', currentTeam?.id],
    queryFn: () => fetchReceipts({ currentTeam }),
  });

  // Fetch claims
  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['team-claims', currentTeam?.id],
    queryFn: () => currentTeam ? claimService.getTeamClaims(currentTeam.id) : Promise.resolve([]),
    enabled: !!currentTeam,
  });

  // Get receipt usage
  const { data: receiptUsage = [], isLoading: usageLoading } = useReceiptUsage(
    receipts.map(r => r.id)
  );

  const isLoading = receiptsLoading || claimsLoading || usageLoading;

  // Calculate statistics
  const stats = React.useMemo(() => {
    const usageSummary = getReceiptUsageSummary(receiptUsage);
    
    const totalReceiptValue = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
    const usedReceiptValue = receipts
      .filter(receipt => receiptUsage.find(u => u.receiptId === receipt.id)?.isUsedInClaim)
      .reduce((sum, receipt) => sum + receipt.total, 0);
    
    const pendingClaims = claims.filter(claim => 
      ['draft', 'submitted', 'under_review'].includes(claim.status)
    ).length;
    
    const approvedClaims = claims.filter(claim => claim.status === 'approved').length;
    
    return {
      ...usageSummary,
      totalReceiptValue,
      usedReceiptValue,
      availableReceiptValue: totalReceiptValue - usedReceiptValue,
      pendingClaims,
      approvedClaims,
      totalClaims: claims.length,
    };
  }, [receipts, receiptUsage, claims, getReceiptUsageSummary]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrencySafe(stats.totalReceiptValue, 'MYR')} total value
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Used in Claims</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.used}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrencySafe(stats.usedReceiptValue, 'MYR')} claimed
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.available}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrencySafe(stats.availableReceiptValue, 'MYR')} available
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Claims</CardTitle>
              <FileText className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingClaims}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalClaims} total claims
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Usage Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Receipt Usage Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Receipts Used in Claims</span>
                <span>{stats.usagePercentage}%</span>
              </div>
              <Progress value={stats.usagePercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-green-600">{stats.used}</div>
                <div className="text-xs text-muted-foreground">Used</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-600">{stats.available}</div>
                <div className="text-xs text-muted-foreground">Available</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onCreateClaim} className="gap-2">
                <FileText className="h-4 w-4" />
                Create New Claim
              </Button>
              <Button variant="outline" onClick={onViewReceipts} className="gap-2">
                <Receipt className="h-4 w-4" />
                View Receipts ({stats.available} available)
              </Button>
              <Button variant="outline" onClick={onViewClaims} className="gap-2">
                <Clock className="h-4 w-4" />
                View Claims ({stats.pendingClaims} pending)
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Activity */}
      {stats.pendingClaims > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">
                      {stats.pendingClaims} claims awaiting action
                    </span>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    Pending
                  </Badge>
                </div>
                
                {stats.available > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">
                        {stats.available} receipts ready for claims
                      </span>
                    </div>
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      Available
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
