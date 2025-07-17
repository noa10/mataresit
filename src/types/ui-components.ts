/**
 * UI Component Types for Actionable Chat Interface
 * 
 * This module defines the type system for interactive UI components
 * that can be embedded in LLM responses and rendered in the chat interface.
 */

// Base UI Component Interface
export interface UIComponent {
  type: 'ui_component';
  component: UIComponentType;
  data: UIComponentData;
  metadata: UIComponentMetadata;
}

// Supported UI Component Types
export type UIComponentType =
  | 'receipt_card'
  | 'line_item_card'
  | 'spending_chart'
  | 'action_button'
  | 'category_breakdown'
  | 'trend_chart'
  | 'merchant_summary'
  | 'financial_insight'
  | 'data_table'
  | 'bar_chart'
  | 'pie_chart'
  | 'summary_card'
  | 'section_header';

// Component Metadata
export interface UIComponentMetadata {
  title: string;
  description?: string;
  interactive: boolean;
  actions?: string[];
  priority?: 'high' | 'medium' | 'low';
}

// Union type for all component data types
export type UIComponentData =
  | ReceiptCardData
  | LineItemCardData
  | SpendingChartData
  | ActionButtonData
  | CategoryBreakdownData
  | TrendChartData
  | MerchantSummaryData
  | FinancialInsightData
  | DataTableData
  | BarChartData
  | PieChartData
  | SummaryCardData
  | SectionHeaderData;

// Receipt Card Component Data
export interface ReceiptCardData {
  receipt_id: string;
  merchant: string;
  total: number;
  currency: string;
  date: string;
  category?: string;
  confidence?: number;
  thumbnail_url?: string;
  line_items_count?: number;
  tags?: string[];
}

// Line Item Card Component Data
export interface LineItemCardData {
  line_item_id: string;
  receipt_id?: string;
  description: string;
  amount: number;
  currency: string;
  merchant: string;
  date: string;
  confidence?: number;
  quantity?: number;
}

// Spending Chart Component Data
export interface SpendingChartData {
  chart_type: 'pie' | 'bar' | 'line' | 'doughnut';
  categories: CategorySpending[];
  total_amount: number;
  currency: string;
  period: string;
  comparison_period?: string;
  growth_rate?: number;
}

export interface CategorySpending {
  name: string;
  amount: number;
  percentage: number;
  color?: string;
  transaction_count?: number;
}

// Action Button Component Data
export interface ActionButtonData {
  action: ActionType;
  label: string;
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  icon?: string;
  url?: string;
  params?: Record<string, any>;
}

export type ActionType = 
  | 'upload_receipt'
  | 'create_claim'
  | 'view_analytics'
  | 'export_data'
  | 'filter_results'
  | 'view_receipt'
  | 'edit_receipt'
  | 'categorize_receipt'
  | 'create_report';

// Category Breakdown Component Data
export interface CategoryBreakdownData {
  categories: CategoryDetail[];
  total_amount: number;
  currency: string;
  period: string;
  top_category: string;
  insights?: string[];
}

export interface CategoryDetail {
  name: string;
  amount: number;
  percentage: number;
  transaction_count: number;
  average_transaction: number;
  trend: 'up' | 'down' | 'stable';
  trend_percentage?: number;
  color?: string;
}

// Trend Chart Component Data
export interface TrendChartData {
  chart_type: 'line' | 'area' | 'bar';
  data_points: TrendDataPoint[];
  currency: string;
  period: string;
  trend_direction: 'up' | 'down' | 'stable';
  trend_percentage: number;
  insights?: string[];
}

export interface TrendDataPoint {
  date: string;
  amount: number;
  label?: string;
  category?: string;
}

// Merchant Summary Component Data
export interface MerchantSummaryData {
  merchant_name: string;
  total_spent: number;
  currency: string;
  visit_count: number;
  average_transaction: number;
  first_visit: string;
  last_visit: string;
  favorite_items?: string[];
  spending_trend: 'up' | 'down' | 'stable';
  loyalty_status?: string;
}

// Financial Insight Component Data
export interface FinancialInsightData {
  insight_type: 'spending_pattern' | 'budget_alert' | 'savings_opportunity' | 'anomaly_detection';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  amount?: number;
  currency?: string;
  recommendations?: string[];
  action_items?: ActionButtonData[];
}

// Parser Result Interface
export interface UIComponentParseResult {
  success: boolean;
  components: UIComponent[];
  cleanedContent: string;
  errors?: string[];
}

// Component Validation Result
export interface ComponentValidationResult {
  valid: boolean;
  component?: UIComponent;
  errors: string[];
}

// Component Rendering Props
export interface UIComponentProps {
  component: UIComponent;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

// Data Table Component Data
export interface DataTableData {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  title?: string;
  subtitle?: string;
  searchable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  total_rows?: number;
  currency?: string;
  // Enhanced features
  filterable?: boolean;
  exportable?: boolean;
  selectable?: boolean;
  compact?: boolean;
}

export interface DataTableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'badge' | 'action' | 'boolean' | 'email' | 'url';
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  // Enhanced properties
  hidden?: boolean;
  resizable?: boolean;
  description?: string;
}

export interface DataTableRow {
  id: string;
  [key: string]: any;
}

// Bar Chart Component Data
export interface BarChartData {
  title?: string;
  subtitle?: string;
  data: BarChartDataPoint[];
  x_axis_label?: string;
  y_axis_label?: string;
  currency?: string;
  orientation?: 'horizontal' | 'vertical';
  color_scheme?: string[];
  show_values?: boolean;
  show_legend?: boolean;
}

export interface BarChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>;
}

// Pie Chart Component Data
export interface PieChartData {
  title?: string;
  subtitle?: string;
  data: PieChartDataPoint[];
  currency?: string;
  show_legend?: boolean;
  show_percentages?: boolean;
  show_values?: boolean;
  color_scheme?: string[];
  center_total?: boolean;
}

export interface PieChartDataPoint {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
  metadata?: Record<string, any>;
}

// Summary Card Component Data
export interface SummaryCardData {
  title: string;
  value: string | number;
  subtitle?: string;
  currency?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  icon?: string;
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  actions?: ActionButtonData[];
  metadata?: Record<string, any>;
}

// Section Header Component Data
export interface SectionHeaderData {
  title: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  subtitle?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  icon?: string;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  divider?: boolean;
  anchor?: string;
  standalone?: boolean; // Indicates if this is a standalone header that might be duplicated
}
