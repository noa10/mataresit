/**
 * UI Component Parser for Chat Interface
 * 
 * This module provides functionality to parse LLM responses and extract
 * special JSON blocks that define interactive UI components.
 */

import { z } from 'zod';
import {
  UIComponent,
  UIComponentParseResult,
  ComponentValidationResult,
  UIComponentType,
  ReceiptCardData,
  SpendingChartData,
  ActionButtonData,
  CategoryBreakdownData,
  TrendChartData,
  MerchantSummaryData,
  FinancialInsightData,
  DataTableData,
  BarChartData,
  PieChartData,
  SummaryCardData,
  SectionHeaderData
} from '@/types/ui-components';

// Zod schemas for validation
const UIComponentMetadataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  interactive: z.boolean(),
  actions: z.array(z.string()).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

const ReceiptCardDataSchema = z.object({
  receipt_id: z.string(),
  merchant: z.string(),
  total: z.number(),
  currency: z.string(),
  date: z.string(),
  category: z.string().optional(),
  confidence: z.number().optional(),
  thumbnail_url: z.string().optional(),
  line_items_count: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

const CategorySpendingSchema = z.object({
  name: z.string(),
  amount: z.number(),
  percentage: z.number(),
  color: z.string().optional(),
  transaction_count: z.number().optional(),
});

const SpendingChartDataSchema = z.object({
  chart_type: z.enum(['pie', 'bar', 'line', 'doughnut']),
  categories: z.array(CategorySpendingSchema),
  total_amount: z.number(),
  currency: z.string(),
  period: z.string(),
  comparison_period: z.string().optional(),
  growth_rate: z.number().optional(),
});

const ActionButtonDataSchema = z.object({
  action: z.enum([
    'upload_receipt', 'create_claim', 'view_analytics', 'export_data',
    'filter_results', 'view_receipt', 'edit_receipt', 'categorize_receipt', 'create_report'
  ]),
  label: z.string(),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost']),
  icon: z.string().optional(),
  url: z.string().optional(),
  params: z.record(z.any()).optional(),
});

const CategoryDetailSchema = z.object({
  name: z.string(),
  amount: z.number(),
  percentage: z.number(),
  transaction_count: z.number(),
  average_transaction: z.number(),
  trend: z.enum(['up', 'down', 'stable']),
  trend_percentage: z.number().optional(),
  color: z.string().optional(),
});

const CategoryBreakdownDataSchema = z.object({
  categories: z.array(CategoryDetailSchema),
  total_amount: z.number(),
  currency: z.string(),
  period: z.string(),
  top_category: z.string(),
  insights: z.array(z.string()).optional(),
});

const TrendDataPointSchema = z.object({
  date: z.string(),
  amount: z.number(),
  label: z.string().optional(),
  category: z.string().optional(),
});

const TrendChartDataSchema = z.object({
  chart_type: z.enum(['line', 'area', 'bar']),
  data_points: z.array(TrendDataPointSchema),
  currency: z.string(),
  period: z.string(),
  trend_direction: z.enum(['up', 'down', 'stable']),
  trend_percentage: z.number(),
  insights: z.array(z.string()).optional(),
});

const MerchantSummaryDataSchema = z.object({
  merchant_name: z.string(),
  total_spent: z.number(),
  currency: z.string(),
  visit_count: z.number(),
  average_transaction: z.number(),
  first_visit: z.string(),
  last_visit: z.string(),
  favorite_items: z.array(z.string()).optional(),
  spending_trend: z.enum(['up', 'down', 'stable']),
  loyalty_status: z.string().optional(),
});

const FinancialInsightDataSchema = z.object({
  insight_type: z.enum(['spending_pattern', 'budget_alert', 'savings_opportunity', 'anomaly_detection']),
  title: z.string(),
  description: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  amount: z.number().optional(),
  currency: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
  action_items: z.array(ActionButtonDataSchema).optional(),
});

// New Component Schemas
const DataTableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'currency', 'date', 'badge', 'action']),
  sortable: z.boolean().optional(),
  width: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
});

const DataTableRowSchema = z.object({
  id: z.string(),
}).passthrough(); // Allow additional properties

const DataTableDataSchema = z.object({
  columns: z.array(DataTableColumnSchema),
  rows: z.array(DataTableRowSchema),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  searchable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  pagination: z.boolean().optional(),
  total_rows: z.number().optional(),
  currency: z.string().optional(),
});

const BarChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const BarChartDataSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  data: z.array(BarChartDataPointSchema),
  x_axis_label: z.string().optional(),
  y_axis_label: z.string().optional(),
  currency: z.string().optional(),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  color_scheme: z.array(z.string()).optional(),
  show_values: z.boolean().optional(),
  show_legend: z.boolean().optional(),
});

const PieChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  percentage: z.number().optional(),
  color: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const PieChartDataSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  data: z.array(PieChartDataPointSchema),
  currency: z.string().optional(),
  show_legend: z.boolean().optional(),
  show_percentages: z.boolean().optional(),
  show_values: z.boolean().optional(),
  color_scheme: z.array(z.string()).optional(),
  center_total: z.boolean().optional(),
});

const SummaryCardTrendSchema = z.object({
  direction: z.enum(['up', 'down', 'stable']),
  percentage: z.number(),
  period: z.string(),
});

const SummaryCardDataSchema = z.object({
  title: z.string(),
  value: z.union([z.string(), z.number()]),
  subtitle: z.string().optional(),
  currency: z.string().optional(),
  trend: SummaryCardTrendSchema.optional(),
  icon: z.string().optional(),
  color: z.enum(['default', 'primary', 'success', 'warning', 'danger']).optional(),
  actions: z.array(ActionButtonDataSchema).optional(),
  metadata: z.record(z.any()).optional(),
});

// Main UI Component Schema
const UIComponentSchema = z.object({
  type: z.literal('ui_component'),
  component: z.enum([
    'receipt_card', 'line_item_card', 'spending_chart', 'action_button', 'category_breakdown',
    'trend_chart', 'merchant_summary', 'financial_insight', 'data_table',
    'bar_chart', 'pie_chart', 'summary_card', 'section_header'
  ]),
  data: z.any(), // Will be validated based on component type
  metadata: UIComponentMetadataSchema,
});

/**
 * Regular expression to match JSON blocks in text
 * Matches: ```json { ... } ``` or ```ui_component { ... } ```
 */
const JSON_BLOCK_REGEX = /```(?:json|ui_component)\s*\n([\s\S]*?)\n```/g;

/**
 * Regular expressions for markdown content detection
 */
const MARKDOWN_TABLE_REGEX = /\|(.+)\|\n\|(?:-+\|)+\n((?:\|.+\|\n?)+)/g;
const MARKDOWN_HEADER_REGEX = /^(#{1,6})\s+(.+)$/gm;

/**
 * Parse markdown tables and convert them to DataTable UI components
 */
function parseMarkdownTables(content: string): { components: UIComponent[], cleanedContent: string } {
  const components: UIComponent[] = [];
  let cleanedContent = content;

  // Reset regex lastIndex to ensure proper matching
  MARKDOWN_TABLE_REGEX.lastIndex = 0;

  const matches = Array.from(content.matchAll(MARKDOWN_TABLE_REGEX));

  for (const match of matches) {
    try {
      const headerRow = match[1];
      const dataRows = match[2];

      // Parse headers
      const headers = headerRow.split('|')
        .map(h => h.trim())
        .filter(h => h.length > 0);

      // Parse data rows
      const rows = dataRows.split('\n')
        .filter(row => row.trim().length > 0)
        .map(row => {
          const cells = row.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);
          return cells;
        })
        .filter(row => row.length > 0);

      if (headers.length > 0 && rows.length > 0) {
        // Extract column values for type detection
        const columnValues = headers.map((_, colIndex) =>
          rows.map(row => row[colIndex] || '').filter(val => val.trim().length > 0)
        );

        // Create column definitions with smart type detection
        const columns = headers.map((header, index) => {
          const columnKey = `col_${index}`;
          const values = columnValues[index];
          const { type, align } = detectColumnType(header, values);

          return {
            key: columnKey,
            label: header,
            type,
            sortable: true,
            align
          };
        });

        // Create row data
        const tableRows = rows.map((row, rowIndex) => {
          const rowData: any = { id: `row_${rowIndex}` };
          headers.forEach((header, colIndex) => {
            const columnKey = `col_${colIndex}`;
            let cellValue = row[colIndex] || '';

            // Clean up cell value
            cellValue = cellValue.trim();

            // Try to parse numbers for currency/number columns
            const column = columns[colIndex];
            if (column.type === 'currency' || column.type === 'number') {
              const numMatch = cellValue.match(/[\d,]+\.?\d*/);
              if (numMatch) {
                const numValue = parseFloat(numMatch[0].replace(/,/g, ''));
                if (!isNaN(numValue)) {
                  cellValue = numValue;
                }
              }
            }

            rowData[columnKey] = cellValue;
          });
          return rowData;
        });

        // Create DataTable component
        const tableComponent: UIComponent = {
          type: 'ui_component',
          component: 'data_table',
          data: {
            columns,
            rows: tableRows,
            searchable: true,
            sortable: true,
            pagination: tableRows.length > 10,
            currency: 'MYR' // Default currency
          } as DataTableData,
          metadata: {
            title: 'Data Table',
            interactive: true,
            description: 'Interactive table generated from markdown'
          }
        };

        components.push(tableComponent);

        // Remove the markdown table from content
        cleanedContent = cleanedContent.replace(match[0], '').trim();
      }
    } catch (error) {
      console.warn('Failed to parse markdown table:', error);
      // Continue processing other tables
    }
  }

  return { components, cleanedContent };
}

/**
 * Parse markdown headers and convert them to SectionHeader UI components
 */
function parseMarkdownHeaders(content: string): { components: UIComponent[], cleanedContent: string } {
  const components: UIComponent[] = [];
  let cleanedContent = content;

  // Reset regex lastIndex to ensure proper matching
  MARKDOWN_HEADER_REGEX.lastIndex = 0;

  const matches = Array.from(content.matchAll(MARKDOWN_HEADER_REGEX));

  for (const match of matches) {
    try {
      const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const title = match[2].trim();

      // Skip if title is empty
      if (!title) continue;

      // Check if this is a standalone section header that might be duplicated
      const standaloneHeaders = [
        'Financial Analysis Summary',
        'Spending Overview',
        'Transaction Breakdown',
        'Insights & Trends',
        'Recommendations',
        'Key Insights',
        'Summary',
        'Analysis'
      ];

      const isStandaloneHeader = standaloneHeaders.some(header =>
        title.toLowerCase().includes(header.toLowerCase()) && title.length < 60
      );

      // Create SectionHeader component
      const headerComponent: UIComponent = {
        type: 'ui_component',
        component: 'section_header',
        data: {
          title,
          level,
          variant: level === 1 ? 'primary' : 'default',
          divider: level <= 2,
          standalone: isStandaloneHeader
        } as SectionHeaderData,
        metadata: {
          title: `Section Header - ${title}`,
          interactive: false,
          description: `Level ${level} header${isStandaloneHeader ? ' (standalone)' : ''}`
        }
      };

      components.push(headerComponent);

      // Always remove the markdown header from content to prevent duplication
      cleanedContent = cleanedContent.replace(match[0], '').trim();
    } catch (error) {
      console.warn('Failed to parse markdown header:', error);
      // Continue processing other headers
    }
  }

  return { components, cleanedContent };
}

/**
 * Clean up redundant content patterns that might cause confusion
 */
function cleanupRedundantContent(content: string): string {
  let cleaned = content;

  // Remove standalone section headers that appear as plain text
  const redundantPatterns = [
    // Remove lines that are just section headers without content
    /^(Financial Analysis Summary|Spending Overview|Transaction Breakdown|Insights & Trends|Recommendations|Key Insights|Summary|Analysis):\s*$/gm,

    // Remove duplicate titles in quotes followed by section names
    /^"[^"]*"\s+(Chill Purchases|Chili Purchases|Analysis|Summary|Overview|Breakdown|Insights|Recommendations)\s*$/gm,

    // Remove standalone quoted titles that appear to be duplicated headers (but preserve those with meaningful content)
    /^"[^"]*"\s+(Chill Purchases|Chili Purchases|Analysis|Summary|Overview|Breakdown|Insights|Recommendations|Purchases)\s*$/gm,

    // Remove empty lines that follow removed headers
    /\n\s*\n\s*\n/g,

    // Remove trailing colons on standalone lines
    /^([A-Z][a-z\s&]+):\s*$/gm
  ];

  redundantPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, (match, group1) => {
      // For the last pattern, only remove if it's a known section header
      if (group1) {
        const knownHeaders = [
          'Financial Analysis Summary',
          'Spending Overview',
          'Transaction Breakdown',
          'Insights & Trends',
          'Recommendations',
          'Key Insights',
          'Summary',
          'Analysis'
        ];
        return knownHeaders.includes(group1) ? '' : match;
      }
      return '';
    });
  });

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/^\s+$/gm, '');

  return cleaned.trim();
}

/**
 * Parse LLM response content and extract UI components
 */
export function parseUIComponents(content: string): UIComponentParseResult {
  const components: UIComponent[] = [];
  const errors: string[] = [];
  let cleanedContent = content;

  try {
    // First, parse markdown tables and convert them to UI components
    const tableParseResult = parseMarkdownTables(cleanedContent);
    components.push(...tableParseResult.components);
    cleanedContent = tableParseResult.cleanedContent;

    // Then, parse markdown headers and convert them to UI components
    const headerParseResult = parseMarkdownHeaders(cleanedContent);
    components.push(...headerParseResult.components);
    cleanedContent = headerParseResult.cleanedContent;

    // Additional cleanup for redundant content patterns
    cleanedContent = cleanupRedundantContent(cleanedContent);

    // Finally, find all JSON blocks in the content
    const matches = Array.from(cleanedContent.matchAll(JSON_BLOCK_REGEX));

    for (const match of matches) {
      const jsonString = match[1].trim();
      
      try {
        // Parse JSON
        const jsonData = JSON.parse(jsonString);
        
        // Validate as UI component
        const validationResult = validateUIComponent(jsonData);
        
        if (validationResult.valid && validationResult.component) {
          components.push(validationResult.component);
          
          // Remove the JSON block from content
          cleanedContent = cleanedContent.replace(match[0], '').trim();
        } else {
          errors.push(`Invalid UI component: ${validationResult.errors.join(', ')}`);
        }
      } catch (parseError) {
        errors.push(`JSON parse error: ${parseError.message}`);
      }
    }

    return {
      success: components.length > 0 || errors.length === 0,
      components,
      cleanedContent,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    return {
      success: false,
      components: [],
      cleanedContent: content,
      errors: [`Parser error: ${error.message}`],
    };
  }
}

/**
 * Enhanced parsing with configuration options
 */
export interface ParseOptions {
  parseMarkdownTables?: boolean;
  parseMarkdownHeaders?: boolean;
  parseJsonBlocks?: boolean;
  defaultCurrency?: string;
  tableRowLimit?: number;
}

export function parseUIComponentsWithOptions(
  content: string,
  options: ParseOptions = {}
): UIComponentParseResult {
  const {
    parseMarkdownTables = true,
    parseMarkdownHeaders = true,
    parseJsonBlocks = true,
    defaultCurrency = 'MYR',
    tableRowLimit = 100
  } = options;

  // Performance optimization: Early return for empty content
  if (!content || content.trim().length === 0) {
    return {
      success: true,
      components: [],
      cleanedContent: '',
      errors: undefined,
    };
  }

  // Performance optimization: Skip processing if content is too large
  const MAX_CONTENT_LENGTH = 50000; // 50KB limit
  if (content.length > MAX_CONTENT_LENGTH) {
    console.warn(`Content too large for parsing: ${content.length} characters. Limit: ${MAX_CONTENT_LENGTH}`);
    return {
      success: false,
      components: [],
      cleanedContent: content,
      errors: ['Content too large for processing'],
    };
  }

  const components: UIComponent[] = [];
  const errors: string[] = [];
  let cleanedContent = content;

  try {
    // Parse markdown tables if enabled
    if (parseMarkdownTables) {
      const tableParseResult = parseMarkdownTables(cleanedContent);
      // Apply row limit to tables with performance optimization
      const limitedTableComponents = tableParseResult.components.map(comp => {
        if (comp.component === 'data_table') {
          const tableData = comp.data as DataTableData;
          if (tableData.rows.length > tableRowLimit) {
            // Performance optimization: Use more efficient slicing for large tables
            const truncatedRows = tableData.rows.length > 1000
              ? tableData.rows.slice(0, tableRowLimit)
              : tableData.rows.slice(0, tableRowLimit);

            return {
              ...comp,
              data: {
                ...tableData,
                rows: truncatedRows,
                pagination: true,
                virtualScrolling: tableData.rows.length > 50 // Enable virtualization for large tables
              },
              metadata: {
                ...comp.metadata,
                description: `Table truncated to ${tableRowLimit} rows (${tableData.rows.length} total)`,
                originalRowCount: tableData.rows.length,
                performanceOptimized: true
              }
            };
          }
        }
        return comp;
      });

      components.push(...limitedTableComponents);
      cleanedContent = tableParseResult.cleanedContent;
    }

    // Parse markdown headers if enabled
    if (parseMarkdownHeaders) {
      const headerParseResult = parseMarkdownHeaders(cleanedContent);
      components.push(...headerParseResult.components);
      cleanedContent = headerParseResult.cleanedContent;
    }

    // Parse JSON blocks if enabled
    if (parseJsonBlocks) {
      const matches = Array.from(cleanedContent.matchAll(JSON_BLOCK_REGEX));

      for (const match of matches) {
        const jsonString = match[1].trim();

        try {
          const jsonData = JSON.parse(jsonString);
          const validationResult = validateUIComponent(jsonData);

          if (validationResult.valid && validationResult.component) {
            components.push(validationResult.component);
            cleanedContent = cleanedContent.replace(match[0], '').trim();
          } else {
            errors.push(`Invalid UI component: ${validationResult.errors.join(', ')}`);
          }
        } catch (parseError) {
          errors.push(`JSON parse error: ${parseError.message}`);
        }
      }
    }

    return {
      success: components.length > 0 || errors.length === 0,
      components,
      cleanedContent,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    return {
      success: false,
      components: [],
      cleanedContent: content,
      errors: [`Enhanced parser error: ${error.message}`],
    };
  }
}

/**
 * Validate a UI component object
 */
export function validateUIComponent(data: any): ComponentValidationResult {
  try {
    // First validate the base structure
    const baseValidation = UIComponentSchema.safeParse(data);
    
    if (!baseValidation.success) {
      return {
        valid: false,
        errors: baseValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }

    const component = baseValidation.data;
    
    // Validate component-specific data
    const dataValidationResult = validateComponentData(component.component, component.data);
    
    if (!dataValidationResult.valid) {
      return dataValidationResult;
    }

    return {
      valid: true,
      component: component as UIComponent,
      errors: [],
    };

  } catch (error) {
    return {
      valid: false,
      errors: [`Validation error: ${error.message}`],
    };
  }
}

/**
 * Validate component-specific data based on component type
 */
function validateComponentData(componentType: UIComponentType, data: any): ComponentValidationResult {
  try {
    let schema;
    
    switch (componentType) {
      case 'receipt_card':
        schema = ReceiptCardDataSchema;
        break;
      case 'spending_chart':
        schema = SpendingChartDataSchema;
        break;
      case 'action_button':
        schema = ActionButtonDataSchema;
        break;
      case 'category_breakdown':
        schema = CategoryBreakdownDataSchema;
        break;
      case 'trend_chart':
        schema = TrendChartDataSchema;
        break;
      case 'merchant_summary':
        schema = MerchantSummaryDataSchema;
        break;
      case 'financial_insight':
        schema = FinancialInsightDataSchema;
        break;
      case 'data_table':
        schema = DataTableDataSchema;
        break;
      case 'bar_chart':
        schema = BarChartDataSchema;
        break;
      case 'pie_chart':
        schema = PieChartDataSchema;
        break;
      case 'summary_card':
        schema = SummaryCardDataSchema;
        break;
      default:
        return {
          valid: false,
          errors: [`Unknown component type: ${componentType}`],
        };
    }

    const validation = schema.safeParse(data);
    
    if (!validation.success) {
      return {
        valid: false,
        errors: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }

    return {
      valid: true,
      errors: [],
    };

  } catch (error) {
    return {
      valid: false,
      errors: [`Data validation error: ${error.message}`],
    };
  }
}

/**
 * Analyze content to detect markdown structures
 */
export function analyzeMarkdownContent(content: string): {
  hasMarkdownTables: boolean;
  hasMarkdownHeaders: boolean;
  tableCount: number;
  headerCount: number;
  headerLevels: number[];
} {
  const tableMatches = Array.from(content.matchAll(MARKDOWN_TABLE_REGEX));
  const headerMatches = Array.from(content.matchAll(MARKDOWN_HEADER_REGEX));

  return {
    hasMarkdownTables: tableMatches.length > 0,
    hasMarkdownHeaders: headerMatches.length > 0,
    tableCount: tableMatches.length,
    headerCount: headerMatches.length,
    headerLevels: headerMatches.map(match => match[1].length)
  };
}

/**
 * Extract table preview from markdown table
 */
export function extractTablePreview(content: string, maxRows: number = 3): {
  tables: Array<{
    headers: string[];
    rows: string[][];
    totalRows: number;
  }>;
} {
  const tables: Array<{
    headers: string[];
    rows: string[][];
    totalRows: number;
  }> = [];

  const matches = Array.from(content.matchAll(MARKDOWN_TABLE_REGEX));

  for (const match of matches) {
    try {
      const headerRow = match[1];
      const dataRows = match[2];

      const headers = headerRow.split('|')
        .map(h => h.trim())
        .filter(h => h.length > 0);

      const allRows = dataRows.split('\n')
        .filter(row => row.trim().length > 0)
        .map(row => {
          const cells = row.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);
          return cells;
        })
        .filter(row => row.length > 0);

      const previewRows = allRows.slice(0, maxRows);

      tables.push({
        headers,
        rows: previewRows,
        totalRows: allRows.length
      });
    } catch (error) {
      console.warn('Failed to extract table preview:', error);
    }
  }

  return { tables };
}

/**
 * Smart column type detection based on content analysis
 */
function detectColumnType(header: string, values: string[]): {
  type: 'text' | 'number' | 'currency' | 'date' | 'badge';
  align: 'left' | 'center' | 'right';
} {
  const headerLower = header.toLowerCase();

  // Check header keywords first
  if (headerLower.includes('amount') || headerLower.includes('total') ||
      headerLower.includes('price') || headerLower.includes('cost')) {
    return { type: 'currency', align: 'right' };
  }

  if (headerLower.includes('date') || headerLower.includes('time')) {
    return { type: 'date', align: 'left' };
  }

  if (headerLower.includes('category') || headerLower.includes('status') ||
      headerLower.includes('type') || headerLower.includes('tag')) {
    return { type: 'badge', align: 'center' };
  }

  if (headerLower.includes('count') || headerLower.includes('number') ||
      headerLower.includes('qty') || headerLower.includes('quantity')) {
    return { type: 'number', align: 'right' };
  }

  // Analyze content patterns
  const nonEmptyValues = values.filter(v => v && v.trim().length > 0);
  if (nonEmptyValues.length === 0) {
    return { type: 'text', align: 'left' };
  }

  // Check for currency patterns
  const currencyPattern = /^[A-Z]{3}\s*[\d,]+\.?\d*$|^[\d,]+\.?\d*\s*[A-Z]{3}$|^\$[\d,]+\.?\d*$|^[\d,]+\.?\d*$/;
  const currencyMatches = nonEmptyValues.filter(v => currencyPattern.test(v.trim()));
  if (currencyMatches.length > nonEmptyValues.length * 0.7) {
    return { type: 'currency', align: 'right' };
  }

  // Check for date patterns
  const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/;
  const dateMatches = nonEmptyValues.filter(v => datePattern.test(v.trim()));
  if (dateMatches.length > nonEmptyValues.length * 0.7) {
    return { type: 'date', align: 'left' };
  }

  // Check for number patterns
  const numberPattern = /^[\d,]+\.?\d*$/;
  const numberMatches = nonEmptyValues.filter(v => numberPattern.test(v.trim()));
  if (numberMatches.length > nonEmptyValues.length * 0.7) {
    return { type: 'number', align: 'right' };
  }

  // Check if values look like categories/tags (short, limited set)
  const uniqueValues = new Set(nonEmptyValues.map(v => v.trim().toLowerCase()));
  if (uniqueValues.size <= Math.max(3, nonEmptyValues.length * 0.3) &&
      nonEmptyValues.every(v => v.trim().length <= 20)) {
    return { type: 'badge', align: 'center' };
  }

  return { type: 'text', align: 'left' };
}

/**
 * Generate a sample UI component for testing
 */
export function generateSampleComponent(type: UIComponentType): UIComponent {
  const baseMetadata = {
    title: `Sample ${type.replace('_', ' ')}`,
    interactive: true,
  };

  switch (type) {
    case 'receipt_card':
      return {
        type: 'ui_component',
        component: 'receipt_card',
        data: {
          receipt_id: 'sample-123',
          merchant: 'Sample Restaurant',
          total: 25.50,
          currency: 'MYR',
          date: '2024-01-15',
          category: 'Food & Dining',
          confidence: 0.95,
        } as ReceiptCardData,
        metadata: { ...baseMetadata, actions: ['view_receipt', 'edit_receipt'] },
      };

    case 'action_button':
      return {
        type: 'ui_component',
        component: 'action_button',
        data: {
          action: 'upload_receipt',
          label: 'Upload New Receipt',
          variant: 'primary',
          icon: 'upload',
        } as ActionButtonData,
        metadata: baseMetadata,
      };

    case 'data_table':
      return {
        type: 'ui_component',
        component: 'data_table',
        data: {
          title: 'Recent Receipts',
          columns: [
            { key: 'merchant', label: 'Merchant', type: 'text', sortable: true },
            { key: 'total', label: 'Amount', type: 'currency', sortable: true, align: 'right' },
            { key: 'date', label: 'Date', type: 'date', sortable: true },
            { key: 'category', label: 'Category', type: 'badge' },
          ],
          rows: [
            { id: '1', merchant: 'Starbucks', total: 15.50, date: '2024-01-15', category: 'Food & Dining' },
            { id: '2', merchant: 'Shell', total: 45.00, date: '2024-01-14', category: 'Transportation' },
          ],
          searchable: true,
          sortable: true,
          pagination: true,
          currency: 'MYR',
        } as DataTableData,
        metadata: baseMetadata,
      };

    case 'bar_chart':
      return {
        type: 'ui_component',
        component: 'bar_chart',
        data: {
          title: 'Monthly Spending',
          data: [
            { label: 'Food', value: 450 },
            { label: 'Transport', value: 200 },
            { label: 'Shopping', value: 300 },
          ],
          currency: 'MYR',
          orientation: 'vertical',
          show_values: true,
          show_legend: true,
        } as BarChartData,
        metadata: baseMetadata,
      };

    case 'pie_chart':
      return {
        type: 'ui_component',
        component: 'pie_chart',
        data: {
          title: 'Spending by Category',
          data: [
            { label: 'Food & Dining', value: 450, percentage: 47.4 },
            { label: 'Transportation', value: 200, percentage: 21.1 },
            { label: 'Shopping', value: 300, percentage: 31.6 },
          ],
          currency: 'MYR',
          show_legend: true,
          show_percentages: true,
          show_values: true,
        } as PieChartData,
        metadata: baseMetadata,
      };

    case 'summary_card':
      return {
        type: 'ui_component',
        component: 'summary_card',
        data: {
          title: 'Total Spending',
          value: 1250.50,
          currency: 'MYR',
          trend: {
            direction: 'up',
            percentage: 12.5,
            period: 'last month',
          },
          icon: 'dollar-sign',
          color: 'primary',
        } as SummaryCardData,
        metadata: baseMetadata,
      };

    default:
      throw new Error(`Sample generation not implemented for ${type}`);
  }
}
