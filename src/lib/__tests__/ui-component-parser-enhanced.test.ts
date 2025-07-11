/**
 * Enhanced UI Component Parser Tests
 * 
 * Tests the markdown table and header detection functionality
 */

import { 
  parseUIComponents, 
  parseUIComponentsWithOptions,
  analyzeMarkdownContent,
  extractTablePreview
} from '../ui-component-parser';

describe('Enhanced UI Component Parser', () => {
  describe('Markdown Table Detection', () => {
    it('should parse simple markdown table', () => {
      const content = `
Here are your receipts:

| Merchant | Date | Amount | Category |
|----------|------|--------|----------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | Groceries |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Groceries |

That's all the data.
      `;

      const result = parseUIComponents(content);
      
      expect(result.success).toBe(true);
      expect(result.components).toHaveLength(1);
      expect(result.components[0].component).toBe('data_table');
      
      const tableData = result.components[0].data as any;
      expect(tableData.columns).toHaveLength(4);
      expect(tableData.rows).toHaveLength(2);
      expect(tableData.columns[0].label).toBe('Merchant');
      expect(tableData.columns[2].type).toBe('currency');
      expect(tableData.columns[2].align).toBe('right');
    });

    it('should detect column types correctly', () => {
      const content = `
| Product | Count | Price | Date | Status |
|---------|-------|-------|------|--------|
| Item A | 5 | $25.99 | 01/01/2024 | Active |
| Item B | 10 | $15.50 | 02/01/2024 | Pending |
      `;

      const result = parseUIComponents(content);
      const tableData = result.components[0].data as any;
      
      expect(tableData.columns[1].type).toBe('number'); // Count
      expect(tableData.columns[2].type).toBe('currency'); // Price
      expect(tableData.columns[3].type).toBe('date'); // Date
      expect(tableData.columns[4].type).toBe('badge'); // Status
    });

    it('should handle multiple tables', () => {
      const content = `
# First Table
| A | B |
|---|---|
| 1 | 2 |

# Second Table  
| X | Y | Z |
|---|---|---|
| a | b | c |
| d | e | f |
      `;

      const result = parseUIComponents(content);
      
      expect(result.components.length).toBeGreaterThanOrEqual(2);
      const tables = result.components.filter(c => c.component === 'data_table');
      expect(tables).toHaveLength(2);
    });
  });

  describe('Markdown Header Detection', () => {
    it('should parse markdown headers', () => {
      const content = `
# Main Title
## Subtitle
### Section Header

Some content here.
      `;

      const result = parseUIComponents(content);
      
      const headers = result.components.filter(c => c.component === 'section_header');
      expect(headers).toHaveLength(3);
      expect(headers[0].data.level).toBe(1);
      expect(headers[1].data.level).toBe(2);
      expect(headers[2].data.level).toBe(3);
    });

    it('should set correct variants for headers', () => {
      const content = `
# Main Title
## Subtitle
      `;

      const result = parseUIComponents(content);
      
      const headers = result.components.filter(c => c.component === 'section_header');
      expect(headers[0].data.variant).toBe('primary'); // H1
      expect(headers[1].data.variant).toBe('default'); // H2
    });
  });

  describe('Enhanced Parsing Options', () => {
    it('should respect parsing options', () => {
      const content = `
# Header
| A | B |
|---|---|
| 1 | 2 |
      `;

      // Parse only tables
      const tablesOnly = parseUIComponentsWithOptions(content, {
        parseMarkdownHeaders: false,
        parseMarkdownTables: true
      });
      
      expect(tablesOnly.components.filter(c => c.component === 'data_table')).toHaveLength(1);
      expect(tablesOnly.components.filter(c => c.component === 'section_header')).toHaveLength(0);

      // Parse only headers
      const headersOnly = parseUIComponentsWithOptions(content, {
        parseMarkdownHeaders: true,
        parseMarkdownTables: false
      });
      
      expect(headersOnly.components.filter(c => c.component === 'section_header')).toHaveLength(1);
      expect(headersOnly.components.filter(c => c.component === 'data_table')).toHaveLength(0);
    });

    it('should apply table row limits', () => {
      const content = `
| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |
| 5 | 6 |
| 7 | 8 |
| 9 | 10 |
      `;

      const result = parseUIComponentsWithOptions(content, {
        tableRowLimit: 3
      });
      
      const tableData = result.components[0].data as any;
      expect(tableData.rows).toHaveLength(3);
      expect(tableData.pagination).toBe(true);
    });
  });

  describe('Content Analysis', () => {
    it('should analyze markdown content correctly', () => {
      const content = `
# Title
## Subtitle

| A | B |
|---|---|
| 1 | 2 |

### Another Header

| X | Y | Z |
|---|---|---|
| a | b | c |
      `;

      const analysis = analyzeMarkdownContent(content);
      
      expect(analysis.hasMarkdownTables).toBe(true);
      expect(analysis.hasMarkdownHeaders).toBe(true);
      expect(analysis.tableCount).toBe(2);
      expect(analysis.headerCount).toBe(3);
      expect(analysis.headerLevels).toEqual([1, 2, 3]);
    });

    it('should extract table previews', () => {
      const content = `
| Name | Age | City |
|------|-----|------|
| John | 25 | NYC |
| Jane | 30 | LA |
| Bob | 35 | Chicago |
| Alice | 28 | Boston |
      `;

      const preview = extractTablePreview(content, 2);
      
      expect(preview.tables).toHaveLength(1);
      expect(preview.tables[0].headers).toEqual(['Name', 'Age', 'City']);
      expect(preview.tables[0].rows).toHaveLength(2);
      expect(preview.tables[0].totalRows).toBe(4);
    });
  });

  describe('Mixed Content Parsing', () => {
    it('should handle content with tables, headers, and JSON blocks', () => {
      const content = `
# Receipt Analysis

I found 3 receipts:

| Merchant | Amount |
|----------|--------|
| Store A | $25.99 |
| Store B | $15.50 |

## Summary

\`\`\`json
{
  "type": "ui_component",
  "component": "summary_card",
  "data": {
    "title": "Total Spent",
    "value": "$41.49"
  },
  "metadata": {
    "title": "Summary",
    "interactive": false
  }
}
\`\`\`

That's your spending summary.
      `;

      const result = parseUIComponents(content);
      
      expect(result.components.length).toBeGreaterThanOrEqual(3);
      expect(result.components.some(c => c.component === 'section_header')).toBe(true);
      expect(result.components.some(c => c.component === 'data_table')).toBe(true);
      expect(result.components.some(c => c.component === 'summary_card')).toBe(true);
    });

    it('should clean content properly', () => {
      const content = `
# Header
Some text before table.

| A | B |
|---|---|
| 1 | 2 |

Some text after table.
      `;

      const result = parseUIComponents(content);
      
      expect(result.cleanedContent).not.toContain('# Header');
      expect(result.cleanedContent).not.toContain('| A | B |');
      expect(result.cleanedContent).toContain('Some text before table.');
      expect(result.cleanedContent).toContain('Some text after table.');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed tables gracefully', () => {
      const content = `
| Incomplete table
|---|
| Missing cells
      `;

      const result = parseUIComponents(content);
      
      // Should not crash and should continue processing
      expect(result.success).toBe(true);
    });

    it('should handle empty content', () => {
      const result = parseUIComponents('');
      
      expect(result.success).toBe(true);
      expect(result.components).toHaveLength(0);
      expect(result.cleanedContent).toBe('');
    });
  });
});
