/**
 * End-to-End Formatting Pipeline Integration Tests
 * 
 * Tests the complete formatting pipeline from LLM response generation
 * through UI rendering to ensure proper display of formatted content.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { parseUIComponents } from '@/lib/ui-component-parser';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { DataTableComponent } from '@/components/chat/ui-components/DataTableComponent';
import { SectionHeaderComponent } from '@/components/chat/ui-components/SectionHeaderComponent';

// Mock data representing LLM responses with various formatting
const mockLLMResponses = {
  simpleMarkdownTable: `# Receipt Analysis Results

I found 3 receipts matching your search:

| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Weekly groceries |
| SHELL STATION | 17/01/2024 | MYR 80.00 | Fuel |

## Summary
• **Total Amount**: MYR 143.50
• **Date Range**: 15/01/2024 - 17/01/2024
• **Merchants**: 3 different stores`,

  complexFinancialAnalysis: `# Financial Analysis Summary

## Spending Overview
Your spending analysis for January 2024:

| Date | Merchant | Category | Amount | Payment |
|------|----------|----------|--------|---------|
| 15/01/2024 | SUPER SEVEN | Groceries | MYR 17.90 | Cash |
| 16/01/2024 | TESCO EXTRA | Groceries | MYR 45.60 | Card |
| 17/01/2024 | SHELL STATION | Fuel | MYR 80.00 | Card |
| 18/01/2024 | STARBUCKS | Food & Beverage | MYR 12.50 | Card |

## Key Insights
• **Total Spent**: MYR 155.00
• **Average per Transaction**: MYR 38.75
• **Top Category**: Fuel (51.6% of spending)
• **Payment Method**: 75% card, 25% cash

### Recommendations
1. Consider fuel-efficient driving to reduce fuel costs
2. Track grocery spending more closely
3. Set up spending alerts for categories over MYR 50`,

  mixedContentWithComponents: `# Search Results for "POWERCAT"

Found **7 receipts** matching your search criteria.

## Receipt Details

| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| SUPER SEVEN CASH & CARRY | 16/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| SUPER SEVEN CASH & CARRY | 17/01/2024 | MYR 17.90 | POWERCAT 1.3KG |

\`\`\`json
{
  "type": "ui_component",
  "component": "summary_card",
  "data": {
    "title": "Total Spent on POWERCAT",
    "value": "MYR 125.30",
    "subtitle": "7 purchases",
    "trend": {
      "direction": "stable",
      "percentage": 0,
      "period": "last month"
    }
  },
  "metadata": {
    "title": "POWERCAT Summary",
    "interactive": false
  }
}
\`\`\`

## Analysis
All purchases are consistent at **MYR 17.90** each, suggesting stable pricing.`
};

describe('End-to-End Formatting Pipeline', () => {
  describe('Markdown Table to UI Component Conversion', () => {
    it('should parse markdown tables and convert to DataTable components', () => {
      const result = parseUIComponents(mockLLMResponses.simpleMarkdownTable);
      
      expect(result.success).toBe(true);
      expect(result.components.length).toBeGreaterThan(0);
      
      // Should have section headers and data table
      const sectionHeaders = result.components.filter(c => c.component === 'section_header');
      const dataTables = result.components.filter(c => c.component === 'data_table');
      
      expect(sectionHeaders.length).toBeGreaterThan(0);
      expect(dataTables.length).toBeGreaterThan(0);
      
      // Validate data table structure
      const tableComponent = dataTables[0];
      expect(tableComponent.data.columns).toHaveLength(4);
      expect(tableComponent.data.rows).toHaveLength(3);
      expect(tableComponent.data.columns[0].label).toBe('Merchant');
      expect(tableComponent.data.columns[2].type).toBe('currency');
    });

    it('should render DataTable component correctly', () => {
      const result = parseUIComponents(mockLLMResponses.simpleMarkdownTable);
      const tableComponent = result.components.find(c => c.component === 'data_table');
      
      if (tableComponent) {
        render(<DataTableComponent data={tableComponent.data} />);
        
        // Check for table headers
        expect(screen.getByText('Merchant')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Amount')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
        
        // Check for data rows
        expect(screen.getByText('SUPER SEVEN CASH & CARRY')).toBeInTheDocument();
        expect(screen.getByText('TESCO EXTRA')).toBeInTheDocument();
        expect(screen.getByText('SHELL STATION')).toBeInTheDocument();
      }
    });
  });

  describe('Section Header Conversion and Rendering', () => {
    it('should parse markdown headers and convert to SectionHeader components', () => {
      const result = parseUIComponents(mockLLMResponses.complexFinancialAnalysis);
      
      const sectionHeaders = result.components.filter(c => c.component === 'section_header');
      expect(sectionHeaders.length).toBeGreaterThan(0);
      
      // Check for different header levels
      const h1Headers = sectionHeaders.filter(h => h.data.level === 1);
      const h2Headers = sectionHeaders.filter(h => h.data.level === 2);
      const h3Headers = sectionHeaders.filter(h => h.data.level === 3);
      
      expect(h1Headers.length).toBeGreaterThan(0);
      expect(h2Headers.length).toBeGreaterThan(0);
      expect(h3Headers.length).toBeGreaterThan(0);
    });

    it('should render SectionHeader components with proper styling', () => {
      const headerData = {
        title: 'Financial Analysis Summary',
        level: 1 as const,
        variant: 'primary' as const,
        divider: true
      };
      
      render(<SectionHeaderComponent data={headerData} />);
      
      expect(screen.getByText('Financial Analysis Summary')).toBeInTheDocument();
    });
  });

  describe('Mixed Content Processing', () => {
    it('should handle mixed markdown and JSON components', () => {
      const result = parseUIComponents(mockLLMResponses.mixedContentWithComponents);
      
      expect(result.success).toBe(true);
      expect(result.components.length).toBeGreaterThan(0);
      
      // Should have section headers, data tables, and summary cards
      const sectionHeaders = result.components.filter(c => c.component === 'section_header');
      const dataTables = result.components.filter(c => c.component === 'data_table');
      const summaryCards = result.components.filter(c => c.component === 'summary_card');
      
      expect(sectionHeaders.length).toBeGreaterThan(0);
      expect(dataTables.length).toBeGreaterThan(0);
      expect(summaryCards.length).toBeGreaterThan(0);
    });

    it('should clean content properly after component extraction', () => {
      const result = parseUIComponents(mockLLMResponses.mixedContentWithComponents);
      
      // Cleaned content should not contain markdown tables or JSON blocks
      expect(result.cleanedContent).not.toContain('| Merchant | Date |');
      expect(result.cleanedContent).not.toContain('```json');
      expect(result.cleanedContent).not.toContain('# Search Results');
      
      // But should contain remaining text content
      expect(result.cleanedContent).toContain('Found **7 receipts** matching');
      expect(result.cleanedContent).toContain('All purchases are consistent');
    });
  });

  describe('ChatMessage Integration', () => {
    it('should render complete formatted message with components', async () => {
      const mockMessage = {
        id: 'test-1',
        content: mockLLMResponses.simpleMarkdownTable,
        role: 'assistant' as const,
        timestamp: new Date(),
        uiComponents: []
      };
      
      render(<ChatMessage message={mockMessage} />);
      
      // Wait for components to render
      await waitFor(() => {
        // Should render markdown content
        expect(screen.getByText(/I found 3 receipts/)).toBeInTheDocument();
        
        // Should render UI components
        expect(screen.getByText('Merchant')).toBeInTheDocument();
        expect(screen.getByText('SUPER SEVEN CASH & CARRY')).toBeInTheDocument();
      });
    });
  });

  describe('Markdown Rendering Integration', () => {
    it('should render markdown content with proper formatting', () => {
      const markdownContent = `## Summary
• **Total Amount**: MYR 143.50
• **Date Range**: 15/01/2024 - 17/01/2024

### Key Points
1. All transactions processed successfully
2. No duplicate entries found
3. Currency formatting is consistent`;
      
      render(<MarkdownRenderer content={markdownContent} variant="chat" />);
      
      // Check for proper markdown rendering
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Key Points')).toBeInTheDocument();
      expect(screen.getByText(/Total Amount.*MYR 143.50/)).toBeInTheDocument();
    });

    it('should handle tables in markdown content', () => {
      const tableContent = `| Name | Value |
|------|-------|
| Total | MYR 100.00 |
| Count | 5 items |`;
      
      render(<MarkdownRenderer content={tableContent} variant="chat" />);
      
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('MYR 100.00')).toBeInTheDocument();
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle large content efficiently', () => {
      const largeTable = `| ID | Merchant | Date | Amount |\n|----|---------|----- |--------|\n` +
        Array.from({ length: 50 }, (_, i) => 
          `| ${i + 1} | Merchant ${i + 1} | ${15 + i}/01/2024 | MYR ${(i + 1) * 10}.00 |`
        ).join('\n');
      
      const startTime = performance.now();
      const result = parseUIComponents(largeTable);
      const endTime = performance.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle malformed content gracefully', () => {
      const malformedContent = `# Header
| Incomplete table
|---|
| Missing cells
\`\`\`json
{ invalid json
\`\`\``;
      
      const result = parseUIComponents(malformedContent);
      
      // Should not crash and should process valid parts
      expect(result.success).toBe(true);
      expect(result.errors).toBeDefined();
    });

    it('should handle empty content', () => {
      const result = parseUIComponents('');
      
      expect(result.success).toBe(true);
      expect(result.components).toHaveLength(0);
      expect(result.cleanedContent).toBe('');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should render components responsively', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375, // iPhone width
      });
      
      const result = parseUIComponents(mockLLMResponses.simpleMarkdownTable);
      const tableComponent = result.components.find(c => c.component === 'data_table');
      
      if (tableComponent) {
        render(<DataTableComponent data={tableComponent.data} compact={true} />);
        
        // Should render without horizontal overflow issues
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
      }
    });
  });
});
