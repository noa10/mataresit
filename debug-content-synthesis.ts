#!/usr/bin/env deno run --allow-env --allow-net --allow-read

import { generateSyntheticFullText, synthesizeReceiptContent } from './supabase/functions/_shared/content-synthesis.ts';

const testVisionData = {
  merchant: 'Test Coffee Shop',
  date: '2025-01-15',
  total: 25.50,
  tax: 2.25,
  currency: 'MYR',
  payment_method: 'Credit Card',
  predicted_category: 'Food & Dining',
  line_items: [
    { description: 'Large Coffee', amount: 8.50 },
    { description: 'Blueberry Muffin', amount: 4.25 },
    { description: 'Extra Shot', amount: 0.75 }
  ],
  ai_suggestions: {
    business_type: 'Coffee Shop',
    location_hint: 'Downtown'
  }
};

console.log('🧪 Testing Content Synthesis');
console.log('============================');

const syntheticFullText = generateSyntheticFullText(testVisionData);
console.log('\n📝 Generated synthetic content:');
console.log(syntheticFullText);
console.log('\n📊 Analysis:');
console.log('Length:', syntheticFullText.length);
console.log('Contains "Large Coffee":', syntheticFullText.includes('Large Coffee'));
console.log('Contains "Test Coffee Shop":', syntheticFullText.includes('Test Coffee Shop'));
console.log('Contains "25.50":', syntheticFullText.includes('25.50'));
console.log('Contains "Food & Dining":', syntheticFullText.includes('Food & Dining'));

const contentStrategy = synthesizeReceiptContent(testVisionData);
console.log('\n📋 Content Strategy:');
console.log('Content types:', Object.keys(contentStrategy).length);
console.log('Non-empty types:', Object.values(contentStrategy).filter(v => v && v.trim().length > 0).length);

console.log('\n🔍 Quality Checks:');
const hasMinimumLength = syntheticFullText.length >= 50;
const containsMerchant = syntheticFullText.includes('Test Coffee Shop');
const containsTotal = syntheticFullText.includes('25.5') || syntheticFullText.includes('25.50');
const containsLineItems = syntheticFullText.includes('Large Coffee');
const containsCategory = syntheticFullText.includes('Food & Dining');
const hasMultipleContentTypes = Object.keys(contentStrategy).length >= 6;
const hasNonEmptyContent = Object.values(contentStrategy).filter(v => v && v.trim().length > 0).length >= 4;

console.log('✅ hasMinimumLength:', hasMinimumLength);
console.log('✅ containsMerchant:', containsMerchant);
console.log('✅ containsTotal:', containsTotal);
console.log('❌ containsLineItems:', containsLineItems);
console.log('✅ containsCategory:', containsCategory);
console.log('✅ hasMultipleContentTypes:', hasMultipleContentTypes);
console.log('✅ hasNonEmptyContent:', hasNonEmptyContent);

const allTestsPassed = hasMinimumLength && containsMerchant && containsTotal && 
                      containsLineItems && containsCategory && hasMultipleContentTypes && hasNonEmptyContent;

console.log('\n🎯 Overall Result:', allTestsPassed ? 'PASS' : 'FAIL');
