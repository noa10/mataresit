Based on the codebase context, I'll provide specific improvements to enhance the formatting of chatbot responses.

## 1. Modifying Response Generation Code

The main issue in the image is that receipt data is displayed as a plain text table, which is hard to read. Let's improve this in `enhanced-response-generation.ts`:

````typescript path=supabase/functions/unified-search/enhanced-response-generation.ts mode=EDIT
/**
 * Parse structured response from LLM output
 */
function parseStructuredResponse(responseText: string): { content: string; rawComponents?: any[] } {
  // Look for JSON blocks in the response
  const jsonBlockRegex = /```(?:json|ui_component)\s*\n([\s\S]*?)\n```/g;
  const rawComponents: any[] = [];
  let cleanedContent = responseText;

  // Look for markdown tables and convert them to UI components
  const markdownTableRegex = /\|(.+)\|\n\|(?:-+\|)+\n((?:\|.+\|\n)+)/g;
  let tableMatch;
  while ((tableMatch = markdownTableRegex.exec(responseText)) !== null) {
    try {
      const headers = tableMatch[1].split('|').map(h => h.trim()).filter(Boolean);
      const rows = tableMatch[2].split('\n').filter(row => row.trim().length > 0)
        .map(row => row.split('|').map(cell => cell.trim()).filter(Boolean));
      
      // Create a data_table component
      const tableComponent = {
        type: 'ui_component',
        component: 'data_table',
        data: {
          headers,
          rows
        },
        metadata: {
          title: 'Data Table',
          interactive: true
        }
      };
      
      rawComponents.push(tableComponent);
      // Remove the markdown table from content
      cleanedContent = cleanedContent.replace(tableMatch[0], '').trim();
    } catch {
      // Skip invalid table format
    }
  }

  // Process JSON blocks
  let match;
  while ((match = jsonBlockRegex.exec(responseText)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      if (jsonData.type === 'ui_component') {
        rawComponents.push(jsonData);
        // Remove the JSON block from content
        cleanedContent = cleanedContent.replace(match[0], '').trim();
      }
    } catch {
      // Skip invalid JSON blocks
    }
  }

  return {
    content: cleanedContent,
    rawComponents: rawComponents.length > 0 ? rawComponents : undefined
  };
}
````

## 2. Changes to Response Parsing Functions

Let's enhance the `parseStructuredResponse` function in `_shared/response-generator.ts` to support more formatting elements:

````typescript path=supabase/functions/_shared/response-generator.ts mode=EDIT
/**
 * Parse structured response from LLM output
 */
async function parseStructuredResponse(
  responseText: string,
  template: PromptTemplate
): Promise<{ content: string; uiComponents?: any[] }> {
  if (template.outputFormat.type === 'json') {
    try {
      const parsed = JSON.parse(responseText);
      return {
        content: parsed.content || parsed.response || responseText,
        uiComponents: parsed.uiComponents || []
      };
    } catch {
      // If JSON parsing fails, treat as text
      return { content: responseText };
    }
  }

  if (template.outputFormat.type === 'structured') {
    // Look for JSON blocks in the response
    const jsonBlockRegex = /```(?:json|ui_component)\s*\n([\s\S]*?)\n```/g;
    const uiComponents: any[] = [];
    let cleanedContent = responseText;

    // Process markdown formatting elements
    // 1. Convert markdown tables to data_table components
    const markdownTableRegex = /\|(.+)\|\n\|(?:-+\|)+\n((?:\|.+\|\n)+)/g;
    let tableMatch;
    while ((tableMatch = markdownTableRegex.exec(responseText)) !== null) {
      try {
        const headers = tableMatch[1].split('|').map(h => h.trim()).filter(Boolean);
        const rows = tableMatch[2].split('\n').filter(row => row.trim().length > 0)
          .map(row => row.split('|').map(cell => cell.trim()).filter(Boolean));
        
        uiComponents.push({
          type: 'ui_component',
          component: 'data_table',
          data: { headers, rows },
          metadata: { title: 'Data Table' }
        });
        
        // Remove the markdown table from content
        cleanedContent = cleanedContent.replace(tableMatch[0], '').trim();
      } catch {
        // Skip invalid table format
      }
    }

    // 2. Convert markdown headers to section components
    const headerRegex = /^(#{1,3})\s+(.+)$/gm;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(responseText)) !== null) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();
      
      uiComponents.push({
        type: 'ui_component',
        component: 'section_header',
        data: { title, level },
        metadata: { }
      });
    }

    // Process JSON blocks
    let match;
    while ((match = jsonBlockRegex.exec(responseText)) !== null) {
      try {
        const jsonData = JSON.parse(match[1]);
        if (jsonData.type === 'ui_component') {
          uiComponents.push(jsonData);
          // Remove the JSON block from content
          cleanedContent = cleanedContent.replace(match[0], '').trim();
        }
      } catch {
        // Skip invalid JSON blocks
      }
    }

    return {
      content: cleanedContent,
      uiComponents: uiComponents.length > 0 ? uiComponents : undefined
    };
  }

  return { content: responseText };
}
````

## 3. Implementation in Enhanced Response Generation

Let's modify the `generateEnhancedResponse` function to include formatting instructions in the prompt:

````typescript path=supabase/functions/unified-search/enhanced-response-generation.ts mode=EDIT
/**
 * Build enhanced prompt with context injection
 */
function buildEnhancedPrompt(
  context: EnhancedResponseContext,
  strategy: ResponseStrategy
): string {
  let prompt = strategy.systemPrompt;

  // Add formatting instructions
  prompt += `\n\nFORMATTING REQUIREMENTS:
- Use markdown formatting for better readability
- For tabular data, use proper markdown tables with headers and aligned columns
- Use headers (# for main headers, ## for subheaders) to organize information
- For receipt data, always format as a table with columns: Merchant | Date | Amount | Description
- Use bullet points (•) for lists of items
- For financial summaries, include a summary section with key metrics
- When showing multiple receipts, use a consistent table format rather than plain text`;

  // Add user profile context
  if (context.userProfile) {
    prompt += `\n\nUser Profile:
• Currency: ${context.userProfile.currency || 'MYR'}
• Date format: ${context.userProfile.dateFormat || 'DD/MM/YYYY'}
• Subscription: ${context.userProfile.subscriptionTier || 'Free'}`;
  }

  // Rest of the function remains the same
  // ...
````

## 4. Converting Raw Data to Formatted Tables

Let's enhance the `generateUIComponents` function to better handle receipt data:

````typescript path=supabase/functions/unified-search/enhanced-response-generation.ts mode=EDIT
/**
 * Generate UI components based on search results
 */
async function generateUIComponents(
  context: EnhancedResponseContext,
  parsedResponse: { content: string; rawComponents?: any[] }
): Promise<any[]> {
  const components: any[] = [];
  const intent = context.preprocessResult.intent;
  
  // Add any components from the parsed response
  if (parsedResponse.rawComponents && parsedResponse.rawComponents.length > 0) {
    components.push(...parsedResponse.rawComponents);
  }
  
  // Generate receipt cards for document retrieval intents
  if (intent === 'document_retrieval' || intent === 'financial_analysis') {
    const receiptResults = context.searchResults.filter(result => 
      result.sourceType === 'receipt' || result.contentType === 'receipt'
    );
    
    // Create a receipt table component for better organization
    if (receiptResults.length > 0) {
      const tableHeaders = ['Merchant', 'Date', 'Amount', 'Category', 'Items'];
      const tableRows = receiptResults.map(result => [
        result.metadata?.merchant || result.title || 'Unknown',
        formatDate(result.metadata?.date || result.createdAt),
        formatCurrency(result.metadata?.total || result.metadata?.amount || 0, result.metadata?.currency || 'MYR'),
        result.metadata?.category || result.metadata?.predicted_category || 'Other',
        result.metadata?.line_items_count ? `${result.metadata.line_items_count} items` : '-'
      ]);
      
      components.push({
        type: 'ui_component',
        component: 'data_table',
        data: {
          headers: tableHeaders,
          rows: tableRows,
          sortable: true,
          filterable: true
        },
        metadata: {
          title: 'Receipt Summary',
          interactive: true
        }
      });
    }

    // Add individual receipt cards for detailed view
    receiptResults.forEach(result => {
      components.push({
        type: 'ui_component',
        component: 'receipt_card',
        data: {
          receipt_id: result.sourceId,
          merchant: result.metadata?.merchant || result.title || 'Unknown Merchant',
          total: result.metadata?.total || result.metadata?.amount || 0,
          currency: result.metadata?.currency || 'MYR',
          date: result.metadata?.date || result.createdAt || new Date().toISOString().split('T')[0],
          category: result.metadata?.category || result.metadata?.predicted_category,
          confidence: result.similarity || 0.8,
          line_items_count: result.metadata?.line_items_count,
          tags: result.metadata?.tags || []
        },
        metadata: {
          title: 'Receipt Card',
          interactive: true,
          actions: ['view_receipt', 'edit_receipt']
        }
      });
    });

    // Add enhanced summary metadata for better presentation
    if (receiptResults.length > 0) {
      const summaryData = generateSearchSummary(receiptResults, context.originalQuery);
      
      // Add summary card component
      components.unshift({
        type: 'ui_component',
        component: 'summary_card',
        data: {
          title: 'Search Results Summary',
          metrics: [
            { label: 'Total Amount', value: summaryData.totalAmount, format: 'currency' },
            { label: 'Receipts Found', value: summaryData.totalResults, format: 'number' },
            { label: 'Date Range', value: `${formatDate(summaryData.dateRange.earliest)} - ${formatDate(summaryData.dateRange.latest)}`, format: 'text' },
            { label: 'Merchants', value: summaryData.merchantCount, format: 'number' }
          ]
        },
        metadata: {
          searchSummary: summaryData
        }
      });
    }
  }
  
  return components;
}

// Helper functions for formatting
function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateString;
  }
}

function formatCurrency(amount: number, currency: string = 'MYR'): string {
  return `${currency} ${amount.toFixed(2)}`;
}
````

## 5. Modifications for Chat UI Display

To ensure these formatted responses display correctly, we need to update the response structure:

````typescript path=supabase/functions/unified-search/enhanced-response-generation.ts mode=EDIT
export interface EnhancedResponse {
  content: string;
  uiComponents: any[];
  followUpSuggestions: string[];
  confidence: number;
  responseType: 'success' | 'partial' | 'empty' | 'error';
  metadata: {
    templateUsed: string;
    processingTime: number;
    tokensUsed?: number;
    modelUsed: string;
    selfCorrectionApplied?: boolean;
    toolCallsExecuted?: number;
    criticAnalysis?: any;
    formattingApplied?: boolean;
    contentStructure?: {
      hasTables: boolean;
      hasHeaders: boolean;
      hasLists: boolean;
      sectionsCount: number
    }
  };
  toolResults?: ToolCallResult[];
  selfCorrectionData?: SelfCorrectionResult;
}

/**
 * Generate enhanced response using advanced prompt engineering
 */
export async function generateEnhancedResponse(
  context: EnhancedResponseContext
): Promise<EnhancedResponse> {
  // Existing implementation...
  
  // Before returning the response, analyze content structure
  const contentStructure = analyzeContentStructure(parsedResponse.content);
  
  return {
    content: parsedResponse.content || finalResponseText,
    uiComponents,
    followUpSuggestions,
    confidence,
    responseType,
    metadata: {
      templateUsed: responseStrategy.templateId,
      processingTime: Date.now() - startTime,
      tokensUsed: result.response.usageMetadata?.totalTokenCount,
      modelUsed: 'gemini-1.5-flash',
      toolCallsExecuted: toolResults.length,
      formattingApplied: true,
      contentStructure
    },
    toolResults: toolResults.length > 0 ? toolResults : undefined
  };
}

/**
 * Analyze content structure to help UI rendering
 */
function analyzeContentStructure(content: string): {
  hasTables: boolean;
  hasHeaders: boolean;
  hasLists: boolean;
  sectionsCount: number
} {
  return {
    hasTables: /\|(.+)\|\n\|(?:-+\|)+\n/.test(content),
    hasHeaders: /^#{1,3}\s+.+$/m.test(content),
    hasLists: /^[*-]\s+.+$/m.test(content),
    sectionsCount: (content.match(/^#{1,3}\s+.+$/gm) || []).length
  };
}
````

These changes will significantly improve the formatting of chatbot responses by:

1. Adding markdown formatting instructions to the prompt
2. Converting markdown tables to interactive data_table components
3. Parsing and preserving headers and sections in the content
4. Creating structured receipt tables instead of plain text listings
5. Adding metadata about content structure to help the UI render appropriately

The UI will need to interpret markdown in the content field and render the uiComponents array as interactive elements, which will transform the text-heavy response in your screenshot into a well-organized, visually appealing interface with proper tables and sections.
