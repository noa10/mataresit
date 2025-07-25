import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  BarChart3, 
  Activity,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { MemberAnalyticsDashboard } from './MemberAnalyticsDashboard';

interface MemberAnalyticsDemoProps {
  teamId: string;
  teamMembers?: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
  }>;
}

export function MemberAnalyticsDemo({ teamId, teamMembers = [] }: MemberAnalyticsDemoProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>();
  const [showDashboard, setShowDashboard] = useState(false);

  const handleMemberSelect = (memberId: string) => {
    setSelectedMemberId(memberId);
    setShowDashboard(true);
  };

  const handleBackToSelection = () => {
    setShowDashboard(false);
    setSelectedMemberId(undefined);
  };

  if (showDashboard) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleBackToSelection}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Selection
          </Button>
          
          {selectedMemberId && (
            <Badge variant="outline" className="flex items-center gap-2">
              <Eye className="h-3 w-3" />
              Viewing: {teamMembers.find(m => m.id === selectedMemberId)?.full_name || 'Unknown Member'}
            </Badge>
          )}
        </div>

        <MemberAnalyticsDashboard
          teamId={teamId}
          selectedMemberId={selectedMemberId}
          onMemberSelect={handleMemberSelect}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Member Analytics Dashboard Demo
          </CardTitle>
          <CardDescription>
            Select a view mode to explore member analytics and team engagement metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowDashboard(true)}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Team Overview</h3>
                    <p className="text-sm text-muted-foreground">
                      View team-wide engagement metrics and performance insights
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Individual Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Deep dive into individual member performance and activity
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member Selection */}
          {teamMembers.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select a Team Member</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map((member) => (
                  <Card 
                    key={member.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleMemberSelect(member.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="font-medium text-blue-600">
                              {member.full_name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">{member.full_name}</div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="capitalize">
                            {member.role}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1 capitalize">
                            {member.status}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Demo Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Demo Instructions</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Click "Team Overview" to view team-wide analytics and engagement metrics</li>
                <li>• Select a team member to view individual performance insights</li>
                <li>• Use the dashboard controls to filter by time periods and view modes</li>
                <li>• Explore charts, trends, and activity timelines for comprehensive insights</li>
              </ul>
            </CardContent>
          </Card>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <BarChart3 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-medium text-green-900">Performance Charts</h4>
              <p className="text-sm text-green-700">Interactive charts showing activity trends and engagement metrics</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Activity className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h4 className="font-medium text-purple-900">Activity Timeline</h4>
              <p className="text-sm text-purple-700">Detailed timeline of member activities and interactions</p>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <Users className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <h4 className="font-medium text-orange-900">Team Insights</h4>
              <p className="text-sm text-orange-700">AI-generated insights and performance comparisons</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Example usage component
export function MemberAnalyticsExample() {
  // Example team data - in real usage, this would come from your team service
  const exampleTeamId = "example-team-id";
  const exampleMembers = [
    {
      id: "user-1",
      full_name: "John Doe",
      email: "john@example.com",
      role: "admin",
      status: "active"
    },
    {
      id: "user-2", 
      full_name: "Jane Smith",
      email: "jane@example.com",
      role: "member",
      status: "active"
    },
    {
      id: "user-3",
      full_name: "Bob Johnson", 
      email: "bob@example.com",
      role: "viewer",
      status: "inactive"
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Member Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Comprehensive member analytics and team engagement insights
        </p>
      </div>
      
      <MemberAnalyticsDemo 
        teamId={exampleTeamId}
        teamMembers={exampleMembers}
      />
    </div>
  );
}
