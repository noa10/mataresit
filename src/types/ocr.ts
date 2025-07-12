// AI processing result interface for receipt data extraction
export interface AIResult {
  merchant: string;
  date: string | null; // Allow null for invalid dates
  total: number;
  tax?: number;
  currency?: string;
  payment_method?: string;
  fullText?: string;
  ai_suggestions?: Record<string, any>;
  predicted_category?: string;
  line_items?: Array<{
    description: string;
    amount: number;
  }>;
  processing_time?: number;
  modelUsed?: string;
  confidence_scores?: Record<string, number>;
}