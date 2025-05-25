
export interface OCRResult {
  merchant: string;
  date: string;
  total: number;
  tax?: number;
  currency?: string;
  items?: Array<{
    description: string;
    amount: number;
    quantity?: number;
  }>;
  paymentMethod?: string;
  rawText?: string;
  confidence_scores?: {
    overall: number;
    merchant: number;
    date: number;
    total: number;
    tax?: number;
  };
}

export interface ProcessingResult {
  success: boolean;
  data?: OCRResult;
  error?: string;
  processingTime?: number;
  method?: string;
  model?: string;
}

export interface ProcessingOptions {
  method: 'ocr-ai' | 'ai-vision';
  model: string;
  skipEmbeddings?: boolean;
}
