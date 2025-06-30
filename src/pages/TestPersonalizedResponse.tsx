// Test Page for Personalized Response Generation
// Phase 5: Personalization & Memory System - Task 3

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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  MessageSquare, 
  Zap, 
  Target, 
  TrendingUp, 
  ThumbsUp, 
  ThumbsDown,
  BarChart3,
  Settings,
  Sparkles,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePersonalizedChat } from '@/hooks/usePersonalizedChat';
import { ChatResponse } from '@/services/personalizedChatService';
import { formatDistanceToNow } from 'date-fns';

export default function TestPersonalizedResponsePage() {
  const { toast } = useToast();
  const [testQuery, setTestQuery] = useState('');
  const [responseStyle, setResponseStyle] = useState<'auto' | 'technical' | 'casual' | 'detailed' | 'concise'>('auto');
  const [conversationId, setConversationId] = useState('test-personalized-response');
  const [enablePersonalization, setEnablePersonalization] = useState(true);
  const [testResponses, setTestResponses] = useState<Record<string, ChatResponse>>({});
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const {
    loading,
    error,
    lastResponse,
    personalizationStats,
    generateResponse,
    provideFeedback,
    loadPersonalizationStats,
    testResponseStyles,
    getResponseQualityMetrics,
    getPersonalizationInsights,
    hasPersonalizationData,
    personalizationMaturity,
    averageResponseQuality
  } = usePersonalizedChat({
    conversationId,
    enablePersonalization,
    defaultResponseStyle: responseStyle,
    autoLearnFromInteractions: true
  });

  useEffect(() => {
    loadPersonalizationStats();
  }, [loadPersonalizationStats]);

  const handleGenerateResponse = async () => {
    if (!testQuery.trim()) {
      toast({ title: 'Error', description: 'Please enter a test query', variant: 'destructive' });
      return;
    }

    try {
      await generateResponse(testQuery, undefined, responseStyle);
      toast({ title: 'Success', description: 'Response generated successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate response', variant: 'destructive' });
    }
  };

  const handleTestAllStyles = async () => {
    if (!testQuery.trim()) {
      toast({ title: 'Error', description: 'Please enter a test query', variant: 'destructive' });
      return;
    }

    try {
      const responses = await testResponseStyles(testQuery);
      setTestResponses(responses);
      toast({ title: 'Success', description: `Generated ${Object.keys(responses).length} style variations` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to test response styles', variant: 'destructive' });
    }
  };

  const handleProvideFeedback = async (feedback: 'positive' | 'negative') => {
    if (!lastResponse) {
      toast({ title: 'Error', description: 'No response to provide feedback on', variant: 'destructive' });
      return;
    }

    try {
      const messageId = `msg_${Date.now()}`;
      await provideFeedback(messageId, feedback, feedbackMessage);
      toast({ 
        title: 'Success', 
        description: `${feedback === 'positive' ? 'Positive' : 'Negative'} feedback recorded` 
      });
      setFeedbackMessage('');
      await loadPersonalizationStats();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to provide feedback', variant: 'destructive' });
    }
  };

  const addSampleQueries = () => {
    const samples = [
      'Find my receipts from Starbucks',
      'Show me my spending on groceries this month',
      'Help me analyze my restaurant expenses',
      'What are my most expensive purchases?',
      'Find receipts with items over $100'
    ];
    setTestQuery(samples[Math.floor(Math.random() * samples.length)]);
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPersonalizationColor = (maturity: string) => {
    switch (maturity) {
      case 'complete': return 'bg-green-500';
      case 'partial': return 'bg-yellow-500';
      case 'minimal': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const insights = getPersonalizationInsights();
  const qualityMetrics = lastResponse ? getResponseQualityMetrics(lastResponse) : null;

  return (
    <>
      <Helmet>
        <title>Personalized Response Test - Mataresit</title>
        <meta name="description" content="Test personalized response generation system" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Personalized Response Test
          </h1>
          <p className="text-muted-foreground">
            Test and analyze the personalized response generation system
          </p>
        </div>

        {/* Status Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Personalization Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${getPersonalizationColor(personalizationMaturity)}`} />
                <p className="text-sm font-medium">Profile Maturity</p>
                <p className="text-xs text-muted-foreground">{personalizationMaturity}</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{personalizationStats?.preferencesCount || 0}</div>
                <p className="text-sm text-muted-foreground">Preferences</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{personalizationStats?.memoryCount || 0}</div>
                <p className="text-sm text-muted-foreground">Memories</p>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getQualityColor(averageResponseQuality)}`}>
                  {averageResponseQuality}
                </div>
                <p className="text-sm text-muted-foreground">Response Quality</p>
              </div>
            </div>

            {personalizationStats && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Personalization Confidence</span>
                  <span className="text-sm text-muted-foreground">
                    {(personalizationStats.averageConfidence * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={personalizationStats.averageConfidence * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="testing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="testing">Response Testing</TabsTrigger>
            <TabsTrigger value="styles">Style Comparison</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* Response Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Query Input */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Test Query
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="conversation-id">Conversation ID</Label>
                    <Input
                      id="conversation-id"
                      value={conversationId}
                      onChange={(e) => setConversationId(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="response-style">Response Style</Label>
                    <Select value={responseStyle} onValueChange={(value) => setResponseStyle(value as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (Personalized)</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                        <SelectItem value="concise">Concise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="test-query">Query</Label>
                    <Textarea
                      id="test-query"
                      placeholder="Enter your test query..."
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable-personalization"
                      checked={enablePersonalization}
                      onChange={(e) => setEnablePersonalization(e.target.checked)}
                    />
                    <Label htmlFor="enable-personalization">Enable Personalization</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleGenerateResponse} disabled={loading} className="flex-1">
                      <Zap className="h-4 w-4 mr-2" />
                      Generate Response
                    </Button>
                    <Button variant="outline" onClick={addSampleQueries}>
                      Sample
                    </Button>
                  </div>
                  <Button onClick={handleTestAllStyles} variant="outline" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Test All Styles
                  </Button>
                </CardContent>
              </Card>

              {/* Response Display */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generated Response
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading && (
                    <div className="text-center py-8 text-muted-foreground">
                      Generating personalized response...
                    </div>
                  )}
                  
                  {error && (
                    <div className="text-center py-8 text-red-500">
                      Error: {error}
                    </div>
                  )}

                  {lastResponse && !loading && (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-md">
                        <p className="text-sm">{lastResponse.content}</p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          Style: {lastResponse.style}
                        </Badge>
                        <Badge variant="outline">
                          Confidence: {(lastResponse.confidence * 100).toFixed(1)}%
                        </Badge>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {lastResponse.processingTime}ms
                        </Badge>
                      </div>

                      {lastResponse.personalizationApplied.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Personalization Applied:</h4>
                          <div className="flex flex-wrap gap-1">
                            {lastResponse.personalizationApplied.map((feature, index) => (
                              <Badge key={index} variant="secondary">
                                {feature.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {lastResponse.suggestedFollowUps && lastResponse.suggestedFollowUps.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Suggested Follow-ups:</h4>
                          <ul className="text-sm space-y-1">
                            {lastResponse.suggestedFollowUps.map((followUp, index) => (
                              <li key={index} className="text-muted-foreground">• {followUp}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Separator />

                      {/* Feedback Section */}
                      <div className="space-y-3">
                        <h4 className="font-medium">Provide Feedback:</h4>
                        <Textarea
                          placeholder="Optional feedback comment..."
                          value={feedbackMessage}
                          onChange={(e) => setFeedbackMessage(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProvideFeedback('positive')}
                          >
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            Good Response
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProvideFeedback('negative')}
                          >
                            <ThumbsDown className="h-4 w-4 mr-2" />
                            Poor Response
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Style Comparison Tab */}
          <TabsContent value="styles" className="space-y-6">
            {Object.keys(testResponses).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(testResponses).map(([style, response]) => (
                  <Card key={style}>
                    <CardHeader>
                      <CardTitle className="capitalize">{style} Style</CardTitle>
                      <CardDescription>
                        Confidence: {(response.confidence * 100).toFixed(1)}% • 
                        {response.processingTime}ms
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="p-3 bg-muted rounded text-sm">
                          {response.content}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {response.personalizationApplied.map((feature, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {feature.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    Use "Test All Styles" to compare different response styles
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {qualityMetrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Response Quality Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Personalization Score:</span>
                        <div className="text-lg">{(qualityMetrics.personalizationScore * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <span className="font-medium">Response Length:</span>
                        <div className="text-lg">{qualityMetrics.responseLength} chars</div>
                      </div>
                      <div>
                        <span className="font-medium">Features Used:</span>
                        <div className="text-lg">{qualityMetrics.personalizationFeaturesUsed}</div>
                      </div>
                      <div>
                        <span className="font-medium">Memory References:</span>
                        <div className="text-lg">{qualityMetrics.memoryReferencesUsed}</div>
                      </div>
                    </div>
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Overall Quality</span>
                        <span className={`text-sm font-medium ${getQualityColor(qualityMetrics.qualityRating)}`}>
                          {qualityMetrics.qualityRating}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">Processing Time</span>
                          <span className="text-sm">{qualityMetrics.processingTime}ms</span>
                        </div>
                        <Progress 
                          value={Math.min(100, (qualityMetrics.processingTime / 2000) * 100)} 
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">Personalization Features</span>
                          <span className="text-sm">{qualityMetrics.personalizationFeaturesUsed}/5</span>
                        </div>
                        <Progress 
                          value={(qualityMetrics.personalizationFeaturesUsed / 5) * 100} 
                          className="h-2"
                        />
                      </div>
                      <div className="pt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Has Follow-ups:</span>
                          <Badge variant={qualityMetrics.hasFollowUps ? "default" : "secondary"}>
                            {qualityMetrics.hasFollowUps ? "Yes" : "No"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    Generate a response to see quality metrics
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            {insights ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Personalization Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-medium">{insights.profileMaturity}</div>
                        <div className="text-sm text-muted-foreground">Profile Maturity</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-medium">{insights.memoryUtilization}</div>
                        <div className="text-sm text-muted-foreground">Memory Utilization</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-medium">{insights.personalizationEffectiveness}</div>
                        <div className="text-sm text-muted-foreground">Effectiveness</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {insights.recommendedImprovements.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Recommended Improvements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {insights.recommendedImprovements.map((improvement, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span className="text-sm">{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    Generate responses to see personalization insights
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
