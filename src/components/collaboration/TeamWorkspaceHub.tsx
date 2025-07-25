import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users,
  MessageCircle,
  FolderOpen,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  Activity,
  Target,
  FileText,
  Bell
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useTeam } from '@/contexts/TeamContext';
import { collaborationService, Project, Message, Conversation } from '@/services/collaborationService';
import { enhancedTeamService } from '@/services/enhancedTeamService';

interface TeamWorkspaceHubProps {
  className?: string;
  onNavigate?: (section: 'messages' | 'projects' | 'members' | 'files') => void;
}

interface ActivityItem {
  id: string;
  type: 'message' | 'project' | 'task' | 'member';
  title: string;
  description: string;
  timestamp: string;
  user?: any;
  metadata?: any;
}

export function TeamWorkspaceHub({ className, onNavigate }: TeamWorkspaceHubProps) {
  const { currentTeam } = useTeam();
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentTeam?.id) {
      loadWorkspaceData();
    }
  }, [currentTeam?.id]);

  const loadWorkspaceData = async () => {
    if (!currentTeam?.id) return;
    
    setIsLoading(true);
    try {
      // Load projects
      const projectsResponse = await collaborationService.getProjects(currentTeam.id);
      if (projectsResponse.success && projectsResponse.data) {
        setProjects(projectsResponse.data.slice(0, 5)); // Show recent 5 projects
      }

      // Load conversations
      const conversationsResponse = await collaborationService.getConversations(currentTeam.id);
      if (conversationsResponse.success && conversationsResponse.data) {
        setConversations(conversationsResponse.data.slice(0, 5)); // Show recent 5 conversations
      }

      // Load team members
      const membersResponse = await enhancedTeamService.getTeamMembers(currentTeam.id);
      if (membersResponse.success && membersResponse.data) {
        setTeamMembers(membersResponse.data);
      }

      // Generate recent activity (mock data for now)
      generateRecentActivity();
    } catch (error) {
      console.error('Error loading workspace data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateRecentActivity = () => {
    // In a real implementation, this would come from a unified activity feed
    const activities: ActivityItem[] = [
      {
        id: '1',
        type: 'project',
        title: 'New project created',
        description: 'Website Redesign project was created',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        type: 'message',
        title: 'New message',
        description: 'You have 3 unread messages',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        type: 'task',
        title: 'Task completed',
        description: 'Design mockups task was completed',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '4',
        type: 'member',
        title: 'New team member',
        description: 'John Doe joined the team',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    setRecentActivity(activities);
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'message': return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'project': return <FolderOpen className="h-4 w-4 text-green-500" />;
      case 'task': return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'member': return <Users className="h-4 w-4 text-orange-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getProjectProgress = (project: Project) => {
    // In a real implementation, this would calculate based on actual tasks
    return Math.floor(Math.random() * 100);
  };

  const getActiveProjects = () => {
    return projects.filter(p => p.status === 'active' || p.status === 'planning');
  };

  const getUnreadMessages = () => {
    // In a real implementation, this would count actual unread messages
    return Math.floor(Math.random() * 10);
  };

  const getUpcomingDeadlines = () => {
    return projects.filter(p => p.due_date && new Date(p.due_date) > new Date()).slice(0, 3);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Team Workspace</h1>
        <p className="text-muted-foreground">
          Welcome to {currentTeam?.name} workspace. Here's what's happening with your team.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FolderOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{getActiveProjects().length}</p>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{getUnreadMessages()}</p>
                <p className="text-sm text-muted-foreground">Unread Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamMembers.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{getUpcomingDeadlines().length}</p>
                <p className="text-sm text-muted-foreground">Upcoming Deadlines</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Your team's active and recent projects</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.('projects')}>
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.slice(0, 3).map((project) => (
                <div key={project.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FolderOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{project.name}</h4>
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Progress:</span>
                        <div className="w-20">
                          <Progress value={getProjectProgress(project)} className="h-1" />
                        </div>
                        <span className="text-xs">{getProjectProgress(project)}%</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {project.status}
                      </Badge>
                    </div>
                  </div>
                  {project.due_date && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Due</p>
                      <p className="text-sm font-medium">
                        {format(new Date(project.due_date), 'MMM dd')}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {projects.length === 0 && (
                <div className="text-center py-8">
                  <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No projects yet</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Project
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Conversations</CardTitle>
                <CardDescription>Latest team conversations and messages</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.('messages')}>
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {conversations.slice(0, 3).map((conversation) => (
                <div key={conversation.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {conversation.conversation_type === 'group' ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        conversation.title?.[0] || 'C'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h4 className="font-medium">
                      {conversation.title || `${conversation.conversation_type} conversation`}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Last message {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {conversation.conversation_type}
                  </Badge>
                </div>
              ))}

              {conversations.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Plus className="h-4 w-4 mr-2" />
                    Start Conversation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Team Members */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Team Members</CardTitle>
                <CardDescription>{teamMembers.length} members</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.('members')}>
                View All
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamMembers.slice(0, 5).map((member) => (
                <div key={member.user_id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback>
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest team updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="p-1 bg-muted rounded-full">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
              <CardDescription>Don't miss these dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {getUpcomingDeadlines().map((project) => (
                <div key={project.id} className="flex items-center gap-3 p-2 border rounded-lg">
                  <div className="p-1 bg-orange-100 rounded">
                    <Calendar className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {format(new Date(project.due_date!), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              ))}

              {getUpcomingDeadlines().length === 0 && (
                <div className="text-center py-4">
                  <Calendar className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">No upcoming deadlines</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
