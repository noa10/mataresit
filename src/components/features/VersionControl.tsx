import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { GitBranch, Clock, User, FileText, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface VersionControlProps {
  className?: string;
}

export const VersionControl: React.FC<VersionControlProps> = ({ className }) => {
  const { isFeatureAvailable, getCurrentTier } = useSubscription();
  const hasVersionControl = isFeatureAvailable('version_control');
  const tier = getCurrentTier();

  if (!hasVersionControl) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Version Control</CardTitle>
            </div>
            <Badge variant="outline">Pro Feature</Badge>
          </div>
          <CardDescription>
            Track changes to your receipt data and revert to previous versions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Version control is available with Pro and Max plans
            </p>
            <Button asChild>
              <Link to="/pricing">Upgrade to Pro</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Placeholder for when feature is available
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-green-500" />
            <CardTitle>Version Control</CardTitle>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-200">
            Available
          </Badge>
        </div>
        <CardDescription>
          Track changes to your receipt data and revert to previous versions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Recent Changes */}
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Changes</h4>
            <div className="space-y-2">
              {[
                { id: 1, action: 'Receipt updated', file: 'grocery-receipt-001.pdf', time: '2 hours ago', user: 'You' },
                { id: 2, action: 'Receipt added', file: 'restaurant-bill-045.jpg', time: '1 day ago', user: 'You' },
                { id: 3, action: 'Receipt deleted', file: 'gas-station-receipt.pdf', time: '3 days ago', user: 'You' },
              ].map((change) => (
                <div key={change.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{change.action}</p>
                      <p className="text-xs text-muted-foreground">{change.file}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {change.user}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {change.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              View History
            </Button>
            <Button variant="outline" size="sm" disabled>
              Create Backup
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Version control features coming soon!</p>
            <p>This is a preview of what will be available.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
