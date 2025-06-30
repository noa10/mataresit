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
  SummaryCardData
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
    'receipt_card', 'spending_chart', 'action_button', 'category_breakdown',
    'trend_chart', 'merchant_summary', 'financial_insight', 'data_table',
    'bar_chart', 'pie_chart', 'summary_card'
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
 * Parse LLM response content and extract UI components
 */
export function parseUIComponents(content: string): UIComponentParseResult {
  const components: UIComponent[] = [];
  const errors: string[] = [];
  let cleanedContent = content;

  try {
    // Find all JSON blocks in the content
    const matches = Array.from(content.matchAll(JSON_BLOCK_REGEX));

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
