/**
 * Content Synthesis Utilities for AI Vision Processing
 * Converts structured AI vision data into rich, searchable text content
 */

export interface ContentExtractionStrategy {
  synthetic_fulltext: string;
  merchant_context: string;
  transaction_summary: string;
  items_description: string;
  category_context: string;
  temporal_context: string;
  financial_context: string;
  behavioral_context: string;
}

export interface EmbeddingPriority {
  content_type: string;
  priority: 'high' | 'medium' | 'low';
  fallback_strategy: string;
  min_content_length: number;
}

export const EMBEDDING_PRIORITIES: EmbeddingPriority[] = [
  {
    content_type: 'synthetic_fulltext',
    priority: 'high',
    fallback_strategy: 'generate_from_structured_data',
    min_content_length: 10
  },
  {
    content_type: 'merchant',
    priority: 'high',
    fallback_strategy: 'use_business_directory_match',
    min_content_length: 2
  },
  {
    content_type: 'items_description',
    priority: 'medium',
    fallback_strategy: 'use_category_keywords',
    min_content_length: 5
  },
  {
    content_type: 'transaction_summary',
    priority: 'medium',
    fallback_strategy: 'use_amount_and_date',
    min_content_length: 8
  }
];

/**
 * Generate synthetic fullText from structured AI vision data
 */
export function generateSyntheticFullText(visionData: any): string {
  const parts: string[] = [];
  
  // Add merchant information
  if (visionData.merchant) {
    parts.push(`Merchant: ${visionData.merchant}`);
  }
  
  // Add transaction details
  if (visionData.total) {
    parts.push(`Total: ${visionData.currency || 'MYR'} ${visionData.total}`);
  }
  
  if (visionData.tax) {
    parts.push(`Tax: ${visionData.currency || 'MYR'} ${visionData.tax}`);
  }
  
  if (visionData.payment_method) {
    parts.push(`Payment Method: ${visionData.payment_method}`);
  }
  
  if (visionData.date) {
    parts.push(`Date: ${visionData.date}`);
  }
  
  // Add line items with rich descriptions
  if (visionData.line_items && visionData.line_items.length > 0) {
    parts.push('Items:');
    visionData.line_items.forEach((item: any, index: number) => {
      parts.push(`${index + 1}. ${item.description} - ${visionData.currency || 'MYR'} ${item.amount}`);
    });
  }
  
  // Add category if available
  if (visionData.predicted_category) {
    parts.push(`Category: ${visionData.predicted_category}`);
  }
  
  // Add AI suggestions as searchable text
  if (visionData.ai_suggestions && typeof visionData.ai_suggestions === 'object') {
    const suggestions = Object.entries(visionData.ai_suggestions)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (suggestions) {
      parts.push(`AI Insights: ${suggestions}`);
    }
  }
  
  return parts.filter(Boolean).join('\n');
}

/**
 * Extract merchant context with business type and payment info
 */
export function extractMerchantContext(visionData: any): string {
  const parts = [visionData.merchant || ''];
  
  // Add business type inference
  if (visionData.predicted_category) {
    parts.push(`Business Type: ${visionData.predicted_category}`);
  }
  
  // Add payment context that might indicate business type
  if (visionData.payment_method) {
    parts.push(`Accepts: ${visionData.payment_method}`);
  }
  
  return parts.filter(Boolean).join(' | ');
}

/**
 * Extract detailed items description for item-level search
 */
export function extractItemsDescription(visionData: any): string {
  if (!visionData.line_items || visionData.line_items.length === 0) {
    return '';
  }
  
  return visionData.line_items
    .map((item: any) => `${item.description} (${item.amount})`)
    .join(', ');
}

/**
 * Extract transaction summary for financial pattern search
 */
export function extractTransactionSummary(visionData: any): string {
  const parts = [];
  
  if (visionData.total) {
    parts.push(`${visionData.currency || 'MYR'} ${visionData.total} transaction`);
  }
  
  if (visionData.payment_method) {
    parts.push(`paid by ${visionData.payment_method}`);
  }
  
  if (visionData.date) {
    parts.push(`on ${visionData.date}`);
  }
  
  return parts.join(' ');
}

/**
 * Extract category context with AI insights
 */
export function extractCategoryContext(visionData: any): string {
  const parts = [];
  
  if (visionData.predicted_category) {
    parts.push(visionData.predicted_category);
  }
  
  // Add contextual keywords based on category
  if (visionData.predicted_category) {
    const categoryKeywords = getCategoryKeywords(visionData.predicted_category);
    if (categoryKeywords) {
      parts.push(categoryKeywords);
    }
  }
  
  return parts.join(' ');
}

/**
 * Extract temporal context for date-based search
 */
export function extractTemporalContext(visionData: any): string {
  if (!visionData.date) return '';
  
  const date = new Date(visionData.date);
  const parts = [visionData.date];
  
  // Add day of week
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  parts.push(dayOfWeek);
  
  // Add month name
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });
  parts.push(monthName);
  
  // Add year
  parts.push(date.getFullYear().toString());
  
  return parts.join(' ');
}

/**
 * Extract financial context for amount-based search
 */
export function extractFinancialContext(visionData: any): string {
  const parts = [];
  
  if (visionData.total) {
    const amount = parseFloat(visionData.total);
    parts.push(`${visionData.currency || 'MYR'} ${amount}`);
    
    // Add amount range categories
    if (amount < 10) parts.push('small purchase');
    else if (amount < 50) parts.push('medium purchase');
    else if (amount < 200) parts.push('large purchase');
    else parts.push('major purchase');
  }
  
  if (visionData.tax) {
    parts.push(`tax ${visionData.tax}`);
  }
  
  return parts.join(' ');
}

/**
 * Extract behavioral context for payment pattern search
 */
export function extractBehavioralContext(visionData: any): string {
  const parts = [];
  
  if (visionData.payment_method) {
    parts.push(visionData.payment_method);
    
    // Add payment type categories
    if (visionData.payment_method.toLowerCase().includes('cash')) {
      parts.push('cash payment');
    } else if (visionData.payment_method.toLowerCase().includes('card')) {
      parts.push('card payment');
    } else if (visionData.payment_method.toLowerCase().includes('digital')) {
      parts.push('digital payment');
    }
  }
  
  return parts.join(' ');
}

/**
 * Get category-specific keywords for enhanced search
 */
function getCategoryKeywords(category: string): string {
  const keywordMap: Record<string, string> = {
    'Food & Dining': 'restaurant food meal dining eat drink',
    'Groceries': 'grocery food shopping supermarket market',
    'Transportation': 'transport travel taxi bus train fuel gas',
    'Shopping': 'retail purchase buy store mall',
    'Entertainment': 'entertainment fun leisure activity',
    'Healthcare': 'medical health doctor pharmacy clinic',
    'Utilities': 'utility bill electricity water internet',
    'Other': 'miscellaneous general expense'
  };
  
  return keywordMap[category] || '';
}

/**
 * Main function to synthesize all content types from vision data
 */
export function synthesizeReceiptContent(visionData: any): ContentExtractionStrategy {
  return {
    synthetic_fulltext: generateSyntheticFullText(visionData),
    merchant_context: extractMerchantContext(visionData),
    transaction_summary: extractTransactionSummary(visionData),
    items_description: extractItemsDescription(visionData),
    category_context: extractCategoryContext(visionData),
    temporal_context: extractTemporalContext(visionData),
    financial_context: extractFinancialContext(visionData),
    behavioral_context: extractBehavioralContext(visionData)
  };
}

/**
 * Validate content quality and provide fallbacks
 */
export function validateAndEnhanceContent(content: ContentExtractionStrategy, visionData: any): ContentExtractionStrategy {
  // Ensure synthetic_fulltext has minimum content
  if (content.synthetic_fulltext.length < 10) {
    content.synthetic_fulltext = generateFallbackFullText(visionData);
  }

  // Ensure merchant context exists
  if (!content.merchant_context && visionData.merchant) {
    content.merchant_context = visionData.merchant;
  }

  return content;
}

/**
 * Generate fallback fullText when primary synthesis fails
 */
function generateFallbackFullText(visionData: any): string {
  const parts = [];

  if (visionData.merchant) parts.push(visionData.merchant);
  if (visionData.total) parts.push(`${visionData.total}`);
  if (visionData.date) parts.push(visionData.date);
  if (visionData.predicted_category) parts.push(visionData.predicted_category);

  return parts.length > 0 ? parts.join(' ') : 'Receipt processed by AI Vision';
}
