import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageCircle,
  FolderOpen,
  Users,
  CheckCircle,
  Calendar,
  FileText,
  Zap,
  Target,
  TrendingUp,
  Clock,
  Database,
  Shield,
  Smartphone
} from 'lucide-react';
import { CollaborationDashboard } from './CollaborationDashboard';

export function CollaborationDemo() {
  const [showDemo, setShowDemo] = useState(false);

  if (showDemo) {
    return <CollaborationDashboard />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Member Collaboration Tools</h1>
        <p className="text-muted-foreground">
          Comprehensive collaboration features for enhanced team productivity and communication.
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm">Real-time Messaging</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Direct and group messaging with real-time delivery, read receipts, and conversation management
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-green-600" />
              <CardTitle className="text-sm">Project Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Create, assign, and track projects and tasks with deadlines, progress tracking, and team collaboration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-sm">Team Workspace</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Centralized hub for team activities, project updates, and member collaboration insights
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm">File Collaboration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Share files, collaborate on documents, and manage project assets with version control
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-red-600" />
              <CardTitle className="text-sm">Team Calendar</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Shared calendar for project deadlines, team meetings, and milestone tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-sm">Real-time Updates</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Live notifications and updates using Supabase Realtime for instant team synchronization
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Implementation Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Phase 1: Core Infrastructure - Completed
            </CardTitle>
            <CardDescription>
              Foundation components and database schema implemented
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Database schema with RLS policies</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Collaboration service layer</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Real-time messaging system</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Project management interface</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Team workspace hub</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Collaboration dashboard</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Technical Architecture
            </CardTitle>
            <CardDescription>
              Built on robust, scalable infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600" />
                <span className="text-sm">PostgreSQL with comprehensive schema</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">Supabase Realtime for live updates</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm">Row Level Security (RLS) policies</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm">Performance optimized with indexes</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-orange-600" />
                <span className="text-sm">Responsive design with Radix UI</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                <span className="text-sm">Integration with existing team system</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Details */}
      <Tabs defaultValue="messaging" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="messaging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Messaging System</CardTitle>
              <CardDescription>
                Comprehensive messaging solution for team communication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Core Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Direct and group conversations</li>
                    <li>• Real-time message delivery</li>
                    <li>• Read receipts and message status</li>
                    <li>• Message editing and deletion</li>
                    <li>• File attachments and media sharing</li>
                    <li>• Conversation search and history</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Advanced Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Message threading and replies</li>
                    <li>• Emoji reactions and responses</li>
                    <li>• @mentions and notifications</li>
                    <li>• Conversation archiving</li>
                    <li>• Message formatting (Markdown)</li>
                    <li>• Integration with project discussions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Management System</CardTitle>
              <CardDescription>
                Comprehensive project and task management for teams
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Project Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Project creation and management</li>
                    <li>• Status tracking and progress monitoring</li>
                    <li>• Budget allocation and tracking</li>
                    <li>• Deadline and milestone management</li>
                    <li>• Team member assignment</li>
                    <li>• Project templates and workflows</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Task Management</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Task creation and assignment</li>
                    <li>• Priority levels and status tracking</li>
                    <li>• Time estimation and logging</li>
                    <li>• Task dependencies and workflows</li>
                    <li>• Progress reporting and analytics</li>
                    <li>• Integration with team calendar</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Workspace Hub</CardTitle>
              <CardDescription>
                Centralized collaboration dashboard for team coordination
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Dashboard Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Team activity overview</li>
                    <li>• Project status summaries</li>
                    <li>• Recent conversations and updates</li>
                    <li>• Member availability and status</li>
                    <li>• Upcoming deadlines and milestones</li>
                    <li>• Quick action shortcuts</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Collaboration Tools</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Member recommendations</li>
                    <li>• Team performance insights</li>
                    <li>• Collaboration analytics</li>
                    <li>• Resource allocation overview</li>
                    <li>• Integration with existing features</li>
                    <li>• Customizable workspace layout</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Integration</CardTitle>
              <CardDescription>
                Seamless integration with existing Mataresit infrastructure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Existing System Integration</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Team management and permissions</li>
                    <li>• Notification system enhancement</li>
                    <li>• Member analytics integration</li>
                    <li>• Receipt and claims workflow</li>
                    <li>• User preferences and settings</li>
                    <li>• Audit trail and activity logging</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Performance & Security</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Real-time performance optimization</li>
                    <li>• Database indexing and caching</li>
                    <li>• Row Level Security (RLS) policies</li>
                    <li>• API rate limiting and protection</li>
                    <li>• Data encryption and privacy</li>
                    <li>• Scalable architecture design</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Demo Action */}
      <Card>
        <CardHeader>
          <CardTitle>Try the Collaboration Dashboard</CardTitle>
          <CardDescription>
            Experience the full collaboration features in an interactive demo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Explore messaging, project management, and team workspace features
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Real-time Updates</Badge>
                <Badge variant="outline" className="text-xs">Interactive UI</Badge>
                <Badge variant="outline" className="text-xs">Full Features</Badge>
              </div>
            </div>
            <Button onClick={() => setShowDemo(true)}>
              Launch Demo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Roadmap</CardTitle>
          <CardDescription>
            Upcoming phases and feature enhancements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Phase 2: Enhanced Features
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Discussion threads and forums</li>
                <li>• Advanced file collaboration</li>
                <li>• Team calendar integration</li>
                <li>• Video/audio calling</li>
                <li>• Advanced project templates</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Phase 3: Analytics & AI
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Collaboration analytics</li>
                <li>• AI-powered recommendations</li>
                <li>• Productivity insights</li>
                <li>• Automated workflows</li>
                <li>• Smart notifications</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Phase 4: Advanced Integration
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• External tool integrations</li>
                <li>• API and webhook support</li>
                <li>• Mobile app features</li>
                <li>• Advanced security features</li>
                <li>• Enterprise capabilities</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
