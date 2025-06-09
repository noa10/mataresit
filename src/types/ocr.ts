// AI processing result interface (simplified from OCR)
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

// Backward compatibility alias
/** @deprecated Use AIResult instead */
export interface OCRResult extends AIResult {
  alternativeResult?: OCRResult;
  discrepancies?: Array<{
    field: string;
    primaryValue: any;
    alternativeValue: any;
  }>;
  primaryMethod?: 'ai-vision';
}