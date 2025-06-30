// Test Page for User Preference Learning System
// Phase 5: Personalization & Memory System - Task 1

import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Brain, Settings, Activity, TrendingUp, MessageSquare, Search, Mouse, BarChart3, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePersonalizationContext, useAdaptiveResponse, usePreferenceManager } from '@/contexts/PersonalizationContext';
import { PreferenceCategory, InteractionType } from '@/types/personalization';
import { Link } from 'react-router-dom';

export default function TestPersonalizationPage() {
  const { toast } = useToast();
  const {
    profile,
    loading,
    error,
    lastUpdated,
    loadProfile,
    updatePatterns,
    trackInteraction,
    trackChatMessage,
    trackSearchQuery,
    trackUIAction,
    isProfileComplete,
    hasPreferences,
    hasPatterns
  } = usePersonalizationContext();

  const { adaptResponse, config: responseConfig } = useAdaptiveResponse();
  const { setPreference, getPreference, updatePatterns: triggerPatternUpdate } = usePreferenceManager();

  // Test interaction states
  const [testMessage, setTestMessage] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [adaptedResponse, setAdaptedResponse] = useState('');

  // Preference setting states
  const [selectedCategory, setSelectedCategory] = useState<PreferenceCategory>('communication_style');
  const [preferenceKey, setPreferenceKey] = useState('');
  const [preferenceValue, setPreferenceValue] = useState('');

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleTrackChatMessage = async () => {
    if (!testMessage.trim()) {
      toast({ title: 'Error', description: 'Please enter a message to track', variant: 'destructive' });
      return;
    }

    try {
      await trackChatMessage(testMessage, 'test-conversation', Math.random() * 5000);
      toast({ title: 'Success', description: 'Chat message tracked successfully' });
      setTestMessage('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to track chat message', variant: 'destructive' });
    }
  };

  const handleTrackSearchQuery = async () => {
    if (!testQuery.trim()) {
      toast({ title: 'Error', description: 'Please enter a search query to track', variant: 'destructive' });
      return;
    }

    try {
      await trackSearchQuery(testQuery, 'semantic', Math.floor(Math.random() * 20) + 1);
      toast({ title: 'Success', description: 'Search query tracked successfully' });
      setTestQuery('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to track search query', variant: 'destructive' });
    }
  };

  const handleTrackUIAction = async (action: string) => {
    try {
      await trackUIAction(action, 'test-component');
      toast({ title: 'Success', description: `UI action "${action}" tracked successfully` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to track UI action', variant: 'destructive' });
    }
  };

  const handleSetPreference = async () => {
    if (!preferenceKey.trim() || !preferenceValue.trim()) {
      toast({ title: 'Error', description: 'Please enter both key and value', variant: 'destructive' });
      return;
    }

    try {
      let value: Record<string, any>;
      try {
        value = JSON.parse(preferenceValue);
      } catch {
        value = { value: preferenceValue };
      }

      const result = await setPreference(selectedCategory, preferenceKey, value);
      if (result.success) {
        toast({ title: 'Success', description: 'Preference set successfully' });
        setPreferenceKey('');
        setPreferenceValue('');
        await loadProfile();
      } else {
        toast({ title: 'Error', description: result.message || 'Failed to set preference', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to set preference', variant: 'destructive' });
    }
  };

  const handleUpdatePatterns = async () => {
    try {
      const result = await triggerPatternUpdate();
      if (result.success) {
        toast({ 
          title: 'Success', 
          description: `Updated ${result.data} behavioral patterns` 
        });
        await loadProfile();
      } else {
        toast({ title: 'Error', description: result.message || 'Failed to update patterns', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update patterns', variant: 'destructive' });
    }
  };

  const handleTestAdaptiveResponse = () => {
    if (!testResponse.trim()) {
      toast({ title: 'Error', description: 'Please enter a response to adapt', variant: 'destructive' });
      return;
    }

    const adapted = adaptResponse(testResponse);
    setAdaptedResponse(adapted);
  };

  const getStatusColor = (completeness: string) => {
    switch (completeness) {
      case 'complete': return 'bg-green-500';
      case 'partial': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      <Helmet>
        <title>Personalization Test - Mataresit</title>
        <meta name="description" content="Test user preference learning and personalization system" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Personalization Test
          </h1>
          <p className="text-muted-foreground">
            Test and monitor the user preference learning system
          </p>

          {/* Navigation to Related Tests */}
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h3 className="font-medium mb-2">Related Test Pages</h3>
            <div className="flex flex-wrap gap-2">
              <Link to="/test/analytics">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics Dashboard
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${getStatusColor(profile?.profile_completeness || 'minimal')}`} />
                <p className="text-sm font-medium">Profile Completeness</p>
                <p className="text-xs text-muted-foreground">{profile?.profile_completeness || 'minimal'}</p>
              </div>
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${hasPreferences ? 'bg-green-500' : 'bg-gray-500'}`} />
                <p className="text-sm font-medium">Preferences</p>
                <p className="text-xs text-muted-foreground">
                  {profile ? Object.keys(profile.preferences).length : 0} categories
                </p>
              </div>
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${hasPatterns ? 'bg-green-500' : 'bg-gray-500'}`} />
                <p className="text-sm font-medium">Patterns</p>
                <p className="text-xs text-muted-foreground">
                  {profile ? Object.keys(profile.behavioral_patterns).length : 0} types
                </p>
              </div>
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${loading ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <p className="text-sm font-medium">Status</p>
                <p className="text-xs text-muted-foreground">
                  {loading ? 'Loading...' : 'Ready'}
                </p>
              </div>
            </div>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Last updated: {lastUpdated.toLocaleString()}
              </p>
            )}
            {error && (
              <p className="text-xs text-red-500 mt-2 text-center">
                Error: {error}
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="interactions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="interactions">Track Interactions</TabsTrigger>
            <TabsTrigger value="preferences">Manage Preferences</TabsTrigger>
            <TabsTrigger value="adaptive">Adaptive Response</TabsTrigger>
            <TabsTrigger value="profile">Profile Data</TabsTrigger>
          </TabsList>

          {/* Track Interactions Tab */}
          <TabsContent value="interactions" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chat Message Tracking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Track Chat Message
                  </CardTitle>
                  <CardDescription>
                    Test chat message interaction tracking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="test-message">Message</Label>
                    <Textarea
                      id="test-message"
                      placeholder="Enter a test message..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleTrackChatMessage} className="w-full">
                    Track Message
                  </Button>
                </CardContent>
              </Card>

              {/* Search Query Tracking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Track Search Query
                  </CardTitle>
                  <CardDescription>
                    Test search query interaction tracking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="test-query">Search Query</Label>
                    <Input
                      id="test-query"
                      placeholder="Enter a test search query..."
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleTrackSearchQuery} className="w-full">
                    Track Query
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* UI Action Tracking */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mouse className="h-5 w-5" />
                  Track UI Actions
                </CardTitle>
                <CardDescription>
                  Test UI action interaction tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => handleTrackUIAction('button_click')}>
                    Track Button Click
                  </Button>
                  <Button variant="outline" onClick={() => handleTrackUIAction('form_submit')}>
                    Track Form Submit
                  </Button>
                  <Button variant="outline" onClick={() => handleTrackUIAction('navigation')}>
                    Track Navigation
                  </Button>
                  <Button variant="outline" onClick={() => handleTrackUIAction('feature_usage')}>
                    Track Feature Usage
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Set Preference */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Set Preference
                  </CardTitle>
                  <CardDescription>
                    Manually set user preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="preference-category">Category</Label>
                    <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as PreferenceCategory)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="communication_style">Communication Style</SelectItem>
                        <SelectItem value="response_length">Response Length</SelectItem>
                        <SelectItem value="technical_detail_level">Technical Detail Level</SelectItem>
                        <SelectItem value="ui_layout">UI Layout</SelectItem>
                        <SelectItem value="feature_usage">Feature Usage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="preference-key">Key</Label>
                    <Input
                      id="preference-key"
                      placeholder="e.g., preferred_style"
                      value={preferenceKey}
                      onChange={(e) => setPreferenceKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="preference-value">Value (JSON)</Label>
                    <Textarea
                      id="preference-value"
                      placeholder='{"style": "technical"}'
                      value={preferenceValue}
                      onChange={(e) => setPreferenceValue(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSetPreference} className="w-full">
                    Set Preference
                  </Button>
                </CardContent>
              </Card>

              {/* Update Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Update Patterns
                  </CardTitle>
                  <CardDescription>
                    Trigger behavioral pattern analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Analyze recent interactions to update behavioral patterns and generate preferences.
                  </p>
                  <Button onClick={handleUpdatePatterns} className="w-full">
                    Update Patterns
                  </Button>
                  <Button onClick={loadProfile} variant="outline" className="w-full">
                    Refresh Profile
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Adaptive Response Tab */}
          <TabsContent value="adaptive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Adaptive Response</CardTitle>
                <CardDescription>
                  See how responses are adapted based on user preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="test-response">Base Response</Label>
                  <Textarea
                    id="test-response"
                    placeholder="Enter a response to adapt..."
                    value={testResponse}
                    onChange={(e) => setTestResponse(e.target.value)}
                  />
                </div>
                <Button onClick={handleTestAdaptiveResponse}>
                  Adapt Response
                </Button>
                {adaptedResponse && (
                  <div className="space-y-2">
                    <Label>Adapted Response</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm">{adaptedResponse}</p>
                    </div>
                  </div>
                )}
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Current Response Configuration</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Style:</span> {responseConfig.communication_style.style}
                    </div>
                    <div>
                      <span className="font-medium">Length:</span> {responseConfig.response_length.length}
                    </div>
                    <div>
                      <span className="font-medium">Technical Level:</span> {responseConfig.technical_detail.level}
                    </div>
                    <div>
                      <span className="font-medium">Confidence:</span> {(responseConfig.personalization_confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Data Tab */}
          <TabsContent value="profile" className="space-y-6">
            {profile ? (
              <div className="space-y-6">
                {/* Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle>User Preferences</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(profile.preferences).length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(profile.preferences).map(([category, prefs]) => (
                          <div key={category}>
                            <h4 className="font-medium mb-2 capitalize">{category.replace('_', ' ')}</h4>
                            <div className="space-y-2">
                              {Object.entries(prefs).map(([key, pref]) => (
                                <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <span className="text-sm font-medium">{key}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                      {(pref.confidence * 100).toFixed(0)}% confidence
                                    </Badge>
                                    <Badge variant="secondary">{pref.source}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No preferences set yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Behavioral Patterns */}
                <Card>
                  <CardHeader>
                    <CardTitle>Behavioral Patterns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(profile.behavioral_patterns).length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(profile.behavioral_patterns).map(([type, pattern]) => (
                          <div key={type}>
                            <h4 className="font-medium mb-2 capitalize">{type.replace('_', ' ')}</h4>
                            <div className="p-3 bg-muted rounded">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline">
                                  {(pattern.confidence * 100).toFixed(0)}% confidence
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Sample size: {pattern.sample_size}
                                </span>
                              </div>
                              <pre className="text-xs overflow-auto">
                                {JSON.stringify(pattern.data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No behavioral patterns computed yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No profile data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
