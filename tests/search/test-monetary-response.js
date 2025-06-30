// Test script for enhanced monetary response generation
import { generateIntelligentResponse, generateSuccessResponse, generateNotFoundResponse } from './src/lib/chat-response-generator.js';

// Mock search results
const mockSearchResults = {
  results: [
    {
      id: '1',
      merchant: 'Starbucks',
      total_amount: 15.50,
      date: '2024-01-15',
      similarity_score: 0.95
    },
    {
      id: '2', 
      merchant: 'McDonald\'s',
      total_amount: 12.30,
      date: '2024-01-16',
      similarity_score: 0.88
    }
  ],
  total: 2,
  count: 2,
  searchParams: {}
};

const emptySearchResults = {
  results: [],
  total: 0,
  count: 0,
  searchParams: {}
};

// Mock monetary filter
const monetaryFilter = {
  min: 10,
  max: 20,
  currency: 'MYR',
  originalAmount: 10,
  originalCurrency: 'MYR',
  conversionInfo: {
    conversionApplied: false,
    reasoning: 'No conversion needed - already in MYR'
  }
};

const monetaryFilterWithConversion = {
  min: 475,
  max: Number.MAX_SAFE_INTEGER,
  currency: 'MYR',
  originalAmount: 100,
  originalCurrency: 'USD',
  conversionInfo: {
    conversionApplied: true,
    reasoning: 'Converted $100 USD to RM475 MYR using exchange rate 4.75',
    exchangeRate: 4.75,
    convertedAmount: { amount: 475, currency: 'MYR' }
  }
};

// Test cases
console.log('=== Testing Enhanced Monetary Response Generation ===\n');

console.log('1. Success response with monetary filter (no conversion):');
const successResponse = generateIntelligentResponse(mockSearchResults, 'receipts over RM10', monetaryFilter);
console.log(successResponse);
console.log('\n');

console.log('2. Success response with monetary filter (with conversion):');
const successResponseWithConversion = generateIntelligentResponse(mockSearchResults, 'receipts over $100 USD', monetaryFilterWithConversion);
console.log(successResponseWithConversion);
console.log('\n');

console.log('3. Not found response with monetary filter:');
const notFoundResponse = generateIntelligentResponse(emptySearchResults, 'receipts over RM50', {
  min: 50,
  max: Number.MAX_SAFE_INTEGER,
  currency: 'MYR',
  originalAmount: 50,
  originalCurrency: 'MYR'
});
console.log(notFoundResponse);
console.log('\n');

console.log('4. Not found response with conversion note:');
const notFoundWithConversion = generateIntelligentResponse(emptySearchResults, 'receipts over $200 USD', {
  min: 950,
  max: Number.MAX_SAFE_INTEGER,
  currency: 'MYR',
  originalAmount: 200,
  originalCurrency: 'USD',
  conversionInfo: {
    conversionApplied: true,
    reasoning: 'Converted $200 USD to RM950 MYR using exchange rate 4.75',
    exchangeRate: 4.75,
    convertedAmount: { amount: 950, currency: 'MYR' }
  }
});
console.log(notFoundWithConversion);
console.log('\n');

console.log('=== Test Complete ===');
