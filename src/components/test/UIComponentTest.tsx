/**
 * UI Component Test Page
 * 
 * Test page for validating the actionable UI components system
 * in the chat interface.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { parseUIComponents, generateSampleComponent } from '@/lib/ui-component-parser';
import { UIComponent } from '@/types/ui-components';
import { toast } from 'sonner';

export default function UIComponentTest() {
  const [testContent, setTestContent] = useState('');
  const [parseResult, setParseResult] = useState<any>(null);
  const [testMessages, setTestMessages] = useState<any[]>([]);

  // Sample JSON blocks for testing
  const sampleJSONBlocks = {
    receiptCard: `Here's a receipt I found for you:

\`\`\`ui_component
{
  "type": "ui_component",
  "component": "receipt_card",
  "data": {
    "receipt_id": "receipt-123",
    "merchant": "Starbucks Coffee",
    "total": 15.75,
    "currency": "MYR",
    "date": "2024-01-15",
    "category": "Food & Dining",
    "confidence": 0.95,
    "line_items_count": 3,
    "tags": ["coffee", "breakfast"]
  },
  "metadata": {
    "title": "Receipt Summary",
    "interactive": true,
    "actions": ["view_details", "edit", "categorize"]
  }
}
\`\`\`

This receipt shows your purchase at Starbucks. You can click the buttons to view more details or edit the information.`,

    actionButton: `I can help you with that! Here are some quick actions:

\`\`\`ui_component
{
  "type": "ui_component",
  "component": "action_button",
  "data": {
    "action": "upload_receipt",
    "label": "Upload New Receipt",
    "variant": "primary",
    "icon": "upload"
  },
  "metadata": {
    "title": "Quick Action",
    "interactive": true
  }
}
\`\`\`

Click the button above to upload a new receipt for processing.`,

    multipleComponents: `Based on your spending analysis, here are your results:

\`\`\`ui_component
{
  "type": "ui_component",
  "component": "receipt_card",
  "data": {
    "receipt_id": "receipt-456",
    "merchant": "McDonald's",
    "total": 12.50,
    "currency": "MYR",
    "date": "2024-01-14",
    "category": "Food & Dining",
    "confidence": 0.88
  },
  "metadata": {
    "title": "Recent Receipt",
    "interactive": true
  }
}
\`\`\`

\`\`\`ui_component
{
  "type": "ui_component",
  "component": "action_button",
  "data": {
    "action": "view_analytics",
    "label": "View Full Analytics",
    "variant": "secondary",
    "icon": "chart"
  },
  "metadata": {
    "title": "Analytics Action",
    "interactive": true
  }
}
\`\`\`

You can view the receipt details above or click to see your full spending analytics.`
  };

  // Handle parsing test content
  const handleParseTest = () => {
    if (!testContent.trim()) {
      toast.error('Please enter some content to test');
      return;
    }

    const result = parseUIComponents(testContent);
    setParseResult(result);

    if (result.success) {
      toast.success(`Parsed ${result.components.length} UI components successfully`);
    } else {
      toast.error(`Parsing failed: ${result.errors?.join(', ')}`);
    }
  };

  // Handle adding test message to chat
  const handleAddToChat = () => {
    if (!parseResult) {
      toast.error('Please parse content first');
      return;
    }

    const newMessage = {
      id: `test-${Date.now()}`,
      type: 'ai' as const,
      content: testContent,
      timestamp: new Date(),
      uiComponents: parseResult.components, // Include parsed components
    };

    setTestMessages(prev => [...prev, newMessage]);
    toast.success('Added message to test chat');
  };

  // Handle loading sample content
  const handleLoadSample = (sampleKey: keyof typeof sampleJSONBlocks) => {
    setTestContent(sampleJSONBlocks[sampleKey]);
    setParseResult(null);
  };

  // Handle clearing test data
  const handleClear = () => {
    setTestContent('');
    setParseResult(null);
    setTestMessages([]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">UI Component Test</h1>
        <p className="text-muted-foreground">
          Test the actionable UI components system for the chat interface
        </p>
      </div>

      {/* Sample Content Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => handleLoadSample('receiptCard')}
            >
              Receipt Card Sample
            </Button>
            <Button
              variant="outline"
              onClick={() => handleLoadSample('actionButton')}
            >
              Action Button Sample
            </Button>
            <Button
              variant="outline"
              onClick={() => handleLoadSample('multipleComponents')}
            >
              Multiple Components Sample
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Input */}
      <Card>
        <CardHeader>
          <CardTitle>Test Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter content with JSON blocks to test..."
            value={testContent}
            onChange={(e) => setTestContent(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={handleParseTest}>
              Parse Components
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleAddToChat}
              disabled={!parseResult?.success}
            >
              Add to Test Chat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Parse Results */}
      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Parse Results
              <Badge variant={parseResult.success ? 'default' : 'destructive'}>
                {parseResult.success ? 'Success' : 'Failed'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Components Found: {parseResult.components.length}</h4>
              {parseResult.components.map((component: UIComponent, index: number) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <div className="font-mono text-sm">
                    <div><strong>Type:</strong> {component.component}</div>
                    <div><strong>Title:</strong> {component.metadata.title}</div>
                    <div><strong>Interactive:</strong> {component.metadata.interactive ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              ))}
            </div>

            {parseResult.errors && (
              <div>
                <h4 className="font-medium mb-2 text-destructive">Errors:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {parseResult.errors.map((error: string, index: number) => (
                    <li key={index} className="text-sm text-destructive">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="font-medium mb-2">Cleaned Content:</h4>
              <div className="p-3 bg-muted rounded-lg text-sm">
                {parseResult.cleanedContent || 'No content after parsing'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Chat */}
      {testMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {testMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onCopy={(content) => toast.success('Copied to clipboard')}
                  onFeedback={(id, feedback) => toast.info(`Feedback: ${feedback}`)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
