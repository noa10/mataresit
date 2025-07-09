import { SearchResult, ReceiptWithSimilarity, LineItemSearchResult } from './ai-search';
import { formatCurrencyAmount } from './currency-converter';

export interface ExtractedKeywords {
  primaryTerms: string[];
  originalQuery: string;
  queryType: 'item' | 'merchant' | 'category' | 'amount' | 'date' | 'general';
  confidence: 'high' | 'medium' | 'low';
}

export interface MonetaryFilterInfo {
  min?: number;
  max?: number;
  currency?: string;
  originalAmount?: number;
  originalMaxAmount?: number;
  originalCurrency?: string;
  conversionInfo?: {
    conversionApplied: boolean;
    reasoning: string;
    exchangeRate?: number;
    convertedAmount?: { amount: number; currency: string };
  };
}

/**
 * Extract key search terms from a natural language query
 */
export function extractKeywords(query: string): ExtractedKeywords {
  const originalQuery = query.trim();
  const lowerQuery = originalQuery.toLowerCase();
  
  // Remove common conversational phrases
  const conversationalPhrases = [
    'can you check for',
    'how about',
    'find me',
    'search for',
    'look for',
    'show me',
    'do you have',
    'any',
    'please',
    'could you',
    'would you',
    'i need',
    'i want',
    'i\'m looking for'
  ];
  
  let cleanedQuery = lowerQuery;
  conversationalPhrases.forEach(phrase => {
    cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), '').trim();
  });
  
  // Remove question words and punctuation
  cleanedQuery = cleanedQuery
    .replace(/\b(what|where|when|how|why|which)\b/gi, '')
    .replace(/[?!.,;:]/g, '')
    .trim();
  
  // Split into potential keywords and filter out common words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can'];
  
  const words = cleanedQuery.split(/\s+/).filter(word => 
    word.length > 1 && !stopWords.includes(word)
  );
  
  // Determine query type and confidence
  let queryType: ExtractedKeywords['queryType'] = 'general';
  let confidence: ExtractedKeywords['confidence'] = 'medium';
  
  // Check for amount patterns
  if (/\$\d+|\d+\s*(dollar|cent|price|cost|amount)/i.test(originalQuery)) {
    queryType = 'amount';
    confidence = 'high';
  }
  // Check for date patterns
  else if (/\b(yesterday|today|tomorrow|last\s+week|this\s+week|last\s+month|this\s+month|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{4})\b/i.test(originalQuery)) {
    queryType = 'date';
    confidence = 'high';
  }
  // Check for merchant patterns (store names, restaurants)
  else if (/\b(store|shop|restaurant|cafe|market|mall|pharmacy|gas\s+station|supermarket|grocery)\b/i.test(originalQuery) || 
           /\b(walmart|target|costco|amazon|starbucks|mcdonalds|subway)\b/i.test(originalQuery)) {
    queryType = 'merchant';
    confidence = 'high';
  }
  // Check for category patterns
  else if (/\b(food|grocery|groceries|dining|entertainment|gas|fuel|clothing|electronics|health|medical|pharmacy|books|travel|transportation)\b/i.test(originalQuery)) {
    queryType = 'category';
    confidence = 'high';
  }
  // If we have specific product terms, it's likely an item search
  else if (words.length > 0 && words.length <= 3) {
    queryType = 'item';
    confidence = words.length === 1 ? 'high' : 'medium';
  }
  
  return {
    primaryTerms: words,
    originalQuery,
    queryType,
    confidence
  };
}

/**
 * Generate contextual "not found" responses with monetary filter support
 */
export function generateNotFoundResponse(
  keywords: ExtractedKeywords,
  monetaryFilter?: MonetaryFilterInfo
): string {
  const { primaryTerms, queryType, confidence } = keywords;
  const mainTerm = primaryTerms.length > 0 ? primaryTerms.join(' ') : keywords.originalQuery;

  // Special handling for monetary queries
  if (queryType === 'amount' && monetaryFilter) {
    return generateMonetaryNotFoundResponse(monetaryFilter);
  }

  // Base responses for different scenarios
  const responses = {
    highConfidenceItem: [
      `I searched for "${mainTerm}" but couldn't find any matching items in your receipts. Would you like to try a different spelling or search for another product?`,
      `No luck finding "${mainTerm}" this time. Perhaps try checking the spelling or using a different product name?`,
      `I didn't find any results for "${mainTerm}". You could try searching for a broader category or the store name where you might have bought it.`
    ],

    mediumConfidenceItem: [
      `I looked for "${mainTerm}" but came up empty. If you're looking for a specific product, try using just the main product name.`,
      `Hmm, I didn't find anything for "${mainTerm}". You might want to try a more specific product name or check the spelling.`
    ],

    merchant: [
      `I couldn't find any receipts from "${mainTerm}". Double-check the store name spelling, or try searching for items you bought there instead.`,
      `No receipts found for "${mainTerm}". Perhaps try the full store name or search by what you purchased there?`
    ],

    category: [
      `I didn't find any ${mainTerm} purchases in your receipts. Try being more specific about the item or store name.`,
      `No ${mainTerm} items found. You could search for specific products in this category or the stores where you shop for these items.`
    ],

    amount: [
      `I couldn't find any receipts matching that amount criteria. Try adjusting the price range or combining it with other search terms.`,
      `No results for that price range. You might want to try a broader amount range or add item or store details.`
    ],

    date: [
      `I didn't find any receipts for that time period. Try expanding the date range or adding specific items or stores to search for.`,
      `No receipts found for those dates. Perhaps try a different time period or combine with item or store names.`
    ],

    general: [
      `I tried searching for "${keywords.originalQuery}" but didn't find any results. For better results, try using specific item names, store names, or dates.`,
      `I couldn't find anything matching "${keywords.originalQuery}". Try rephrasing with more specific terms like product names or store names.`,
      `No matches found for "${keywords.originalQuery}". Remember, I can search by item name, store, date, or even amounts. How about trying one of those?`
    ],

    lowConfidence: [
      `I tried searching for "${keywords.originalQuery}" but didn't find any results. For more precise results, try using just the key terms, like "${mainTerm}".`,
      `I couldn't find anything for "${keywords.originalQuery}". Try simplifying your search to just the main product or store name.`
    ]
  };

  // Select appropriate response category
  let responseCategory: keyof typeof responses;

  if (confidence === 'low') {
    responseCategory = 'lowConfidence';
  } else if (queryType === 'item' && confidence === 'high') {
    responseCategory = 'highConfidenceItem';
  } else if (queryType === 'item') {
    responseCategory = 'mediumConfidenceItem';
  } else {
    responseCategory = queryType;
  }

  // Get random response from the appropriate category
  const categoryResponses = responses[responseCategory] || responses.general;
  const randomIndex = Math.floor(Math.random() * categoryResponses.length);

  return categoryResponses[randomIndex];
}

/**
 * Generate specialized "not found" response for monetary queries
 */
function generateMonetaryNotFoundResponse(monetaryFilter: MonetaryFilterInfo): string {
  const { min, max, originalAmount, originalMaxAmount, originalCurrency } = monetaryFilter;
  const displayCurrency = originalCurrency || 'MYR';

  // Build filter description
  const filterParts: string[] = [];

  if (min !== undefined && min > 0) {
    const displayAmount = originalAmount || min;
    const formattedAmount = formatCurrencyAmount({ amount: displayAmount, currency: displayCurrency });
    filterParts.push(`over ${formattedAmount}`);
  }

  if (max !== undefined && max < Number.MAX_SAFE_INTEGER) {
    const displayAmount = originalMaxAmount || max;
    const formattedAmount = formatCurrencyAmount({ amount: displayAmount, currency: displayCurrency });
    filterParts.push(`under ${formattedAmount}`);
  }

  const filterDescription = filterParts.length > 0 ? ` ${filterParts.join(' and ')}` : '';

  let response = `I couldn't find any receipts${filterDescription}.`;

  // Add helpful suggestions
  const suggestions = [
    'Try adjusting your amount range',
    'Check if you have receipts in that price range',
    'Consider using a broader price range'
  ];

  response += ` ${suggestions[Math.floor(Math.random() * suggestions.length)]}.`;

  // Add conversion note if applicable
  if (monetaryFilter.conversionInfo?.conversionApplied) {
    response += `\n\n*Note: ${monetaryFilter.conversionInfo.reasoning}*`;
  }

  return response;
}

/**
 * Generate contextual success responses with monetary filter information
 */
export function generateSuccessResponse(
  results: SearchResult,
  keywords: ExtractedKeywords,
  monetaryFilter?: MonetaryFilterInfo
): string {
  const { primaryTerms, queryType } = keywords;
  const mainTerm = primaryTerms.length > 0 ? primaryTerms.join(' ') : keywords.originalQuery;
  const totalResults = results.total || 0;
  const displayedResults = results.results?.length || 0;

  // Analyze result types
  const receipts = results.results?.filter(r => 'merchant' in r) || [];
  const lineItems = results.results?.filter(r => 'line_item_description' in r) || [];

  // Generate conversational, concise response
  return generateConversationalResponse(
    mainTerm,
    totalResults,
    receipts,
    lineItems,
    queryType,
    monetaryFilter
  );
}

/**
 * Generate conversational, concise responses with smart summarization
 */
function generateConversationalResponse(
  mainTerm: string,
  totalResults: number,
  receipts: any[],
  lineItems: any[],
  queryType: string,
  monetaryFilter?: MonetaryFilterInfo
): string {
  // Handle monetary queries first
  if (queryType === 'amount' && monetaryFilter) {
    return generateMonetaryFilterResponse(totalResults, monetaryFilter, receipts, lineItems);
  }

  // Analyze the results to create smart summaries
  const summary = analyzeResultsForSummary(receipts, lineItems, mainTerm);

  // Generate conversational opening
  let response = `I found ${totalResults} ${totalResults === 1 ? 'receipt' : 'receipts'} matching "${mainTerm}"`;

  // Add smart summary if available
  if (summary.commonMerchant && summary.merchantCount === 1) {
    response += `, all from ${summary.commonMerchant}`;
  } else if (summary.commonMerchant && summary.merchantCount <= 3) {
    response += `, mostly from ${summary.commonMerchant}`;
  }

  // Add common item/amount info if available
  if (summary.commonItem && summary.itemCount <= 2) {
    response += `.
They are all for ${summary.commonItem}`;
    if (summary.commonAmount) {
      response += ` at ${summary.commonAmount}`;
    }
  } else if (summary.priceRange) {
    response += `.
${summary.priceRange}`;
  }

  // Add simple call to action
  response += `.
What would you like to do?`;

  // Add currency conversion note if applicable
  if (monetaryFilter?.conversionInfo?.conversionApplied) {
    response += `\n\n*Note: ${monetaryFilter.conversionInfo.reasoning}*`;
  }

  return response;
}

/**
 * Analyze results to create smart summaries
 */
function analyzeResultsForSummary(receipts: any[], lineItems: any[], searchTerm: string) {
  const merchants = receipts.map(r => r.merchant).filter(Boolean);
  const amounts = receipts.map(r => r.total || r.total_amount).filter(Boolean);

  // Find most common merchant
  const merchantCounts = merchants.reduce((acc, merchant) => {
    acc[merchant] = (acc[merchant] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedMerchants = Object.entries(merchantCounts)
    .sort(([,a], [,b]) => b - a);

  const commonMerchant = sortedMerchants[0]?.[0];
  const merchantCount = Object.keys(merchantCounts).length;

  // Analyze amounts
  let commonAmount = '';
  let priceRange = '';

  if (amounts.length > 0) {
    const uniqueAmounts = [...new Set(amounts)];
    if (uniqueAmounts.length === 1) {
      commonAmount = `MYR ${uniqueAmounts[0].toFixed(2)}`;
    } else if (uniqueAmounts.length <= 3) {
      const sortedAmounts = uniqueAmounts.sort((a, b) => a - b);
      const min = sortedAmounts[0];
      const max = sortedAmounts[sortedAmounts.length - 1];
      priceRange = `Amounts range from MYR ${min.toFixed(2)} to MYR ${max.toFixed(2)}`;
    }
  }

  // Try to identify common item from search term or receipt data
  let commonItem = '';
  if (searchTerm && searchTerm.length > 2) {
    // Check if search term appears to be a product name
    const isProductName = /^[a-zA-Z0-9\s\-\.]+$/i.test(searchTerm) &&
                         searchTerm.split(' ').length <= 4;
    if (isProductName) {
      commonItem = searchTerm.toUpperCase();
    }
  }

  return {
    commonMerchant,
    merchantCount,
    commonItem,
    itemCount: 1, // Simplified for now
    commonAmount,
    priceRange
  };
}

/**
 * Generate specialized response for monetary filter queries
 */
function generateMonetaryFilterResponse(
  totalResults: number,
  monetaryFilter: MonetaryFilterInfo,
  receipts: any[],
  lineItems: any[]
): string {
  const { min, max, originalAmount, originalMaxAmount, originalCurrency } = monetaryFilter;
  const displayCurrency = originalCurrency || 'MYR';

  // Build filter description
  const filterParts: string[] = [];

  if (min !== undefined && min > 0) {
    const displayAmount = originalAmount || min;
    const formattedAmount = formatCurrencyAmount({ amount: displayAmount, currency: displayCurrency });
    filterParts.push(`over ${formattedAmount}`);
  }

  if (max !== undefined && max < Number.MAX_SAFE_INTEGER) {
    const displayAmount = originalMaxAmount || max;
    const formattedAmount = formatCurrencyAmount({ amount: displayAmount, currency: displayCurrency });
    filterParts.push(`under ${formattedAmount}`);
  }

  const filterDescription = filterParts.length > 0 ? ` ${filterParts.join(' and ')}` : '';

  // Generate response based on results
  if (totalResults === 0) {
    return `I couldn't find any receipts${filterDescription}. You might want to try a different amount range or check if you have receipts in that price range.`;
  }

  let response = `I found ${totalResults} receipt${totalResults !== 1 ? 's' : ''}${filterDescription}.`;

  // Add summary statistics if we have receipts
  if (receipts.length > 0) {
    const amounts = receipts
      .map(r => r.total_amount || r.total)
      .filter(amount => typeof amount === 'number');

    if (amounts.length > 0) {
      const minAmount = Math.min(...amounts);
      const maxAmount = Math.max(...amounts);
      const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

      response += ` The amounts range from ${formatCurrencyAmount({ amount: minAmount, currency: displayCurrency })} to ${formatCurrencyAmount({ amount: maxAmount, currency: displayCurrency })}, with an average of ${formatCurrencyAmount({ amount: avgAmount, currency: displayCurrency })}.`;
    }
  }

  return response;
}

/**
 * Detect user intent for help and guidance
 */
export function detectUserIntent(query: string): {
  intent: 'help' | 'greeting' | 'search' | 'unclear';
  response?: string;
} {
  const lowerQuery = query.toLowerCase().trim();

  // Help requests
  if (/\b(help|how\s+do\s+i|what\s+can\s+you|how\s+to|guide|tutorial|instructions)\b/i.test(lowerQuery)) {
    return {
      intent: 'help',
      response: `I can help you search through your receipts! Here are some things you can ask me:

• **Find specific items**: "coffee" or "bread"
• **Search by store**: "Walmart receipts" or "Starbucks purchases"
• **Filter by date**: "receipts from last month" or "purchases this week"
• **Filter by amount**: "receipts over $50" or "items under $10"
• **Combine criteria**: "grocery items from last week over $20"

Just ask me in natural language, and I'll find what you're looking for!`
    };
  }

  // Greetings
  if (/\b(hello|hi|hey|good\s+(morning|afternoon|evening)|greetings)\b/i.test(lowerQuery)) {
    return {
      intent: 'greeting',
      response: `Hello! I'm your AI Receipt Assistant. I can help you search through your receipts using natural language.

Try asking me something like "find coffee purchases" or "show me receipts from last week". What would you like to search for?`
    };
  }

  // Very short or unclear queries
  if (lowerQuery.length < 3 || /^[a-z]$/.test(lowerQuery)) {
    return {
      intent: 'unclear',
      response: `I'd be happy to help you search your receipts! Could you be a bit more specific? For example, you could ask for:
• A specific item name
• A store name
• Receipts from a certain time period
• Items within a price range`
    };
  }

  return { intent: 'search' };
}

/**
 * Generate suggestions based on failed searches
 */
export function generateSearchSuggestions(keywords: ExtractedKeywords): string[] {
  const { queryType, primaryTerms } = keywords;
  const suggestions: string[] = [];

  switch (queryType) {
    case 'item':
      suggestions.push(
        `Try searching for the category instead (e.g., "groceries", "food")`,
        `Search by the store name where you bought it`,
        `Check the spelling of "${primaryTerms.join(' ')}"`,
        `Try a broader term (e.g., "drinks" instead of specific brand names)`
      );
      break;

    case 'merchant':
      suggestions.push(
        `Try the full store name or check spelling`,
        `Search for items you typically buy there instead`,
        `Try searching by location (e.g., "grocery store" or "restaurant")`
      );
      break;

    case 'category':
      suggestions.push(
        `Try specific item names within this category`,
        `Search by store names where you shop for these items`,
        `Use different category terms (e.g., "food" instead of "groceries")`
      );
      break;

    default:
      suggestions.push(
        `Try being more specific with item or store names`,
        `Add time periods (e.g., "last month", "this week")`,
        `Include price ranges (e.g., "over $20", "under $10")`,
        `Search by categories (e.g., "food", "gas", "entertainment")`
      );
  }

  return suggestions.slice(0, 3); // Return top 3 suggestions
}

/**
 * Main function to generate intelligent chat responses with monetary filter support
 */
export function generateIntelligentResponse(
  results: SearchResult,
  originalQuery: string,
  monetaryFilter?: MonetaryFilterInfo
): string {
  console.log('💰 DEBUG: Generating response for monetary query:', {
    originalQuery,
    monetaryFilter,
    resultsCount: results.count,
    totalResults: results.total,
    hasResults: results.results && results.results.length > 0,
    sampleResults: results.results?.slice(0, 2).map(r => ({
      merchant: r.merchant,
      total: r.total,
      totalType: typeof r.total
    }))
  });

  // First check for special intents
  const intentCheck = detectUserIntent(originalQuery);
  if (intentCheck.intent !== 'search' && intentCheck.response) {
    return intentCheck.response;
  }

  const keywords = extractKeywords(originalQuery);

  if (!results.results || results.results.length === 0) {
    return generateNotFoundResponse(keywords, monetaryFilter);
  } else {
    return generateSuccessResponse(results, keywords, monetaryFilter);
  }
}
