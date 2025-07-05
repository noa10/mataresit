import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TestTube, 
  Activity, 
  Settings, 
  FileText, 
  Shield,
  Zap,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { NotificationSystemTester } from '@/components/testing/NotificationSystemTester';
import { NotificationPerformanceMonitor } from '@/components/testing/NotificationPerformanceMonitor';
import { NotificationTestPanel } from '@/components/notifications/NotificationTestPanel';
import { RealTimeNotificationTester } from '@/components/testing/RealTimeNotificationTester';

export function NotificationTestingPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const testingFeatures = [
    {
      icon: <TestTube className="h-5 w-5" />,
      title: 'Comprehensive Test Suite',
      description: 'Test all notification scenarios including receipt processing, team collaboration, and email delivery',
      status: 'ready'
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Real-time Testing',
      description: 'Test real-time notification delivery, cross-tab synchronization, and connection management',
      status: 'ready'
    },
    {
      icon: <Activity className="h-5 w-5" />,
      title: 'Performance Monitoring',
      description: 'Real-time monitoring of notification system performance and health metrics',
      status: 'ready'
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: 'Security Testing',
      description: 'Validate user permissions, data privacy, and secure notification delivery',
      status: 'ready'
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Load Testing',
      description: 'Test system performance under high notification volume and concurrent users',
      status: 'ready'
    }
  ];

  const systemComponents = [
    {
      name: 'In-App Notifications',
      description: 'Real-time notifications within the application',
      features: ['Real-time updates', 'User preferences', 'Read/unread status', 'Action buttons'],
      status: 'operational'
    },
    {
      name: 'Push Notifications',
      description: 'Browser push notifications for offline users',
      features: ['Service worker', 'Subscription management', 'Offline delivery', 'Rich notifications'],
      status: 'operational'
    },
    {
      name: 'Email Notifications',
      description: 'Professional email templates with Resend integration',
      features: ['HTML templates', 'Bilingual support', 'Delivery tracking', 'User preferences'],
      status: 'operational'
    },
    {
      name: 'Team Collaboration',
      description: 'Team-aware notifications for receipt sharing and comments',
      features: ['Receipt sharing', 'Comment notifications', 'Team member alerts', 'Role-based access'],
      status: 'operational'
    },
    {
      name: 'Database Triggers',
      description: 'Automatic notification creation via database triggers',
      features: ['Status change triggers', 'Automatic notifications', 'Error handling', 'Performance optimization'],
      status: 'operational'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
      case 'ready':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Operational</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Degraded</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Notification System Testing</h1>
        <p className="text-gray-600">
          Comprehensive testing and monitoring suite for the notification system
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="testing">System Testing</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="manual">Manual Testing</TabsTrigger>
          <TabsTrigger value="documentation">Documentation</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Testing Features */}
          <Card>
            <CardHeader>
              <CardTitle>Testing Capabilities</CardTitle>
              <CardDescription>
                Comprehensive testing suite for all notification system components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {testingFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium">{feature.title}</h3>
                        {getStatusBadge(feature.status)}
                      </div>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Components */}
          <Card>
            <CardHeader>
              <CardTitle>System Components</CardTitle>
              <CardDescription>
                Overview of all notification system components and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemComponents.map((component, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{component.name}</h3>
                      {getStatusBadge(component.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{component.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {component.features.map((feature, featureIndex) => (
                        <Badge key={featureIndex} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common testing and monitoring actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setActiveTab('testing')}
                >
                  <TestTube className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-medium mb-1">Run Full Test Suite</h3>
                  <p className="text-sm text-gray-600">Execute all notification tests</p>
                </div>
                <div
                  className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setActiveTab('realtime')}
                >
                  <Zap className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-medium mb-1">Test Real-time</h3>
                  <p className="text-sm text-gray-600">Test live notifications</p>
                </div>
                <div
                  className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setActiveTab('performance')}
                >
                  <Activity className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-medium mb-1">Check Performance</h3>
                  <p className="text-sm text-gray-600">Monitor system health</p>
                </div>
                <div 
                  className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setActiveTab('manual')}
                >
                  <Settings className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-medium mb-1">Manual Testing</h3>
                  <p className="text-sm text-gray-600">Test specific scenarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Testing Tab */}
        <TabsContent value="testing">
          <NotificationSystemTester />
        </TabsContent>

        {/* Real-time Testing Tab */}
        <TabsContent value="realtime">
          <RealTimeNotificationTester />
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <NotificationPerformanceMonitor />
        </TabsContent>

        {/* Manual Testing Tab */}
        <TabsContent value="manual">
          <NotificationTestPanel />
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="documentation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Testing Documentation
              </CardTitle>
              <CardDescription>
                Comprehensive guide for testing the notification system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Scenarios */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Test Scenarios</h3>
                <div className="space-y-3">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Receipt Processing Notifications</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Test receipt upload and processing started notification</li>
                      <li>• Test receipt processing completion notification</li>
                      <li>• Test receipt processing failure notification</li>
                      <li>• Test batch processing completion notification</li>
                    </ul>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Team Collaboration Notifications</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Test receipt sharing with team members</li>
                      <li>• Test comment notifications on shared receipts</li>
                      <li>• Test receipt editing notifications</li>
                      <li>• Test team member role change notifications</li>
                    </ul>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Email Notifications</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Test email template rendering</li>
                      <li>• Test bilingual email support (English/Malay)</li>
                      <li>• Test email delivery tracking</li>
                      <li>• Test user preference respect</li>
                    </ul>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Push Notifications</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Test browser push notification subscription</li>
                      <li>• Test push notification delivery</li>
                      <li>• Test offline notification queuing</li>
                      <li>• Test notification click actions</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Performance Benchmarks */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Performance Benchmarks</h3>
                <div className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Response Time Targets</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Database queries: &lt; 100ms</li>
                        <li>• Notification creation: &lt; 200ms</li>
                        <li>• Email service: &lt; 1000ms</li>
                        <li>• Push service: &lt; 500ms</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Throughput Targets</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Notifications per hour: &lt; 1000</li>
                        <li>• Concurrent users: 100+</li>
                        <li>• Email delivery rate: &gt; 95%</li>
                        <li>• Push delivery rate: &gt; 90%</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Troubleshooting Guide */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Troubleshooting Guide</h3>
                <div className="space-y-3">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Common Issues</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• <strong>Notifications not appearing:</strong> Check user preferences and browser permissions</li>
                      <li>• <strong>Email not delivered:</strong> Verify Resend API key and email template</li>
                      <li>• <strong>Push notifications blocked:</strong> Check service worker registration and permissions</li>
                      <li>• <strong>Performance issues:</strong> Monitor database query times and notification queue size</li>
                    </ul>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Debugging Steps</h4>
                    <ol className="text-sm text-gray-600 space-y-1">
                      <li>1. Check browser console for JavaScript errors</li>
                      <li>2. Verify user authentication and permissions</li>
                      <li>3. Test notification preferences settings</li>
                      <li>4. Monitor Edge Function logs in Supabase</li>
                      <li>5. Check email delivery logs in Resend dashboard</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
