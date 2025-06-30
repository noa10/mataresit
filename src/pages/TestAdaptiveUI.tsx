// Test Page for Adaptive UI Component System
// Phase 5: Personalization & Memory System - Task 4

import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Layout, 
  Zap, 
  Settings, 
  Eye, 
  Monitor,
  Smartphone,
  Tablet,
  PanelLeft,
  PanelRight,
  Maximize2,
  Minimize2,
  Star,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdaptiveUI } from '@/hooks/useAdaptiveUI';
import { AdaptiveLayout } from '@/components/adaptive/AdaptiveLayout';
import { AdaptiveNavigation } from '@/components/adaptive/AdaptiveNavigation';
import { AdaptiveFeaturePanel } from '@/components/adaptive/AdaptiveFeaturePanel';
import { AdaptiveContainer } from '@/components/adaptive/AdaptiveContainer';

export default function TestAdaptiveUIPage() {
  const { toast } = useToast();
  const {
    uiState,
    loading,
    error,
    adaptationConfidence,
    adaptUI,
    getLayoutConfig,
    getSidebarPosition,
    getNavigationStyle,
    isCompactLayout,
    trackComponentInteraction,
    hasAdaptations,
    adaptationLevel
  } = useAdaptiveUI();

  const [testMode, setTestMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showAdaptationControls, setShowAdaptationControls] = useState(true);
  const [enablePersonalization, setEnablePersonalization] = useState(true);
  const [simulateUsagePatterns, setSimulateUsagePatterns] = useState(false);

  const layoutConfig = getLayoutConfig();
  const sidebarPosition = getSidebarPosition();
  const navigationStyle = getNavigationStyle();
  const isCompact = isCompactLayout();

  useEffect(() => {
    // Track page visit
    trackComponentInteraction('test-adaptive-ui', 'page_visit');
  }, [trackComponentInteraction]);

  const handleAdaptUI = async () => {
    try {
      await adaptUI();
      toast({ title: 'Success', description: 'UI adapted successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to adapt UI', variant: 'destructive' });
    }
  };

  const simulateInteraction = async (componentId: string, interactionType: string) => {
    try {
      await trackComponentInteraction(componentId, interactionType);
      toast({ 
        title: 'Interaction Tracked', 
        description: `${componentId}: ${interactionType}`,
        duration: 2000
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to track interaction', variant: 'destructive' });
    }
  };

  const getAdaptationColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getViewportClasses = () => {
    switch (testMode) {
      case 'mobile':
        return 'max-w-sm mx-auto';
      case 'tablet':
        return 'max-w-4xl mx-auto';
      case 'desktop':
      default:
        return 'w-full';
    }
  };

  const renderStatusCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Adaptation Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getAdaptationColor(adaptationLevel)}`}>
              {adaptationLevel}
            </div>
            <div className="text-sm text-muted-foreground">Adaptation Level</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{(adaptationConfidence * 100).toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground">Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{layoutConfig.layoutType}</div>
            <div className="text-sm text-muted-foreground">Layout Type</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{navigationStyle}</div>
            <div className="text-sm text-muted-foreground">Navigation</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Adaptation Confidence</span>
            <span className="text-sm text-muted-foreground">
              {(adaptationConfidence * 100).toFixed(1)}%
            </span>
          </div>
          <Progress value={adaptationConfidence * 100} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={hasAdaptations ? "default" : "secondary"}>
            {hasAdaptations ? 'Adaptations Active' : 'No Adaptations'}
          </Badge>
          <Badge variant="outline">
            Sidebar: {sidebarPosition}
          </Badge>
          <Badge variant="outline">
            {isCompact ? 'Compact' : 'Spacious'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const renderControlsCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Test Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="test-mode">Viewport Mode</Label>
            <Select value={testMode} onValueChange={(value) => setTestMode(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desktop">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Desktop
                  </div>
                </SelectItem>
                <SelectItem value="tablet">
                  <div className="flex items-center gap-2">
                    <Tablet className="h-4 w-4" />
                    Tablet
                  </div>
                </SelectItem>
                <SelectItem value="mobile">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Mobile
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Adaptation Settings</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-controls"
                  checked={showAdaptationControls}
                  onCheckedChange={setShowAdaptationControls}
                />
                <Label htmlFor="show-controls">Show Adaptation Controls</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enable-personalization"
                  checked={enablePersonalization}
                  onCheckedChange={setEnablePersonalization}
                />
                <Label htmlFor="enable-personalization">Enable Personalization</Label>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Actions</Label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAdaptUI} disabled={loading}>
              <Zap className="h-4 w-4 mr-2" />
              Adapt UI
            </Button>
            <Button 
              variant="outline" 
              onClick={() => simulateInteraction('test-component', 'click')}
            >
              Simulate Click
            </Button>
            <Button 
              variant="outline" 
              onClick={() => simulateInteraction('navigation', 'hover')}
            >
              Simulate Hover
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderInteractionSimulator = () => (
    <Card>
      <CardHeader>
        <CardTitle>Interaction Simulator</CardTitle>
        <CardDescription>
          Simulate user interactions to test adaptive behavior
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { id: 'upload', label: 'Upload', icon: '📤' },
            { id: 'search', label: 'Search', icon: '🔍' },
            { id: 'chat', label: 'Chat', icon: '💬' },
            { id: 'analytics', label: 'Analytics', icon: '📊' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
            { id: 'team', label: 'Team', icon: '👥' },
            { id: 'claims', label: 'Claims', icon: '📄' },
            { id: 'help', label: 'Help', icon: '❓' }
          ].map((item) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              onClick={() => simulateInteraction(item.id, 'feature_usage')}
              className="flex flex-col h-auto py-3"
            >
              <span className="text-lg mb-1">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Helmet>
        <title>Adaptive UI Test - Mataresit</title>
        <meta name="description" content="Test adaptive UI component system" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Test Controls Header */}
        <div className="border-b bg-muted/30 p-4">
          <div className="container mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Layout className="h-6 w-6" />
                  Adaptive UI Test
                </h1>
                <p className="text-muted-foreground">
                  Test and preview the adaptive UI component system
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Eye className="h-3 w-3" />
                  {testMode}
                </Badge>
                <Badge variant={hasAdaptations ? "default" : "secondary"} className="gap-1">
                  <Zap className="h-3 w-3" />
                  {adaptationLevel}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Main Test Area */}
        <div className={cn('transition-all duration-300', getViewportClasses())}>
          <AdaptiveLayout
            enableAdaptation={enablePersonalization}
            showAdaptationControls={showAdaptationControls}
            className="min-h-screen"
          >
            <div className="space-y-6">
              {/* Status and Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {renderStatusCard()}
                {renderControlsCard()}
              </div>

              {/* Interaction Simulator */}
              {renderInteractionSimulator()}

              {/* Adaptive Components Demo */}
              <Tabs defaultValue="navigation" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="navigation">Navigation</TabsTrigger>
                  <TabsTrigger value="features">Features</TabsTrigger>
                  <TabsTrigger value="layout">Layout</TabsTrigger>
                </TabsList>

                <TabsContent value="navigation" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Adaptive Navigation</CardTitle>
                      <CardDescription>
                        Navigation adapts based on usage patterns and screen size
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg p-4">
                        <AdaptiveNavigation 
                          orientation="horizontal"
                          className="justify-center"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="features" className="space-y-6">
                  <AdaptiveFeaturePanel 
                    enablePersonalization={enablePersonalization}
                    showCategories={true}
                  />
                </TabsContent>

                <TabsContent value="layout" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Layout Configuration</CardTitle>
                      <CardDescription>
                        Current layout settings and adaptation details
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Layout Type:</span>
                            <div className="text-muted-foreground">{layoutConfig.layoutType}</div>
                          </div>
                          <div>
                            <span className="font-medium">Sidebar Position:</span>
                            <div className="text-muted-foreground">{sidebarPosition}</div>
                          </div>
                          <div>
                            <span className="font-medium">Navigation Style:</span>
                            <div className="text-muted-foreground">{navigationStyle}</div>
                          </div>
                          <div>
                            <span className="font-medium">Content Density:</span>
                            <div className="text-muted-foreground">{layoutConfig.contentDensity}</div>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <h4 className="font-medium mb-2">Responsive Breakpoints</h4>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Mobile:</span>
                              <div className="text-muted-foreground">{layoutConfig.responsiveBreakpoints.mobile}px</div>
                            </div>
                            <div>
                              <span className="font-medium">Tablet:</span>
                              <div className="text-muted-foreground">{layoutConfig.responsiveBreakpoints.tablet}px</div>
                            </div>
                            <div>
                              <span className="font-medium">Desktop:</span>
                              <div className="text-muted-foreground">{layoutConfig.responsiveBreakpoints.desktop}px</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Adaptive Container Examples */}
              <Card>
                <CardHeader>
                  <CardTitle>Adaptive Container Examples</CardTitle>
                  <CardDescription>
                    Examples of components using adaptive containers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AdaptiveContainer componentId="example-1" className="p-4 border rounded-lg">
                      <div className="text-center">
                        <Star className="h-8 w-8 mx-auto mb-2 text-primary" />
                        <h3 className="font-medium">Primary Feature</h3>
                        <p className="text-sm text-muted-foreground">High priority component</p>
                      </div>
                    </AdaptiveContainer>

                    <AdaptiveContainer componentId="example-2" className="p-4 border rounded-lg">
                      <div className="text-center">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <h3 className="font-medium">Secondary Feature</h3>
                        <p className="text-sm text-muted-foreground">Medium priority component</p>
                      </div>
                    </AdaptiveContainer>

                    <AdaptiveContainer componentId="example-3" className="p-4 border rounded-lg">
                      <div className="text-center">
                        <Settings className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <h3 className="font-medium">Advanced Feature</h3>
                        <p className="text-sm text-muted-foreground">Low priority component</p>
                      </div>
                    </AdaptiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AdaptiveLayout>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <Zap className="h-8 w-8 animate-pulse mx-auto mb-2" />
              <p>Adapting UI...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed bottom-4 right-4 z-50">
            <Card className="bg-destructive text-destructive-foreground">
              <CardContent className="p-4">
                <p className="text-sm">Error: {error}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
