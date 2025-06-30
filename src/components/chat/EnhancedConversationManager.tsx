// Enhanced Conversation Manager with Memory System
// Phase 5: Personalization & Memory System - Task 2

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  MessageSquare, 
  Clock, 
  Search, 
  Archive, 
  Star, 
  Trash2, 
  Compress,
  Memory,
  Database,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConversationMemory } from '@/hooks/useConversationMemory';
import { formatDistanceToNow } from 'date-fns';
import {
  ConversationMessage,
  ConversationContext,
  ConversationMemory,
  MemorySearchResult,
  ContextType,
  MemoryType
} from '@/types/personalization';

interface EnhancedConversationManagerProps {
  conversationId?: string;
  onConversationSelect?: (conversationId: string) => void;
  onNewConversation?: () => void;
}

export function EnhancedConversationManager({
  conversationId,
  onConversationSelect,
  onNewConversation
}: EnhancedConversationManagerProps) {
  const { toast } = useToast();
  const {
    messages,
    context,
    memory,
    contextWindow,
    compressedContext,
    loading,
    error,
    loadMessages,
    saveContext,
    saveMemory,
    getContextWindow,
    compressContext,
    searchMemory,
    needsCompression,
    totalTokens,
    messageCount,
    contextCount,
    memoryCount
  } = useConversationMemory({
    conversationId,
    autoSave: true,
    maxTokens: 4000,
    compressionThreshold: 8000
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');

  /**
   * Handle memory search
   */
  const handleMemorySearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchMemory(searchQuery);
      setSearchResults(results);
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: 'Failed to search conversation memory',
        variant: 'destructive'
      });
    }
  }, [searchQuery, searchMemory, toast]);

  /**
   * Handle context compression
   */
  const handleCompressContext = useCallback(async () => {
    if (!conversationId) return;

    try {
      await compressContext();
      toast({
        title: 'Context Compressed',
        description: 'Conversation context has been compressed to save tokens'
      });
    } catch (error) {
      toast({
        title: 'Compression Failed',
        description: 'Failed to compress conversation context',
        variant: 'destructive'
      });
    }
  }, [conversationId, compressContext, toast]);

  /**
   * Handle context window generation
   */
  const handleGenerateContextWindow = useCallback(async () => {
    if (!conversationId) return;

    try {
      await getContextWindow();
      toast({
        title: 'Context Window Generated',
        description: 'Conversation context window has been updated'
      });
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate context window',
        variant: 'destructive'
      });
    }
  }, [conversationId, getContextWindow, toast]);

  /**
   * Save manual memory entry
   */
  const handleSaveMemory = useCallback(async (
    memoryType: MemoryType,
    key: string,
    data: Record<string, any>
  ) => {
    try {
      await saveMemory(memoryType, key, data, 0.8);
      toast({
        title: 'Memory Saved',
        description: `${memoryType} memory has been saved`
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save memory',
        variant: 'destructive'
      });
    }
  }, [saveMemory, toast]);

  // Auto-search when query changes
  useEffect(() => {
    const timeoutId = setTimeout(handleMemorySearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleMemorySearch]);

  const getStatusColor = (value: number, threshold: number) => {
    if (value >= threshold) return 'text-red-500';
    if (value >= threshold * 0.7) return 'text-yellow-500';
    return 'text-green-500';
  };

  const formatMemoryType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatContextType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Conversation Memory Manager
          </CardTitle>
          <CardDescription>
            Manage conversation memory, context, and intelligent summarization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{messageCount}</div>
              <div className="text-sm text-muted-foreground">Messages</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStatusColor(totalTokens, 8000)}`}>
                {totalTokens.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{contextCount}</div>
              <div className="text-sm text-muted-foreground">Context Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{memoryCount}</div>
              <div className="text-sm text-muted-foreground">Memories</div>
            </div>
          </div>

          {needsCompression && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compress className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    Context compression recommended ({totalTokens.toLocaleString()} tokens)
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={handleCompressContext}>
                  Compress Now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleGenerateContextWindow}>
          <Database className="h-4 w-4 mr-2" />
          Generate Context Window
        </Button>
        <Button variant="outline" onClick={handleCompressContext} disabled={!needsCompression}>
          <Compress className="h-4 w-4 mr-2" />
          Compress Context
        </Button>
        <Button variant="outline" onClick={() => loadMessages()}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Reload Messages
        </Button>
      </div>

      {/* Memory Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Memory Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Search conversation memory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            {searchResults.length > 0 && (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div key={result.id} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">
                          {formatMemoryType(result.memory_type)}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {(result.confidence_score * 100).toFixed(0)}% confidence
                          </Badge>
                          <Badge variant="outline">
                            {(result.relevance_score * 100).toFixed(0)}% relevance
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm font-medium">{result.memory_key}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Last accessed: {formatDistanceToNow(new Date(result.last_accessed))} ago
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="compression">Compression</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {conversationId ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Conversation ID:</span> {conversationId}
                    </div>
                    <div>
                      <span className="font-medium">Total Messages:</span> {messageCount}
                    </div>
                    <div>
                      <span className="font-medium">Total Tokens:</span> {totalTokens.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Compression Needed:</span> {needsCompression ? 'Yes' : 'No'}
                    </div>
                  </div>
                  
                  {contextWindow && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Context Window Status</h4>
                      <div className="p-3 bg-muted rounded-md">
                        <div className="text-sm">
                          Generated: {formatDistanceToNow(new Date(contextWindow.generated_at))} ago
                        </div>
                        <div className="text-sm">
                          Token Usage: {contextWindow.total_tokens} / {contextWindow.max_tokens}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No conversation selected
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="context" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Context</CardTitle>
              <CardDescription>
                Context data stored for this conversation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {context.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {context.map((ctx) => (
                      <div key={ctx.id} className="p-3 border rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">
                            {formatContextType(ctx.context_type)}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {(ctx.relevance_score * 100).toFixed(0)}% relevance
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {ctx.context_tokens} tokens
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Updated: {formatDistanceToNow(new Date(ctx.last_updated))} ago
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No context data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Memory</CardTitle>
              <CardDescription>
                Long-term memory stored across conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {memory.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {memory.map((mem) => (
                      <div key={mem.id} className="p-3 border rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">
                            {formatMemoryType(mem.memory_type)}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {(mem.confidence_score * 100).toFixed(0)}% confidence
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {mem.access_count} accesses
                            </span>
                          </div>
                        </div>
                        <div className="text-sm font-medium">{mem.memory_key}</div>
                        <div className="text-xs text-muted-foreground">
                          Last accessed: {formatDistanceToNow(new Date(mem.last_accessed))} ago
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No memory data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compression" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Context Compression</CardTitle>
              <CardDescription>
                Manage conversation context compression and summarization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {compressedContext ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Original Tokens:</span> {compressedContext.original_tokens?.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Compressed Tokens:</span> {compressedContext.compressed_tokens?.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Compression Ratio:</span> {((compressedContext.compression_ratio || 0) * 100).toFixed(1)}%
                    </div>
                    <div>
                      <span className="font-medium">Compressed At:</span> {compressedContext.compressed_at ? formatDistanceToNow(new Date(compressedContext.compressed_at)) + ' ago' : 'N/A'}
                    </div>
                  </div>
                  
                  {compressedContext.summary && (
                    <div>
                      <h4 className="font-medium mb-2">Summary</h4>
                      <div className="p-3 bg-muted rounded-md text-sm">
                        {compressedContext.summary}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No compression data available
                  {needsCompression && (
                    <div className="mt-4">
                      <Button onClick={handleCompressContext}>
                        <Compress className="h-4 w-4 mr-2" />
                        Compress Context Now
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
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
  );
}
