/**
 * Formatting Pipeline Demo Component
 * 
 * A development tool for visually testing and validating the formatting pipeline.
 * This component allows developers to input LLM responses and see how they are
 * processed through the complete formatting pipeline.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseUIComponents, analyzeMarkdownContent } from '@/lib/ui-component-parser';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { UIComponentRenderer } from '@/components/chat/ui-components/UIComponentRenderer';
import { Copy, Download, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

// Sample test inputs
const sampleInputs = {
  basicTable: `# Receipt Search Results

Found 3 receipts matching your criteria:

| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Weekly groceries |
| SHELL STATION | 17/01/2024 | MYR 80.00 | Fuel |

## Summary
• **Total Amount**: MYR 143.50
• **Date Range**: 15/01/2024 - 17/01/2024
• **Merchants**: 3 different stores`,

  financialAnalysis: `# Financial Analysis Summary

## Spending Overview
Your spending analysis for January 2024:

| Category | Amount | Percentage | Change |
|----------|--------|------------|--------|
| Groceries | MYR 245.30 | 45% | +12% |
| Fuel | MYR 180.00 | 33% | -5% |
| Dining | MYR 120.50 | 22% | +8% |

### Key Insights
• **Total Spent**: MYR 545.80
• **Average per Day**: MYR 17.61
• **Top Category**: Groceries (45% of spending)
• **Biggest Change**: Groceries increased by 12%

### Recommendations
1. Consider meal planning to reduce grocery costs
2. Look for fuel-efficient routes
3. Set dining budget alerts`,

  mixedContent: `# Search Results for "POWERCAT"

Found **7 receipts** matching your search criteria.

## Receipt Details
| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| SUPER SEVEN | 16/01/2024 | MYR 17.90 | POWERCAT 1.3KG |

\`\`\`json
{
  "type": "ui_component",
  "component": "summary_card",
  "data": {
    "title": "Total POWERCAT Purchases",
    "value": "MYR 125.30",
    "subtitle": "7 purchases this month",
    "trend": {
      "direction": "stable",
      "percentage": 0,
      "period": "vs last month"
    }
  },
  "metadata": {
    "title": "POWERCAT Summary",
    "interactive": false
  }
}
\`\`\`

All purchases are consistent at **MYR 17.90** each.`
};

export function FormattingPipelineDemo() {
  const [input, setInput] = useState(sampleInputs.basicTable);
  const [activeTab, setActiveTab] = useState('input');

  // Process the input through the formatting pipeline
  const pipelineResult = useMemo(() => {
    try {
      const analysis = analyzeMarkdownContent(input);
      const parseResult = parseUIComponents(input);
      
      return {
        success: true,
        analysis,
        parseResult,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        analysis: null,
        parseResult: null,
        error: error.message
      };
    }
  }, [input]);

  // Validation checks
  const validationChecks = useMemo(() => {
    if (!pipelineResult.success) return [];
    
    return [
      {
        name: 'Currency Format',
        passed: /MYR \d+\.\d{2}/.test(input),
        description: 'Uses "MYR 25.50" format'
      },
      {
        name: 'Date Format',
        passed: /\d{2}\/\d{2}\/\d{4}/.test(input),
        description: 'Uses DD/MM/YYYY format'
      },
      {
        name: 'Table Structure',
        passed: pipelineResult.analysis?.hasMarkdownTables || false,
        description: 'Contains properly formatted markdown tables'
      },
      {
        name: 'Header Hierarchy',
        passed: pipelineResult.analysis?.hasMarkdownHeaders || false,
        description: 'Uses markdown headers for organization'
      },
      {
        name: 'No Placeholders',
        passed: !/\{\{.*?\}\}/.test(input),
        description: 'No template placeholders like {{date}}'
      },
      {
        name: 'Component Generation',
        passed: (pipelineResult.parseResult?.components.length || 0) > 0,
        description: 'Successfully generates UI components'
      }
    ];
  }, [input, pipelineResult]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const loadSample = (sampleKey: keyof typeof sampleInputs) => {
    setInput(sampleInputs[sampleKey]);
    setActiveTab('input');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Formatting Pipeline Demo</h1>
        <p className="text-muted-foreground">
          Test and validate the complete formatting pipeline from LLM responses to UI components
        </p>
      </div>

      {/* Sample Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sample Inputs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => loadSample('basicTable')}>
              Basic Table
            </Button>
            <Button variant="outline" onClick={() => loadSample('financialAnalysis')}>
              Financial Analysis
            </Button>
            <Button variant="outline" onClick={() => loadSample('mixedContent')}>
              Mixed Content
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Input (LLM Response)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter LLM response with markdown formatting..."
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">
                {input.length} characters
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(input)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pipeline Results
              {pipelineResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="components">Components</TabsTrigger>
                <TabsTrigger value="validation">Validation</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="analysis" className="mt-4">
                <ScrollArea className="h-[350px]">
                  {pipelineResult.success && pipelineResult.analysis ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Content Analysis</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex justify-between">
                            <span>Tables:</span>
                            <Badge variant="secondary">
                              {pipelineResult.analysis.tableCount}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Headers:</span>
                            <Badge variant="secondary">
                              {pipelineResult.analysis.headerCount}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">Header Levels</h4>
                        <div className="flex gap-1 flex-wrap">
                          {pipelineResult.analysis.headerLevels.map((level, i) => (
                            <Badge key={i} variant="outline">
                              H{level}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Features Detected</h4>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {pipelineResult.analysis.hasMarkdownTables ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-400" />
                            )}
                            <span>Markdown Tables</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {pipelineResult.analysis.hasMarkdownHeaders ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-400" />
                            )}
                            <span>Markdown Headers</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-500">
                      Error: {pipelineResult.error}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="components" className="mt-4">
                <ScrollArea className="h-[350px]">
                  {pipelineResult.success && pipelineResult.parseResult ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Generated Components</h4>
                        <div className="space-y-2">
                          {pipelineResult.parseResult.components.map((component, i) => (
                            <div key={i} className="border rounded p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge>{component.component}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {component.metadata?.title}
                                </span>
                              </div>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                {JSON.stringify(component.data, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">Cleaned Content</h4>
                        <div className="bg-muted p-3 rounded text-sm">
                          {pipelineResult.parseResult.cleanedContent || 'No remaining content'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-500">
                      Error: {pipelineResult.error}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="validation" className="mt-4">
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3">
                    {validationChecks.map((check, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 border rounded">
                        {check.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium">{check.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {check.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <ScrollArea className="h-[350px]">
                  <div className="space-y-4">
                    {/* Render cleaned markdown content */}
                    {pipelineResult.success && pipelineResult.parseResult?.cleanedContent && (
                      <div>
                        <h4 className="font-semibold mb-2">Markdown Content</h4>
                        <div className="border rounded p-3">
                          <MarkdownRenderer 
                            content={pipelineResult.parseResult.cleanedContent}
                            variant="chat"
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Render UI components */}
                    {pipelineResult.success && pipelineResult.parseResult?.components.map((component, i) => (
                      <div key={i}>
                        <h4 className="font-semibold mb-2">
                          {component.component} Component
                        </h4>
                        <div className="border rounded p-3">
                          <UIComponentRenderer
                            component={component}
                            onAction={(action, data) => console.log('Action:', action, data)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
