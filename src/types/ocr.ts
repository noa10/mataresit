// OCR result interface
export interface OCRResult {
  merchant: string;
  date: string;
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
  alternativeResult?: OCRResult;
  discrepancies?: Array<{
    field: string;
    primaryValue: any;
    alternativeValue: any;
  }>;
  modelUsed?: string;
  primaryMethod?: 'ocr-ai' | 'ai-vision';
} 