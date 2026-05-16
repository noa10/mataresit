/**
 * Audit Trail Viewer — Coming Soon placeholder.
 *
 * The full audit log UI depends on enhancedTeamService methods that
 * still return empty results in code (getAuditLogs, searchAuditLogs)
 * pending a final pass to wire them to public.get_team_audit_logs and
 * public.search_audit_logs (both restored in PR #84). Until those
 * service methods are switched off the in-code stubs, the tab can't
 * display real data — show a Coming Soon placeholder instead of an
 * always-empty table.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export function AuditTrailViewer() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Audit Trail
        </CardTitle>
        <CardDescription>
          Comprehensive audit log of team activity, member changes, and security events.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground">
            Audit trail viewer will be available in an upcoming release.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
