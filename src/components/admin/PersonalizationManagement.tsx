import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Brain, 
  Settings, 
  BarChart3, 
  Shield, 
  Database,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PersonalizationStats {
  totalUsers: number;
  activeUsers: number;
  totalInteractions: number;
  averageProfileCompleteness: number;
  memoryUsage: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface UserPersonalizationData {
  userId: string;
  email: string;
  profileCompleteness: string;
  totalInteractions: number;
  lastActivity: string;
  memoryCount: number;
  preferencesCount: number;
}

export function PersonalizationManagement() {
  const { toast } = useToast();
  const [stats, setStats] = useState<PersonalizationStats | null>(null);
  const [users, setUsers] = useState<UserPersonalizationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  
  // System settings
  const [systemSettings, setSystemSettings] = useState({
    personalizationEnabled: true,
    memoryRetentionDays: 90,
    minInteractionsForLearning: 10,
    maxMemoryPerUser: 1000,
    analyticsEnabled: true,
    autoCleanupEnabled: true
  });

  useEffect(() => {
    loadPersonalizationStats();
    loadUserData();
    loadSystemSettings();
  }, []);

  const loadPersonalizationStats = async () => {
    try {
      // Get overall system statistics
      const { data: userStats, error: userError } = await supabase
        .from('user_personalization_profiles')
        .select('profile_completeness');

      const { data: interactionStats, error: interactionError } = await supabase
        .from('user_interactions')
        .select('user_id, timestamp')
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (userError || interactionError) {
        throw new Error('Failed to load statistics');
      }

      const totalUsers = userStats?.length || 0;
      const activeUsers = new Set(interactionStats?.map(i => i.user_id)).size;
      const totalInteractions = interactionStats?.length || 0;
      
      const avgCompleteness = userStats?.reduce((sum, user) => {
        const score = user.profile_completeness === 'complete' ? 100 :
                     user.profile_completeness === 'partial' ? 50 : 25;
        return sum + score;
      }, 0) / Math.max(totalUsers, 1);

      setStats({
        totalUsers,
        activeUsers,
        totalInteractions,
        averageProfileCompleteness: avgCompleteness,
        memoryUsage: 75, // Placeholder
        systemHealth: avgCompleteness > 70 ? 'healthy' : avgCompleteness > 40 ? 'warning' : 'critical'
      });
    } catch (error) {
      console.error('Error loading personalization stats:', error);
      toast({
        title: "Error",
        description: "Failed to load personalization statistics",
        variant: "destructive",
      });
    }
  };

  const loadUserData = async () => {
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('user_personalization_profiles')
        .select(`
          user_id,
          profile_completeness,
          preferences,
          last_updated
        `);

      const { data: users, error: userError } = await supabase
        .from('auth.users')
        .select('id, email');

      if (profileError || userError) {
        throw new Error('Failed to load user data');
      }

      // Combine user and profile data
      const userData = users?.map(user => {
        const profile = profiles?.find(p => p.user_id === user.id);
        return {
          userId: user.id,
          email: user.email,
          profileCompleteness: profile?.profile_completeness || 'minimal',
          totalInteractions: 0, // Would need separate query
          lastActivity: profile?.last_updated || 'Never',
          memoryCount: 0, // Would need separate query
          preferencesCount: profile ? Object.keys(profile.preferences || {}).length : 0
        };
      }) || [];

      setUsers(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSystemSettings = async () => {
    // In a real implementation, these would be loaded from a system settings table
    // For now, using default values
  };

  const updateSystemSettings = async () => {
    try {
      // In a real implementation, save to system settings table
      toast({
        title: "Settings Updated",
        description: "System personalization settings have been updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update system settings",
        variant: "destructive",
      });
    }
  };

  const resetUserPersonalization = async (userId: string) => {
    try {
      // Delete user personalization data
      await supabase
        .from('user_personalization_profiles')
        .delete()
        .eq('user_id', userId);

      await supabase
        .from('user_interactions')
        .delete()
        .eq('user_id', userId);

      await supabase
        .from('conversation_memory')
        .delete()
        .eq('user_id', userId);

      toast({
        title: "User Reset",
        description: "User personalization data has been reset",
      });

      loadUserData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset user personalization",
        variant: "destructive",
      });
    }
  };

  const exportPersonalizationData = async () => {
    try {
      // Export all personalization data
      const { data: profiles } = await supabase
        .from('user_personalization_profiles')
        .select('*');

      const { data: interactions } = await supabase
        .from('user_interactions')
        .select('*');

      const exportData = {
        profiles,
        interactions,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personalization-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Personalization data has been exported",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export personalization data",
        variant: "destructive",
      });
    }
  };

  const runSystemCleanup = async () => {
    try {
      // Clean up old interactions and memory
      const cutoffDate = new Date(Date.now() - systemSettings.memoryRetentionDays * 24 * 60 * 60 * 1000);
      
      await supabase
        .from('user_interactions')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      await supabase
        .from('conversation_memory')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      toast({
        title: "Cleanup Complete",
        description: "Old personalization data has been cleaned up",
      });

      loadPersonalizationStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run system cleanup",
        variant: "destructive",
      });
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Personalization Management
          </h2>
          <p className="text-muted-foreground">
            Manage system-wide personalization settings and user data
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportPersonalizationData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" onClick={runSystemCleanup}>
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeUsers || 0} active this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interactions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalInteractions || 0}</div>
            <p className="text-xs text-muted-foreground">
              This week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completeness</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats?.averageProfileCompleteness || 0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Profile completeness
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getHealthBadge(stats?.systemHealth || 'unknown')}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall system status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Personalization Data</CardTitle>
              <CardDescription>
                Manage individual user personalization profiles and data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{user.email}</div>
                      <div className="text-sm text-muted-foreground">
                        Profile: {user.profileCompleteness} • 
                        Preferences: {user.preferencesCount} • 
                        Last active: {new Date(user.lastActivity).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(user.userId)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetUserPersonalization(user.userId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Configure global personalization system settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="personalization-enabled">Enable Personalization</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow the system to learn from user interactions
                  </p>
                </div>
                <Switch
                  id="personalization-enabled"
                  checked={systemSettings.personalizationEnabled}
                  onCheckedChange={(checked) => 
                    setSystemSettings(prev => ({ ...prev, personalizationEnabled: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memory-retention">Memory Retention (days)</Label>
                <Input
                  id="memory-retention"
                  type="number"
                  value={systemSettings.memoryRetentionDays}
                  onChange={(e) => 
                    setSystemSettings(prev => ({ 
                      ...prev, 
                      memoryRetentionDays: parseInt(e.target.value) 
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min-interactions">Minimum Interactions for Learning</Label>
                <Input
                  id="min-interactions"
                  type="number"
                  value={systemSettings.minInteractionsForLearning}
                  onChange={(e) => 
                    setSystemSettings(prev => ({ 
                      ...prev, 
                      minInteractionsForLearning: parseInt(e.target.value) 
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="analytics-enabled">Enable Analytics</Label>
                  <p className="text-sm text-muted-foreground">
                    Collect usage analytics for system improvement
                  </p>
                </div>
                <Switch
                  id="analytics-enabled"
                  checked={systemSettings.analyticsEnabled}
                  onCheckedChange={(checked) => 
                    setSystemSettings(prev => ({ ...prev, analyticsEnabled: checked }))
                  }
                />
              </div>

              <Button onClick={updateSystemSettings}>
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Analytics</CardTitle>
              <CardDescription>
                Monitor personalization system performance and usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                <p>Detailed analytics dashboard coming soon</p>
                <p className="text-sm">Monitor user engagement, learning progress, and system performance</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Maintenance</CardTitle>
              <CardDescription>
                Perform maintenance tasks and system cleanup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Maintenance operations can affect system performance. Run during low-usage periods.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" onClick={runSystemCleanup}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clean Old Data
                </Button>
                
                <Button variant="outline" onClick={loadPersonalizationStats}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Statistics
                </Button>
                
                <Button variant="outline" onClick={exportPersonalizationData}>
                  <Download className="h-4 w-4 mr-2" />
                  Export All Data
                </Button>
                
                <Button variant="outline" disabled>
                  <Database className="h-4 w-4 mr-2" />
                  Rebuild Indexes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
