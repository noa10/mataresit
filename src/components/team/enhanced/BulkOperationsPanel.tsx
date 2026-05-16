/**
 * Bulk Operations Panel — Coming Soon placeholder.
 *
 * The full bulk-ops UI depends on a set of database functions
 * (bulk_invite_team_members, bulk_remove_team_members,
 * bulk_update_member_roles, get_bulk_operations, etc.) that aren't
 * yet present in prod. The original component still lives in git
 * history; restore it once the P3 schema-drift repair migration lands.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { TeamMember } from '@/types/team';

interface BulkOperationsPanelProps {
  selectedMembers: TeamMember[];
  onSelectionChange: (members: TeamMember[]) => void;
  onOperationComplete: () => void;
}

export function BulkOperationsPanel(_props: BulkOperationsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Bulk Operations
        </CardTitle>
        <CardDescription>
          Invite, remove, and update multiple members at once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground">
            Bulk member operations will be available in an upcoming release.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
