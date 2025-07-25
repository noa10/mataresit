import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Home,
  MessageCircle,
  FolderOpen,
  Users,
  FileText,
  Calendar,
  Settings,
  Bell,
  Search,
  Plus
} from 'lucide-react';
import { TeamWorkspaceHub } from './TeamWorkspaceHub';
import { DirectMessaging } from './DirectMessaging';
import { ProjectManagement } from './ProjectManagement';
import { MemberRecommendationCard } from '../team/enhanced/MemberRecommendationCard';

interface CollaborationDashboardProps {
  className?: string;
}

export function CollaborationDashboard({ className }: CollaborationDashboardProps) {
  const [activeTab, setActiveTab] = useState('workspace');

  const handleNavigation = (section: 'messages' | 'projects' | 'members' | 'files') => {
    setActiveTab(section);
  };

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Team Collaboration</h1>
            <p className="text-muted-foreground">
              Collaborate, communicate, and coordinate with your team
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" size="sm">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                3
              </Badge>
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Quick Action
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="workspace" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Workspace
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <div className="xl:col-span-3">
                <TeamWorkspaceHub onNavigate={handleNavigation} />
              </div>
              <div className="space-y-6">
                <MemberRecommendationCard
                  maxRecommendations={3}
                  onMemberSelect={(member) => {
                    console.log('Selected member for collaboration:', member);
                    // Could navigate to direct message with this member
                    setActiveTab('messages');
                  }}
                />
                
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                    <CardDescription>Common collaboration tasks</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('messages')}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Start New Conversation
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('projects')}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Create New Project
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('files')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Share Files
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('members')}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Invite Members
                    </Button>
                  </CardContent>
                </Card>

                {/* Collaboration Tips */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Collaboration Tips</CardTitle>
                    <CardDescription>Make the most of team features</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">💬 Effective Messaging</h4>
                      <p className="text-xs text-muted-foreground">
                        Use @mentions to notify specific team members and keep conversations focused.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">📋 Project Organization</h4>
                      <p className="text-xs text-muted-foreground">
                        Break down projects into smaller tasks and assign clear deadlines.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">📁 File Management</h4>
                      <p className="text-xs text-muted-foreground">
                        Keep project files organized and use version control for documents.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <DirectMessaging />
          </TabsContent>

          <TabsContent value="projects">
            <ProjectManagement />
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Manage team members and their collaboration preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">Enhanced Member Management</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Advanced member management features are available in the main team section.
                    </p>
                    <Button variant="outline">
                      Go to Team Management
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle>File Collaboration</CardTitle>
                <CardDescription>
                  Share, collaborate, and manage team files
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* File Upload Area */}
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">File Collaboration Coming Soon</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Advanced file sharing and collaboration features are in development.
                    </p>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Planned Features:</h4>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Real-time collaborative editing</li>
                        <li>• Version control and history</li>
                        <li>• File sharing with permissions</li>
                        <li>• Integration with projects and tasks</li>
                        <li>• Comment and review system</li>
                      </ul>
                    </div>
                  </div>

                  {/* Recent Files Placeholder */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Recent Files</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="opacity-50">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded">
                                <FileText className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">Document {i}.pdf</h4>
                                <p className="text-xs text-muted-foreground">Shared 2 days ago</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
