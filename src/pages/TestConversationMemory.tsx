// Test Page for Conversation Memory & Context Retention System
// Phase 5: Personalization & Memory System - Task 2

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
import { 
  Brain, 
  MessageSquare, 
  Database, 
  Memory, 
  Compress, 
  Search,
  Save,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConversationMemory } from '@/hooks/useConversationMemory';
import { EnhancedConversationManager } from '@/components/chat/EnhancedConversationManager';
import { formatDistanceToNow } from 'date-fns';
import { ContextType, MemoryType } from '@/types/personalization';

export default function TestConversationMemoryPage() {
  const { toast } = useToast();
  const [testConversationId, setTestConversationId] = useState('test-conversation-memory');
  const [testMessage, setTestMessage] = useState('');
  const [testMessageType, setTestMessageType] = useState<'user' | 'ai' | 'system'>('user');
  const [contextType, setContextType] = useState<ContextType>('summary');
  const [contextData, setContextData] = useState('');
  const [memoryType, setMemoryType] = useState<MemoryType>('user_profile');
  const [memoryKey, setMemoryKey] = useState('');
  const [memoryData, setMemoryData] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    messages,
    context,
    memory,
    contextWindow,
    compressedContext,
    loading,
    error,
    saveMessage,
    saveContext,
    saveMemory,
    getContextWindow,
    compressContext,
    searchMemory,
    needsCompression,
    totalTokens,
    messageCount
  } = useConversationMemory({
    conversationId: testConversationId,
    autoSave: true,
    maxTokens: 4000,
    compressionThreshold: 2000 // Lower threshold for testing
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSaveMessage = async () => {
    if (!testMessage.trim()) {
      toast({ title: 'Error', description: 'Please enter a message', variant: 'destructive' });
      return;
    }

    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await saveMessage(messageId, testMessageType, testMessage);
      toast({ title: 'Success', description: 'Message saved successfully' });
      setTestMessage('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save message', variant: 'destructive' });
    }
  };

  const handleSaveContext = async () => {
    if (!contextData.trim()) {
      toast({ title: 'Error', description: 'Please enter context data', variant: 'destructive' });
      return;
    }

    try {
      let data: Record<string, any>;
      try {
        data = JSON.parse(contextData);
      } catch {
        data = { content: contextData };
      }

      await saveContext(contextType, data);
      toast({ title: 'Success', description: 'Context saved successfully' });
      setContextData('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save context', variant: 'destructive' });
    }
  };

  const handleSaveMemory = async () => {
    if (!memoryKey.trim() || !memoryData.trim()) {
      toast({ title: 'Error', description: 'Please enter memory key and data', variant: 'destructive' });
      return;
    }

    try {
      let data: Record<string, any>;
      try {
        data = JSON.parse(memoryData);
      } catch {
        data = { content: memoryData };
      }

      await saveMemory(memoryType, memoryKey, data);
      toast({ title: 'Success', description: 'Memory saved successfully' });
      setMemoryKey('');
      setMemoryData('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save memory', variant: 'destructive' });
    }
  };

  const handleSearchMemory = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchMemory(searchQuery);
      setSearchResults(results);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to search memory', variant: 'destructive' });
    }
  };

  const handleGenerateContextWindow = async () => {
    try {
      await getContextWindow();
      toast({ title: 'Success', description: 'Context window generated successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate context window', variant: 'destructive' });
    }
  };

  const handleCompressContext = async () => {
    try {
      await compressContext();
      toast({ title: 'Success', description: 'Context compressed successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to compress context', variant: 'destructive' });
    }
  };

  const addSampleMessages = async () => {
    const sampleMessages = [
      { type: 'user' as const, content: 'Hello, I need help with my receipt management.' },
      { type: 'ai' as const, content: 'I\'d be happy to help you with receipt management! What specific task would you like assistance with?' },
      { type: 'user' as const, content: 'I want to analyze my spending patterns for the last month.' },
      { type: 'ai' as const, content: 'I can help you analyze your spending patterns. Let me gather your receipt data from the last month and create a comprehensive analysis.' },
      { type: 'user' as const, content: 'Can you show me which merchants I spend the most money at?' },
      { type: 'ai' as const, content: 'Based on your receipt data, here are your top merchants by spending amount. I\'ll also include frequency and average transaction amounts.' }
    ];

    try {
      for (const msg of sampleMessages) {
        const messageId = `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await saveMessage(messageId, msg.type, msg.content);
        // Small delay to ensure proper ordering
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      toast({ title: 'Success', description: 'Sample messages added successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add sample messages', variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet>
        <title>Conversation Memory Test - Mataresit</title>
        <meta name="description" content="Test conversation memory and context retention system" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Conversation Memory Test
          </h1>
          <p className="text-muted-foreground">
            Test conversation memory, context retention, and intelligent summarization
          </p>
        </div>

        {/* Status Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Memory System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{messageCount}</div>
                <p className="text-sm text-muted-foreground">Messages</p>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${totalTokens > 2000 ? 'text-red-500' : 'text-green-500'}`}>
                  {totalTokens.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">Tokens</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{context.length}</div>
                <p className="text-sm text-muted-foreground">Context Items</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{memory.length}</div>
                <p className="text-sm text-muted-foreground">Memories</p>
              </div>
            </div>
            
            {needsCompression && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compress className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      Context compression recommended
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCompressContext}>
                    Compress Now
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={addSampleMessages}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Sample Messages
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerateContextWindow}>
                <Zap className="h-4 w-4 mr-2" />
                Generate Context Window
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="testing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="testing">Testing Interface</TabsTrigger>
            <TabsTrigger value="manager">Memory Manager</TabsTrigger>
            <TabsTrigger value="data">Data Viewer</TabsTrigger>
          </TabsList>

          {/* Testing Interface Tab */}
          <TabsContent value="testing" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Save Message */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Save Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="conversation-id">Conversation ID</Label>
                    <Input
                      id="conversation-id"
                      value={testConversationId}
                      onChange={(e) => setTestConversationId(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="message-type">Message Type</Label>
                    <Select value={testMessageType} onValueChange={(value) => setTestMessageType(value as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="ai">AI</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="test-message">Message Content</Label>
                    <Textarea
                      id="test-message"
                      placeholder="Enter test message..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSaveMessage} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Save Message
                  </Button>
                </CardContent>
              </Card>

              {/* Save Context */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Save Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="context-type">Context Type</Label>
                    <Select value={contextType} onValueChange={(value) => setContextType(value as ContextType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="summary">Summary</SelectItem>
                        <SelectItem value="key_topics">Key Topics</SelectItem>
                        <SelectItem value="user_intent">User Intent</SelectItem>
                        <SelectItem value="important_facts">Important Facts</SelectItem>
                        <SelectItem value="action_items">Action Items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="context-data">Context Data (JSON)</Label>
                    <Textarea
                      id="context-data"
                      placeholder='{"key": "value"}'
                      value={contextData}
                      onChange={(e) => setContextData(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSaveContext} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Save Context
                  </Button>
                </CardContent>
              </Card>

              {/* Save Memory */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Memory className="h-5 w-5" />
                    Save Memory
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="memory-type">Memory Type</Label>
                    <Select value={memoryType} onValueChange={(value) => setMemoryType(value as MemoryType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user_profile">User Profile</SelectItem>
                        <SelectItem value="preferences">Preferences</SelectItem>
                        <SelectItem value="recurring_topics">Recurring Topics</SelectItem>
                        <SelectItem value="important_events">Important Events</SelectItem>
                        <SelectItem value="conversation_style">Conversation Style</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="memory-key">Memory Key</Label>
                    <Input
                      id="memory-key"
                      placeholder="e.g., preferred_analysis_type"
                      value={memoryKey}
                      onChange={(e) => setMemoryKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="memory-data">Memory Data (JSON)</Label>
                    <Textarea
                      id="memory-data"
                      placeholder='{"preference": "detailed_analysis"}'
                      value={memoryData}
                      onChange={(e) => setMemoryData(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSaveMemory} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Save Memory
                  </Button>
                </CardContent>
              </Card>

              {/* Search Memory */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Memory
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="search-query">Search Query</Label>
                    <Input
                      id="search-query"
                      placeholder="Search conversation memory..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSearchMemory} className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Search Memory
                  </Button>
                  
                  {searchResults.length > 0 && (
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {searchResults.map((result, index) => (
                          <div key={index} className="p-2 border rounded text-sm">
                            <div className="font-medium">{result.memory_key}</div>
                            <div className="text-muted-foreground">
                              {result.memory_type} - {(result.confidence_score * 100).toFixed(0)}% confidence
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Memory Manager Tab */}
          <TabsContent value="manager">
            <EnhancedConversationManager conversationId={testConversationId} />
          </TabsContent>

          {/* Data Viewer Tab */}
          <TabsContent value="data" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Context Window */}
              <Card>
                <CardHeader>
                  <CardTitle>Context Window</CardTitle>
                </CardHeader>
                <CardContent>
                  {contextWindow ? (
                    <div className="space-y-2 text-sm">
                      <div><strong>Generated:</strong> {formatDistanceToNow(new Date(contextWindow.generated_at))} ago</div>
                      <div><strong>Tokens:</strong> {contextWindow.total_tokens} / {contextWindow.max_tokens}</div>
                      <div><strong>Messages:</strong> {Array.isArray(contextWindow.messages) ? contextWindow.messages.length : 0}</div>
                      <Separator />
                      <pre className="text-xs overflow-auto max-h-32">
                        {JSON.stringify(contextWindow, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No context window generated
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Compressed Context */}
              <Card>
                <CardHeader>
                  <CardTitle>Compressed Context</CardTitle>
                </CardHeader>
                <CardContent>
                  {compressedContext ? (
                    <div className="space-y-2 text-sm">
                      <div><strong>Needs Compression:</strong> {compressedContext.needs_compression ? 'Yes' : 'No'}</div>
                      {compressedContext.original_tokens && (
                        <div><strong>Original Tokens:</strong> {compressedContext.original_tokens}</div>
                      )}
                      {compressedContext.compressed_tokens && (
                        <div><strong>Compressed Tokens:</strong> {compressedContext.compressed_tokens}</div>
                      )}
                      <Separator />
                      <pre className="text-xs overflow-auto max-h-32">
                        {JSON.stringify(compressedContext, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No compressed context available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {loading && (
          <div className="text-center py-4 text-muted-foreground">
            Loading conversation memory...
          </div>
        )}

        {error && (
          <div className="text-center py-4 text-red-500">
            Error: {error}
          </div>
        )}
      </div>
    </>
  );
}
