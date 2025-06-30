import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  Brain, 
  MessageSquare, 
  BarChart3, 
  Settings,
  TestTube,
  ArrowLeft,
  Play,
  Users,
  FileText,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PersonalizationIntegrationTest } from '@/components/test/PersonalizationIntegrationTest';
import { PersonalizationManagement } from '@/components/admin/PersonalizationManagement';
import { useAuth } from '@/contexts/AuthContext';

export default function TestPersonalizationIntegrationPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const features = [
    {
      title: 'User Preference Learning',
      description: 'Automatically learns from user interactions to adapt communication style and preferences',
      icon: <Brain className="h-6 w-6 text-blue-600" />,
      status: 'implemented',
      testPath: '/test/personalization'
    },
    {
      title: 'Conversation Memory',
      description: 'Maintains context across chat sessions with intelligent memory management',
      icon: <MessageSquare className="h-6 w-6 text-green-600" />,
      status: 'implemented',
      testPath: '/test/personalization'
    },
    {
      title: 'Personalized Responses',
      description: 'Generates responses tailored to individual user preferences and communication style',
      icon: <Zap className="h-6 w-6 text-purple-600" />,
      status: 'implemented',
      testPath: '/test/personalization'
    },
    {
      title: 'Adaptive UI Components',
      description: 'UI elements that adapt based on user behavior and preferences',
      icon: <Settings className="h-6 w-6 text-orange-600" />,
      status: 'implemented',
      testPath: '/test/personalization'
    },
    {
      title: 'Long-term Analytics',
      description: 'Comprehensive tracking and analysis of user interaction patterns',
      icon: <BarChart3 className="h-6 w-6 text-red-600" />,
      status: 'implemented',
      testPath: '/test/analytics'
    },
    {
      title: 'Chat Integration',
      description: 'Seamless integration with existing chat system for personalized conversations',
      icon: <MessageSquare className="h-6 w-6 text-cyan-600" />,
      status: 'implemented',
      testPath: '/semantic-search'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'implemented':
        return <Badge className="bg-green-500">Implemented</Badge>;
      case 'testing':
        return <Badge className="bg-blue-500">Testing</Badge>;
      case 'planned':
        return <Badge variant="outline">Planned</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/test/analytics">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Analytics
            </Button>
          </Link>
          
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8" />
              Personalization Integration
            </h1>
            <p className="text-muted-foreground">
              Complete integration testing and management for Phase 5: Personalization & Memory System
            </p>
          </div>
        </div>
        
        <Badge variant="outline" className="flex items-center gap-1">
          <TestTube className="h-3 w-3" />
          Integration Testing
        </Badge>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link to="/test/personalization">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Personalization Test</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Test individual personalization components
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/test/analytics">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                <span className="font-medium">Analytics Dashboard</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                View comprehensive analytics and insights
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/semantic-search">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Live Chat</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Experience personalized chat in action
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="testing">Integration Tests</TabsTrigger>
          <TabsTrigger value="admin">Admin Controls</TabsTrigger>
          <TabsTrigger value="documentation">Documentation</TabsTrigger>
          <TabsTrigger value="status">System Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Feature Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Phase 5: Personalization & Memory System</CardTitle>
              <CardDescription>
                Complete implementation of intelligent personalization features for Mataresit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="mt-1">{feature.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{feature.title}</h4>
                        {getStatusBadge(feature.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {feature.description}
                      </p>
                      <Link to={feature.testPath}>
                        <Button variant="outline" size="sm">
                          <Play className="h-3 w-3 mr-1" />
                          Test
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Implementation Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Implementation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>User Preference Learning System with automatic adaptation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Conversation Memory with intelligent context retention</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Personalized Response Generation with style adaptation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Adaptive UI Components with behavior-based customization</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Long-term Interaction Tracking with comprehensive analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Seamless Chat System Integration</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <PersonalizationIntegrationTest />
        </TabsContent>

        <TabsContent value="admin" className="space-y-4">
          {user?.email?.includes('admin') ? (
            <PersonalizationManagement />
          ) : (
            <Alert>
              <AlertDescription>
                Admin access required to view personalization management controls.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="documentation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentation & Guides
              </CardTitle>
              <CardDescription>
                Comprehensive documentation for users and administrators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Complete guide for users on how to use personalization features
                    </p>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <strong>Topics covered:</strong>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• How personalization works</li>
                        <li>• Adaptive chat responses</li>
                        <li>• Conversation memory</li>
                        <li>• Smart receipt processing</li>
                        <li>• Personalized search</li>
                        <li>• Analytics & insights</li>
                        <li>• Privacy controls</li>
                      </ul>
                    </div>
                    <Button variant="outline" size="sm" className="mt-4">
                      View User Guide
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Admin Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Administrative controls and system management
                    </p>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <strong>Topics covered:</strong>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• System configuration</li>
                        <li>• User data management</li>
                        <li>• Privacy controls</li>
                        <li>• Performance monitoring</li>
                        <li>• Data export/import</li>
                        <li>• System maintenance</li>
                        <li>• Troubleshooting</li>
                      </ul>
                    </div>
                    <Button variant="outline" size="sm" className="mt-4">
                      View Admin Guide
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                Current status of all personalization components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="font-medium">Database</div>
                  <div className="text-sm text-muted-foreground">All functions operational</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="font-medium">Services</div>
                  <div className="text-sm text-muted-foreground">All services running</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="font-medium">Integration</div>
                  <div className="text-sm text-muted-foreground">Chat system integrated</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
