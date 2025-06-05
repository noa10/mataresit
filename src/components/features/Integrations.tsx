import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { Puzzle, Plus, Settings, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface IntegrationsProps {
  className?: string;
}

export const Integrations: React.FC<IntegrationsProps> = ({ className }) => {
  const { isFeatureAvailable, getFeatureLimit, getCurrentTier } = useSubscription();
  const hasIntegrations = isFeatureAvailable('integrations');
  const integrationsLevel = getFeatureLimit('integrations_level') as string;
  const tier = getCurrentTier();

  if (!hasIntegrations) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Integrations</CardTitle>
            </div>
            <Badge variant="outline">Pro Feature</Badge>
          </div>
          <CardDescription>
            Connect with your favorite tools and services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Puzzle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Integrations are available with Pro and Max plans
            </p>
            <Button asChild>
              <Link to="/pricing">Upgrade to Pro</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableIntegrations = [
    {
      name: 'QuickBooks',
      description: 'Sync receipts with your accounting software',
      status: 'available',
      level: 'basic',
      icon: '📊'
    },
    {
      name: 'Xero',
      description: 'Export receipts to Xero for bookkeeping',
      status: 'available',
      level: 'basic',
      icon: '📈'
    },
    {
      name: 'Google Drive',
      description: 'Backup receipts to Google Drive',
      status: 'connected',
      level: 'basic',
      icon: '💾'
    },
    {
      name: 'Slack',
      description: 'Get notifications in your Slack workspace',
      status: 'available',
      level: 'advanced',
      icon: '💬'
    },
    {
      name: 'Zapier',
      description: 'Connect with 5000+ apps via Zapier',
      status: 'available',
      level: 'advanced',
      icon: '⚡'
    },
    {
      name: 'Custom API',
      description: 'Build custom integrations with our API',
      status: 'available',
      level: 'advanced',
      icon: '🔧'
    }
  ];

  const filteredIntegrations = availableIntegrations.filter(integration => {
    if (integrationsLevel === 'basic') {
      return integration.level === 'basic';
    }
    return true; // advanced level shows all
  });

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-green-500" />
            <CardTitle>Integrations</CardTitle>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-200">
            {integrationsLevel} level
          </Badge>
        </div>
        <CardDescription>
          Connect with your favorite tools and services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Integration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredIntegrations.map((integration) => (
              <div key={integration.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {integration.status === 'connected' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <Plus className="h-3 w-3 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Level Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-medium text-blue-800">
                {integrationsLevel === 'basic' ? 'Basic Integrations' : 'Advanced Integrations'}
              </p>
            </div>
            <p className="text-xs text-blue-700">
              {integrationsLevel === 'basic' 
                ? 'You have access to essential accounting and storage integrations.'
                : 'You have access to all integrations including advanced automation tools.'
              }
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Integration features coming soon!</p>
            <p>This is a preview of what will be available.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
