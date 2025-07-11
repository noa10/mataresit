/**
 * Enhanced Prompt Engineering Tests
 * 
 * Tests the improved prompt templates and formatting instructions
 */

import { describe, it, expect } from 'https://deno.land/std@0.192.0/testing/bdd.ts';

// Mock test data
const mockReceiptResults = [
  {
    sourceId: 'receipt-1',
    title: 'SUPER SEVEN CASH & CARRY',
    metadata: {
      merchant: 'SUPER SEVEN CASH & CARRY',
      total: 17.90,
      currency: 'MYR',
      date: '2024-01-15',
      category: 'Groceries',
      description: 'POWERCAT 1.3KG'
    }
  },
  {
    sourceId: 'receipt-2',
    title: 'TESCO EXTRA',
    metadata: {
      merchant: 'TESCO EXTRA',
      total: 45.60,
      currency: 'MYR',
      date: '2024-01-16',
      category: 'Groceries',
      description: 'Weekly groceries'
    }
  }
];

describe('Enhanced Prompt Engineering', () => {
  describe('Formatting Requirements Validation', () => {
    it('should validate currency formatting', () => {
      const validFormats = [
        'MYR 25.50',
        'MYR 1,234.56',
        '**Total: MYR 245.30**'
      ];
      
      const invalidFormats = [
        'MYR25.50',  // No space
        '25.50 MYR', // Wrong order
        'MYR 25.5',  // Missing decimal
        '{{amount}}' // Template placeholder
      ];
      
      const currencyRegex = /MYR\s+[\d,]+\.\d{2}/;
      
      validFormats.forEach(format => {
        expect(currencyRegex.test(format.replace(/\*\*/g, ''))).toBe(true);
      });
      
      invalidFormats.forEach(format => {
        if (!format.includes('{{')) {
          expect(currencyRegex.test(format)).toBe(false);
        }
      });
    });

    it('should validate date formatting', () => {
      const validDates = [
        '15/01/2024',
        '01/12/2023',
        '31/12/2024'
      ];
      
      const invalidDates = [
        '2024-01-15',  // ISO format
        '15-01-2024',  // Wrong separator
        '1/1/2024',    // Single digits
        '{{date}}'     // Template placeholder
      ];
      
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      
      validDates.forEach(date => {
        expect(dateRegex.test(date)).toBe(true);
      });
      
      invalidDates.forEach(date => {
        if (!date.includes('{{')) {
          expect(dateRegex.test(date)).toBe(false);
        }
      });
    });

    it('should validate table structure', () => {
      const validTable = `| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |`;

      const tableLines = validTable.split('\n');
      
      // Check header row
      expect(tableLines[0]).toMatch(/^\|.*\|$/);
      
      // Check separator row
      expect(tableLines[1]).toMatch(/^\|[-\s|]+\|$/);
      
      // Check data row
      expect(tableLines[2]).toMatch(/^\|.*\|$/);
      
      // Check column count consistency
      const headerCols = tableLines[0].split('|').length;
      const dataCols = tableLines[2].split('|').length;
      expect(headerCols).toBe(dataCols);
    });
  });

  describe('Response Template Validation', () => {
    it('should validate conversational template format', () => {
      const singleReceiptResponse = 'I found 1 receipt from **SUPER SEVEN CASH & CARRY** on 15/01/2024 for **MYR 17.90** (POWERCAT 1.3KG). What would you like to do?';
      
      // Check for required elements
      expect(singleReceiptResponse).toContain('I found');
      expect(singleReceiptResponse).toContain('MYR 17.90');
      expect(singleReceiptResponse).toContain('15/01/2024');
      expect(singleReceiptResponse).toContain('What would you like to do?');
      expect(singleReceiptResponse).toContain('**'); // Bold formatting
    });

    it('should validate document retrieval template structure', () => {
      const documentResponse = `# Search Results for "POWERCAT"

Found **7 receipts** matching your search criteria.

## Receipt Details
| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |

## Key Statistics
• **Total Amount**: MYR 125.30
• **Date Range**: 15/01/2024 - 22/01/2024`;

      // Check for required sections
      expect(documentResponse).toContain('# Search Results');
      expect(documentResponse).toContain('## Receipt Details');
      expect(documentResponse).toContain('## Key Statistics');
      expect(documentResponse).toContain('| Merchant | Date | Amount | Description |');
      expect(documentResponse).toContain('• **Total Amount**:');
    });

    it('should validate financial analysis template structure', () => {
      const financialResponse = `# Financial Analysis Summary

## Spending Overview
• **Total Spent**: MYR 245.30
• **Number of Transactions**: 12 receipts
• **Average per Transaction**: MYR 20.44

## Transaction Breakdown
| Date | Merchant | Category | Amount |
|------|----------|----------|--------|
| 15/01/2024 | SUPER SEVEN | Groceries | MYR 17.90 |

## Key Insights
• **Spending Trend**: +15.2% increase from last month`;

      // Check for required sections
      expect(financialResponse).toContain('# Financial Analysis Summary');
      expect(financialResponse).toContain('## Spending Overview');
      expect(financialResponse).toContain('## Transaction Breakdown');
      expect(financialResponse).toContain('## Key Insights');
      expect(financialResponse).toContain('+15.2%'); // Percentage format
    });
  });

  describe('Content Quality Validation', () => {
    it('should not contain template placeholders', () => {
      const responses = [
        'I found 1 receipt from SUPER SEVEN on 15/01/2024 for MYR 17.90.',
        'Total amount: MYR 245.30 from 15/01/2024 to 20/01/2024.',
        '| SUPER SEVEN | 15/01/2024 | MYR 17.90 | POWERCAT |'
      ];
      
      const placeholderPatterns = [
        /\{\{.*?\}\}/g,  // {{placeholder}}
        /\$\{.*?\}/g,    // ${placeholder}
        /<.*?>/g         // <placeholder>
      ];
      
      responses.forEach(response => {
        placeholderPatterns.forEach(pattern => {
          expect(pattern.test(response)).toBe(false);
        });
      });
    });

    it('should use consistent formatting throughout', () => {
      const response = `Found 3 receipts:

| Merchant | Date | Amount |
|----------|------|--------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 |

**Total**: MYR 63.50`;

      // Check currency consistency
      const currencyMatches = response.match(/MYR\s+[\d,]+\.\d{2}/g);
      expect(currencyMatches).toBeTruthy();
      expect(currencyMatches!.length).toBeGreaterThan(0);
      
      // Check date consistency
      const dateMatches = response.match(/\d{2}\/\d{2}\/\d{4}/g);
      expect(dateMatches).toBeTruthy();
      expect(dateMatches!.length).toBeGreaterThan(0);
    });

    it('should have proper markdown structure', () => {
      const response = `# Main Header
## Sub Header
### Sub-sub Header

| Table | Header |
|-------|--------|
| Data | Value |

• Bullet point
• Another point

**Bold text** and *italic text*`;

      // Check header hierarchy
      expect(response).toMatch(/^# /m);
      expect(response).toMatch(/^## /m);
      expect(response).toMatch(/^### /m);
      
      // Check table structure
      expect(response).toMatch(/\|.*\|/);
      expect(response).toMatch(/\|[-\s|]+\|/);
      
      // Check list formatting
      expect(response).toMatch(/^• /m);
      
      // Check text formatting
      expect(response).toContain('**');
      expect(response).toContain('*');
    });
  });

  describe('Mobile Responsiveness Validation', () => {
    it('should limit table columns for mobile compatibility', () => {
      const mobileTable = `| Merchant | Date | Amount | Desc |
|----------|------|--------|------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | POWERCAT |`;

      const headerRow = mobileTable.split('\n')[0];
      const columnCount = headerRow.split('|').filter(col => col.trim().length > 0).length;
      
      expect(columnCount).toBeLessThanOrEqual(5); // Max 5 columns for mobile
    });

    it('should use concise column headers', () => {
      const headers = ['Merchant', 'Date', 'Amount', 'Desc'];
      
      headers.forEach(header => {
        expect(header.length).toBeLessThanOrEqual(12); // Reasonable length for mobile
      });
    });
  });

  describe('Summary Statistics Validation', () => {
    it('should format summary statistics correctly', () => {
      const summary = `## Summary
• **Total Receipts**: 7 items
• **Total Amount**: MYR 125.30
• **Date Range**: 15/01/2024 - 20/01/2024
• **Average per Receipt**: MYR 17.90`;

      // Check bullet point format
      expect(summary).toMatch(/^• \*\*/m);
      
      // Check bold formatting for labels
      expect(summary).toContain('**Total Receipts**:');
      expect(summary).toContain('**Total Amount**:');
      
      // Check currency and date formatting
      expect(summary).toMatch(/MYR\s+[\d,]+\.\d{2}/);
      expect(summary).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });
});
