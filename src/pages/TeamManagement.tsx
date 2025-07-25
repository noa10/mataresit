import React from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Sparkles,
} from 'lucide-react';

// Import enhanced components
import { EnhancedTeamManagement } from '@/components/team/enhanced/EnhancedTeamManagement';

export default function TeamManagement() {
  const { currentTeam, hasPermission } = useTeam();

  // Check if user has access to team management
  if (!currentTeam) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Team Selected</h3>
            <p className="text-muted-foreground">
              Please select a team to manage its members and settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasPermission('view_members')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              You don't have permission to view team management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {currentTeam.name}
            <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border-blue-200">
              <Sparkles className="h-3 w-3 mr-1" />
              Enhanced
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            Advanced team management with bulk operations, audit trails, and enhanced controls
          </p>
        </div>
      </div>

      {/* Enhanced Team Management */}
      <EnhancedTeamManagement />
    </div>
  );
}

